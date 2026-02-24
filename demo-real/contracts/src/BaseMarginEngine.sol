// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./BaseVault.sol";
import "./interfaces/IPriceOracle.sol";

/// @title BaseMarginEngine – leveraged trading on Base mainnet using BaseVault
/// @notice Users open leveraged positions (2-5x) with USDC collateral. Vault lends the borrowed portion.
///         PnL settlement is oracle-driven (no user-supplied settlement prices).
contract BaseMarginEngine is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────

    struct Position {
        address owner;
        uint256 collateral;       // USDC deposited by user (after fee)
        uint256 borrowed;         // USDC borrowed from vault
        uint256 notional;         // collateral_input * leverage
        uint256 entryPriceMock;   // entry price from oracle (6 decimals)
        uint256 leverage;
        bool    isLong;
        bytes32 marketId;
        uint256 openTimestamp;
        bool    isOpen;
    }

    // ─── State ───────────────────────────────────────────────────────

    IERC20    public immutable usdc;
    BaseVault public vault;
    IPriceOracle public priceOracle;

    uint256 public nextPositionId;
    mapping(uint256 => Position)     public positions;
    mapping(address => uint256[])    public userPositions;
    mapping(address => uint256)      public walletBorrowed; // track per-wallet borrowed

    // Open fee: 0.15% of notional (bps)
    uint256 public openFeeBps = 15;
    // Open fee split (sum = 10000): 30% LP / 40% insurance / 30% protocol
    uint256 public openFeeLpBps        = 3000;
    uint256 public openFeeInsuranceBps = 4000;
    uint256 public openFeeProtocolBps  = 3000;

    // Borrow APR kink model (bps): base 5%, slope1 15%, slope2 60%, kink 70%
    uint256 public baseRateBps = 500;
    uint256 public slope1Bps   = 1500;
    uint256 public slope2Bps   = 6000;
    uint256 public kinkBps     = 7000;

    // Maintenance margin: 10% of notional
    uint256 public maintenanceMarginBps = 1000;

    // Liquidation penalty: 1% of remaining
    uint256 public liquidationPenaltyBps = 100;
    uint256 public liqKeeperBps    = 5000; // 50%
    uint256 public liqInsuranceBps = 4000; // 40%
    uint256 public liqProtocolBps  = 1000; // 10%

    // Leverage: 2-5x
    uint256 public constant MIN_LEVERAGE = 2;
    uint256 public constant MAX_LEVERAGE = 5;

    // Price decimals (6 decimals: 1_000_000 = $1.00)
    uint256 public constant PRICE_DECIMALS = 1e6;

    // ─── Events ──────────────────────────────────────────────────────

    event PositionOpened(
        uint256 indexed positionId, address indexed owner,
        uint256 collateral, uint256 borrowed, uint256 notional,
        uint256 leverage, bool isLong, bytes32 marketId, uint256 entryPriceMock, uint256 openFee
    );
    event PositionClosed(
        uint256 indexed positionId, address indexed owner,
        uint256 exitPriceMock, int256 pnl, uint256 interest, uint256 returnedToUser
    );
    event PositionLiquidated(
        uint256 indexed positionId, address indexed liquidator,
        uint256 penalty, uint256 keeperReward
    );

    // ─── Constructor ─────────────────────────────────────────────────

    constructor(address _usdc, address _vault, address _priceOracle) Ownable(msg.sender) {
        require(_usdc != address(0) && _vault != address(0) && _priceOracle != address(0), "BME: zero address");
        usdc  = IERC20(_usdc);
        vault = BaseVault(_vault);
        priceOracle = IPriceOracle(_priceOracle);
    }

    // ─── Admin ───────────────────────────────────────────────────────

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setOpenFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= 100, "BME: max 1%");
        openFeeBps = _bps;
    }

    function setRateModel(uint256 _base, uint256 _s1, uint256 _s2, uint256 _kink) external onlyOwner {
        require(_base <= 2000 && _s1 <= 5000 && _s2 <= 10000 && _kink <= 9500, "BME: OOB");
        baseRateBps = _base;
        slope1Bps   = _s1;
        slope2Bps   = _s2;
        kinkBps     = _kink;
    }

    function setMaintenanceMargin(uint256 _bps) external onlyOwner {
        require(_bps >= 100 && _bps <= 2000, "BME: OOB");
        maintenanceMarginBps = _bps;
    }

    function setPriceOracle(address _priceOracle) external onlyOwner {
        require(_priceOracle != address(0), "BME: zero oracle");
        priceOracle = IPriceOracle(_priceOracle);
    }

    /// @notice Withdraw excess USDC from the contract (e.g. leftover from negative PnL).
    /// @param to Recipient address.
    /// @param amount Amount to send (use 0 to send full balance).
    function sweep(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "BME: zero to");
        uint256 bal = usdc.balanceOf(address(this));
        if (amount == 0) amount = bal;
        require(amount > 0 && amount <= bal, "BME: bad amount");
        usdc.safeTransfer(to, amount);
    }

    // ─── View helpers ────────────────────────────────────────────────

    /// @notice Borrow APR based on vault utilization (kink model, returns bps).
    function borrowAPR() public view returns (uint256) {
        uint256 util = vault.utilization();
        if (util <= kinkBps) {
            return baseRateBps + (slope1Bps * util) / kinkBps;
        } else {
            uint256 normalRate = baseRateBps + slope1Bps;
            uint256 excessUtil = util - kinkBps;
            uint256 excessMax  = 10000 - kinkBps;
            return normalRate + (slope2Bps * excessUtil) / excessMax;
        }
    }

    /// @notice Calculate interest owed on a borrow.
    function calculateInterest(uint256 borrowed, uint256 openTimestamp) public view returns (uint256) {
        if (borrowed == 0) return 0;
        uint256 duration = block.timestamp - openTimestamp;
        uint256 aprBps = borrowAPR();
        return (borrowed * aprBps * duration) / (365.25 days * 10000);
    }

    function getMarketOraclePrice(bytes32 marketId) public view returns (uint256) {
        (uint256 yesPriceE6,, bool valid) = priceOracle.getYesPriceE6(marketId);
        require(valid, "BME: invalid oracle");
        require(yesPriceE6 > 0 && yesPriceE6 <= PRICE_DECIMALS, "BME: bad oracle price");
        return yesPriceE6;
    }

    function getPositionOraclePrice(uint256 positionId) external view returns (uint256) {
        Position storage pos = positions[positionId];
        require(pos.owner != address(0), "BME: bad position");
        uint256 yesPrice = getMarketOraclePrice(pos.marketId);
        return pos.isLong ? yesPrice : PRICE_DECIMALS - yesPrice;
    }

    /// @notice Check liquidation: equity < maintenance requirement, using current oracle price.
    function isLiquidatable(uint256 positionId) public view returns (bool) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) return false;

        uint256 yesPrice = getMarketOraclePrice(pos.marketId);
        uint256 currentPriceMock = pos.isLong ? yesPrice : PRICE_DECIMALS - yesPrice;
        int256 pnl = _calculatePnL(pos, currentPriceMock);
        uint256 interest = calculateInterest(pos.borrowed, pos.openTimestamp);
        int256 equity = int256(pos.collateral) + pnl - int256(interest);
        int256 maintenanceReq = int256((pos.notional * maintenanceMarginBps) / 10000);

        return equity < maintenanceReq;
    }

    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    // ─── Core: Open Position ─────────────────────────────────────────

    /// @notice Open a leveraged position with real USDC collateral on Base.
    /// @param collateralAmount USDC collateral from user (6 decimals)
    /// @param leverage         2-5x multiplier
    /// @param isLong           true = LONG, false = SHORT
    /// @param marketId         market identifier used by oracle router.
    function openPosition(
        uint256 collateralAmount,
        uint256 leverage,
        bool    isLong,
        bytes32 marketId
    ) external nonReentrant whenNotPaused returns (uint256 positionId) {
        require(collateralAmount > 0, "BME: zero collateral");
        require(leverage >= MIN_LEVERAGE && leverage <= MAX_LEVERAGE, "BME: leverage 2-5x");
        require(marketId != bytes32(0), "BME: zero marketId");

        uint256 yesPrice = getMarketOraclePrice(marketId);
        uint256 entryPriceMock = isLong ? yesPrice : PRICE_DECIMALS - yesPrice;
        require(entryPriceMock > 0, "BME: zero entry");

        uint256 notional = collateralAmount * leverage;
        uint256 borrowed = notional - collateralAmount;

        // 1. Pull collateral from user
        usdc.safeTransferFrom(msg.sender, address(this), collateralAmount);

        // 2. Borrow from vault (vault enforces caps)
        if (borrowed > 0) {
            vault.lendToMarginEngine(borrowed, msg.sender, 0, walletBorrowed[msg.sender]);
            walletBorrowed[msg.sender] += borrowed;
        }

        // 3. Open fee: 0.15% of notional → split to vault buckets
        uint256 openFee = (notional * openFeeBps) / 10000;
        if (openFee > 0) {
            uint256 lpFee    = (openFee * openFeeLpBps) / 10000;
            uint256 insFee   = (openFee * openFeeInsuranceBps) / 10000;
            uint256 protoFee = openFee - lpFee - insFee;
            usdc.approve(address(vault), lpFee + insFee + protoFee);
            vault.creditFees(lpFee, insFee, protoFee);
        }

        uint256 effectiveCollateral = collateralAmount - openFee;

        // 4. Store position
        positionId = nextPositionId++;
        positions[positionId] = Position({
            owner:          msg.sender,
            collateral:     effectiveCollateral,
            borrowed:       borrowed,
            notional:       notional,
            entryPriceMock: entryPriceMock,
            leverage:       leverage,
            isLong:         isLong,
            marketId:       marketId,
            openTimestamp:  block.timestamp,
            isOpen:         true
        });
        userPositions[msg.sender].push(positionId);

        emit PositionOpened(
            positionId, msg.sender, effectiveCollateral, borrowed,
            notional, leverage, isLong, marketId, entryPriceMock, openFee
        );
    }

    // ─── Core: Close Position ────────────────────────────────────────

    /// @notice Close your position using oracle-backed exit price.
    function closePosition(uint256 positionId) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "BME: not open");
        require(pos.owner == msg.sender, "BME: not owner");

        uint256 yesPrice = getMarketOraclePrice(pos.marketId);
        uint256 exitPriceMock = pos.isLong ? yesPrice : PRICE_DECIMALS - yesPrice;
        require(exitPriceMock > 0, "BME: zero exit");

        pos.isOpen = false;

        int256 pnl = _calculatePnL(pos, exitPriceMock);
        uint256 interest = calculateInterest(pos.borrowed, pos.openTimestamp);

        // Repay vault: principal + interest
        if (pos.borrowed > 0 || interest > 0) {
            uint256 repayTotal = pos.borrowed + interest;
            usdc.approve(address(vault), repayTotal);
            vault.repayFromMarginEngine(pos.borrowed, interest);
        }

        // Reduce wallet borrowed tracking
        if (pos.borrowed > 0) {
            walletBorrowed[pos.owner] = walletBorrowed[pos.owner] >= pos.borrowed
                ? walletBorrowed[pos.owner] - pos.borrowed
                : 0;
        }

        // User return: collateral + PnL - interest (floored at 0).
        int256 equity = int256(pos.collateral) + pnl - int256(interest);
        uint256 returnAmount = equity > 0 ? uint256(equity) : 0;
        uint256 bal = usdc.balanceOf(address(this));
        if (returnAmount > bal) returnAmount = bal;
        if (returnAmount > 0) {
            usdc.safeTransfer(pos.owner, returnAmount);
        }

        emit PositionClosed(positionId, pos.owner, exitPriceMock, pnl, interest, returnAmount);
    }

    // ─── Core: Liquidate ─────────────────────────────────────────────

    /// @notice Liquidate undercollateralized position (equity < maintenance requirement).
    function liquidate(uint256 positionId) external nonReentrant whenNotPaused {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "BME: not open");

        uint256 yesPrice = getMarketOraclePrice(pos.marketId);
        uint256 currentPriceMock = pos.isLong ? yesPrice : PRICE_DECIMALS - yesPrice;
        require(isLiquidatable(positionId), "BME: not liquidatable");

        pos.isOpen = false;

        int256 pnl = _calculatePnL(pos, currentPriceMock);
        uint256 interest = calculateInterest(pos.borrowed, pos.openTimestamp);

        // Repay vault
        if (pos.borrowed > 0 || interest > 0) {
            uint256 repayTotal = pos.borrowed + interest;
            uint256 bal = usdc.balanceOf(address(this));
            if (repayTotal > bal) {
                usdc.approve(address(vault), bal);
                vault.repayFromMarginEngine(bal > pos.borrowed ? pos.borrowed : bal, bal > pos.borrowed ? bal - pos.borrowed : 0);
            } else {
                usdc.approve(address(vault), repayTotal);
                vault.repayFromMarginEngine(pos.borrowed, interest);
            }
        }

        // Reduce wallet borrowed
        if (pos.borrowed > 0) {
            walletBorrowed[pos.owner] = walletBorrowed[pos.owner] >= pos.borrowed
                ? walletBorrowed[pos.owner] - pos.borrowed
                : 0;
        }

        int256 equity = int256(pos.collateral) + pnl - int256(interest);
        uint256 remaining = equity > 0 ? uint256(equity) : 0;

        uint256 penalty = (remaining * liquidationPenaltyBps) / 10000;
        if (penalty > remaining) penalty = remaining;

        if (penalty > 0) {
            uint256 keeperReward = (penalty * liqKeeperBps) / 10000;
            uint256 insPortion   = (penalty * liqInsuranceBps) / 10000;
            uint256 protoPortion = penalty - keeperReward - insPortion;

            if (keeperReward > 0) usdc.safeTransfer(msg.sender, keeperReward);
            if (insPortion + protoPortion > 0) {
                usdc.approve(address(vault), insPortion + protoPortion);
                vault.creditFees(0, insPortion, protoPortion);
            }

            emit PositionLiquidated(positionId, msg.sender, penalty, keeperReward);
        }

        uint256 ownerReturn = remaining - penalty;
        if (ownerReturn > 0) {
            uint256 bal = usdc.balanceOf(address(this));
            if (ownerReturn > bal) ownerReturn = bal;
            usdc.safeTransfer(pos.owner, ownerReturn);
        }
    }

    // ─── Internal ────────────────────────────────────────────────────

    /// @dev PnL: LONG = notional * (exit-entry)/entry, SHORT = notional * (entry-exit)/entry
    function _calculatePnL(Position storage pos, uint256 exitPriceMock) internal view returns (int256) {
        if (pos.entryPriceMock == 0) return 0;
        int256 priceDiff;
        if (pos.isLong) {
            priceDiff = int256(exitPriceMock) - int256(pos.entryPriceMock);
        } else {
            priceDiff = int256(pos.entryPriceMock) - int256(exitPriceMock);
        }
        return (int256(pos.notional) * priceDiff) / int256(pos.entryPriceMock);
    }
}
