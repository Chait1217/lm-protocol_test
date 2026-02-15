// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVault {
    function lendToMarginEngine(uint256 amount) external;
    function repayFromMarginEngine(uint256 principal, uint256 interest) external;
    function totalAssets() external view returns (uint256);
    function totalBorrowed() external view returns (uint256);
    function utilization() external view returns (uint256);
    function insuranceBalance() external view returns (uint256);
    function protocolBalance() external view returns (uint256);
}
