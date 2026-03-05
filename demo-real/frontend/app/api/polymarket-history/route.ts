import { NextRequest, NextResponse } from "next/server";

const YES_TOKEN =
  "38397507750621893057346880033441136112987238933685677349709401910643842844855";
const CLOB = "https://clob.polymarket.com";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Verified working intervals and fidelity values:
// interval=6h, fidelity=60 → 7 points
// interval=1d, fidelity=60 → 25 points
// interval=1w, fidelity=60 → 169 points
// interval=max, fidelity=100 → 403 points

const VALID_INTERVALS: Record<string, number> = {
  "6h": 60,
  "1d": 60,
  "1w": 60,
  max: 100,
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const interval = searchParams.get("interval") || "1d";
    const fidelity = VALID_INTERVALS[interval] ?? 60;

    const url = `${CLOB}/prices-history?market=${YES_TOKEN}&interval=${interval}&fidelity=${fidelity}`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `CLOB returned ${res.status}`, history: [] },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Verified response format: { history: [{ t: 1772665221, p: 0.385 }, ...] }
    const history: { t: number; p: number }[] = data?.history ?? [];

    return NextResponse.json({
      success: true,
      interval,
      fidelity,
      count: history.length,
      history,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), history: [] },
      { status: 500 }
    );
  }
}
