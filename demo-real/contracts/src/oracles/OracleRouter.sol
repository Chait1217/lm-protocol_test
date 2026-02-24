// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IPriceOracle.sol";

/// @title OracleRouter
/// @notice Per-market oracle routing with staleness checks.
contract OracleRouter is Ownable, IPriceOracle {
    struct SourceConfig {
        address source;
        uint256 maxAgeSec;
        bool enabled;
    }

    mapping(bytes32 => SourceConfig) public marketSource;

    event MarketSourceSet(bytes32 indexed marketId, address indexed source, uint256 maxAgeSec, bool enabled);

    constructor() Ownable(msg.sender) {}

    function setMarketSource(bytes32 marketId, address source, uint256 maxAgeSec, bool enabled) external onlyOwner {
        require(source != address(0), "OR: zero source");
        marketSource[marketId] = SourceConfig({
            source: source,
            maxAgeSec: maxAgeSec,
            enabled: enabled
        });
        emit MarketSourceSet(marketId, source, maxAgeSec, enabled);
    }

    function getYesPriceE6(bytes32 marketId) external view returns (uint256 priceE6, uint256 updatedAt, bool valid) {
        SourceConfig memory cfg = marketSource[marketId];
        require(cfg.enabled, "OR: market disabled");
        require(cfg.source != address(0), "OR: source missing");

        (priceE6, updatedAt, valid) = IPriceOracle(cfg.source).getYesPriceE6(marketId);
        require(valid, "OR: invalid source price");
        require(priceE6 <= 1e6, "OR: price > 1");
        if (cfg.maxAgeSec > 0) {
            require(updatedAt > 0 && block.timestamp >= updatedAt, "OR: bad timestamp");
            require(block.timestamp - updatedAt <= cfg.maxAgeSec, "OR: stale price");
        }
    }
}
