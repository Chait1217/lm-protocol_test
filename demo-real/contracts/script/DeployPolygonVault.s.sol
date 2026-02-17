// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BaseVault.sol";
import "../src/BaseMarginEngine.sol";

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

    function run() external {
        // Support both PRIVATE_KEY env var and --private-key CLI flag
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0));
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }
        address deployer = msg.sender;

        // 1. Deploy Vault (same BaseVault code, with Polygon USDC.e as asset)
        BaseVault vault = new BaseVault(POLYGON_USDCE);
        console.log("PolygonVault deployed at:", address(vault));

        // 2. Deploy MarginEngine pointing to the vault
        BaseMarginEngine engine = new BaseMarginEngine(POLYGON_USDCE, address(vault));
        console.log("PolygonMarginEngine deployed at:", address(engine));

        // 3. Link MarginEngine in Vault so it can borrow
        vault.setMarginEngine(address(engine));
        console.log("MarginEngine linked in Vault");

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary (Polygon PoS mainnet) ===");
        console.log("Deployer:", deployer);
        console.log("USDC.e (asset):", POLYGON_USDCE);
        console.log("Vault:", address(vault));
        console.log("MarginEngine:", address(engine));
        console.log("\nCopy to frontend .env.local:");
        console.log("NEXT_PUBLIC_USDC_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
        console.log(string.concat("NEXT_PUBLIC_VAULT_ADDRESS=", vm.toString(address(vault))));
        console.log(string.concat("NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS=", vm.toString(address(engine))));
    }
}
