import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

/** Proxy to Polymarket Gamma API. Use when /api/polymarket-live fails. */
export async function GET(
  req: NextRequest,
  ctx: { params: { path: string[] } }
) {
  const { path } = ctx.params;
  const subpath = "/" + path.join("/");
  const search = req.nextUrl.searchParams.toString();
  const fullPath = search ? `${subpath}?${search}` : subpath;
  const url = `${GAMMA_BASE}${fullPath}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "LMProtocol/1.0" },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, {
      status: res.status,
      headers: { "Cache-Control": "no-store, no-cache" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Proxy error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
