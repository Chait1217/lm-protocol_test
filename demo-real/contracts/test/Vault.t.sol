// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../src/BaseVault.sol";
import "../src/BaseMarginEngine.sol";
import "../src/oracles/OracleRouter.sol";
import "../src/oracles/UmaResolutionAdapter.sol";
import "../src/oracles/ChainlinkBinaryAdapter.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract VaultTest is Test {
    MockUSDC usdc;
    BaseVault vault;
    BaseMarginEngine engine;
    OracleRouter router;
    UmaResolutionAdapter uma;
    ChainlinkBinaryAdapter chainlink;

    address deployer = address(1);
    address alice = address(2);
    address bob = address(3);
    address keeper = address(4);

    bytes32 constant MARKET_ID = keccak256("will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568");

    function setUp() public {
        vm.startPrank(deployer);

        usdc = new MockUSDC();
        vault = new BaseVault(address(usdc));
        router = new OracleRouter();
        uma = new UmaResolutionAdapter(address(0), address(0), 0);
        chainlink = new ChainlinkBinaryAdapter();
        uma.setResolvedPrice(MARKET_ID, 600000); // 60c YES
        router.setMarketSource(MARKET_ID, address(uma), 0, true);

        engine = new BaseMarginEngine(address(usdc), address(vault), address(router));
        vault.setMarginEngine(address(engine));

        vm.stopPrank();

        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        usdc.mint(address(engine), 1_000_000e6); // bootstrap liquidity for close payouts in test env
    }

    function _aliceDeposit(uint256 amount) internal {
        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function testDepositWithdraw() public {
        _aliceDeposit(1000e6);

        vm.startPrank(alice);
        vault.withdraw(500e6);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), 500e6);
        assertEq(vault.totalAssets(), 500e6);
    }

    function testOpenClosePositionOracleDriven() public {
        _aliceDeposit(5000e6);

        vm.startPrank(bob);
        usdc.approve(address(engine), 1000e6);
        uint256 posId = engine.openPosition(100e6, 3, true, MARKET_ID);
        vm.stopPrank();

        BaseMarginEngine.Position memory pos = engine.getPosition(posId);
        assertEq(pos.marketId, MARKET_ID);
        assertEq(pos.entryPriceMock, 600000);
        assertTrue(pos.isOpen);

        vm.startPrank(deployer);
        uma.setResolvedPrice(MARKET_ID, 700000); // YES rises
        vm.stopPrank();

        vm.warp(block.timestamp + 1 hours);
        vm.prank(bob);
        engine.closePosition(posId);

        BaseMarginEngine.Position memory closed = engine.getPosition(posId);
        assertFalse(closed.isOpen);
    }

    function testLiquidationUsesOraclePrice() public {
        _aliceDeposit(5000e6);

        vm.startPrank(bob);
        usdc.approve(address(engine), 1000e6);
        uint256 posId = engine.openPosition(100e6, 5, true, MARKET_ID);
        vm.stopPrank();

        vm.startPrank(deployer);
        uma.setResolvedPrice(MARKET_ID, 150000); // YES crashes
        vm.stopPrank();

        assertTrue(engine.isLiquidatable(posId));

        vm.prank(keeper);
        engine.liquidate(posId);

        BaseMarginEngine.Position memory liquidated = engine.getPosition(posId);
        assertFalse(liquidated.isOpen);
    }

    function testRouterRejectsStalePrice() public {
        vm.startPrank(deployer);
        router.setMarketSource(MARKET_ID, address(uma), 1, true);
        vm.stopPrank();

        vm.warp(block.timestamp + 2);
        vm.expectRevert("OR: stale price");
        engine.getMarketOraclePrice(MARKET_ID);
    }

    function testRouterSourceSwitching() public {
        vm.startPrank(deployer);
        router.setMarketSource(MARKET_ID, address(chainlink), 0, true); // no feed configured
        vm.stopPrank();

        vm.expectRevert("OR: invalid source price");
        engine.getMarketOraclePrice(MARKET_ID);

        vm.startPrank(deployer);
        router.setMarketSource(MARKET_ID, address(uma), 0, true);
        vm.stopPrank();

        uint256 price = engine.getMarketOraclePrice(MARKET_ID);
        assertEq(price, 600000);
    }
}
