import { NextRequest, NextResponse } from "next/server";
import https from "node:https";
import dns from "node:dns";

export const dynamic = "force-dynamic";

const CLOB_HOST = "clob.polymarket.com";
const CLOB_FALLBACK_IPS = ["104.18.34.205", "172.64.153.51"];

const resolver = new dns.Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);
let cachedClobIp: { ip: string; ts: number } | null = null;

async function resolveViaDoh(host: string): Promise<string | null> {
  const providers = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
    `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`,
  ];
  for (const url of providers) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/dns-json" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { Answer?: Array<{ data?: string; type?: number }> };
      const answers = Array.isArray(json?.Answer) ? json.Answer : [];
      const ip = answers.find((a) => a?.type === 1 && typeof a?.data === "string")?.data;
      if (ip) return ip;
    } catch {
      // try next provider
    }
  }
  return null;
}

async function resolveClob(): Promise<string> {
  if (cachedClobIp && Date.now() - cachedClobIp.ts < 60_000)
    return cachedClobIp.ip;
  try {
    const addrs = await new Promise<string[]>((resolve, reject) =>
      resolver.resolve4(CLOB_HOST, (err, a) =>
        err ? reject(err) : resolve(a)
      )
    );
    if (addrs.length > 0) {
      cachedClobIp = { ip: addrs[0], ts: Date.now() };
      return addrs[0];
    }
  } catch {
    try {
      const addr = await new Promise<string>((resolve, reject) =>
        dns.lookup(CLOB_HOST, 4, (err, address) =>
          err || !address ? reject(err) : resolve(address)
        )
      );
      cachedClobIp = { ip: addr, ts: Date.now() };
      return addr;
    } catch {
      const doh = await resolveViaDoh(CLOB_HOST);
      if (doh) {
        cachedClobIp = { ip: doh, ts: Date.now() };
        return doh;
      }
      if (CLOB_FALLBACK_IPS.length > 0) {
        cachedClobIp = { ip: CLOB_FALLBACK_IPS[0], ts: Date.now() };
        return CLOB_FALLBACK_IPS[0];
      }
    }
  }
  throw new Error(`DNS resolution failed for ${CLOB_HOST}`);
}

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
  if (!fwd["accept"]) fwd["accept"] = "application/json";
  return fwd;
}

async function proxyToClob(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: Buffer | null
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  const ip = await resolveClob();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error("Proxy timeout"));
    }, 30000);

    const req = https.request(
        {
          hostname: ip,
          port: 443,
          path,
          method,
          headers: {
            ...headers,
            Host: CLOB_HOST,
          },
          servername: CLOB_HOST,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            clearTimeout(timer);
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
        }
      );
      req.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    if (body && body.length > 0) req.write(body);
    req.end();
  });
}

async function handleRequest(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const params = await ctx.params;
  const subpath = "/" + params.path.join("/");
  const search = req.nextUrl.search;
  const fullPath = subpath + search;
  const headers = getForwardHeaders(req);

  let body: Buffer | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = Buffer.from(await req.arrayBuffer());
    } catch {
      body = null;
    }
  }

  try {
    const resp = await proxyToClob(req.method, fullPath, headers, body);

    if (resp.status >= 400 && fullPath.includes("/order")) {
      const raw = resp.body.toString("utf8").slice(0, 500);
      console.error("[clob-proxy][order-error]", {
        method: req.method,
        path: fullPath,
        status: resp.status,
        body: raw,
      });
    }

    const resHeaders = new Headers();
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    resHeaders.set("Access-Control-Allow-Headers", "*");
    if (resp.headers["content-type"])
      resHeaders.set("content-type", resp.headers["content-type"]);

    return new NextResponse(new Uint8Array(resp.body), {
      status: resp.status,
      headers: resHeaders,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Proxy error";
    console.error("[clob-proxy]", req.method, fullPath, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(req, ctx);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(req, ctx);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(req, ctx);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
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
