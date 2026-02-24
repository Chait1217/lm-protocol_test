// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Optimistic Oracle V3 Callback Recipient Interface (UMA OOV3)
/// @notice Implement this to receive resolution/dispute callbacks from UMA OptimisticOracleV3.
interface OptimisticOracleV3CallbackRecipientInterface {
    /// @notice Called by OOV3 when an assertion is resolved (after liveness or after dispute resolution).
    /// @param assertionId The assertion that was resolved.
    /// @param assertedTruthfully True if the assertion was accepted as true (unchallenged or dispute won by asserter).
    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthfully) external;

    /// @notice Called by OOV3 when an assertion is disputed.
    /// @param assertionId The assertion that was disputed.
    function assertionDisputedCallback(bytes32 assertionId) external;
}
