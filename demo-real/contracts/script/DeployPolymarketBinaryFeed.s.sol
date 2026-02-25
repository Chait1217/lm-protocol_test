// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/oracles/PolymarketBinaryPriceFeed.sol";

/// @title DeployPolymarketBinaryFeed
/// @notice Deploys a Chainlink-compatible updater feed for binary markets.
contract DeployPolymarketBinaryFeed is Script {
    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0));
        address updater = vm.envOr("POLYMARKET_FEED_UPDATER", msg.sender);
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        PolymarketBinaryPriceFeed feed = new PolymarketBinaryPriceFeed(updater);

        vm.stopBroadcast();

        console.log("PolymarketBinaryPriceFeed:", address(feed));
        console.log("Updater:", updater);
    }
}
