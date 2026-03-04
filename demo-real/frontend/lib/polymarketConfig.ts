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
  (process.env.NEXT_PUBLIC_POLYMARKET_CLOB_API || "").trim() ||
  "https://clob.polymarket.com";

/**
 * High-liquidity standard market: "Will the Iranian regime fall by June 30?"
 * Token IDs from Gamma/CLOB. Condition ID for CTF; CLOB orders use tokenId from API.
 */
export const DEFAULT_MARKET_SLUG = "will-the-iranian-regime-fall-by-june-30";

export const FALLBACK_CLOB_TOKEN_IDS = [
  "38397507750621893057346880033441136112987238933685677349709401910643842844855",
  "95949957895141858444199258452803633110472396604599808168788254125381075552218",
];

/** @deprecated Use DEFAULT_MARKET_SLUG */
export const BTC100K_MARKET_SLUG = DEFAULT_MARKET_SLUG;

/** Condition ID for Iranian regime market (binary). */
export const BTC100K_CONDITION_ID =
  (process.env.NEXT_PUBLIC_BTC100K_CONDITION_ID ?? "0x9352c559e9648ab4cab236087b64ca85c5b7123a4c7d9d7d4efde4a39c18056f") as `0x${string}`;

/** Parent collection for binary markets (no parent). */
export const PARENT_COLLECTION_ID = ("0x" + "0".repeat(64)) as `0x${string}`;
