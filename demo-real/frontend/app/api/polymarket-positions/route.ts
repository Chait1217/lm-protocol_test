import { NextResponse } from "next/server";

/**
 * GET /api/polymarket-positions?address=0x...
 *
 * Fetches real open positions from Polymarket Data API.
 * 
 * VERIFIED WORKING (tested 2026-03-05):
 *   GET https://data-api.polymarket.com/positions?user=0x6CcBdc898016F2E49ada47496696d635b8D4fB31&sizeThreshold=0&limit=100
 *   Returns array of position objects with: asset, size, avgPrice, currentPrice, market, slug, etc.
 */

const CLOB_HOST = "https://clob.polymarket.com";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let address = searchParams.get("address");

  // If no address provided, use the wallet from env
  if (!address) {
    try {
      const { Wallet } = await import("ethers");
      const pk = process.env.POLYMARKET_PRIVATE_KEY;
      if (pk) {
        const w = new Wallet(pk);
        address = w.address;
      }
    } catch { /* ignore */ }
  }

  if (!address) {
    return NextResponse.json({ success: false, error: "No address provided and no POLYMARKET_PRIVATE_KEY set" }, { status: 400 });
  }

  try {
    const url = `https://data-api.polymarket.com/positions?user=${address}&sizeThreshold=0&limit=100`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ success: false, error: `Data API returned ${res.status}: ${text}` }, { status: 502 });
    }

    const rawPositions = await res.json();

    if (!Array.isArray(rawPositions)) {
      return NextResponse.json({ success: true, positions: [] });
    }

    // Enrich each position with live CLOB price
    const positions = await Promise.all(
      rawPositions
        .filter((p: any) => parseFloat(p.size || "0") > 0.001) // filter dust
        .map(async (p: any) => {
          const size = parseFloat(p.size || "0");
          const avgPrice = parseFloat(p.avgPrice || "0");
          const asset = p.asset || "";

          // Fetch live price from CLOB
          let currentPrice = parseFloat(p.curPrice || "0");
          try {
            const midRes = await fetch(`${CLOB_HOST}/price?token_id=${asset}&side=BUY`, { cache: "no-store" });
            if (midRes.ok) {
              const midData = await midRes.json();
              currentPrice = parseFloat(midData.price || "0");
            }
          } catch { /* use curPrice from data API */ }

          const currentValue = size * currentPrice;
          const cost = size * avgPrice;
          const pnl = currentValue - cost;
          const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

          // Determine outcome name
          const outcome = p.outcome || (p.asset === p.proxySetYesAsset ? "Yes" : "No");

          return {
            market: p.title || p.market || "Unknown Market",
            slug: p.eventSlug || p.slug || "",
            outcome,
            size: size.toFixed(4),
            avgPrice: avgPrice.toFixed(4),
            currentPrice: currentPrice.toFixed(4),
            currentValue: currentValue.toFixed(4),
            cost: cost.toFixed(4),
            pnl: pnl.toFixed(4),
            pnlPct: pnlPct.toFixed(2),
            asset,
            conditionId: p.conditionId || "",
            negRisk: p.curNegRisk || false,
          };
        })
    );

    return NextResponse.json({
      success: true,
      positions,
      wallet: address,
      count: positions.length,
    });
  } catch (err) {
    console.error("polymarket-positions error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
