/* eslint-disable no-console */
const { ethers } = require("ethers");

const DEFAULT_SLUG = "will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568";
const RPC_URL = (process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com").trim();
const FEED_ADDRESS = (process.env.POLYMARKET_BINARY_FEED_ADDRESS || "").trim();
const PRIVATE_KEY = (process.env.POLYMARKET_FEED_PRIVATE_KEY || "").trim();
const MARKET_SLUG = (process.env.POLYMARKET_MARKET_SLUG || DEFAULT_SLUG).trim();
const INTERVAL_SEC = Number(process.env.POLYMARKET_UPDATE_INTERVAL_SEC || "30");
const MIN_TIP_GWEI = Number(process.env.POLYMARKET_MIN_PRIORITY_FEE_GWEI || "30");
const DRY_RUN = (process.env.DRY_RUN || "false").toLowerCase() === "true";

const FEED_ABI = [
  "function updatePriceE6(uint256 yesPriceE6) external",
  "function updater() view returns (address)",
];

function requireEnv() {
  if (!FEED_ADDRESS || !ethers.utils.isAddress(FEED_ADDRESS)) {
    throw new Error("POLYMARKET_BINARY_FEED_ADDRESS is missing or invalid");
  }
  if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith("0x")) {
    throw new Error("POLYMARKET_FEED_PRIVATE_KEY is missing or invalid");
  }
  if (!Number.isFinite(INTERVAL_SEC) || INTERVAL_SEC < 10) {
    throw new Error("POLYMARKET_UPDATE_INTERVAL_SEC must be >= 10 seconds");
  }
  if (!Number.isFinite(MIN_TIP_GWEI) || MIN_TIP_GWEI < 1) {
    throw new Error("POLYMARKET_MIN_PRIORITY_FEE_GWEI must be >= 1");
  }
}

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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  requireEnv();
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const feed = new ethers.Contract(FEED_ADDRESS, FEED_ABI, wallet);
  let lastSubmitted = null;

  console.log("[polymarket-feed-updater] POLYMARKET_FEED: derived updater address from POLYMARKET_FEED_PRIVATE_KEY:", wallet.address);
  const feedUpdater = await feed.updater();
  const feedUpdaterNorm = (feedUpdater || "").toLowerCase();
  const configuredNorm = wallet.address.toLowerCase();
  console.log("[polymarket-feed-updater] Feed", FEED_ADDRESS, "authorized updater:", feedUpdater, "| configured:", wallet.address);
  if (feedUpdaterNorm !== configuredNorm) {
    console.error("[polymarket-feed-updater] FATAL: Configured key address is not the feed's authorized updater. Run scripts/set-polymarket-feed-updater.js with the feed owner key.");
    process.exit(1);
  }

  console.log(`Updater running for slug: ${MARKET_SLUG}`);
  console.log(`Feed: ${FEED_ADDRESS}`);
  console.log(`Updater wallet: ${wallet.address}`);
  console.log(`Interval: ${INTERVAL_SEC}s`);
  console.log(`Dry run: ${DRY_RUN}`);

  for (;;) {
    try {
      const yesE6 = await fetchYesPriceE6();
      if (lastSubmitted === yesE6) {
        console.log(`[skip] unchanged YES price: ${yesE6}`);
      } else if (DRY_RUN) {
        console.log(`[dry-run] would submit YES price e6: ${yesE6}`);
        lastSubmitted = yesE6;
      } else {
        const feeData = await provider.getFeeData();
        const minTip = ethers.utils.parseUnits(String(MIN_TIP_GWEI), "gwei");
        const priority = feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas.gt(minTip)
          ? feeData.maxPriorityFeePerGas
          : minTip;
        let maxFee = feeData.maxFeePerGas && feeData.maxFeePerGas.gt(priority)
          ? feeData.maxFeePerGas
          : priority.mul(2);
        if (maxFee.lte(priority)) {
          maxFee = priority.add(ethers.utils.parseUnits("5", "gwei"));
        }

        let tx;
        let rcpt;
        const maxAttempts = 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            tx = await feed.updatePriceE6(yesE6, {
              maxPriorityFeePerGas: priority,
              maxFeePerGas: maxFee,
            });
            console.log(`[tx] submitted YES price e6: ${yesE6} hash=${tx.hash}`);
            rcpt = await tx.wait();
            break;
          } catch (txErr) {
            const txMsg = txErr instanceof Error ? txErr.message : String(txErr);
            if (txMsg.toLowerCase().includes("not updater") || txMsg.includes("PF:")) throw txErr;
            if (attempt < maxAttempts) {
              console.warn(`[retry] attempt ${attempt} failed: ${txMsg}; retrying in 5s...`);
              await sleep(5000);
            } else {
              throw txErr;
            }
          }
        }
        console.log(`[ok] confirmed block=${rcpt.blockNumber}`);
        lastSubmitted = yesE6;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[error] ${message}`);
      if (message.toLowerCase().includes("not updater")) {
        console.error("[polymarket-feed-updater] FATAL: Feed rejected (not updater). Exiting so process manager can restart after you fix updater.");
        process.exit(1);
      }
      if (message.toLowerCase().includes("revert") || message.includes("PF:")) {
        console.error("[polymarket-feed-updater] FATAL: Contract reverted. Exiting for restart.");
        process.exit(1);
      }
    }

    await sleep(INTERVAL_SEC * 1000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
