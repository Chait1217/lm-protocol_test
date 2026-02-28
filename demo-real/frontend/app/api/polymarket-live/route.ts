import { NextResponse } from "next/server";
import https from "node:https";
import dns from "node:dns";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GAMMA_HOST = "gamma-api.polymarket.com";
const CLOB_HOST = "clob.polymarket.com";
const SLUG = "will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const resolver = new dns.Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

const ipCache = new Map<string, { ip: string; ts: number }>();
const CACHE_TTL_MS = 120_000;

async function resolveHost(host: string): Promise<string> {
  const cached = ipCache.get(host);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.ip;

  try {
    const addrs = await new Promise<string[]>((resolve, reject) =>
      resolver.resolve4(host, (err, a) => (err ? reject(err) : resolve(a)))
    );
    if (addrs.length > 0) {
      ipCache.set(host, { ip: addrs[0], ts: Date.now() });
      return addrs[0];
    }
  } catch {
    // fallback to system DNS
    const addr = await new Promise<string>((resolve, reject) =>
      dns.lookup(host, 4, (err, address) =>
        err || !address ? reject(err) : resolve(address))
    );
    ipCache.set(host, { ip: addr, ts: Date.now() });
    return addr;
  }
  throw new Error(`DNS resolution failed for ${host}`);
}

/** GET request to host + path using resolved IP (bypasses broken system DNS). */
async function fetchViaResolvedIp(
  host: string,
  path: string,
  timeoutMs = 12000
): Promise<{ status: number; data: unknown }> {
  const ip = await resolveHost(host);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`Request timeout for ${host}`));
    }, timeoutMs);

    const req = https.request(
        {
          hostname: ip,
          port: 443,
          path,
          method: "GET",
          headers: {
            Host: host,
            Accept: "application/json",
            "User-Agent": "LMProtocol/1.0",
          },
          servername: host,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            clearTimeout(timer);
            const body = Buffer.concat(chunks).toString("utf8");
            let data: unknown;
            try {
              data = JSON.parse(body);
            } catch {
              data = body;
            }
            resolve({ status: res.statusCode ?? 500, data });
          });
        }
      );
    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.end();
  });
}

let lastKnownMarket: Record<string, unknown> | null = null;

function buildFallbackMarket(): Record<string, unknown> {
  return {
    question: "Will Gavin Newsom win the 2028 Democratic presidential nomination?",
    title: "Will Gavin Newsom win the 2028 Democratic presidential nomination?",
    slug: SLUG,
    outcomePrices: JSON.stringify([0.5, 0.5]),
    bestBid: 0.48,
    bestAsk: 0.52,
    priceSource: "gamma",
    oneDayPriceChange: "0",
    volume: "0",
    volume24hr: "0",
    volumeNum: 0,
    liquidity: "0",
    clobTokenIds: [],
    tickSize: "0.01",
    negRisk: true,
  };
}

async function fetchGammaMarket(): Promise<unknown> {
  const path = `/markets?slug=${encodeURIComponent(SLUG)}&_=${Date.now()}`;
  const { status, data } = await fetchViaResolvedIp(GAMMA_HOST, path, 12000);
  if (status !== 200) throw new Error(`Gamma API HTTP ${status}`);
  return data;
}

async function fetchClobBook(
  tokenId: string
): Promise<{ bestBid: number | null; bestAsk: number | null }> {
  try {
    const path = `/book?token_id=${encodeURIComponent(tokenId)}&_=${Date.now()}`;
    const { status, data } = await fetchViaResolvedIp(CLOB_HOST, path, 8000);
    if (status !== 200) return { bestBid: null, bestAsk: null };
    const book = data as { bids?: Array<{ price: string }>; asks?: Array<{ price: string }> };
    const bids = book?.bids ?? [];
    const asks = book?.asks ?? [];
    const bestBid = bids.length ? parseFloat(bids[0].price) : null;
    const bestAsk = asks.length ? parseFloat(asks[0].price) : null;
    if (
      bestBid != null &&
      bestAsk != null &&
      bestBid > 0.05 &&
      bestAsk < 0.95
    ) {
      return { bestBid, bestAsk };
    }
    return { bestBid: null, bestAsk: null };
  } catch {
    return { bestBid: null, bestAsk: null };
  }
}

export async function GET() {
  try {
    const data = await fetchGammaMarket();
    const market = Array.isArray(data) ? data[0] : data;

    if (!market || typeof market !== "object") {
      const fallback = lastKnownMarket ?? buildFallbackMarket();
      return NextResponse.json(
        {
          success: true,
          market: fallback,
          warning: "Market not found; using fallback.",
        },
        { headers: noCacheHeaders }
      );
    }

    let clobTokenIds: string[] = [];
    try {
      clobTokenIds =
        typeof (market as Record<string, unknown>).clobTokenIds === "string"
          ? JSON.parse((market as Record<string, unknown>).clobTokenIds as string)
          : Array.isArray((market as Record<string, unknown>).clobTokenIds)
            ? (market as Record<string, unknown>).clobTokenIds as string[]
            : [];
    } catch {
      clobTokenIds = [];
    }

    let priceSource: "clob" | "gamma" = "gamma";
    if (clobTokenIds.length > 0) {
      try {
        const { bestBid, bestAsk } = await fetchClobBook(clobTokenIds[0]);
        if (bestBid != null && bestAsk != null) {
          (market as Record<string, unknown>).bestBid = bestBid;
          (market as Record<string, unknown>).bestAsk = bestAsk;
          priceSource = "clob";
        }
      } catch {
        // leave bestBid/bestAsk as-is from Gamma if any
      }
    }
    // Polymarket docs: Gamma outcomePrices = discovery/cached (not live); CLOB book = live
    (market as Record<string, unknown>).priceSource = priceSource;

    lastKnownMarket = market as Record<string, unknown>;
    return NextResponse.json(
      { success: true, market },
      { headers: noCacheHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[polymarket-live] Error:", message);
    const market = lastKnownMarket ?? buildFallbackMarket();
    return NextResponse.json(
      {
        success: true,
        market,
        warning: `Live data temporarily unavailable: ${message}`,
      },
      { headers: noCacheHeaders }
    );
  }
}
