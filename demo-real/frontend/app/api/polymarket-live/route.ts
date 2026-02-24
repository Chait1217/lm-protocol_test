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

/* ---------- DNS resolution with Google/Cloudflare fallback ---------- */

const googleResolver = new dns.Resolver();
googleResolver.setServers(["8.8.8.8", "1.1.1.1"]);

const ipCache: Record<string, { ip: string; ts: number }> = {};

async function resolveHost(hostname: string): Promise<string> {
  const cached = ipCache[hostname];
  if (cached && Date.now() - cached.ts < 60_000) return cached.ip;

  // Try Google DNS directly (system DNS is unreliable for polymarket)
  try {
    const addrs = await new Promise<string[]>((resolve, reject) =>
      googleResolver.resolve4(hostname, (err, a) => (err ? reject(err) : resolve(a)))
    );
    if (addrs.length > 0) {
      ipCache[hostname] = { ip: addrs[0], ts: Date.now() };
      return addrs[0];
    }
  } catch { /* fall through */ }

  // Fallback: try system DNS
  try {
    const addr = await new Promise<string>((resolve, reject) =>
      dns.lookup(hostname, 4, (err, address) => (err || !address ? reject(err) : resolve(address)))
    );
    ipCache[hostname] = { ip: addr, ts: Date.now() };
    return addr;
  } catch { /* fall through */ }

  throw new Error(`DNS resolution failed for ${hostname}`);
}

/* ---------- HTTPS GET with resolved IP + SNI ---------- */

function httpsGet(hostname: string, ip: string, path: string): Promise<any> {
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
        servername: hostname, // TLS SNI
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (c: Buffer) => { data += c.toString(); });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error("Invalid JSON from " + hostname)); }
          } else {
            reject(new Error(`HTTP ${res.statusCode} from ${hostname}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout " + hostname)); });
  });
}

/* ---------- Polymarket helpers ---------- */

async function fetchGammaMarket() {
  const ip = await resolveHost(GAMMA_HOST);
  return httpsGet(GAMMA_HOST, ip, `/markets?slug=${SLUG}&_=${Date.now()}`);
}

async function fetchClobBook(tokenId: string): Promise<{ bestBid: number | null; bestAsk: number | null }> {
  try {
    const ip = await resolveHost(CLOB_HOST);
    const book = await httpsGet(CLOB_HOST, ip, `/book?token_id=${encodeURIComponent(tokenId)}&_=${Date.now()}`);
    const bids = book?.bids ?? [];
    const asks = book?.asks ?? [];
    const bestBid = bids.length ? parseFloat(bids[0].price) : null;
    const bestAsk = asks.length ? parseFloat(asks[0].price) : null;
    if (bestBid != null && bestAsk != null && bestBid > 0.05 && bestAsk < 0.95) {
      return { bestBid, bestAsk };
    }
    return { bestBid: null, bestAsk: null };
  } catch {
    return { bestBid: null, bestAsk: null };
  }
}

/* ---------- Route handler ---------- */

export async function GET() {
  try {
    const data = await fetchGammaMarket();
    const market = Array.isArray(data) ? data[0] : data;

    if (!market || typeof market !== "object") {
      return NextResponse.json(
        { success: false, error: "Market not found" },
        { status: 404, headers: noCacheHeaders }
      );
    }

    let clobTokenIds: string[] = [];
    try {
      clobTokenIds = typeof market.clobTokenIds === "string"
        ? JSON.parse(market.clobTokenIds)
        : Array.isArray(market.clobTokenIds)
          ? market.clobTokenIds
          : [];
    } catch {
      clobTokenIds = [];
    }

    try {
      if (clobTokenIds.length > 0) {
        const { bestBid, bestAsk } = await fetchClobBook(clobTokenIds[0]);
        if (bestBid != null && bestAsk != null) {
          (market as Record<string, unknown>).bestBid = bestBid;
          (market as Record<string, unknown>).bestAsk = bestAsk;
        }
      }
    } catch { /* bestBid/bestAsk stay undefined */ }

    return NextResponse.json({ success: true, market }, { headers: noCacheHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[polymarket-live] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
