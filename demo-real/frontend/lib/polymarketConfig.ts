export const POLYGON_CHAIN_ID = 137;

export const POLYMKT_USDCE_ADDRESS = (
  (process.env.NEXT_PUBLIC_POLYMKT_USDCE_ADDRESS || "").trim() ||
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
) as `0x${string}`;

export const POLYMKT_CTF_ADDRESS = (
  (process.env.NEXT_PUBLIC_POLYMKT_CTF_ADDRESS || "").trim() ||
  "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
) as `0x${string}`;

export const POLYMKT_CTF_EXCHANGE_ADDRESS = (
  (process.env.NEXT_PUBLIC_POLYMKT_CTF_EXCHANGE_ADDRESS || "").trim() ||
  "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"
) as `0x${string}`;

export const POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS = (
  (process.env.NEXT_PUBLIC_POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS || "").trim() ||
  "0xC5d563A36AE78145C45a50134d48A1215220f80a"
) as `0x${string}`;

export const POLYMKT_NEG_RISK_ADAPTER_ADDRESS = (
  (process.env.NEXT_PUBLIC_POLYMKT_NEG_RISK_ADAPTER_ADDRESS || "").trim() ||
  "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296"
) as `0x${string}`;

export const POLYMARKET_CLOB_API =
  (process.env.NEXT_PUBLIC_POLYMARKET_CLOB_API || "").trim() ||
  "https://clob.polymarket.com";

export const POLYMARKET_GAMMA_API =
  (process.env.NEXT_PUBLIC_POLYMARKET_GAMMA_API || "").trim() ||
  "https://gamma-api.polymarket.com";

export const POLYMARKET_DATA_API =
  (process.env.NEXT_PUBLIC_POLYMARKET_DATA_API || "").trim() ||
  "https://data-api.polymarket.com";

export const DEFAULT_MARKET_TITLE =
  (process.env.NEXT_PUBLIC_POLYMARKET_MARKET_TITLE || "").trim() ||
  "Will the Iranian regime fall by June 30?";

export const DEFAULT_MARKET_SLUG =
  (process.env.NEXT_PUBLIC_POLYMARKET_MARKET_SLUG || "").trim() ||
  "will-the-iranian-regime-fall-by-june-30";

export const POLYMARKET_YES_TOKEN =
  (process.env.NEXT_PUBLIC_POLYMARKET_YES_TOKEN || "").trim() ||
  "38397507750621893057346880033441136112987238933685677349709401910643842844855";

export const POLYMARKET_NO_TOKEN =
  (process.env.NEXT_PUBLIC_POLYMARKET_NO_TOKEN || "").trim() ||
  "95949957895141858444199258452803633110472396604599808168788254125381075552218";

export const POLYMARKET_CONDITION_ID = (
  (process.env.NEXT_PUBLIC_POLYMARKET_CONDITION_ID || "").trim() ||
  "0x9352c559e9648ab4cab236087b64ca85c5b7123a4c7d9d7d4efde4a39c18056f"
) as `0x${string}`;

export const POLYMARKET_TICK_SIZE =
  (process.env.NEXT_PUBLIC_POLYMARKET_TICK_SIZE || "").trim() || "0.01";

export const POLYMARKET_TICK_NUM = Number(POLYMARKET_TICK_SIZE);

export const POLYMARKET_NEG_RISK =
  ((process.env.NEXT_PUBLIC_POLYMARKET_NEG_RISK || "").trim() || "false") ===
  "true";

export const FALLBACK_CLOB_TOKEN_IDS = [
  POLYMARKET_YES_TOKEN,
  POLYMARKET_NO_TOKEN,
];
