import { NextRequest, NextResponse } from "next/server";
import { MARKET_CONFIG } from "@/lib/polymarketConfig";

const DATA_API = MARKET_CONFIG.dataApiUrl;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("user") || searchParams.get("wallet");

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      const res = NextResponse.json(
        { success: false, error: "Missing or invalid wallet address. Pass ?user=0x..." },
        { status: 400 }
      );
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.headers.set("Pragma", "no-cache");
      res.headers.set("Expires", "0");
      return res;
    }

    const url = `${DATA_API}/positions?user=${wallet}&sizeThreshold=0&limit=50`;
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
      const errorResponse = NextResponse.json(
        { success: false, error: `Data API returned ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
      errorResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      errorResponse.headers.set("Pragma", "no-cache");
      errorResponse.headers.set("Expires", "0");
      return errorResponse;
    }

    const raw = await res.json();
    if (!Array.isArray(raw)) {
      const badFormat = NextResponse.json(
        { success: false, error: "Unexpected response format", positions: [] },
        { status: 502 }
      );
      badFormat.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      badFormat.headers.set("Pragma", "no-cache");
      badFormat.headers.set("Expires", "0");
      return badFormat;
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

    const okResponse = NextResponse.json({
      success: true,
      count: positions.length,
      positions,
    });
    okResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    okResponse.headers.set("Pragma", "no-cache");
    okResponse.headers.set("Expires", "0");
    return okResponse;
  } catch (err: any) {
    const errorResponse = NextResponse.json(
      { success: false, error: err?.message || String(err), positions: [] },
      { status: 500 }
    );
    errorResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    errorResponse.headers.set("Pragma", "no-cache");
    errorResponse.headers.set("Expires", "0");
    return errorResponse;
  }
}
