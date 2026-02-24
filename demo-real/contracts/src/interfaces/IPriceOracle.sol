// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IPriceOracle
/// @notice Unified oracle interface returning YES price for binary markets in 1e6 decimals.
interface IPriceOracle {
    /// @return priceE6 YES outcome price in 1e6 decimals (1_000_000 = 100%)
    /// @return updatedAt Last update timestamp in seconds.
    /// @return valid Whether the source considers the value valid.
    function getYesPriceE6(bytes32 marketId) external view returns (uint256 priceE6, uint256 updatedAt, bool valid);
}
