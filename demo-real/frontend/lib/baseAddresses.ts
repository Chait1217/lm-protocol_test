/**
 * Polygon PoS mainnet contract addresses for vault and margin trading.
 * Set in .env.local after deploying via DeployPolygonVault.s.sol.
 *
 * Legacy: these were previously Base addresses. Now Polygon-only.
 */

export const USDC_ADDRESS = (process.env
  .NEXT_PUBLIC_USDC_ADDRESS ?? "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174") as `0x${string}`;

export const VAULT_ADDRESS = (process.env
  .NEXT_PUBLIC_VAULT_ADDRESS ?? "0x") as `0x${string}`;

export const MARGIN_ENGINE_ADDRESS = (process.env
  .NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS ?? "0x") as `0x${string}`;

/** @deprecated Use USDC_ADDRESS */
export const BASE_USDC_ADDRESS = USDC_ADDRESS;
/** @deprecated Use VAULT_ADDRESS */
export const BASE_VAULT_ADDRESS = VAULT_ADDRESS;
/** @deprecated Use MARGIN_ENGINE_ADDRESS */
export const BASE_MARGIN_ENGINE_ADDRESS = MARGIN_ENGINE_ADDRESS;
