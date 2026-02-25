import { NextRequest, NextResponse } from "next/server";
import https from "node:https";
import dns from "node:dns";
import { createPublicClient, createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_SLUG = "will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568";
const ZERO = "0x0000000000000000000000000000000000000000";
const CHAIN_ID_HEX = "0x89";
const GAMMA_HOST = "gamma-api.polymarket.com";
const googleResolver = new dns.Resolver();
googleResolver.setServers(["8.8.8.8", "1.1.1.1"]);
const ipCache: Record<string, { ip: string; ts: number }> = {};

function parseOutcomePrices(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
    } catch {
      return [];
    }
  }
  return [];
}

async function isRpcHealthy(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const j = await res.json().catch(() => ({}));
    const chainId = String(j?.result || "").toLowerCase();
    return chainId === CHAIN_ID_HEX;
  } catch {
    return false;
  }
}

async function withRetries<T>(fn: () => Promise<T>, attempts = 3, delayMs = 700): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

async function resolveHost(hostname: string): Promise<string> {
  const cached = ipCache[hostname];
  if (cached && Date.now() - cached.ts < 60_000) return cached.ip;

  try {
    const addrs = await new Promise<string[]>((resolve, reject) =>
      googleResolver.resolve4(hostname, (err, a) => (err ? reject(err) : resolve(a)))
    );
    if (addrs.length > 0) {
      ipCache[hostname] = { ip: addrs[0], ts: Date.now() };
      return addrs[0];
    }
  } catch {
    // fallback to system DNS
  }

  const addr = await new Promise<string>((resolve, reject) =>
    dns.lookup(hostname, 4, (err, address) => (err || !address ? reject(err) : resolve(address)))
  );
  ipCache[hostname] = { ip: addr, ts: Date.now() };
  return addr;
}

async function httpsGetJson(hostname: string, path: string): Promise<any> {
  const ip = await resolveHost(hostname);
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname: ip,
        port: 443,
        path,
        headers: {
          Host: hostname,
          Accept: "application/json",
          "User-Agent": "LMProtocol/1.0",
        },
        servername: hostname,
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (c: Buffer) => { data += c.toString(); });
        res.on("end", () => {
          if ((res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error("Invalid JSON from gamma"));
            }
          } else {
            reject(new Error(`Gamma HTTP ${res.statusCode}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Gamma timeout")); });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const marketId = String(body?.marketId || process.env.NEXT_PUBLIC_MARKET_ID || "").trim();
    const oracleRouter = String(process.env.NEXT_PUBLIC_ORACLE_ROUTER_ADDRESS || "").trim();
    const preferredRpc = String(process.env.POLYGON_RPC_URL || "").trim();
    const fallbackRpc = String(process.env.NEXT_PUBLIC_POLYGON_RPC_URL || "").trim();
    const allowPublicFallback =
      String(process.env.POLYGON_RPC_ALLOW_PUBLIC_FALLBACK || "false").toLowerCase() === "true";
    const rpcCandidates = [preferredRpc, fallbackRpc]
      .filter((v, i, a) => v.length > 0 && a.indexOf(v) === i)
      .concat(allowPublicFallback ? ["https://polygon-bor-rpc.publicnode.com", "https://polygon.llamarpc.com"] : []);
    const updaterPk = String(process.env.POLYMARKET_FEED_PRIVATE_KEY || "").trim();
    const slug = String(process.env.POLYMARKET_MARKET_SLUG || process.env.NEXT_PUBLIC_MARKET_SLUG || DEFAULT_SLUG).trim();

    if (!marketId || !marketId.startsWith("0x")) {
      return NextResponse.json({ success: false, error: "Missing/invalid marketId" }, { status: 400 });
    }
    if (!oracleRouter || oracleRouter === ZERO) {
      return NextResponse.json({ success: false, error: "Oracle router is not configured" }, { status: 400 });
    }
    if (rpcCandidates.length === 0) {
      return NextResponse.json({ success: false, error: "POLYGON_RPC_URL is not configured" }, { status: 400 });
    }
    if (!updaterPk || !updaterPk.startsWith("0x")) {
      return NextResponse.json({ success: false, error: "POLYMARKET_FEED_PRIVATE_KEY is not configured" }, { status: 400 });
    }

    const account = privateKeyToAccount(updaterPk as Hex);
    console.log("[oracle-refresh] POLYMARKET_FEED: derived updater address from POLYMARKET_FEED_PRIVATE_KEY:", account.address);

    const gammaJson = await httpsGetJson(GAMMA_HOST, `/markets?slug=${encodeURIComponent(slug)}&_=${Date.now()}`);
    const market = Array.isArray(gammaJson) ? gammaJson[0] : gammaJson;
    const prices = parseOutcomePrices(market?.outcomePrices);
    const yes = Number(prices?.[0]);
    if (!Number.isFinite(yes)) {
      return NextResponse.json({ success: false, error: "Could not read YES price from Gamma" }, { status: 500 });
    }
    const yesE6 = Math.max(0, Math.min(1_000_000, Math.round(yes * 1_000_000)));

    let lastErr = "No healthy Polygon RPC endpoint available";
    const rpcErrors: Array<{ rpcUrl: string; stage: string; error: string }> = [];
    for (const rpcUrl of rpcCandidates) {
      const healthy = await isRpcHealthy(rpcUrl);
      if (!healthy) {
        rpcErrors.push({ rpcUrl, stage: "healthcheck", error: "eth_chainId failed or wrong chain" });
        continue;
      }
      try {
        const transport = http(rpcUrl, { timeout: 15_000, retryCount: 0 });
        const publicClient = createPublicClient({ chain: polygon, transport });
        const walletClient = createWalletClient({ account, chain: polygon, transport });

        const src: readonly [string, bigint, boolean] = await withRetries(() =>
          publicClient.readContract({
            address: oracleRouter as Hex,
            abi: parseAbi(["function marketSource(bytes32) view returns (address source, uint256 maxAgeSec, bool enabled)"]),
            functionName: "marketSource",
            args: [marketId as Hex],
          })
        );
        const sourceAddr = String(src[0] ?? "");
        const sourceEnabled = Boolean(src[2]);
        if (!sourceEnabled || !sourceAddr || sourceAddr === ZERO) {
          return NextResponse.json({ success: false, error: "Oracle source is disabled/missing for market" }, { status: 400 });
        }

        const feedCfg: readonly [string, boolean, boolean] = await withRetries(() =>
          publicClient.readContract({
            address: sourceAddr as Hex,
            abi: parseAbi(["function feedByMarket(bytes32) view returns (address aggregator, bool invert, bool enabled)"]),
            functionName: "feedByMarket",
            args: [marketId as Hex],
          })
        );
        const feedAddr = String(feedCfg[0] ?? "");
        const feedEnabled = Boolean(feedCfg[2]);
        if (!feedEnabled || !feedAddr || feedAddr === ZERO) {
          return NextResponse.json({ success: false, error: "Feed is disabled/missing for market" }, { status: 400 });
        }

        const feedUpdater = (await withRetries(() =>
          publicClient.readContract({
            address: feedAddr as Hex,
            abi: parseAbi(["function updater() view returns (address)"]),
            functionName: "updater",
          })
        )) as string;
        const feedUpdaterNorm = (feedUpdater ?? "").toLowerCase();
        const configuredUpdaterNorm = account.address.toLowerCase();
        console.log("[oracle-refresh] Feed", feedAddr, "authorized updater:", feedUpdater, "| configured:", account.address);
        if (feedUpdaterNorm !== configuredUpdaterNorm) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Feed update rejected: configured POLYMARKET_FEED_PRIVATE_KEY is not the authorized updater for this feed.",
              configuredUpdaterAddress: account.address,
              feedUpdaterAddress: feedUpdater || null,
              feedAddress: feedAddr,
              hint: "Run scripts/set-polymarket-feed-updater.js with the feed owner key to set updater to configuredUpdaterAddress.",
            },
            { status: 403 }
          );
        }

        const txHash = await withRetries(() =>
          walletClient.writeContract({
            address: feedAddr as Hex,
            abi: parseAbi(["function updatePriceE6(uint256 yesPriceE6) external"]),
            functionName: "updatePriceE6",
            args: [BigInt(yesE6)],
          })
        );
        const rcpt = await withRetries(() => publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 }));

        return NextResponse.json({
          success: true,
          rpcUrl,
          txHash,
          blockNumber: rcpt?.blockNumber,
          yesE6,
          feed: feedAddr,
          updater: account.address,
        });
      } catch (err: unknown) {
        lastErr = err instanceof Error ? err.message : String(err);
        rpcErrors.push({ rpcUrl, stage: "contract_call_or_tx", error: lastErr });
        if (lastErr.toLowerCase().includes("not updater")) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Feed update rejected: configured POLYMARKET_FEED_PRIVATE_KEY is not the authorized updater for this feed.",
              configuredUpdaterAddress: account.address,
              hint: "Run scripts/set-polymarket-feed-updater.js with the feed owner key to set updater to configuredUpdaterAddress.",
              rpcUrl,
              details: rpcErrors,
            },
            { status: 403 }
          );
        }
      }
    }

    return NextResponse.json({ success: false, error: lastErr, details: rpcErrors }, { status: 502 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

