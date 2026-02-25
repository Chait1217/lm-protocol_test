/* eslint-disable no-console */
/**
 * Simulation: verify key → address, feed updater match, and current YES price.
 * Does NOT send any transaction. Use to confirm config before running the real updater.
 *
 * Usage:
 *   POLYMARKET_BINARY_FEED_ADDRESS=0x... POLYMARKET_FEED_PRIVATE_KEY=0x... node scripts/simulate-polymarket-feed-update.js
 */
const { ethers } = require("ethers");

const DEFAULT_SLUG = "will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568";
const RPC_URL = (process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com").trim();
const FEED_ADDRESS = (process.env.POLYMARKET_BINARY_FEED_ADDRESS || "").trim();
const PRIVATE_KEY = (process.env.POLYMARKET_FEED_PRIVATE_KEY || "").trim();
const MARKET_SLUG = (process.env.POLYMARKET_MARKET_SLUG || DEFAULT_SLUG).trim();

const FEED_ABI = [
  "function updater() view returns (address)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];

function parseOutcomePrices(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

async function fetchYesPriceE6() {
  const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(MARKET_SLUG)}`;
  const resp = await fetch(url, { headers: { accept: "application/json" } });
  if (!resp.ok) throw new Error(`Gamma API failed: ${resp.status}`);
  const rows = await resp.json();
  const market = Array.isArray(rows) ? rows[0] : rows;
  if (!market) throw new Error("No market found for slug");
  const prices = parseOutcomePrices(market.outcomePrices);
  const yes = Number(prices?.[0]);
  if (!Number.isFinite(yes)) throw new Error("Could not parse YES outcome price");
  return Math.max(0, Math.min(1_000_000, Math.round(yes * 1_000_000)));
}

async function main() {
  if (!FEED_ADDRESS || !ethers.utils.isAddress(FEED_ADDRESS)) {
    throw new Error("POLYMARKET_BINARY_FEED_ADDRESS is missing or invalid");
  }
  if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith("0x")) {
    throw new Error("POLYMARKET_FEED_PRIVATE_KEY is missing or invalid");
  }

  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const feed = new ethers.Contract(FEED_ADDRESS, FEED_ABI, provider);

  console.log("[simulate] 1. Derived updater address from POLYMARKET_FEED_PRIVATE_KEY:", wallet.address);
  const feedUpdater = await feed.updater();
  console.log("[simulate] 2. Feed authorized updater:", feedUpdater);
  const match = (feedUpdater || "").toLowerCase() === wallet.address.toLowerCase();
  if (match) {
    console.log("[simulate] 3. Match: configured key IS the authorized updater.");
  } else {
    console.log("[simulate] 3. MISMATCH: configured key is NOT the feed updater. Run scripts/set-polymarket-feed-updater.js with the feed owner key.");
  }

  let latestRound = null;
  try {
    latestRound = await feed.latestRoundData();
    console.log("[simulate] 4. Feed latest round:", latestRound.roundId?.toString(), "answer:", latestRound.answer?.toString());
  } catch (e) {
    console.log("[simulate] 4. Feed has no round yet (expected before first update).");
  }

  const yesE6 = await fetchYesPriceE6();
  console.log("[simulate] 5. Current YES price (e6) from Gamma:", yesE6);

  if (match) {
    console.log("[simulate] SUCCESS: Would call updatePriceE6(" + yesE6 + ") — no tx sent.");
  } else {
    console.log("[simulate] BLOCKED: Fix updater first, then run updater or oracle-refresh.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
