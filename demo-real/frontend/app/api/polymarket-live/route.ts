import { NextResponse } from "next/server";

// ── Token IDs for "Will the Iranian regime fall by June 30?" ──
const YES_TOKEN =
  "38397507750621893057346880033441136112987238933685677349709401910643842844855";
const NO_TOKEN =
  "95949957895141858444199258452803633110472396604599808168788254125381075552218";
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
    // Fetch BOTH YES and NO token data from CLOB in parallel
    const [
      yesBidData, yesAskData, yesMidData, yesSpreadData, yesLastData,
      noBidData, noAskData, noMidData,
      gammaData,
    ] = await Promise.all([
      // YES token
      safeFetch(`${CLOB}/price?token_id=${YES_TOKEN}&side=buy`),
      safeFetch(`${CLOB}/price?token_id=${YES_TOKEN}&side=sell`),
      safeFetch(`${CLOB}/midpoint?token_id=${YES_TOKEN}`),
      safeFetch(`${CLOB}/spread?token_id=${YES_TOKEN}`),
      safeFetch(`${CLOB}/last-trade-price?token_id=${YES_TOKEN}`),
      // NO token
      safeFetch(`${CLOB}/price?token_id=${NO_TOKEN}&side=buy`),
      safeFetch(`${CLOB}/price?token_id=${NO_TOKEN}&side=sell`),
      safeFetch(`${CLOB}/midpoint?token_id=${NO_TOKEN}`),
      // Gamma for 24h volume only
      safeFetch(`${GAMMA}/markets?slug=${GAMMA_SLUG}`),
    ]);

    // Parse YES CLOB responses
    const yesBestBid = yesBidData?.price ? parseFloat(yesBidData.price) : null;
    const yesBestAsk = yesAskData?.price ? parseFloat(yesAskData.price) : null;
    const yesMidpoint = yesMidData?.mid ? parseFloat(yesMidData.mid) : null;
    const yesSpread = yesSpreadData?.spread ? parseFloat(yesSpreadData.spread) : null;
    const yesLastPrice = yesLastData?.price ? parseFloat(yesLastData.price) : null;
    const yesLastSide: string | null = yesLastData?.side ?? null;

    // Parse NO CLOB responses
    const noBestBid = noBidData?.price ? parseFloat(noBidData.price) : null;
    const noBestAsk = noAskData?.price ? parseFloat(noAskData.price) : null;
    const noMidpoint = noMidData?.mid ? parseFloat(noMidData.mid) : null;

    // YES price: prefer midpoint, fallback to average of bid/ask, fallback to last trade
    const yesPrice = yesMidpoint
      ?? (yesBestBid != null && yesBestAsk != null ? (yesBestBid + yesBestAsk) / 2 : null)
      ?? yesLastPrice
      ?? null;

    // NO price: prefer NO midpoint, fallback to 1 - yesPrice
    const noPrice = noMidpoint
      ?? (noBestBid != null && noBestAsk != null ? (noBestBid + noBestAsk) / 2 : null)
      ?? (yesPrice != null ? 1 - yesPrice : null);

    // Calculate spreads from bid/ask
    const yesSpreadCalc = yesSpread
      ?? (yesBestBid != null && yesBestAsk != null ? yesBestAsk - yesBestBid : null);
    const noSpreadCalc = noBestBid != null && noBestAsk != null
      ? noBestAsk - noBestBid
      : null;

    // Gamma data for volume
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
        // YES data
        yesPrice,
        yesBestBid: yesBestBid,
        yesBestAsk: yesBestAsk,
        yesMidpoint,
        yesSpread: yesSpreadCalc,
        // NO data
        noPrice,
        noBestBid: noBestBid,
        noBestAsk: noBestAsk,
        noMidpoint,
        noSpread: noSpreadCalc,
        // Legacy fields (for backward compat)
        bestBid: yesBestBid,
        bestAsk: yesBestAsk,
        midpoint: yesMidpoint,
        spread: yesSpreadCalc,
        // Trade info
        lastTradePrice: yesLastPrice,
        lastTradeSide: yesLastSide,
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
