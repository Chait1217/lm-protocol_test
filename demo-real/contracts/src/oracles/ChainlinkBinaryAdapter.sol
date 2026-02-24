// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IPriceOracle.sol";

interface IAggregatorV3Like {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/// @title ChainlinkBinaryAdapter
/// @notice Adapts Chainlink-style feeds into binary YES price (1e6 decimals).
/// @dev Expects feed value to represent YES probability in [0,1] domain after decimals scaling.
contract ChainlinkBinaryAdapter is Ownable, IPriceOracle {
    struct FeedConfig {
        address aggregator;
        bool invert;
        bool enabled;
    }

    mapping(bytes32 => FeedConfig) public feedByMarket;

    event FeedSet(bytes32 indexed marketId, address indexed aggregator, bool invert, bool enabled);

    constructor() Ownable(msg.sender) {}

    function setFeed(bytes32 marketId, address aggregator, bool invert, bool enabled) external onlyOwner {
        require(aggregator != address(0), "CL: zero aggregator");
        feedByMarket[marketId] = FeedConfig({
            aggregator: aggregator,
            invert: invert,
            enabled: enabled
        });
        emit FeedSet(marketId, aggregator, invert, enabled);
    }

    function getYesPriceE6(bytes32 marketId) external view returns (uint256 priceE6, uint256 updatedAt, bool valid) {
        FeedConfig memory cfg = feedByMarket[marketId];
        if (!cfg.enabled || cfg.aggregator == address(0)) {
            return (0, 0, false);
        }

        IAggregatorV3Like agg = IAggregatorV3Like(cfg.aggregator);
        (, int256 answer,, uint256 ts,) = agg.latestRoundData();
        if (answer <= 0 || ts == 0) return (0, 0, false);

        uint8 dec = agg.decimals();
        uint256 raw = uint256(answer);

        if (dec >= 6) {
            priceE6 = raw / (10 ** (dec - 6));
        } else {
            priceE6 = raw * (10 ** (6 - dec));
        }
        if (priceE6 > 1e6) return (0, 0, false);

        if (cfg.invert) {
            priceE6 = 1e6 - priceE6;
        }
        updatedAt = ts;
        valid = true;
    }
}
