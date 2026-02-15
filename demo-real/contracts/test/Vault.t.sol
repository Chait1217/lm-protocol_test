// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MockUSDC.sol";
import "../src/Vault.sol";
import "../src/MarginEngine.sol";

contract VaultTest is Test {
    MockUSDC usdc;
    Vault vault;
    MarginEngine engine;

    address deployer = address(1);
    address alice = address(2);
    address bob = address(3);

    function setUp() public {
        vm.startPrank(deployer);

        usdc = new MockUSDC();
        vault = new Vault(address(usdc));
        engine = new MarginEngine(address(usdc), address(vault));
        vault.setMarginEngine(address(engine));

        vm.stopPrank();

        // Fund users
        usdc.faucet(alice, 10_000e6);
        usdc.faucet(bob, 10_000e6);
    }

    function testDeposit() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1000e6);
        vault.deposit(1000e6);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), 1000e6);
        assertEq(vault.totalAssets(), 1000e6);
    }

    function testWithdraw() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1000e6);
        vault.deposit(1000e6);
        vault.withdraw(500e6);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), 500e6);
        assertEq(usdc.balanceOf(alice), 9500e6);
    }

    function testOpenClosePosition() public {
        // Alice deposits into vault
        vm.startPrank(alice);
        usdc.approve(address(vault), 5000e6);
        vault.deposit(5000e6);
        vm.stopPrank();

        // Bob opens a leveraged position
        vm.startPrank(bob);
        usdc.approve(address(engine), 1000e6);
        uint256 posId = engine.openPosition(
            100e6,      // 100 USDC collateral
            5,          // 5x leverage
            MarginEngine.Direction.LONG,
            600000      // $0.60 entry price
        );
        vm.stopPrank();

        MarginEngine.Position memory pos = engine.getPosition(posId);
        assertEq(pos.collateral + pos.borrowed, 100e6 * 5 - (100e6 * 5 * 15 / 10000)); // notional minus fee is split
        assertTrue(pos.isOpen);

        // Fast forward 1 day, close at $0.66 (+10%)
        vm.warp(block.timestamp + 1 days);

        vm.startPrank(bob);
        engine.closePosition(posId, 660000); // $0.66
        vm.stopPrank();

        MarginEngine.Position memory closed = engine.getPosition(posId);
        assertFalse(closed.isOpen);
    }

    function testUtilizationCap() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1000e6);
        vault.deposit(1000e6);
        vm.stopPrank();

        // Try to borrow > 80% via a position
        // 900 USDC borrowed would be 90% utilization
        vm.startPrank(bob);
        usdc.approve(address(engine), 1000e6);

        // This should fail due to per-position cap (0.25% of 1000 = 2.5 USDC max borrow)
        vm.expectRevert("Vault: exceeds per-position cap");
        engine.openPosition(
            100e6, 10, MarginEngine.Direction.LONG, 600000
        );
        vm.stopPrank();
    }

    function testFaucet() public {
        usdc.faucet(alice, 5000e6);
        assertEq(usdc.balanceOf(alice), 15000e6); // 10k from setup + 5k
    }

    function testFaucetMaxLimit() public {
        vm.expectRevert("MockUSDC: max 10k per mint");
        usdc.faucet(alice, 10_001e6);
    }
}
