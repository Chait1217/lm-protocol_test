import { NextRequest, NextResponse } from "next/server";
import https from "node:https";
import dns from "node:dns";

export const dynamic = "force-dynamic";

const CLOB_HOST = "clob.polymarket.com";

/* ---------- DNS resolution with Google/Cloudflare fallback ---------- */

const googleResolver = new dns.Resolver();
googleResolver.setServers(["8.8.8.8", "1.1.1.1"]);

const ipCache: { ip: string; ts: number } | null = null;
let cachedIp: { ip: string; ts: number } | null = null;

async function resolveClob(): Promise<string> {
  if (cachedIp && Date.now() - cachedIp.ts < 60_000) return cachedIp.ip;

  // Google DNS first (system DNS is unreliable for polymarket)
  try {
    const addrs = await new Promise<string[]>((resolve, reject) =>
      googleResolver.resolve4(CLOB_HOST, (err, a) => (err ? reject(err) : resolve(a)))
    );
    if (addrs.length > 0) {
      cachedIp = { ip: addrs[0], ts: Date.now() };
      return addrs[0];
    }
  } catch { /* fall through */ }

  // Fallback: system DNS
  try {
    const addr = await new Promise<string>((resolve, reject) =>
      dns.lookup(CLOB_HOST, 4, (err, address) => (err || !address ? reject(err) : resolve(address)))
    );
    cachedIp = { ip: addr, ts: Date.now() };
    return addr;
  } catch { /* fall through */ }

  throw new Error(`DNS resolution failed for ${CLOB_HOST}`);
}

/* ---------- Proxy request to CLOB via resolved IP ---------- */

async function proxyRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: Buffer | null
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  const ip = await resolveClob();
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: ip,
      port: 443,
      path,
      method,
      headers: {
        ...headers,
        Host: CLOB_HOST,
      },
      servername: CLOB_HOST, // TLS SNI
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const respHeaders: Record<string, string> = {};
        for (const [key, val] of Object.entries(res.headers)) {
          if (val && typeof val === "string") respHeaders[key] = val;
        }
        resolve({
          status: res.statusCode ?? 500,
          headers: respHeaders,
          body: Buffer.concat(chunks),
        });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Proxy timeout")); });
    if (body && body.length > 0) req.write(body);
    req.end();
  });
}

/* ---------- Extract forwarded headers (auth, content-type) ---------- */

function getForwardHeaders(req: NextRequest): Record<string, string> {
  const fwd: Record<string, string> = {};
  const forward = [
    "content-type",
    "accept",
    "authorization",
    "poly-address",
    "poly-signature",
    "poly-timestamp",
    "poly-nonce",
    "poly-api-key",
    "poly-passphrase",
    // CLOB client headers
    "POLY_ADDRESS",
    "POLY_SIGNATURE",
    "POLY_TIMESTAMP",
    "POLY_NONCE",
    "POLY_API_KEY",
    "POLY_PASSPHRASE",
  ];
  for (const h of forward) {
    const v = req.headers.get(h);
    if (v) fwd[h] = v;
  }
  // Always send JSON accept
  if (!fwd["accept"]) fwd["accept"] = "application/json";
  return fwd;
}

/* ---------- Route handlers ---------- */

async function handleRequest(req: NextRequest, { params }: { params: { path: string[] } }) {
  const subpath = "/" + params.path.join("/");
  const search = req.nextUrl.search; // preserve query string
  const fullPath = subpath + search;
  const headers = getForwardHeaders(req);
  let body: Buffer | null = null;

  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      const ab = await req.arrayBuffer();
      body = Buffer.from(ab);
    } catch { /* no body */ }
  }

  try {
    const resp = await proxyRequest(req.method, fullPath, headers, body);
    if (resp.status >= 400 && fullPath.includes("/order")) {
      let raw = "";
      try {
        raw = resp.body.toString("utf8");
      } catch {
        raw = "<unreadable>";
      }
      console.error("[clob-proxy][order-error]", {
        method: req.method,
        path: fullPath,
        status: resp.status,
        body: raw,
      });
    }

    // Build response, forwarding CORS headers
    const resHeaders = new Headers();
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    resHeaders.set("Access-Control-Allow-Headers", "*");
    if (resp.headers["content-type"]) resHeaders.set("content-type", resp.headers["content-type"]);

    const bodyInit: BodyInit = new Uint8Array(resp.body);
    return new NextResponse(bodyInit, { status: resp.status, headers: resHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Proxy error";
    console.error("[clob-proxy]", req.method, fullPath, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleRequest(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleRequest(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleRequest(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleRequest(req, ctx);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
