import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/polymarket-positions?address=0x...
 *
 * Fetches REAL positions from the Polymarket Data API.
 * Uses https://data-api.polymarket.com/positions?user={address}
 *
 * This returns all open positions for the wallet including:
 * - size, avgPrice, currentValue, cashPnl, percentPnl
 * - title, outcome, curPrice, slug
 */

const DATA_API = "https://data-api.polymarket.com";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { success: false, error: "Missing address parameter" },
        { status: 400 }
      );
    }

    // Fetch positions from Polymarket Data API
    // sizeThreshold=0 to include all positions (even small ones)
    const url = `${DATA_API}/positions?user=${address}&sizeThreshold=0&limit=100&sortBy=CURRENT&sortDirection=DESC`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `Data API returned ${res.status}: ${errText}` },
        { status: 502 }
      );
    }

    const rawPositions = await res.json();

    if (!Array.isArray(rawPositions)) {
      return NextResponse.json({
        success: true,
        positions: [],
        count: 0,
      });
    }

    // Map to a clean format for the frontend
    const positions = rawPositions
      .filter((p: any) => p.size > 0.001) // filter out dust
      .map((p: any) => ({
        market: p.title || "Unknown Market",
        slug: p.slug || "",
        eventSlug: p.eventSlug || "",
        outcome: p.outcome || "Unknown",
        outcomeIndex: p.outcomeIndex ?? 0,
        size: p.size || 0,
        avgPrice: p.avgPrice || 0,
        currentPrice: p.curPrice || 0,
        initialValue: p.initialValue || 0,
        currentValue: p.currentValue || 0,
        pnl: p.cashPnl || 0,
        pnlPct: p.percentPnl || 0,
        realizedPnl: p.realizedPnl || 0,
        totalBought: p.totalBought || 0,
        asset: p.asset || "",
        oppositeAsset: p.oppositeAsset || "",
        conditionId: p.conditionId || "",
        redeemable: p.redeemable || false,
        mergeable: p.mergeable || false,
        negativeRisk: p.negativeRisk || false,
        endDate: p.endDate || "",
        icon: p.icon || "",
      }));

    return NextResponse.json({
      success: true,
      positions,
      count: positions.length,
      wallet: address,
    });
  } catch (err) {
    console.error("polymarket-positions error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
