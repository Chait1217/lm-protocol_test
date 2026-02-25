// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PolymarketBinaryPriceFeed
/// @notice Minimal Chainlink-compatible feed for binary YES price in 1e6 precision.
/// @dev Designed for offchain updaters that read Polymarket and write onchain.
contract PolymarketBinaryPriceFeed is Ownable {
    struct Round {
        int256 answer;
        uint256 startedAt;
        uint256 updatedAt;
        uint80 answeredInRound;
    }

    uint8 public constant decimals = 6;
    uint80 public latestRoundId;
    address public updater;
    mapping(uint80 => Round) public rounds;

    event UpdaterSet(address indexed updater);
    event PriceUpdated(uint80 indexed roundId, int256 answer, uint256 updatedAt);

    constructor(address initialUpdater) Ownable(msg.sender) {
        updater = initialUpdater;
        emit UpdaterSet(initialUpdater);
    }

    modifier onlyUpdaterOrOwner() {
        require(msg.sender == owner() || msg.sender == updater, "PF: not updater");
        _;
    }

    function setUpdater(address newUpdater) external onlyOwner {
        updater = newUpdater;
        emit UpdaterSet(newUpdater);
    }

    /// @notice Push latest YES probability in 1e6 precision (0..1e6).
    function updatePriceE6(uint256 yesPriceE6) external onlyUpdaterOrOwner {
        require(yesPriceE6 <= 1e6, "PF: price > 1");
        uint80 nextRoundId = latestRoundId + 1;
        uint256 ts = block.timestamp;

        rounds[nextRoundId] = Round({
            answer: int256(yesPriceE6),
            startedAt: ts,
            updatedAt: ts,
            answeredInRound: nextRoundId
        });
        latestRoundId = nextRoundId;

        emit PriceUpdated(nextRoundId, int256(yesPriceE6), ts);
    }

    /// @notice Chainlink AggregatorV3-compatible latest round response.
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = latestRoundId;
        require(roundId != 0, "PF: no data");
        Round memory r = rounds[roundId];
        return (roundId, r.answer, r.startedAt, r.updatedAt, r.answeredInRound);
    }
}
