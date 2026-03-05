import { NextResponse } from "next/server";

const WALLET =
  process.env.NEXT_PUBLIC_TRADER_WALLET ||
  "0x6CcBdc898016F2E49ada47496696d635b8D4fB31";
const CLOB = "https://clob.polymarket.com";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function safeFetch(url: string, timeoutMs = 5000): Promise<any> {
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
    // Verified working endpoint: returns array of position objects
    const url = `https://data-api.polymarket.com/positions?user=${WALLET}&sizeThreshold=0&limit=100`;
    const rawPositions = await safeFetch(url);

    if (!Array.isArray(rawPositions)) {
      return NextResponse.json({
        success: true,
        positions: [],
        wallet: WALLET,
      });
    }

    // Filter out dust positions and enrich with live CLOB prices
    const positions = [];
    for (const p of rawPositions) {
      const size = parseFloat(p.size || "0");
      if (size < 0.001) continue;

      // Get live price from CLOB for this specific asset
      let livePrice = parseFloat(p.curPrice || "0");
      try {
        const clobPrice = await safeFetch(
          `${CLOB}/price?token_id=${p.asset}&side=buy`,
          2000
        );
        if (clobPrice?.price) {
          livePrice = parseFloat(clobPrice.price);
        }
      } catch {
        // Use curPrice from data-api as fallback
      }

      const avgPrice = parseFloat(p.avgPrice || "0");
      const currentValue = size * livePrice;
      const cost = size * avgPrice;
      const pnl = currentValue - cost;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

      positions.push({
        market: p.title || p.market || "Unknown",
        slug: p.slug || "",
        outcome: p.outcome || "Unknown",
        size: p.size,
        avgPrice: avgPrice.toString(),
        currentPrice: livePrice.toString(),
        currentValue: currentValue.toFixed(6),
        cost: cost.toFixed(6),
        pnl: pnl.toFixed(6),
        pnlPct: pnlPct.toFixed(2),
        asset: p.asset,
        conditionId: p.conditionId || "",
        negRisk: p.negRisk === true || p.negRisk === "true",
      });
    }

    return NextResponse.json({
      success: true,
      positions,
      wallet: WALLET,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), positions: [] },
      { status: 500 }
    );
  }
}
