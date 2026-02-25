/**
 * Polymarket on Polygon: chain, tokens, and CTF/Exchange addresses.
 * Used for real Polymarket trade execution (BTC 100k market).
 * @see https://docs.polymarket.com/developers/CTF/deployment-resources
 */

export const POLYGON_CHAIN_ID = 137;

/** USDC.e on Polygon PoS (bridged). Polymarket uses this for deposits/trading. */
export const POLYMKT_USDCE_ADDRESS = (
  (process.env.NEXT_PUBLIC_POLYMKT_USDCE_ADDRESS || "").trim() ||
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
) as `0x${string}`;

/** Conditional Tokens Framework (CTF) on Polygon. */
export const POLYMKT_CTF_ADDRESS = (
  (process.env.NEXT_PUBLIC_POLYMKT_CTF_ADDRESS || "").trim() ||
  "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
) as `0x${string}`;

/** CTF Exchange on Polygon (settlement). Note: matchOrders is onlyOperator; use CLOB API to place orders. */
export const POLYMKT_CTF_EXCHANGE_ADDRESS = (
  (process.env.NEXT_PUBLIC_POLYMKT_CTF_EXCHANGE_ADDRESS || "").trim() ||
  "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"
) as `0x${string}`;

/** Neg-risk CTF exchange on Polygon (multi-outcome/negative-risk routing). */
export const POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS = (
  (process.env.NEXT_PUBLIC_POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS || "").trim() ||
  "0xC5d563A36AE78145C45a50134d48A1215220f80a"
) as `0x${string}`;

/** Neg-risk adapter on Polygon. */
export const POLYMKT_NEG_RISK_ADAPTER_ADDRESS = (
  (process.env.NEXT_PUBLIC_POLYMKT_NEG_RISK_ADAPTER_ADDRESS || "").trim() ||
  "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296"
) as `0x${string}`;

/**
 * CLOB API base URL for placing orders.
 * Routes through our Next.js proxy to bypass local DNS issues with polymarket.com.
 * The proxy at /api/clob-proxy forwards requests to https://clob.polymarket.com.
 */
export const POLYMARKET_CLOB_API =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/clob-proxy`
    : "https://clob.polymarket.com";

/**
 * Newsom market: "Will Gavin Newsom win the 2028 Democratic presidential nomination ?"
 * Token IDs come from the Gamma/CLOB market response (clobTokenIds).
 * Condition ID / partition are used for CTF split/merge; for CLOB orders we use tokenId from the API.
 */
export const BTC100K_MARKET_SLUG = "will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568";

/** Placeholder: conditionId for BTC 100k (binary). Fill from Gamma API or Polymarket docs if needed for CTF.splitPosition. */
export const BTC100K_CONDITION_ID =
  process.env.NEXT_PUBLIC_BTC100K_CONDITION_ID ?? ("0x" + "0".repeat(64)) as `0x${string}`;

/** Parent collection for binary markets (no parent). */
export const PARENT_COLLECTION_ID = ("0x" + "0".repeat(64)) as `0x${string}`;
