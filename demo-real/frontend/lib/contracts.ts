// ─── Contract ABIs (matching Polygon mainnet deployed contracts) ────────────────

/**
 * USDC.e on Polygon (bridged USDC). Standard ERC20 read/write for balanceOf, allowance, approve.
 */
export const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
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

/** @deprecated Use USDC_ABI instead */
export const MOCK_USDC_ABI = USDC_ABI;

export const VAULT_ABI = [
  // Deposit
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  // Withdraw — ERC-4626 standard (3-arg)
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
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
  {
    name: "maxWithdraw",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "maxRedeem",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
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
      { name: "isLong", type: "bool" },
      { name: "marketId", type: "bytes32" },
    ],
    outputs: [{ name: "positionId", type: "uint256" }],
  },
  {
    name: "closePosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "liquidate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }],
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
          { name: "isLong", type: "bool" },
          { name: "marketId", type: "bytes32" },
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
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getMarketOraclePrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getPositionOraclePrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
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
      { name: "isLong", type: "bool", indexed: false },
      { name: "marketId", type: "bytes32", indexed: false },
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

// ─── Contract Addresses (from .env – Polygon mainnet) ───────────────────────────

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export function getContractAddresses() {
  const vaultEnv = (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "").trim();
  const marginEnv = (process.env.NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS || "").trim();
  return {
    usdc: ((process.env.NEXT_PUBLIC_USDC_ADDRESS || "").trim() || "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174") as `0x${string}`,
    /** @deprecated Use usdc instead */
    mockUsdc: ((process.env.NEXT_PUBLIC_USDC_ADDRESS || "").trim() || "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174") as `0x${string}`,
    vault: (vaultEnv || ZERO_ADDRESS) as `0x${string}`,
    marginEngine: (marginEnv || ZERO_ADDRESS) as `0x${string}`,
    oracleRouter: ((process.env.NEXT_PUBLIC_ORACLE_ROUTER_ADDRESS || "").trim() || ZERO_ADDRESS) as `0x${string}`,
    marketId: ((process.env.NEXT_PUBLIC_MARKET_ID || "").trim() ||
      "0x0f4f0800c154f98b8fdbd46c02f7f157293736f2d5e07c1306edbf46a64db22f") as `0x${string}`,
  };
}
