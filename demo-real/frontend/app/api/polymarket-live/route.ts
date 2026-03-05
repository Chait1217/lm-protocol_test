import { NextResponse } from "next/server";

/**
 * GET /api/polymarket-live
 *
 * Fetches REAL-TIME market data by calling the CLOB API directly.
 * 
 * VERIFIED WORKING ENDPOINTS (tested 2026-03-05):
 *   GET https://clob.polymarket.com/price?token_id={TOKEN}&side=BUY   → {"price":"0.38"}
 *   GET https://clob.polymarket.com/price?token_id={TOKEN}&side=SELL  → {"price":"0.39"}
 *   GET https://clob.polymarket.com/midpoint?token_id={TOKEN}         → {"mid":"0.385"}
 *   GET https://clob.polymarket.com/spread?token_id={TOKEN}           → {"spread":"0.01"}
 *   GET https://clob.polymarket.com/last-trade-price?token_id={TOKEN} → {"price":"0.39","side":"BUY"}
 *
 * Also fetches volume from Gamma API (cached, less critical).
 */

const CLOB = "https://clob.polymarket.com";
const GAMMA = "https://gamma-api.polymarket.com";

const YES_TOKEN = "38397507750621893057346880033441136112987238933685677349709401910643842844855";
const MARKET_SLUG = "will-the-iranian-regime-fall-by-june-30";

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
      fetchJson(`${CLOB}/price?token_id=${YES_TOKEN}&side=BUY`),
      fetchJson(`${CLOB}/price?token_id=${YES_TOKEN}&side=SELL`),
      fetchJson(`${CLOB}/midpoint?token_id=${YES_TOKEN}`),
      fetchJson(`${CLOB}/spread?token_id=${YES_TOKEN}`),
      fetchJson(`${CLOB}/last-trade-price?token_id=${YES_TOKEN}`),
      fetchJson(`${GAMMA}/markets?slug=${MARKET_SLUG}`),
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

    return NextResponse.json({
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
  } catch (err) {
    console.error("polymarket-live error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
