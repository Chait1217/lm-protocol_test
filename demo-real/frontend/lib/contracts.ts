// ─── Contract ABIs (minimal, matching deployed contracts) ─────────────────────

export const MOCK_USDC_ABI = [
  {
    name: "faucet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
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

export const VAULT_ABI = [
  // Deposit / Withdraw
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  // Views
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
  {
    name: "convertToShares",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const MARGIN_ENGINE_ABI = [
  // Open / Close / Liquidate
  {
    name: "openPosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collateralAmount", type: "uint256" },
      { name: "leverage", type: "uint256" },
      { name: "direction", type: "uint8" },
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
  // Views
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
          { name: "direction", type: "uint8" },
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
    name: "isLiquidatable",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "currentPriceMock", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "nextPositionId",
    type: "function",
    stateMutability: "view",
    inputs: [],
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
  // Events
  {
    name: "PositionOpened",
    type: "event",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "collateral", type: "uint256", indexed: false },
      { name: "borrowed", type: "uint256", indexed: false },
      { name: "notional", type: "uint256", indexed: false },
      { name: "leverage", type: "uint256", indexed: false },
      { name: "direction", type: "uint8", indexed: false },
      { name: "entryPriceMock", type: "uint256", indexed: false },
      { name: "openFee", type: "uint256", indexed: false },
    ],
  },
  {
    name: "PositionClosed",
    type: "event",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "exitPriceMock", type: "uint256", indexed: false },
      { name: "pnl", type: "int256", indexed: false },
      { name: "interest", type: "uint256", indexed: false },
      { name: "returnedToUser", type: "uint256", indexed: false },
    ],
  },
] as const;

// ─── Contract Addresses (from .env) ──────────────────────────────────────────

export function getContractAddresses() {
  return {
    mockUsdc: (process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ?? "0x") as `0x${string}`,
    vault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? "0x") as `0x${string}`,
    marginEngine: (process.env.NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS ?? "0x") as `0x${string}`,
  };
}
