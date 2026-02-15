/**
 * Reusable ABIs for Base mainnet: BaseVault, BaseMarginEngine, ERC20 USDC.
 * Used by /base-vault and /margin-trade.
 */

/** ABI for BaseVault v2 (deposit, withdraw, totalAssets, totalBorrowed, utilization, insurance, protocol, balanceOf, convertToAssets). */
export const baseVaultAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalBorrowed",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "utilization",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "insuranceBalance",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "protocolBalance",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToAssets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** ABI for BaseMarginEngine on Base mainnet. */
export const baseMarginEngineAbi = [
  {
    name: "openPosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collateralAmount", type: "uint256" },
      { name: "leverage", type: "uint256" },
      { name: "isLong", type: "bool" },
      { name: "entryPriceMock", type: "uint256" },
    ],
    outputs: [{ name: "positionId", type: "uint256" }],
  },
  {
    name: "closePosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "exitPriceMock", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "liquidate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "currentPriceMock", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getPosition",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "collateral", type: "uint256" },
          { name: "borrowed", type: "uint256" },
          { name: "notional", type: "uint256" },
          { name: "entryPriceMock", type: "uint256" },
          { name: "leverage", type: "uint256" },
          { name: "isLong", type: "bool" },
          { name: "openTimestamp", type: "uint256" },
          { name: "isOpen", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getUserPositions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "borrowAPR",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "calculateInterest",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "borrowed", type: "uint256" },
      { name: "openTimestamp", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "nextPositionId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "walletBorrowed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "openFeeBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "maintenanceMarginBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

