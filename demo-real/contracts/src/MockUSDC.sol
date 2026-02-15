// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC - Test USDC token for testnet deployment
/// @notice Anyone can mint (faucet-style) for testing purposes
contract MockUSDC is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;

    constructor() ERC20("Mock USDC", "USDC") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Faucet: anyone can mint up to 10,000 USDC at a time for testing
    function faucet(address to, uint256 amount) external {
        require(amount <= 10_000 * 10 ** _DECIMALS, "MockUSDC: max 10k per mint");
        _mint(to, amount);
    }

    /// @notice Owner can mint any amount
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
