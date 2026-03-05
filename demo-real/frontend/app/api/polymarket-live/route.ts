import { NextResponse } from "next/server";

/**
 * GET /api/polymarket-live
 *
 * Fetches live market data from the Polymarket Gamma API.
 * Returns YES/NO prices, best bid/ask, spread, volume, and 24h change.
 *
 * UPDATED: Market changed to "Will the Iranian regime fall by June 30?"
 */

const GAMMA_API = "https://gamma-api.polymarket.com";
const MARKET_SLUG = "will-the-iranian-regime-fall-by-june-30";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetch(`${GAMMA_API}/markets?slug=${MARKET_SLUG}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Gamma API returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const market = Array.isArray(data) ? data[0] : data;

    if (!market) {
      return NextResponse.json(
        { success: false, error: "Market not found" },
        { status: 404 }
      );
    }

    // Parse outcome prices
    let outcomePrices: number[] = [];
    try {
      outcomePrices =
        typeof market.outcomePrices === "string"
          ? JSON.parse(market.outcomePrices)
          : market.outcomePrices ?? [];
    } catch {
      outcomePrices = [];
    }

    // Parse CLOB token IDs
    let clobTokenIds: string[] = [];
    try {
      clobTokenIds =
        typeof market.clobTokenIds === "string"
          ? JSON.parse(market.clobTokenIds)
          : market.clobTokenIds ?? [];
    } catch {
      clobTokenIds = [];
    }

    return NextResponse.json({
      success: true,
      market: {
        id: market.id,
        question: market.question,
        slug: market.slug,
        conditionId: market.conditionId,
        outcomePrices,
        clobTokenIds,
        bestBid: market.bestBid,
        bestAsk: market.bestAsk,
        lastTradePrice: market.lastTradePrice,
        spread: market.spread,
        oneDayPriceChange: market.oneDayPriceChange,
        oneHourPriceChange: market.oneHourPriceChange,
        oneWeekPriceChange: market.oneWeekPriceChange,
        volume: market.volume,
        volume24hr: market.volume24hr,
        liquidity: market.liquidity,
        endDate: market.endDate,
        active: market.active,
        closed: market.closed,
        negRisk: market.negRisk ?? false,
        orderPriceMinTickSize: market.orderPriceMinTickSize,
      },
    });
  } catch (err) {
    console.error("polymarket-live error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
