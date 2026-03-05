import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/polymarket-history?interval=1d
 *
 * Fetches price history for the Iranian regime market from the CLOB API.
 * Uses the YES token ID to get historical price points.
 *
 * Intervals: 1m, 5m, 1h, 6h, 1d, 1w
 */

const CLOB_HOST = "https://clob.polymarket.com";
const YES_TOKEN_ID =
  "38397507750621893057346880033441136112987238933685677349709401910643842844855";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Fidelity mapping for CLOB prices-history endpoint
const FIDELITY_MAP: Record<string, number> = {
  "1m": 1,    // 1 minute
  "5m": 5,    // 5 minutes
  "1h": 60,   // 1 hour
  "6h": 360,  // 6 hours
  "1d": 1440, // 1 day
  "1w": 10080,// 1 week
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const interval = searchParams.get("interval") || "1h";
    const fidelity = FIDELITY_MAP[interval] || 60;

    // Try CLOB prices-history endpoint
    const url = `${CLOB_HOST}/prices-history?market=${YES_TOKEN_ID}&interval=all&fidelity=${fidelity}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (res.ok) {
      const data = await res.json();
      // CLOB returns { history: [{ t: timestamp, p: price }] }
      if (data?.history && Array.isArray(data.history) && data.history.length > 0) {
        return NextResponse.json({
          success: true,
          history: data.history,
          source: "clob",
        });
      }
    }

    // Fallback: Try Gamma API timeseries
    const gammaUrl = `https://gamma-api.polymarket.com/markets/958443/timeseries?fidelity=${fidelity}`;
    const gammaRes = await fetch(gammaUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (gammaRes.ok) {
      const gammaData = await gammaRes.json();
      if (Array.isArray(gammaData) && gammaData.length > 0) {
        const history = gammaData.map((point: any) => ({
          t: new Date(point.t || point.timestamp || point.date).getTime() / 1000,
          p: parseFloat(point.p || point.price || point.yes || "0"),
        })).filter((p: any) => p.p > 0 && !isNaN(p.t));

        return NextResponse.json({
          success: true,
          history,
          source: "gamma",
        });
      }
    }

    // Last fallback: generate from current price
    const liveRes = await fetch(`${CLOB_HOST}/price?token_id=${YES_TOKEN_ID}&side=BUY`);
    if (liveRes.ok) {
      const liveData = await liveRes.json();
      const currentPrice = parseFloat(liveData.price || "0.5");
      const now = Math.floor(Date.now() / 1000);
      const history = [];
      // Generate 24 synthetic points over the last 24 hours
      for (let i = 24; i >= 0; i--) {
        history.push({
          t: now - i * 3600,
          p: currentPrice + (Math.random() - 0.5) * 0.02,
        });
      }
      history[history.length - 1].p = currentPrice;

      return NextResponse.json({
        success: true,
        history,
        source: "synthetic",
      });
    }

    return NextResponse.json(
      { success: false, error: "Could not fetch price history from any source" },
      { status: 502 }
    );
  } catch (err) {
    console.error("polymarket-history error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
