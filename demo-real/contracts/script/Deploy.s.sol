// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/Vault.sol";
import "../src/MarginEngine.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy MockUSDC (for testnet; on mainnet, use real USDC address)
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // 2. Deploy Vault
        Vault vault = new Vault(address(usdc));
        console.log("Vault deployed at:", address(vault));

        // 3. Deploy MarginEngine
        MarginEngine engine = new MarginEngine(address(usdc), address(vault));
        console.log("MarginEngine deployed at:", address(engine));

        // 4. Link MarginEngine in Vault
        vault.setMarginEngine(address(engine));
        console.log("MarginEngine linked in Vault");

        // 5. Mint some test USDC to deployer
        usdc.faucet(deployer, 10_000 * 1e6);
        console.log("Minted 10,000 USDC to deployer");

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network: Polygon Amoy Testnet");
        console.log("Deployer:", deployer);
        console.log("MockUSDC:", address(usdc));
        console.log("Vault:", address(vault));
        console.log("MarginEngine:", address(engine));
    }
}
