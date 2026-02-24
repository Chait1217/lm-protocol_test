// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IPriceOracle.sol";

/// @title UmaResolutionAdapter
/// @notice Minimal UMA-ready adapter storing resolved YES prices per market in 1e6 decimals.
/// @dev In production this would be wired to UMA OO assertions/disputes; for demo it is owner-fed.
contract UmaResolutionAdapter is Ownable, IPriceOracle {
    struct Resolution {
        uint256 priceE6;
        uint256 resolvedAt;
        bool resolved;
    }

    mapping(bytes32 => Resolution) public resolutionByMarket;

    event MarketResolved(bytes32 indexed marketId, uint256 yesPriceE6, uint256 resolvedAt);
    event MarketCleared(bytes32 indexed marketId);

    constructor() Ownable(msg.sender) {}

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
