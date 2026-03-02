import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/trade-demo/") {
    return NextResponse.redirect(new URL("/trade-demo", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/trade-demo/"],
};
