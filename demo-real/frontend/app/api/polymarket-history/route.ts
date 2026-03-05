import { NextResponse } from "next/server";

/**
 * GET /api/polymarket-history?interval=1d&fidelity=60
 *
 * VERIFIED WORKING (tested 2026-03-05):
 *   GET https://clob.polymarket.com/prices-history?market={YES_TOKEN}&interval=1d&fidelity=60
 *   Response: { "history": [{ "t": 1772665221, "p": 0.385 }, ...] }
 *
 * Tested results:
 *   interval=1h  fidelity=60  → 2 points
 *   interval=1d  fidelity=60  → 25 points
 *   interval=1w  fidelity=60  → 169 points
 *   interval=max fidelity=100 → 404 points
 */

const YES_TOKEN = "38397507750621893057346880033441136112987238933685677349709401910643842844855";
const CLOB = "https://clob.polymarket.com";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const interval = searchParams.get("interval") || "1d";
  const fidelity = searchParams.get("fidelity") || "60";

  try {
    const url = `${CLOB}/prices-history?market=${YES_TOKEN}&interval=${interval}&fidelity=${fidelity}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { success: false, error: `CLOB returned ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    // Response format: { history: [{ t: number, p: number }, ...] }
    const history = data?.history || [];

    // Also fetch current midpoint to append as latest data point
    let currentPrice: number | null = null;
    try {
      const midRes = await fetch(`${CLOB}/midpoint?token_id=${YES_TOKEN}`, { cache: "no-store" });
      if (midRes.ok) {
        const midData = await midRes.json();
        currentPrice = midData?.mid ? parseFloat(midData.mid) : null;
      }
    } catch { /* ignore */ }

    // Append current price as latest point if we have it
    if (currentPrice != null) {
      const now = Math.floor(Date.now() / 1000);
      const lastPoint = history.length > 0 ? history[history.length - 1] : null;
      // Only append if different from last point or more than 10s newer
      if (!lastPoint || now - lastPoint.t > 10) {
        history.push({ t: now, p: currentPrice });
      }
    }

    return NextResponse.json({
      success: true,
      history,
      interval,
      fidelity: parseInt(fidelity),
      points: history.length,
    });
  } catch (err) {
    console.error("polymarket-history error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
