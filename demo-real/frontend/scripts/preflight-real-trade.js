/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ZERO = "0x0000000000000000000000000000000000000000";
const ENV_PATH = path.resolve(__dirname, "../.env.local");

function loadDotEnvLocal() {
  if (!fs.existsSync(ENV_PATH)) return;
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function isAddress(v) {
  return typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);
}

function isBytes32(v) {
  return typeof v === "string" && /^0x[a-fA-F0-9]{64}$/.test(v);
}

function add(result, ok, label, detail) {
  result.push({ ok, label, detail });
}

async function main() {
  loadDotEnvLocal();

  const env = process.env;
  const result = [];

  const chainId = (env.NEXT_PUBLIC_POLYGON_CHAIN_ID || "").trim();
  const publicRpc = (env.NEXT_PUBLIC_POLYGON_RPC_URL || "").trim();
  const rpc = (env.POLYGON_RPC_URL || publicRpc).trim();
  const marketId = (env.NEXT_PUBLIC_MARKET_ID || "").trim();
  const routerAddr = (env.NEXT_PUBLIC_ORACLE_ROUTER_ADDRESS || "").trim();
  const sourceVault = (env.NEXT_PUBLIC_VAULT_ADDRESS || "").trim();
  const sourceEngine = (env.NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS || "").trim();
  const usdc = (env.NEXT_PUBLIC_USDC_ADDRESS || "").trim();
  const walletConnectId = (env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "").trim();
  const updaterPk = (env.POLYMARKET_FEED_PRIVATE_KEY || "").trim();

  add(result, chainId === "137", "NEXT_PUBLIC_POLYGON_CHAIN_ID", chainId || "[missing]");
  add(result, !!publicRpc, "NEXT_PUBLIC_POLYGON_RPC_URL", publicRpc || "[missing]");
  add(result, !!rpc, "POLYGON_RPC_URL (or fallback)", rpc || "[missing]");
  add(result, isAddress(usdc), "NEXT_PUBLIC_USDC_ADDRESS", usdc || "[missing]");
  add(result, isAddress(sourceVault), "NEXT_PUBLIC_VAULT_ADDRESS", sourceVault || "[missing]");
  add(result, isAddress(sourceEngine), "NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS", sourceEngine || "[missing]");
  add(result, isAddress(routerAddr), "NEXT_PUBLIC_ORACLE_ROUTER_ADDRESS", routerAddr || "[missing]");
  add(result, isBytes32(marketId), "NEXT_PUBLIC_MARKET_ID", marketId || "[missing]");

  const wcOk = !!walletConnectId && walletConnectId !== "your_walletconnect_project_id";
  add(
    result,
    wcOk,
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
    wcOk ? "[set]" : "placeholder or missing (safe if you only use MetaMask)"
  );

  const updaterPkOk = /^0x[a-fA-F0-9]{64}$/.test(updaterPk);
  add(result, updaterPkOk, "POLYMARKET_FEED_PRIVATE_KEY", updaterPkOk ? "[set]" : "[missing/invalid]");

  if (!rpc) {
    printResult(result);
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const block = await provider.getBlockNumber();
  add(result, block > 0, "RPC connectivity", `latest block ${block}`);

  for (const [name, addr] of [
    ["Vault bytecode", sourceVault],
    ["MarginEngine bytecode", sourceEngine],
    ["OracleRouter bytecode", routerAddr],
  ]) {
    const code = isAddress(addr) ? await provider.getCode(addr) : "0x";
    add(result, code !== "0x", name, code !== "0x" ? "deployed" : "missing");
  }

  if (isAddress(routerAddr) && isBytes32(marketId)) {
    const router = new ethers.Contract(
      routerAddr,
      ["function marketSource(bytes32) view returns (address source, uint256 maxAgeSec, bool enabled)"],
      provider
    );
    const src = await router.marketSource(marketId);
    const source = src.source || src[0];
    const maxAgeSec = Number(src.maxAgeSec || src[1]);
    const srcEnabled = Boolean(src.enabled ?? src[2]);
    add(result, isAddress(source), "marketSource.source", source || "[zero]");
    add(result, srcEnabled, "marketSource.enabled", String(srcEnabled));
    add(result, Number.isFinite(maxAgeSec) && maxAgeSec > 0, "marketSource.maxAgeSec", String(maxAgeSec));

    if (isAddress(source) && source !== ZERO) {
      const adapter = new ethers.Contract(
        source,
        ["function feedByMarket(bytes32) view returns (address aggregator, bool invert, bool enabled)"],
        provider
      );
      const cfg = await adapter.feedByMarket(marketId);
      const feed = cfg.aggregator || cfg[0];
      const feedEnabled = Boolean(cfg.enabled ?? cfg[2]);
      add(result, isAddress(feed) && feed !== ZERO, "feedByMarket.aggregator", feed || "[zero]");
      add(result, feedEnabled, "feedByMarket.enabled", String(feedEnabled));

      if (isAddress(feed) && feed !== ZERO) {
        const feedC = new ethers.Contract(
          feed,
          [
            "function owner() view returns (address)",
            "function updater() view returns (address)",
            "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
          ],
          provider
        );

        const [owner, updater, roundData] = await Promise.all([
          feedC.owner(),
          feedC.updater(),
          feedC.latestRoundData(),
        ]);

        const updatedAt = Number(roundData[3]);
        const ageSec = Math.max(0, Math.floor(Date.now() / 1000) - updatedAt);
        add(result, isAddress(owner), "feed.owner", owner);
        add(result, isAddress(updater), "feed.updater", updater);
        add(result, updatedAt > 0, "feed.updatedAt", `${updatedAt}`);
        add(
          result,
          Number.isFinite(maxAgeSec) && ageSec <= maxAgeSec,
          "feed freshness vs maxAge",
          `ageSec=${ageSec}, maxAgeSec=${maxAgeSec}`
        );

        if (updaterPkOk) {
          const configuredUpdater = new ethers.Wallet(updaterPk).address;
          add(
            result,
            configuredUpdater.toLowerCase() === String(updater).toLowerCase(),
            "POLYMARKET_FEED_PRIVATE_KEY matches feed.updater",
            configuredUpdater
          );
        }
      }
    }
  }

  if (isAddress(sourceEngine) && isBytes32(marketId)) {
    const marginEngine = new ethers.Contract(
      sourceEngine,
      ["function getMarketOraclePrice(bytes32 marketId) view returns (uint256)"],
      provider
    );
    try {
      const px = await marginEngine.getMarketOraclePrice(marketId);
      const n = Number(px.toString());
      add(result, Number.isFinite(n) && n > 0, "marginEngine.getMarketOraclePrice", px.toString());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      add(result, false, "marginEngine.getMarketOraclePrice", message);
    }
  }

  printResult(result);
  const allGood = result.every((r) => r.ok);
  if (!allGood) process.exit(1);
}

function printResult(result) {
  console.log("\n=== Real Trade Preflight ===");
  for (const row of result) {
    const marker = row.ok ? "READY" : "NOT_READY";
    console.log(`${marker} | ${row.label} | ${row.detail}`);
  }
  const pass = result.filter((r) => r.ok).length;
  const fail = result.length - pass;
  console.log(`\nResult: ${pass} passed, ${fail} failed.`);
}

main().catch((err) => {
  console.error("Preflight failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
