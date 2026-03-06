import { NextResponse } from "next/server";
import {
  DEFAULT_MARKET_SLUG,
  POLYMARKET_CLOB_API,
  POLYMARKET_GAMMA_API,
  POLYMARKET_YES_TOKEN,
} from "@/lib/polymarketConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [bidData, askData, midData, spreadData, lastTradeData, gammaData] =
      await Promise.all([
        fetchJson(`${POLYMARKET_CLOB_API}/price?token_id=${POLYMARKET_YES_TOKEN}&side=BUY`),
        fetchJson(`${POLYMARKET_CLOB_API}/price?token_id=${POLYMARKET_YES_TOKEN}&side=SELL`),
        fetchJson(`${POLYMARKET_CLOB_API}/midpoint?token_id=${POLYMARKET_YES_TOKEN}`),
        fetchJson(`${POLYMARKET_CLOB_API}/spread?token_id=${POLYMARKET_YES_TOKEN}`),
        fetchJson(`${POLYMARKET_CLOB_API}/last-trade-price?token_id=${POLYMARKET_YES_TOKEN}`),
        fetchJson(`${POLYMARKET_GAMMA_API}/markets?slug=${DEFAULT_MARKET_SLUG}`),
      ]);

    const bestBid = bidData?.price ? parseFloat(String(bidData.price)) : null;
    const bestAsk = askData?.price ? parseFloat(String(askData.price)) : null;
    const midpoint = midData?.mid ? parseFloat(String(midData.mid)) : null;
    const spread = spreadData?.spread ? parseFloat(String(spreadData.spread)) : null;
    const lastTradePrice = lastTradeData?.price
      ? parseFloat(String(lastTradeData.price))
      : null;

    const yesPrice = midpoint ?? bestBid ?? lastTradePrice ?? null;
    const noPrice = yesPrice != null ? 1 - yesPrice : null;

    const gamma = Array.isArray(gammaData) ? gammaData[0] : gammaData;
    const volume24hr = gamma?.volume24hr
      ? parseFloat(String(gamma.volume24hr))
      : null;
    const oneDayPriceChange = gamma?.oneDayPriceChange
      ? parseFloat(String(gamma.oneDayPriceChange))
      : 0;

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
        outcomePrices: [yesPrice, noPrice],
      },
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    return response;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
