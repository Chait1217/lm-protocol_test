// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/oracles/OracleRouter.sol";
import "../src/oracles/ChainlinkBinaryAdapter.sol";

/// @title ConfigureOracleFeeds – Set production Chainlink binary feeds per market in the router.
/// @notice Run after deploy. Configures one market per invocation via env vars; run multiple times for multiple markets.
///
/// Required env:
///   ORACLE_ROUTER_ADDRESS     – OracleRouter contract
///   CHAINLINK_ADAPTER_ADDRESS – ChainlinkBinaryAdapter contract
///   MARKET_ID                 – bytes32 market id (e.g. cast keccak "will-gavin-newsom-win-...")
///   CHAINLINK_AGGREGATOR      – Chainlink aggregator contract for this market
///                               (or PolymarketBinaryPriceFeed address)
///
/// Optional env:
///   CHAINLINK_INVERT         – "true" to invert feed (default false)
///   CHAINLINK_MAX_AGE_SEC    – max age for staleness check (default 3600)
///
/// Example (use MARKET_SLUG for convenience; script hashes it):
///   export ORACLE_ROUTER_ADDRESS=0x...
///   export CHAINLINK_ADAPTER_ADDRESS=0x...
///   export MARKET_SLUG=will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568
///   export CHAINLINK_AGGREGATOR=0x...   # production binary outcome feed
///   forge script script/ConfigureOracleFeeds.s.sol:ConfigureOracleFeeds --rpc-url $POLYGON_RPC_URL --broadcast
contract ConfigureOracleFeeds is Script {
    function run() external {
        address routerAddr = vm.envAddress("ORACLE_ROUTER_ADDRESS");
        address chainlinkAddr = vm.envAddress("CHAINLINK_ADAPTER_ADDRESS");
        address aggregator = vm.envAddress("CHAINLINK_AGGREGATOR");
        bool invert = vm.envOr("CHAINLINK_INVERT", false);
        uint256 maxAgeSec = vm.envOr("CHAINLINK_MAX_AGE_SEC", uint256(3600));

        // Market: use MARKET_ID (bytes32 hex) if set, else MARKET_SLUG (keccak256(slug))
        bytes32 marketId;
        try vm.envBytes32("MARKET_ID") returns (bytes32 id) {
            marketId = id;
        } catch {
            marketId = keccak256(bytes(vm.envString("MARKET_SLUG")));
        }

        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0));
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        ChainlinkBinaryAdapter chainlink = ChainlinkBinaryAdapter(chainlinkAddr);
        OracleRouter router = OracleRouter(routerAddr);

        chainlink.setFeed(marketId, aggregator, invert, true);
        router.setMarketSource(marketId, address(chainlink), maxAgeSec, true);

        vm.stopBroadcast();

        console.log("Configured Chainlink feed for market:");
        console.logBytes32(marketId);
        console.log("Aggregator:", aggregator);
        console.log("MaxAgeSec:", maxAgeSec);
    }
}
