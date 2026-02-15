// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BaseVault.sol";
import "../src/BaseMarginEngine.sol";

/// @title DeployBaseMarginEngine – Deploy updated BaseVault + BaseMarginEngine to Base mainnet.
/// @notice Since BaseVault now has lending functions, it must be redeployed. The old vault
///         at 0xEA6D70E05BF1b36eeB5b9c8D46048b2220Fc976A is a simpler version without lending.
///
/// Usage:
///   source .env
///   forge script script/DeployBaseMarginEngine.s.sol:DeployBaseMarginEngine --rpc-url $BASE_MAINNET_RPC_URL --broadcast
contract DeployBaseMarginEngine is Script {
    /// Canonical native USDC on Base mainnet (Circle)
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy updated BaseVault (with lending hooks)
        BaseVault vault = new BaseVault(BASE_USDC);
        console.log("BaseVault (v2 with lending) deployed at:", address(vault));

        // 2. Deploy BaseMarginEngine pointing to the new vault
        BaseMarginEngine engine = new BaseMarginEngine(BASE_USDC, address(vault));
        console.log("BaseMarginEngine deployed at:", address(engine));

        // 3. Link MarginEngine in Vault so it can borrow
        vault.setMarginEngine(address(engine));
        console.log("MarginEngine linked in BaseVault");

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary (Base mainnet) ===");
        console.log("Deployer:", deployer);
        console.log("USDC (native):", BASE_USDC);
        console.log("BaseVault (v2):", address(vault));
        console.log("BaseMarginEngine:", address(engine));
        console.log("\nCopy to frontend .env.local:");
        console.log("NEXT_PUBLIC_BASE_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
        console.log("NEXT_PUBLIC_BASE_VAULT_ADDRESS=", address(vault));
        console.log("NEXT_PUBLIC_BASE_MARGIN_ENGINE_ADDRESS=", address(engine));
    }
}
