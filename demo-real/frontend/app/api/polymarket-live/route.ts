import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const POLYMARKET_GAMMA = "https://gamma-api.polymarket.com";
const POLYMARKET_CLOB = "https://clob.polymarket.com";
const SLUG = "will-bitcoin-reach-100000-by-december-31-2026-571";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

async function fetchClobBook(tokenId: string): Promise<{ bestBid: number | null; bestAsk: number | null }> {
  try {
    const url = `${POLYMARKET_CLOB}/book?token_id=${encodeURIComponent(tokenId)}&_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) return { bestBid: null, bestAsk: null };
    const book = await res.json();
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

export async function GET() {
  try {
    const gammaUrl = `${POLYMARKET_GAMMA}/markets?slug=${SLUG}&_=${Date.now()}`;
    const response = await fetch(gammaUrl, {
      headers: { Accept: "application/json", "User-Agent": "LMProtocol/1.0" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Polymarket API error: ${response.status}` },
        { status: 502, headers: noCacheHeaders }
      );
    }

    const data = await response.json();
    const market = Array.isArray(data) ? data[0] : data;

    if (!market) {
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

    if (clobTokenIds.length > 0) {
      const yesTokenId = clobTokenIds[0];
      const { bestBid, bestAsk } = await fetchClobBook(yesTokenId);
      if (bestBid != null && bestAsk != null) {
        market.bestBid = bestBid;
        market.bestAsk = bestAsk;
      }
    }

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
