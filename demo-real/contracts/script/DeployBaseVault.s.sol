// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BaseVault.sol";

/// @title DeployBaseVault – Deploy BaseVault to Base mainnet (native USDC).
/// @notice Set PRIVATE_KEY and BASE_MAINNET_RPC_URL in .env, then:
///         forge script script/DeployBaseVault.s.sol:DeployBaseVault --rpc-url $BASE_MAINNET_RPC_URL --broadcast
contract DeployBaseVault is Script {
    /// Canonical native USDC on Base mainnet (Circle)
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        BaseVault vault = new BaseVault(BASE_USDC);
        console.log("BaseVault deployed at:", address(vault));

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary (Base mainnet) ===");
        console.log("Deployer:", deployer);
        console.log("USDC (asset):", BASE_USDC);
        console.log("BaseVault:", address(vault));
        console.log("\nCopy to frontend .env.local:");
        console.log("NEXT_PUBLIC_BASE_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
        console.log("NEXT_PUBLIC_BASE_VAULT_ADDRESS=", address(vault));
    }
}
