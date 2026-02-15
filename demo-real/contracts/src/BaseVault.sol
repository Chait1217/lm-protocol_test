// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title BaseVault – ERC4626-style vault for native USDC on Base mainnet with lending
/// @notice deposit/withdraw for LPs. MarginEngine borrows via lendToMarginEngine / repayFromMarginEngine.
///         totalAssets = USDC balance + totalBorrowed. Interest split: 88% LP / 7% insurance / 5% protocol.
contract BaseVault is ERC20, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    address public marginEngine;

    // ─── Lending state ────────────────────────────────────────────────
    uint256 public totalBorrowed;
    uint256 public insuranceBalance;
    uint256 public protocolBalance;

    // Interest split (must sum to 10000)
    uint256 public constant LP_SHARE_BPS       = 8800; // 88%
    uint256 public constant INSURANCE_SHARE_BPS = 700;  // 7%
    uint256 public constant PROTOCOL_SHARE_BPS  = 500;  // 5%

    // Lending caps
    uint256 public utilizationCapBps         = 8000; // 80% max utilization
    uint256 public maxBorrowPerPositionBps   = 500;  // 5% of TVL per position
    uint256 public maxBorrowPerWalletBps     = 2000; // 20% of TVL per wallet

    mapping(address => uint256) public walletBorrowed;

    // ─── Events ───────────────────────────────────────────────────────
    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event Lend(uint256 amount, address borrower, uint256 newTotalBorrowed);
    event Repay(uint256 principal, uint256 interest);
    event FeesCredit(uint256 lpFee, uint256 insFee, uint256 protoFee);
    event Sweep(address indexed token, address indexed to, uint256 amount);

    modifier onlyMarginEngine() {
        require(msg.sender == marginEngine, "BaseVault: not MarginEngine");
        _;
    }

    constructor(address _asset) ERC20("Base USDC Vault", "bUSDC") Ownable(msg.sender) {
        require(_asset != address(0), "BaseVault: zero asset");
        asset = IERC20(_asset);
    }

    // ─── Admin ────────────────────────────────────────────────────────
    function setMarginEngine(address _me) external onlyOwner {
        require(_me != address(0), "BaseVault: zero address");
        marginEngine = _me;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Views ────────────────────────────────────────────────────────

    /// @notice Total USDC managed: balance in contract + amount lent to MarginEngine.
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this)) + totalBorrowed;
    }

    /// @notice Utilization in bps (0–10000). totalBorrowed / totalAssets.
    function utilization() public view returns (uint256) {
        uint256 ta = totalAssets();
        if (ta == 0) return 0;
        return (totalBorrowed * 10000) / ta;
    }

    /// @notice Convert USDC to shares. First deposit 1:1; then shares = assets * totalSupply / totalAssets.
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 ta = totalAssets();
        if (supply == 0 || ta == 0) return assets;
        return (assets * supply) / ta;
    }

    /// @notice Convert shares to USDC amount.
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }

    // ─── LP: Deposit / Withdraw ───────────────────────────────────────

    /// @notice Deposit USDC → receive vault shares.
    function deposit(uint256 assets) external nonReentrant whenNotPaused returns (uint256 shares) {
        require(assets > 0, "BaseVault: zero amount");
        shares = convertToShares(assets);
        require(shares > 0, "BaseVault: zero shares");

        asset.safeTransferFrom(msg.sender, address(this), assets);
        _mint(msg.sender, shares);

        emit Deposit(msg.sender, assets, shares);
    }

    /// @notice Withdraw USDC by burning shares. Only from available (unlent) balance.
    function withdraw(uint256 assets) external nonReentrant whenNotPaused returns (uint256 shares) {
        require(assets > 0, "BaseVault: zero amount");
        uint256 ta = totalAssets();
        require(ta > 0, "BaseVault: no liquidity");
        shares = (assets * totalSupply()) / ta;
        require(shares > 0, "BaseVault: zero shares");
        require(balanceOf(msg.sender) >= shares, "BaseVault: insufficient shares");

        // Only available (not lent) USDC can be withdrawn
        uint256 available = asset.balanceOf(address(this));
        require(assets <= available, "BaseVault: insufficient liquidity");

        _burn(msg.sender, shares);
        asset.safeTransfer(msg.sender, assets);

        emit Withdraw(msg.sender, assets, shares);
    }

    // ─── MarginEngine: Lending hooks ──────────────────────────────────

    /// @notice MarginEngine borrows USDC from vault for a leveraged position.
    /// @param amount   USDC to lend
    /// @param borrower The trader opening the position
    function lendToMarginEngine(
        uint256 amount,
        address borrower,
        uint256 /* positionBorrowExisting */,
        uint256 /* walletBorrowExisting */
    ) external onlyMarginEngine nonReentrant whenNotPaused {
        require(amount > 0, "BaseVault: zero lend");
        uint256 ta = totalAssets();
        require(ta > 0, "BaseVault: empty vault");

        // Caps disabled for prototype testing (uncomment to re-enable)
        uint256 newBorrowed = totalBorrowed + amount;
        // require((newBorrowed * 10000) / (ta + amount) <= utilizationCapBps, "BaseVault: utilization cap");
        // uint256 maxPerPosition = (ta * maxBorrowPerPositionBps) / 10000;
        // require(positionBorrowExisting + amount <= maxPerPosition, "BaseVault: position cap");
        // uint256 maxPerWallet = (ta * maxBorrowPerWalletBps) / 10000;
        // require(walletBorrowExisting + amount <= maxPerWallet, "BaseVault: wallet cap");

        // 4. Check available liquidity
        uint256 available = asset.balanceOf(address(this));
        require(amount <= available, "BaseVault: insufficient liquidity");

        totalBorrowed = newBorrowed;
        walletBorrowed[borrower] += amount;

        // Transfer USDC to MarginEngine
        asset.safeTransfer(marginEngine, amount);

        emit Lend(amount, borrower, newBorrowed);
    }

    /// @notice MarginEngine repays borrowed USDC + interest. Interest split 88/7/5.
    function repayFromMarginEngine(uint256 principal, uint256 interest) external onlyMarginEngine nonReentrant {
        // Pull total repayment from MarginEngine
        uint256 total = principal + interest;
        if (total > 0) {
            asset.safeTransferFrom(msg.sender, address(this), total);
        }

        // Reduce totalBorrowed by principal
        if (principal > 0) {
            totalBorrowed = totalBorrowed >= principal ? totalBorrowed - principal : 0;
        }

        // Split interest: 88% LP (stays in vault balance), 7% insurance, 5% protocol
        if (interest > 0) {
            uint256 insPortion  = (interest * INSURANCE_SHARE_BPS) / 10000;
            uint256 protoPortion = (interest * PROTOCOL_SHARE_BPS) / 10000;
            // LP portion = interest - insPortion - protoPortion (stays in vault, grows share value)
            insuranceBalance += insPortion;
            protocolBalance  += protoPortion;
        }

        emit Repay(principal, interest);
    }

    /// @notice MarginEngine credits open-position fees (or liquidation fees) to vault buckets.
    function creditFees(uint256 lpFee, uint256 insFee, uint256 protoFee) external onlyMarginEngine nonReentrant {
        uint256 total = lpFee + insFee + protoFee;
        if (total > 0) {
            asset.safeTransferFrom(msg.sender, address(this), total);
        }
        // lpFee stays in vault balance (grows share value for LPs)
        insuranceBalance += insFee;
        protocolBalance  += protoFee;

        emit FeesCredit(lpFee, insFee, protoFee);
    }

    // ─── Owner: Sweep accidental tokens ───────────────────────────────

    function sweep(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(asset), "BaseVault: cannot sweep asset");
        require(to != address(0), "BaseVault: zero to");
        if (amount == 0) amount = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(to, amount);
        emit Sweep(token, to, amount);
    }
}
