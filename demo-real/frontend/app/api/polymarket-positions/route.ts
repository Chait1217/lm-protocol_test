import { NextRequest, NextResponse } from "next/server";
import { POLYMARKET_DATA_API } from "@/lib/polymarketConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function safeFetch(url: string, timeoutMs = 8000): Promise<any | null> {
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user =
      searchParams.get("user") ||
      searchParams.get("wallet") ||
      searchParams.get("address") ||
      "";

    if (!/^0x[a-fA-F0-9]{40}$/.test(user)) {
      return NextResponse.json(
        { success: false, error: "Valid wallet address is required", positions: [] },
        { status: 400 }
      );
    }

    const url = `${POLYMARKET_DATA_API}/positions?user=${encodeURIComponent(
      user
    )}&sizeThreshold=0&limit=100`;

    const data = await safeFetch(url);

    if (!Array.isArray(data)) {
      return NextResponse.json({
        success: true,
        positions: [],
      });
    }

    const positions = data
      .filter((p: any) => Number(p?.size || 0) > 0)
      .map((p: any) => ({
        market: p?.title || p?.market || p?.question || "Unknown market",
        slug: p?.slug || "",
        outcome: String(p?.outcome || "").toLowerCase(),
        size: String(p?.size || "0"),
        avgPrice: String(p?.avgPrice || p?.avg_price || "0"),
        currentPrice: String(p?.curPrice || p?.currentPrice || p?.price || "0"),
        currentValue: String(p?.currentValue || p?.value || "0"),
        cost: String(p?.cashPnl ?? p?.cost ?? "0"),
        pnl: String(p?.cashPnl ?? p?.pnl ?? "0"),
        pnlPct: String(p?.percentPnl ?? p?.pnlPct ?? "0"),
        asset: String(p?.asset || ""),
        conditionId: String(p?.conditionId || ""),
        negRisk: Boolean(p?.negRisk),
      }));

    return NextResponse.json({
      success: true,
      positions,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        positions: [],
      },
      { status: 500 }
    );
  }
}
