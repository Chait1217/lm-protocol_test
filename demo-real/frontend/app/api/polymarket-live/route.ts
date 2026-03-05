import { NextResponse } from "next/server";

// ── Token IDs for "Will the Iranian regime fall by June 30?" ──
const YES_TOKEN =
  "38397507750621893057346880033441136112987238933685677349709401910643842844855";
const CLOB = "https://clob.polymarket.com";
const GAMMA = "https://gamma-api.polymarket.com";
const GAMMA_SLUG = "will-the-iranian-regime-fall-by-june-30";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function safeFetch(url: string, timeoutMs = 4000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  try {
    // Fetch all CLOB data in parallel — these are the verified working endpoints
    const [bidData, askData, midData, spreadData, lastData, gammaData] =
      await Promise.all([
        safeFetch(`${CLOB}/price?token_id=${YES_TOKEN}&side=buy`),
        safeFetch(`${CLOB}/price?token_id=${YES_TOKEN}&side=sell`),
        safeFetch(`${CLOB}/midpoint?token_id=${YES_TOKEN}`),
        safeFetch(`${CLOB}/spread?token_id=${YES_TOKEN}`),
        safeFetch(`${CLOB}/last-trade-price?token_id=${YES_TOKEN}`),
        safeFetch(`${GAMMA}/markets?slug=${GAMMA_SLUG}`),
      ]);

    // Parse CLOB responses — format verified: {"price":"0.38"}, {"mid":"0.385"}, {"spread":"0.01"}
    const bestBid = bidData?.price ? parseFloat(bidData.price) : null;
    const bestAsk = askData?.price ? parseFloat(askData.price) : null;
    const midpoint = midData?.mid ? parseFloat(midData.mid) : null;
    const spreadVal = spreadData?.spread
      ? parseFloat(spreadData.spread)
      : null;
    const lastTradePrice = lastData?.price ? parseFloat(lastData.price) : null;
    const lastTradeSide: string | null = lastData?.side ?? null;

    // YES price: prefer midpoint, fallback to bid, fallback to last trade
    const yesPrice = midpoint ?? bestBid ?? lastTradePrice ?? null;
    const noPrice = yesPrice != null ? 1 - yesPrice : null;

    // Gamma data for volume (not for prices — CLOB is more accurate)
    const gammaMarket = Array.isArray(gammaData) ? gammaData[0] : gammaData;
    const volume24hr = gammaMarket?.volume24hr
      ? parseFloat(String(gammaMarket.volume24hr))
      : null;
    const oneDayPriceChange = gammaMarket?.oneDayPriceChange
      ? parseFloat(String(gammaMarket.oneDayPriceChange))
      : 0;

    return NextResponse.json({
      success: true,
      market: {
        yesPrice,
        noPrice,
        bestBid,
        bestAsk,
        midpoint,
        spread: spreadVal,
        lastTradePrice,
        lastTradeSide,
        volume24hr,
        oneDayPriceChange,
        outcomePrices: [yesPrice, noPrice],
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
