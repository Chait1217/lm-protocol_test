/* eslint-disable no-console */
/**
 * One-off script to set the authorized updater on PolymarketBinaryPriceFeed.
 * Uses the feed OWNER key (not the updater key). Polygon mainnet.
 *
 * Usage:
 *   FEED_OWNER_PRIVATE_KEY=0x... POLYMARKET_BINARY_FEED_ADDRESS=0x... NEW_UPDATER_ADDRESS=0x... node scripts/set-polymarket-feed-updater.js
 * Or derive new updater from your updater key:
 *   FEED_OWNER_PRIVATE_KEY=0x... POLYMARKET_BINARY_FEED_ADDRESS=0x... POLYMARKET_FEED_PRIVATE_KEY=0x... node scripts/set-polymarket-feed-updater.js
 *
 * Keys only from env; never commit keys.
 */
const { ethers } = require("ethers");

const RPC_URL = (process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com").trim();
const FEED_ADDRESS = (process.env.POLYMARKET_BINARY_FEED_ADDRESS || "").trim();
const OWNER_PK = (process.env.FEED_OWNER_PRIVATE_KEY || process.env.POLYMARKET_FEED_OWNER_PRIVATE_KEY || "").trim();
const NEW_UPDATER_ENV = (process.env.NEW_UPDATER_ADDRESS || "").trim();
const UPDATER_PK = (process.env.POLYMARKET_FEED_PRIVATE_KEY || "").trim();

const FEED_ABI = [
  "function updater() view returns (address)",
  "function owner() view returns (address)",
  "function setUpdater(address newUpdater) external",
];

async function main() {
  if (!FEED_ADDRESS || !ethers.utils.isAddress(FEED_ADDRESS)) {
    throw new Error("POLYMARKET_BINARY_FEED_ADDRESS is missing or invalid");
  }
  if (!OWNER_PK || !OWNER_PK.startsWith("0x")) {
    throw new Error("FEED_OWNER_PRIVATE_KEY or POLYMARKET_FEED_OWNER_PRIVATE_KEY is missing or invalid");
  }

  let newUpdaterAddress = NEW_UPDATER_ENV;
  if (!newUpdaterAddress || !ethers.utils.isAddress(newUpdaterAddress)) {
    if (UPDATER_PK && UPDATER_PK.startsWith("0x")) {
      const w = new ethers.Wallet(UPDATER_PK);
      newUpdaterAddress = w.address;
      console.log("Derived NEW_UPDATER_ADDRESS from POLYMARKET_FEED_PRIVATE_KEY:", newUpdaterAddress);
    } else {
      throw new Error("Set NEW_UPDATER_ADDRESS (0x...) or POLYMARKET_FEED_PRIVATE_KEY to derive the new updater address");
    }
  }
  if (!ethers.utils.isAddress(newUpdaterAddress)) {
    throw new Error("NEW_UPDATER_ADDRESS is not a valid address");
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const ownerWallet = new ethers.Wallet(OWNER_PK, provider);
  const feed = new ethers.Contract(FEED_ADDRESS, FEED_ABI, ownerWallet);

  const currentOwner = await feed.owner();
  const currentUpdater = await feed.updater();
  if (currentOwner.toLowerCase() !== ownerWallet.address.toLowerCase()) {
    throw new Error(
      `Current feed owner is ${currentOwner}; signer is ${ownerWallet.address}. Use the feed owner key.`
    );
  }

  console.log("Feed:", FEED_ADDRESS);
  console.log("Current updater:", currentUpdater);
  console.log("New updater:", newUpdaterAddress);
  console.log("Sending setUpdater tx...");

  const tx = await feed.setUpdater(newUpdaterAddress, {
    maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei"),
    maxFeePerGas: ethers.utils.parseUnits("100", "gwei"),
  });
  console.log("Tx hash:", tx.hash);
  const rcpt = await tx.wait();
  if (rcpt.status !== 1) {
    throw new Error("Transaction reverted");
  }
  console.log("Confirmed in block", rcpt.blockNumber);
  const updated = await feed.updater();
  console.log("Feed updater is now:", updated);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
