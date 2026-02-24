// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IOptimisticOracleV3.sol";
import "../interfaces/OptimisticOracleV3CallbackRecipientInterface.sol";

/// @title UmaResolutionAdapter
/// @notice UMA-ready adapter: resolved YES prices per market (1e6). Supports UMA OOV3 assertions/disputes
///         end-to-end, with optional owner override for demo/emergency.
contract UmaResolutionAdapter is Ownable, IPriceOracle, OptimisticOracleV3CallbackRecipientInterface {
    using SafeERC20 for IERC20;

    struct Resolution {
        uint256 priceE6;
        uint256 resolvedAt;
        bool resolved;
    }

    struct PendingAssertion {
        bytes32 marketId;
        uint256 yesPriceE6;
    }

    IOptimisticOracleV3 public immutable ooV3;
    IERC20 public immutable bondCurrency;
    uint64 public assertionLiveness;
    bytes32 public immutable defaultIdentifier;

    mapping(bytes32 => Resolution) public resolutionByMarket;
    mapping(bytes32 => PendingAssertion) public pendingAssertions;

    event MarketResolved(bytes32 indexed marketId, uint256 yesPriceE6, uint256 resolvedAt);
    event MarketCleared(bytes32 indexed marketId);
    event ResolutionProposed(bytes32 indexed assertionId, bytes32 indexed marketId, uint256 yesPriceE6, address asserter);
    event ResolutionDisputed(bytes32 indexed assertionId);

    /// @param _ooV3 UMA Optimistic Oracle V3 address. Pass address(0) for owner-only (demo) mode.
    /// @param _bondCurrency Bond token for assertions (e.g. USDC). Ignored if _ooV3 is zero.
    /// @param _assertionLiveness Challenge period in seconds (e.g. 7200). Ignored if _ooV3 is zero.
    constructor(address _ooV3, address _bondCurrency, uint64 _assertionLiveness) Ownable(msg.sender) {
        ooV3 = IOptimisticOracleV3(_ooV3);
        bondCurrency = IERC20(_bondCurrency);
        assertionLiveness = _ooV3 != address(0) ? _assertionLiveness : 0;
        defaultIdentifier = _ooV3 != address(0) ? IOptimisticOracleV3(_ooV3).defaultIdentifier() : bytes32(0);
    }

    /// @notice Propose a resolution for a market via UMA OOV3. Bond is pulled from caller; after liveness
    ///         without dispute, anyone can settle on OOV3 and this adapter will receive the callback and set the price.
    /// @param marketId Market identifier (e.g. keccak256(slug)).
    /// @param yesPriceE6 YES outcome price in 1e6 (0 <= yesPriceE6 <= 1e6).
    /// @return assertionId UMA assertion id; use it to dispute or settle on the OOV3 contract.
    function proposeResolution(bytes32 marketId, uint256 yesPriceE6) external returns (bytes32 assertionId) {
        require(address(ooV3) != address(0), "UMA: OOV3 not set");
        require(yesPriceE6 <= 1e6, "UMA: price > 1");

        uint256 bond = ooV3.getMinimumBond(address(bondCurrency));
        bondCurrency.safeTransferFrom(msg.sender, address(this), bond);
        bondCurrency.forceApprove(address(ooV3), bond);

        // Claim for disputers: encoded marketId and yesPriceE6 (verifiable off-chain).
        bytes memory claim = abi.encode(marketId, yesPriceE6, block.number);

        assertionId = ooV3.assertTruth(
            claim,
            msg.sender,           // asserter receives bond back if accepted
            address(this),        // we receive resolution callback
            address(0),           // no escalation manager → DVM arbitrates disputes
            assertionLiveness,
            bondCurrency,
            bond,
            defaultIdentifier,
            bytes32(0)
        );

        pendingAssertions[assertionId] = PendingAssertion({ marketId: marketId, yesPriceE6: yesPriceE6 });
        emit ResolutionProposed(assertionId, marketId, yesPriceE6, msg.sender);
        return assertionId;
    }

    /// @notice UMA OOV3 callback: assertion was resolved (unchallenged or dispute resolved).
    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthfully) external override {
        require(msg.sender == address(ooV3), "UMA: only OOV3");
        PendingAssertion memory p = pendingAssertions[assertionId];
        delete pendingAssertions[assertionId];

        if (assertedTruthfully && p.marketId != bytes32(0)) {
            resolutionByMarket[p.marketId] = Resolution({
                priceE6: p.yesPriceE6,
                resolvedAt: block.timestamp,
                resolved: true
            });
            emit MarketResolved(p.marketId, p.yesPriceE6, block.timestamp);
        }
    }

    /// @notice UMA OOV3 callback: assertion was disputed (will be arbitrated by DVM; resolution callback later).
    function assertionDisputedCallback(bytes32 assertionId) external override {
        require(msg.sender == address(ooV3), "UMA: only OOV3");
        emit ResolutionDisputed(assertionId);
        // Keep pendingAssertions so that when assertionResolvedCallback is later called after DVM, we can still resolve
    }

    /// @notice Admin/demo: set resolved price directly. Use when OOV3 is not configured or for emergency override.
    function setResolvedPrice(bytes32 marketId, uint256 yesPriceE6) external onlyOwner {
        require(yesPriceE6 <= 1e6, "UMA: price > 1");
        resolutionByMarket[marketId] = Resolution({
            priceE6: yesPriceE6,
            resolvedAt: block.timestamp,
            resolved: true
        });
        emit MarketResolved(marketId, yesPriceE6, block.timestamp);
    }

    function clearResolvedPrice(bytes32 marketId) external onlyOwner {
        delete resolutionByMarket[marketId];
        emit MarketCleared(marketId);
    }

    function getYesPriceE6(bytes32 marketId) external view returns (uint256 priceE6, uint256 updatedAt, bool valid) {
        Resolution memory r = resolutionByMarket[marketId];
        if (!r.resolved) return (0, 0, false);
        return (r.priceE6, r.resolvedAt, true);
    }

}
