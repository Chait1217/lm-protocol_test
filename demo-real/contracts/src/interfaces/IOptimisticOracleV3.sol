// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Minimal UMA Optimistic Oracle V3 interface for market resolution
/// @notice Used by UmaResolutionAdapter to propose and receive resolution assertions.
interface IOptimisticOracleV3 {
    /// @notice Asserts a truth; bond is pulled from msg.sender (the caller of this function).
    /// @param claim Encoded claim (e.g. marketId + yesPriceE6) for disputers to verify.
    /// @param asserter Address that receives the bond back if assertion is accepted.
    /// @param callbackRecipient Contract that receives assertionResolvedCallback / assertionDisputedCallback.
    /// @param escalationManager Optional; use address(0) for DVM arbitration.
    /// @param liveness Challenge period in seconds.
    /// @param currency Bond token.
    /// @param bond Bond amount (must be >= getMinimumBond(currency)).
    /// @param identifier UMA identifier (e.g. defaultIdentifier()).
    /// @param domainId Optional domain; use bytes32(0) if not needed.
    /// @return assertionId Unique id for this assertion.
    function assertTruth(
        bytes memory claim,
        address asserter,
        address callbackRecipient,
        address escalationManager,
        uint64 liveness,
        IERC20 currency,
        uint256 bond,
        bytes32 identifier,
        bytes32 domainId
    ) external returns (bytes32 assertionId);

    /// @notice Minimum bond required for the given currency.
    function getMinimumBond(address currency) external view returns (uint256);

    /// @notice Default UMA identifier for assertions (e.g. "ASSERT_TRUTH").
    function defaultIdentifier() external view returns (bytes32);
}
