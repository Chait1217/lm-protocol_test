// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/oracles/PolymarketBinaryPriceFeed.sol";

/// @title UpdatePolymarketBinaryFeed
/// @notice Pushes latest YES price (1e6 precision) to updater feed.
contract UpdatePolymarketBinaryFeed is Script {
    function run() external {
        address feedAddr = vm.envAddress("POLYMARKET_BINARY_FEED_ADDRESS");
        uint256 yesPriceE6 = vm.envUint("POLYMARKET_YES_PRICE_E6");
        require(yesPriceE6 <= 1e6, "price > 1");

        uint256 updaterKey = vm.envOr("UPDATER_PRIVATE_KEY", uint256(0));
        if (updaterKey != 0) {
            vm.startBroadcast(updaterKey);
        } else {
            vm.startBroadcast();
        }

        PolymarketBinaryPriceFeed(feedAddr).updatePriceE6(yesPriceE6);

        vm.stopBroadcast();
        console.log("Updated feed:", feedAddr);
        console.log("YES price e6:", yesPriceE6);
    }
}
