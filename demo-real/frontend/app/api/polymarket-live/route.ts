import { NextResponse } from "next/server";
import { MARKET_CONFIG } from "@/lib/polymarketConfig";

/**
 * GET /api/polymarket-live
 *
 * Fetches REAL-TIME market data by calling the CLOB API.
 * Uses unified MARKET_CONFIG.
 */

const { yesTokenId, clobUrl, gammaUrl, slug } = MARKET_CONFIG;

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function GET() {
  try {
    // Fetch all CLOB data in parallel for speed
    const [bidData, askData, midData, spreadData, lastTradeData, gammaData] = await Promise.all([
      fetchJson(`${clobUrl}/price?token_id=${yesTokenId}&side=BUY`),
      fetchJson(`${clobUrl}/price?token_id=${yesTokenId}&side=SELL`),
      fetchJson(`${clobUrl}/midpoint?token_id=${yesTokenId}`),
      fetchJson(`${clobUrl}/spread?token_id=${yesTokenId}`),
      fetchJson(`${clobUrl}/last-trade-price?token_id=${yesTokenId}`),
      fetchJson(`${gammaUrl}/markets?slug=${slug}`),
    ]);

    // Parse CLOB responses — all return string values
    const bestBid = bidData?.price ? parseFloat(bidData.price) : null;
    const bestAsk = askData?.price ? parseFloat(askData.price) : null;
    const midpoint = midData?.mid ? parseFloat(midData.mid) : null;
    const spread = spreadData?.spread ? parseFloat(spreadData.spread) : null;
    const lastTradePrice = lastTradeData?.price ? parseFloat(lastTradeData.price) : null;

    // YES price = midpoint (or best bid if midpoint unavailable)
    const yesPrice = midpoint ?? bestBid ?? lastTradePrice ?? null;
    const noPrice = yesPrice != null ? 1 - yesPrice : null;

    // Gamma data for volume and 24h change (less critical, can be stale)
    const gamma = Array.isArray(gammaData) ? gammaData[0] : gammaData;
    const volume24hr = gamma?.volume24hr ? parseFloat(String(gamma.volume24hr)) : null;
    const oneDayPriceChange = gamma?.oneDayPriceChange ? parseFloat(String(gamma.oneDayPriceChange)) : 0;

    const response = NextResponse.json({
      success: true,
      market: {
        yesPrice,
        noPrice,
        bestBid,
        bestAsk,
        midpoint,
        spread,
        lastTradePrice,
        lastTradeSide: lastTradeData?.side || null,
        volume24hr,
        oneDayPriceChange,
        // Keep outcomePrices for backward compat
        outcomePrices: [yesPrice, noPrice],
      },
    });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  } catch (err) {
    console.error("polymarket-live error:", err);
    const errorResponse = NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
    errorResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    errorResponse.headers.set("Pragma", "no-cache");
    errorResponse.headers.set("Expires", "0");
    return errorResponse;
  }
}
