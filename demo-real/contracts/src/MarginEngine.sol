// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./Vault.sol";

/// @title LM Protocol MarginEngine
/// @notice Manages leveraged positions with real USDC collateral + vault borrowing
/// @dev PnL uses mock prices; all USDC transfers are real onchain
contract MarginEngine is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────

    enum Direction { LONG, SHORT }

    struct Position {
        address owner;
        uint256 collateral;       // USDC deposited by user
        uint256 borrowed;         // USDC borrowed from vault
        uint256 notional;         // collateral * leverage
        uint256 entryPriceMock;   // mock entry price (6 decimals, e.g. 600000 = $0.60)
        uint256 leverage;         // 2-10
        Direction direction;
        uint256 openTimestamp;
        bool isOpen;
    }

    // ─── State ───────────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    Vault public vault;

    uint256 public nextPositionId;
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public userPositions;

    // Open fee: bps on notional
    uint256 public openFeeBps = 15; // 0.15%
    // Open fee split (must sum to 10000)
    uint256 public openFeeLpBps        = 3000;  // 30%
    uint256 public openFeeInsuranceBps = 4000;  // 40%
    uint256 public openFeeProtocolBps  = 3000;  // 30%

    // Borrow APR: kink model parameters (in bps, i.e. 500 = 5%)
    uint256 public baseRateBps  = 500;    // 5%
    uint256 public slope1Bps    = 1500;   // 15%
    uint256 public slope2Bps    = 6000;   // 60%
    uint256 public kinkBps      = 7000;   // 70% utilization kink

    // Maintenance margin (bps of notional)
    uint256 public maintenanceMarginBps = 500; // 5%

    // Liquidation penalty (bps of remaining collateral)
    uint256 public liquidationPenaltyBps = 100; // 1%
    // Liquidation penalty split (must sum to 10000)
    uint256 public liqKeeperBps    = 5000;  // 50%
    uint256 public liqInsuranceBps = 4000;  // 40%
    uint256 public liqProtocolBps  = 1000;  // 10%

    // Leverage bounds
    uint256 public constant MIN_LEVERAGE = 2;
    uint256 public constant MAX_LEVERAGE = 10;

    // Price decimals (6 decimals: 1_000_000 = $1.00)
    uint256 public constant PRICE_DECIMALS = 1e6;

    // ─── Events ──────────────────────────────────────────────────────────

    event PositionOpened(
        uint256 indexed positionId,
        address indexed owner,
        uint256 collateral,
        uint256 borrowed,
        uint256 notional,
        uint256 leverage,
        Direction direction,
        uint256 entryPriceMock,
        uint256 openFee
    );

    event PositionClosed(
        uint256 indexed positionId,
        address indexed owner,
        uint256 exitPriceMock,
        int256 pnl,
        uint256 interest,
        uint256 returnedToUser
    );

    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed liquidator,
        uint256 penalty,
        uint256 keeperReward
    );

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor(address _usdc, address _vault) Ownable(msg.sender) {
        require(_usdc != address(0) && _vault != address(0), "ME: zero address");
        usdc = IERC20(_usdc);
        vault = Vault(_vault);
    }

    // ─── Admin ───────────────────────────────────────────────────────────

    function setOpenFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= 100, "ME: fee too high"); // max 1%
        openFeeBps = _bps;
    }

    function setOpenFeeSplit(uint256 _lp, uint256 _ins, uint256 _proto) external onlyOwner {
        require(_lp + _ins + _proto == 10000, "ME: must sum to 10000");
        openFeeLpBps = _lp;
        openFeeInsuranceBps = _ins;
        openFeeProtocolBps = _proto;
    }

    function setRateModel(uint256 _base, uint256 _s1, uint256 _s2, uint256 _kink) external onlyOwner {
        require(_base <= 2000 && _s1 <= 5000 && _s2 <= 10000 && _kink <= 9500, "ME: params OOB");
        baseRateBps = _base;
        slope1Bps = _s1;
        slope2Bps = _s2;
        kinkBps = _kink;
    }

    function setMaintenanceMargin(uint256 _bps) external onlyOwner {
        require(_bps >= 100 && _bps <= 2000, "ME: OOB");
        maintenanceMarginBps = _bps;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── View helpers ────────────────────────────────────────────────────

    /// @notice Calculate borrow APR based on vault utilization (kink model)
    function borrowAPR() public view returns (uint256) {
        uint256 util = vault.utilization(); // bps
        if (util <= kinkBps) {
            return baseRateBps + (slope1Bps * util) / kinkBps;
        } else {
            uint256 normalRate = baseRateBps + slope1Bps;
            uint256 excessUtil = util - kinkBps;
            uint256 excessMax = 10000 - kinkBps;
            return normalRate + (slope2Bps * excessUtil) / excessMax;
        }
    }

    /// @notice Calculate interest for a position based on duration
    function calculateInterest(uint256 borrowed, uint256 openTimestamp) public view returns (uint256) {
        if (borrowed == 0) return 0;
        uint256 duration = block.timestamp - openTimestamp;
        uint256 aprBps = borrowAPR();
        // interest = borrowed * apr * duration / (365.25 days * 10000)
        return (borrowed * aprBps * duration) / (365.25 days * 10000);
    }

    /// @notice Check if a position is below maintenance margin
    function isLiquidatable(uint256 positionId, uint256 currentPriceMock) public view returns (bool) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) return false;

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

    // ─── Core: Open Position ─────────────────────────────────────────────

    /// @notice Open a leveraged position with real USDC collateral
    /// @param collateralAmount USDC collateral from user
    /// @param leverage Leverage multiplier (2-10)
    /// @param direction LONG (0) or SHORT (1)
    /// @param entryPriceMock Mock entry price (6 decimals)
    function openPosition(
        uint256 collateralAmount,
        uint256 leverage,
        Direction direction,
        uint256 entryPriceMock
    ) external nonReentrant whenNotPaused returns (uint256 positionId) {
        require(collateralAmount > 0, "ME: zero collateral");
        require(leverage >= MIN_LEVERAGE && leverage <= MAX_LEVERAGE, "ME: invalid leverage");
        require(entryPriceMock > 0, "ME: zero price");

        uint256 notional = collateralAmount * leverage;
        uint256 borrowed = notional - collateralAmount;

        // 1. Pull collateral from user
        usdc.safeTransferFrom(msg.sender, address(this), collateralAmount);

        // 2. Borrow from vault
        if (borrowed > 0) {
            vault.lendToMarginEngine(borrowed);
        }

        // 3. Calculate and distribute open fee
        uint256 openFee = (notional * openFeeBps) / 10000;
        if (openFee > 0) {
            uint256 lpFee = (openFee * openFeeLpBps) / 10000;
            uint256 insFee = (openFee * openFeeInsuranceBps) / 10000;
            uint256 protoFee = openFee - lpFee - insFee;

            // Approve vault to pull fees
            usdc.approve(address(vault), lpFee + insFee + protoFee);
            vault.creditFees(lpFee, insFee, protoFee);
        }

        // Adjust collateral after fee
        uint256 effectiveCollateral = collateralAmount - openFee;

        // 4. Store position
        positionId = nextPositionId++;
        positions[positionId] = Position({
            owner: msg.sender,
            collateral: effectiveCollateral,
            borrowed: borrowed,
            notional: notional,
            entryPriceMock: entryPriceMock,
            leverage: leverage,
            direction: direction,
            openTimestamp: block.timestamp,
            isOpen: true
        });
        userPositions[msg.sender].push(positionId);

        emit PositionOpened(
            positionId, msg.sender, effectiveCollateral, borrowed,
            notional, leverage, direction, entryPriceMock, openFee
        );
    }

    // ─── Core: Close Position ────────────────────────────────────────────

    /// @notice Close a position with a mock exit price
    /// @param positionId The position to close
    /// @param exitPriceMock Mock exit price (6 decimals)
    function closePosition(uint256 positionId, uint256 exitPriceMock) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "ME: not open");
        require(pos.owner == msg.sender, "ME: not owner");
        require(exitPriceMock > 0, "ME: zero price");

        pos.isOpen = false;

        // Calculate PnL and interest
        int256 pnl = _calculatePnL(pos, exitPriceMock);
        uint256 interest = calculateInterest(pos.borrowed, pos.openTimestamp);

        // Repay vault: principal + interest
        if (pos.borrowed > 0 || interest > 0) {
            uint256 repayTotal = pos.borrowed + interest;
            usdc.approve(address(vault), repayTotal);
            vault.repayFromMarginEngine(pos.borrowed, interest);
        }

        // Calculate user return: collateral + pnl - interest
        int256 userReturn = int256(pos.collateral) + pnl - int256(interest);
        uint256 returnAmount;
        if (userReturn > 0) {
            returnAmount = uint256(userReturn);
            // Check we have enough USDC
            uint256 balance = usdc.balanceOf(address(this));
            if (returnAmount > balance) {
                returnAmount = balance; // cap to available (shouldn't happen in normal flow)
            }
            usdc.safeTransfer(pos.owner, returnAmount);
        }
        // If userReturn <= 0, user loses all collateral (already consumed)

        emit PositionClosed(positionId, pos.owner, exitPriceMock, pnl, interest, returnAmount);
    }

    // ─── Core: Liquidate ─────────────────────────────────────────────────

    /// @notice Liquidate an undercollateralized position
    /// @param positionId Position to liquidate
    /// @param currentPriceMock Current mock price for margin check
    function liquidate(uint256 positionId, uint256 currentPriceMock) external nonReentrant whenNotPaused {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "ME: not open");
        require(isLiquidatable(positionId, currentPriceMock), "ME: not liquidatable");

        pos.isOpen = false;

        int256 pnl = _calculatePnL(pos, currentPriceMock);
        uint256 interest = calculateInterest(pos.borrowed, pos.openTimestamp);

        // Repay vault first
        if (pos.borrowed > 0 || interest > 0) {
            uint256 repayTotal = pos.borrowed + interest;
            uint256 balance = usdc.balanceOf(address(this));
            // If PnL loss is large, we might not have enough to fully repay
            // In that case, repay what we can (insurance covers the gap conceptually)
            if (repayTotal > balance + pos.collateral) {
                // Partial repay scenario
                usdc.approve(address(vault), balance);
                vault.repayFromMarginEngine(balance > pos.borrowed ? pos.borrowed : balance, balance > pos.borrowed ? balance - pos.borrowed : 0);
            } else {
                usdc.approve(address(vault), repayTotal);
                vault.repayFromMarginEngine(pos.borrowed, interest);
            }
        }

        // Calculate remaining equity
        int256 equity = int256(pos.collateral) + pnl - int256(interest);
        uint256 remaining = equity > 0 ? uint256(equity) : 0;

        // Liquidation penalty from remaining collateral
        uint256 penalty = (remaining * liquidationPenaltyBps) / 10000;
        if (penalty > remaining) penalty = remaining;

        if (penalty > 0) {
            uint256 keeperReward = (penalty * liqKeeperBps) / 10000;
            uint256 insPortion = (penalty * liqInsuranceBps) / 10000;
            uint256 protoPortion = penalty - keeperReward - insPortion;

            // Pay keeper
            if (keeperReward > 0) {
                usdc.safeTransfer(msg.sender, keeperReward);
            }

            // Credit insurance + protocol to vault
            if (insPortion + protoPortion > 0) {
                usdc.approve(address(vault), insPortion + protoPortion);
                vault.creditFees(0, insPortion, protoPortion);
            }

            emit PositionLiquidated(positionId, msg.sender, penalty, keeperReward);
        }

        // Return remaining - penalty to position owner
        uint256 ownerReturn = remaining - penalty;
        if (ownerReturn > 0) {
            uint256 balance = usdc.balanceOf(address(this));
            if (ownerReturn > balance) ownerReturn = balance;
            usdc.safeTransfer(pos.owner, ownerReturn);
        }
    }

    // ─── Internal ────────────────────────────────────────────────────────

    /// @dev Calculate PnL using mock prices
    /// For LONG:  pnl = notional * (exitPrice - entryPrice) / entryPrice
    /// For SHORT: pnl = notional * (entryPrice - exitPrice) / entryPrice
    function _calculatePnL(Position storage pos, uint256 exitPriceMock) internal view returns (int256) {
        if (pos.entryPriceMock == 0) return 0;

        int256 priceDiff;
        if (pos.direction == Direction.LONG) {
            priceDiff = int256(exitPriceMock) - int256(pos.entryPriceMock);
        } else {
            priceDiff = int256(pos.entryPriceMock) - int256(exitPriceMock);
        }

        // pnl = notional * priceDiff / entryPrice
        return (int256(pos.notional) * priceDiff) / int256(pos.entryPriceMock);
    }
}
