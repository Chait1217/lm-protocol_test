// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title LM Protocol Vault
/// @notice ERC4626-like simplified vault for USDC with lending to MarginEngine
/// @dev Shares are minted 1:1 at launch; exchange rate drifts as interest accrues
contract Vault is ERC20, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    address public marginEngine;

    uint256 public totalBorrowed;       // USDC lent to MarginEngine
    uint256 public insuranceBalance;    // accumulated insurance fees
    uint256 public protocolBalance;     // accumulated protocol fees

    // Interest split (bps, must sum to 10000)
    uint256 public lpShareBps       = 8800;   // 88%
    uint256 public insuranceShareBps = 700;   // 7%
    uint256 public protocolShareBps  = 500;   // 5%

    // Lending caps (relaxed for demo; tighten for production)
    uint256 public utilizationCapBps           = 8000;  // 80%
    uint256 public maxBorrowPerPositionBps     = 500;   // 5% of TVL
    uint256 public maxBorrowPerWalletBps       = 2000;  // 20% of TVL

    // Track per-wallet borrows
    mapping(address => uint256) public walletBorrowed;

    // ─── Events ──────────────────────────────────────────────────────────
    event Deposit(address indexed user, uint256 usdcAmount, uint256 sharesMinted);
    event Withdraw(address indexed user, uint256 usdcAmount, uint256 sharesBurned);
    event Lend(uint256 amount, uint256 newTotalBorrowed);
    event Repay(uint256 principal, uint256 interest, uint256 lpShare, uint256 insuranceShare, uint256 protocolShare);
    event MarginEngineUpdated(address indexed newMarginEngine);
    event FeeDistribution(uint256 amount, string feeType, uint256 lpShare, uint256 insuranceShare, uint256 protocolShare);

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier onlyMarginEngine() {
        require(msg.sender == marginEngine, "Vault: caller is not MarginEngine");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _usdc) ERC20("LM Vault Share", "lmUSDC") Ownable(msg.sender) {
        require(_usdc != address(0), "Vault: zero address");
        usdc = IERC20(_usdc);
    }

    // ─── Admin ───────────────────────────────────────────────────────────
    function setMarginEngine(address _marginEngine) external onlyOwner {
        require(_marginEngine != address(0), "Vault: zero address");
        marginEngine = _marginEngine;
        emit MarginEngineUpdated(_marginEngine);
    }

    function setUtilizationCap(uint256 _capBps) external onlyOwner {
        require(_capBps <= 9500, "Vault: cap too high");
        utilizationCapBps = _capBps;
    }

    function setMaxBorrowPerPosition(uint256 _bps) external onlyOwner {
        require(_bps <= 500, "Vault: too high");
        maxBorrowPerPositionBps = _bps;
    }

    function setMaxBorrowPerWallet(uint256 _bps) external onlyOwner {
        require(_bps <= 2000, "Vault: too high");
        maxBorrowPerWalletBps = _bps;
    }

    function setInterestSplit(uint256 _lp, uint256 _insurance, uint256 _protocol) external onlyOwner {
        require(_lp + _insurance + _protocol == 10000, "Vault: must sum to 10000");
        lpShareBps = _lp;
        insuranceShareBps = _insurance;
        protocolShareBps = _protocol;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── View helpers ────────────────────────────────────────────────────

    /// @notice Total USDC managed by the vault (in vault + lent out), minus insurance/protocol reserves
    function totalAssets() public view returns (uint256) {
        return usdc.balanceOf(address(this)) + totalBorrowed - insuranceBalance - protocolBalance;
    }

    /// @notice Current utilization in bps (0-10000)
    function utilization() public view returns (uint256) {
        uint256 ta = totalAssets();
        if (ta == 0) return 0;
        return (totalBorrowed * 10000) / ta;
    }

    /// @notice Convert USDC amount to shares
    function convertToShares(uint256 usdcAmount) public view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 ta = totalAssets();
        if (supply == 0 || ta == 0) return usdcAmount; // 1:1 at start
        return (usdcAmount * supply) / ta;
    }

    /// @notice Convert shares to USDC amount
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }

    // ─── Deposit / Withdraw ──────────────────────────────────────────────

    /// @notice Deposit USDC and receive vault shares
    function deposit(uint256 usdcAmount) external nonReentrant whenNotPaused returns (uint256 shares) {
        require(usdcAmount > 0, "Vault: zero amount");
        shares = convertToShares(usdcAmount);
        require(shares > 0, "Vault: zero shares");

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        _mint(msg.sender, shares);

        emit Deposit(msg.sender, usdcAmount, shares);
    }

    /// @notice Withdraw USDC by burning vault shares
    function withdraw(uint256 usdcAmount) external nonReentrant whenNotPaused returns (uint256 shares) {
        require(usdcAmount > 0, "Vault: zero amount");
        shares = convertToShares(usdcAmount);
        require(shares > 0, "Vault: zero shares");
        require(balanceOf(msg.sender) >= shares, "Vault: insufficient shares");

        // Ensure enough liquid USDC (not lent out)
        uint256 available = usdc.balanceOf(address(this)) - insuranceBalance - protocolBalance;
        require(usdcAmount <= available, "Vault: insufficient liquidity");

        _burn(msg.sender, shares);
        usdc.safeTransfer(msg.sender, usdcAmount);

        emit Withdraw(msg.sender, usdcAmount, shares);
    }

    // ─── Lending (called by MarginEngine) ────────────────────────────────

    /// @notice Lend USDC to MarginEngine for a leveraged position
    /// @param amount USDC amount to lend
    function lendToMarginEngine(uint256 amount) external onlyMarginEngine nonReentrant whenNotPaused {
        require(amount > 0, "Vault: zero amount");

        uint256 ta = totalAssets();
        require(ta > 0, "Vault: empty vault");

        // Utilization cap check
        uint256 newBorrowed = totalBorrowed + amount;
        uint256 newUtil = (newBorrowed * 10000) / ta;
        require(newUtil <= utilizationCapBps, "Vault: utilization cap exceeded");

        // Per-position cap
        uint256 maxPerPosition = (ta * maxBorrowPerPositionBps) / 10000;
        require(amount <= maxPerPosition, "Vault: exceeds per-position cap");

        // Per-wallet cap (tracked by MarginEngine caller's tx.origin for simplicity)
        uint256 maxPerWallet = (ta * maxBorrowPerWalletBps) / 10000;
        require(walletBorrowed[tx.origin] + amount <= maxPerWallet, "Vault: exceeds per-wallet cap");

        // Ensure enough liquid USDC
        uint256 available = usdc.balanceOf(address(this)) - insuranceBalance - protocolBalance;
        require(amount <= available, "Vault: insufficient liquidity");

        walletBorrowed[tx.origin] += amount;
        totalBorrowed += amount;

        usdc.safeTransfer(marginEngine, amount);
        emit Lend(amount, totalBorrowed);
    }

    /// @notice Repay principal + interest from MarginEngine
    function repayFromMarginEngine(uint256 principal, uint256 interest) external onlyMarginEngine nonReentrant {
        require(principal <= totalBorrowed, "Vault: principal exceeds borrowed");

        // Transfer total repayment from MarginEngine
        uint256 total = principal + interest;
        usdc.safeTransferFrom(marginEngine, address(this), total);

        totalBorrowed -= principal;

        // Track wallet borrowed reduction
        if (walletBorrowed[tx.origin] >= principal) {
            walletBorrowed[tx.origin] -= principal;
        } else {
            walletBorrowed[tx.origin] = 0;
        }

        // Split interest
        if (interest > 0) {
            uint256 lpShare = (interest * lpShareBps) / 10000;
            uint256 insShare = (interest * insuranceShareBps) / 10000;
            uint256 protoShare = interest - lpShare - insShare; // remainder to protocol

            // LP share stays in vault (increases share value)
            insuranceBalance += insShare;
            protocolBalance += protoShare;

            emit Repay(principal, interest, lpShare, insShare, protoShare);
        } else {
            emit Repay(principal, 0, 0, 0, 0);
        }
    }

    /// @notice Credit open/close/liquidation fees directly (called by MarginEngine after receiving USDC)
    function creditFees(uint256 lpFee, uint256 insuranceFee, uint256 protocolFee) external onlyMarginEngine {
        uint256 total = lpFee + insuranceFee + protocolFee;
        if (total > 0) {
            usdc.safeTransferFrom(marginEngine, address(this), total);
            // lpFee stays as vault assets (increases share value)
            insuranceBalance += insuranceFee;
            protocolBalance += protocolFee;
            emit FeeDistribution(total, "fee", lpFee, insuranceFee, protocolFee);
        }
    }

    // ─── Protocol withdrawals ────────────────────────────────────────────

    function withdrawInsurance(address to, uint256 amount) external onlyOwner {
        require(amount <= insuranceBalance, "Vault: insufficient insurance");
        insuranceBalance -= amount;
        usdc.safeTransfer(to, amount);
    }

    function withdrawProtocol(address to, uint256 amount) external onlyOwner {
        require(amount <= protocolBalance, "Vault: insufficient protocol");
        protocolBalance -= amount;
        usdc.safeTransfer(to, amount);
    }
}
