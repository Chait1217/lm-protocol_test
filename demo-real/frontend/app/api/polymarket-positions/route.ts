import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const user = (request.nextUrl.searchParams.get("user") || "").trim();
    const sizeRaw = request.nextUrl.searchParams.get("size") || "10";
    const size = Math.min(100, Math.max(1, Number(sizeRaw) || 10));

    if (!isAddress(user)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'user' wallet address" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const url = `https://data-api.polymarket.com/positions?user=${encodeURIComponent(user)}&size=${size}`;
    const upstream = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "LMProtocol/1.0",
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json(
        {
          success: false,
          error: `Polymarket API error (${upstream.status})`,
          detail: text.slice(0, 300),
        },
        { status: 502, headers: noCacheHeaders }
      );
    }

    const data = await upstream.json();
    const positions = Array.isArray(data) ? data : [];

    return NextResponse.json(
      {
        success: true,
        user: user.toLowerCase(),
        count: positions.length,
        positions,
      },
      { headers: noCacheHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

