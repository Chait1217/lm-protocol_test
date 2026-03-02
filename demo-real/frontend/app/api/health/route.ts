import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/health - confirms Next.js Trade Demo is running */
export async function GET() {
  return NextResponse.json({ ok: true, app: "trade-demo" });
}
