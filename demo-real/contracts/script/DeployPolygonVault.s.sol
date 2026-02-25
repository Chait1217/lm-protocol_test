// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BaseVault.sol";
import "../src/BaseMarginEngine.sol";
import "../src/oracles/OracleRouter.sol";
import "../src/oracles/ChainlinkBinaryAdapter.sol";
import "../src/oracles/UmaResolutionAdapter.sol";
import "../src/oracles/PolymarketBinaryPriceFeed.sol";

/// @title DeployPolygonVault – Deploy Vault + MarginEngine to Polygon PoS mainnet.
/// @notice Same contract logic as Base deployment, targeting Polygon for Polymarket integration.
///         Uses USDC.e (bridged USDC) on Polygon — the token Polymarket operates with.
///
/// Usage (env var):
///   source polygon.env
///   forge script script/DeployPolygonVault.s.sol:DeployPolygonVault --rpc-url $POLYGON_RPC_URL --broadcast
///
/// Usage (CLI private key — no env needed):
///   forge script script/DeployPolygonVault.s.sol:DeployPolygonVault \
///     --rpc-url https://polygon-rpc.com --private-key 0x... --broadcast
contract DeployPolygonVault is Script {
    /// USDC.e on Polygon PoS (bridged USDC — Polymarket's token)
    address constant POLYGON_USDCE = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;
    string constant NEWSOM_SLUG = "will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568";

    function run() external {
        // Support both PRIVATE_KEY env var and --private-key CLI flag
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0));
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        // 1. Deploy Vault (same BaseVault code, with Polygon USDC.e as asset)
        BaseVault vault = new BaseVault(POLYGON_USDCE);
        console.log("PolygonVault deployed at:", address(vault));

        // 2. Deploy oracle layer
        OracleRouter router = new OracleRouter();
        ChainlinkBinaryAdapter chainlinkAdapter = new ChainlinkBinaryAdapter();
        PolymarketBinaryPriceFeed updaterFeed;
        bytes32 marketId = keccak256(bytes(NEWSOM_SLUG));
        UmaResolutionAdapter umaAdapter;
        {
            // UMA: pass (0,0,0) for no OOV3; set UMA_OOV3_ADDRESS etc. for production OOV3
            address ooV3Addr = vm.envOr("UMA_OOV3_ADDRESS", address(0));
            address bondCurrencyAddr = vm.envOr("UMA_BOND_CURRENCY", POLYGON_USDCE);
            uint64 umaLiveness = uint64(vm.envOr("UMA_ASSERTION_LIVENESS", uint256(7200)));
            umaAdapter = new UmaResolutionAdapter(ooV3Addr, bondCurrencyAddr, umaLiveness);

            // Optional demo bootstrap (disabled by default): set only if explicitly requested.
            uint256 demoBootstrapUmaPriceE6 = vm.envOr("DEMO_BOOTSTRAP_UMA_PRICE_E6", uint256(type(uint256).max));
            if (demoBootstrapUmaPriceE6 != type(uint256).max) {
                umaAdapter.setResolvedPrice(marketId, demoBootstrapUmaPriceE6);
            }

            // Default source selection:
            // 1) Chainlink feed if configured (live market-linked source)
            // 2) UMA OOV3 adapter if configured (assertion/dispute flow)
            // 3) Otherwise market is disabled until oracle source is configured.
            bool hasUmaOov3 = ooV3Addr != address(0);
            bool marketEnabled = false;
            address defaultSource = address(umaAdapter);
            uint256 defaultMaxAge = 0;

            // Optional: configure Chainlink for this market if production feed address is set
            address chainlinkAggregator = vm.envOr("CHAINLINK_NEWSOM_AGGREGATOR", address(0));
            // Optional fallback: deploy internal updater feed and use it as aggregator source.
            // Useful when no public Chainlink binary feed exists for a market.
            if (chainlinkAggregator == address(0) && vm.envOr("DEPLOY_POLYMARKET_UPDATER_FEED", false)) {
                updaterFeed = new PolymarketBinaryPriceFeed(vm.envOr("POLYMARKET_FEED_UPDATER", msg.sender));
                chainlinkAggregator = address(updaterFeed);
                console.log("Using Polymarket updater feed as aggregator:", chainlinkAggregator);
            }
            if (chainlinkAggregator != address(0)) {
                bool invert = vm.envOr("CHAINLINK_NEWSOM_INVERT", false);
                uint256 maxAgeSec = vm.envOr("CHAINLINK_NEWSOM_MAX_AGE_SEC", uint256(3600));
                chainlinkAdapter.setFeed(marketId, chainlinkAggregator, invert, true);
                defaultSource = address(chainlinkAdapter);
                defaultMaxAge = maxAgeSec;
                marketEnabled = true;
            } else if (hasUmaOov3 || demoBootstrapUmaPriceE6 != type(uint256).max) {
                defaultSource = address(umaAdapter);
                defaultMaxAge = 0;
                marketEnabled = true;
            }
            router.setMarketSource(marketId, defaultSource, defaultMaxAge, marketEnabled);
            if (!marketEnabled) {
                console.log("WARNING: Market source disabled. Set CHAINLINK_NEWSOM_AGGREGATOR or UMA_OOV3_ADDRESS.");
            }
        }

        // 3. Deploy MarginEngine pointing to the vault + oracle router
        BaseMarginEngine engine = new BaseMarginEngine(POLYGON_USDCE, address(vault), address(router));
        console.log("PolygonMarginEngine deployed at:", address(engine));

        // 4. Link MarginEngine in Vault so it can borrow
        vault.setMarginEngine(address(engine));
        console.log("MarginEngine linked in Vault");

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary (Polygon PoS mainnet) ===");
        console.log("Deployer:", msg.sender);
        console.log("USDC.e (asset):", POLYGON_USDCE);
        console.log("OracleRouter:", address(router));
        console.log("ChainlinkAdapter:", address(chainlinkAdapter));
        console.log("UmaAdapter:", address(umaAdapter));
        console.log("PolymarketUpdaterFeed:", address(updaterFeed));
        console.log("MarketId (bytes32):");
        console.logBytes32(marketId);
        console.log("Vault:", address(vault));
        console.log("MarginEngine:", address(engine));
        console.log("\nCopy to frontend .env.local:");
        console.log("NEXT_PUBLIC_USDC_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
        console.log(string.concat("NEXT_PUBLIC_VAULT_ADDRESS=", vm.toString(address(vault))));
        console.log(string.concat("NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS=", vm.toString(address(engine))));
        console.log(string.concat("NEXT_PUBLIC_MARKET_SLUG=", NEWSOM_SLUG));
        console.log(string.concat("NEXT_PUBLIC_MARKET_ID=", vm.toString(marketId)));
        console.log(string.concat("NEXT_PUBLIC_ORACLE_ROUTER_ADDRESS=", vm.toString(address(router))));
        console.log(string.concat("NEXT_PUBLIC_ORACLE_CHAINLINK_ADAPTER_ADDRESS=", vm.toString(address(chainlinkAdapter))));
        console.log(string.concat("NEXT_PUBLIC_ORACLE_UMA_ADAPTER_ADDRESS=", vm.toString(address(umaAdapter))));
    }
}
