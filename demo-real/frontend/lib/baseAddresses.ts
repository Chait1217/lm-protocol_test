/**
 * Base mainnet contract addresses for /base-vault and /margin-trade.
 * Set in .env.local after deploying via DeployBaseMarginEngine.s.sol.
 */

export const BASE_USDC_ADDRESS = (process.env
  .NEXT_PUBLIC_BASE_USDC_ADDRESS ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`;

export const BASE_VAULT_ADDRESS = (process.env
  .NEXT_PUBLIC_BASE_VAULT_ADDRESS ?? "0x") as `0x${string}`;

export const BASE_MARGIN_ENGINE_ADDRESS = (process.env
  .NEXT_PUBLIC_BASE_MARGIN_ENGINE_ADDRESS ?? "0x") as `0x${string}`;
