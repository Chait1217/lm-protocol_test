import { NextResponse } from "next/server";

const WALLET = "0x6CcBdc898016F2E49ada47496696d635b8D4fB31";
const DATA_API = "https://data-api.polymarket.com";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const url = `${DATA_API}/positions?user=${WALLET}&sizeThreshold=0&limit=50`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `Data API returned ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const raw = await res.json();
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { success: false, error: "Unexpected response format", positions: [] },
        { status: 502 }
      );
    }

    // Filter positions with size > 0.001
    const positions = raw
      .filter((p: any) => parseFloat(p.size) > 0.001)
      .map((p: any) => ({
        market: p.title || "Unknown Market",
        slug: p.slug || "",
        outcome: p.outcome || "Yes",
        size: String(p.size),
        avgPrice: String(p.avgPrice),
        currentPrice: String(p.curPrice),
        currentValue: String(p.currentValue),
        cost: String(p.initialValue),
        pnl: String(p.cashPnl),
        pnlPct: String(p.percentPnl),
        asset: p.asset,
        conditionId: p.conditionId || "",
        negRisk: Boolean(p.negativeRisk),
        icon: p.icon || "",
        endDate: p.endDate || "",
        oppositeAsset: p.oppositeAsset || "",
      }));

    return NextResponse.json({
      success: true,
      count: positions.length,
      positions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || String(err), positions: [] },
      { status: 500 }
    );
  }
}
