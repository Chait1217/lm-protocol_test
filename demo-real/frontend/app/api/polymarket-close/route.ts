import { NextRequest, NextResponse } from "next/server";

const YES_TOKEN =
  "38397507750621893057346880033441136112987238933685677349709401910643842844855";
const NO_TOKEN =
  "95949957895141858444199258452803633110472396604599808168788254125381075552218";
const CLOB_URL = "https://clob.polymarket.com";
const TICK_SIZE = "0.01";
const TICK_NUM = 0.01;
const NEG_RISK = false;
const WALLET_ADDR = "0x6CcBdc898016F2E49ada47496696d635b8D4fB31";

export const dynamic = "force-dynamic";

async function safeFetch(url: string, timeoutMs = 5000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept either { asset, size } from positions panel, or { side } from leverage box
    const assetToken = body.asset || body.tokenID || YES_TOKEN;
    let sellSize = body.size ? parseFloat(body.size) : 0;

    const pk = process.env.POLYMARKET_PRIVATE_KEY;
    if (!pk) {
      return NextResponse.json(
        { success: false, error: "POLYMARKET_PRIVATE_KEY not set" },
        { status: 500 }
      );
    }

    const { ClobClient } = require("@polymarket/clob-client");
    const { ethers } = require("ethers");

    // If no size provided, fetch from positions API
    if (sellSize <= 0) {
      const posData = await safeFetch(
        `https://data-api.polymarket.com/positions?user=${WALLET_ADDR}&sizeThreshold=0&limit=50`
      );
      if (Array.isArray(posData)) {
        const pos = posData.find((p: any) => p.asset === assetToken);
        if (pos) {
          sellSize = parseFloat(pos.size);
        }
      }
    }

    if (sellSize <= 0) {
      return NextResponse.json(
        { success: false, error: "No position found to close (size = 0)" },
        { status: 400 }
      );
    }

    // Round size to 2 decimal places — do NOT floor to integer
    const roundedSize = Math.round(sellSize * 100) / 100;

    // Get current best bid for sell price
    let bestBid = 0.5;
    try {
      const bidData = await safeFetch(
        `${CLOB_URL}/price?token_id=${assetToken}&side=buy`
      );
      if (bidData?.price) bestBid = parseFloat(bidData.price);
    } catch {}

    // Set sell price at best bid (aggressive — will fill immediately)
    const sellPrice = Math.round(bestBid / TICK_NUM) * TICK_NUM;
    const clampedPrice = Math.max(TICK_NUM, Math.min(1 - TICK_NUM, sellPrice));

    console.log("[polymarket-close] Closing position:", {
      asset: assetToken.slice(0, 20) + "...",
      size: roundedSize,
      sellPrice: clampedPrice,
      bestBid,
    });

    // Create CLOB client
    const wallet = new ethers.Wallet(pk);
    const tempClient = new ClobClient(CLOB_URL, 137, wallet);
    let apiCreds;
    try {
      apiCreds = await tempClient.createOrDeriveApiKey();
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `API key derivation failed: ${e?.message}` },
        { status: 500 }
      );
    }
    const client = new ClobClient(CLOB_URL, 137, wallet, apiCreds);

    // Strategy 1: GTC limit sell at best bid
    let orderResult: any = null;
    let method = "GTC-limit-sell";

    try {
      const signedOrder = await client.createOrder({
        tokenID: assetToken,
        price: clampedPrice,
        size: roundedSize,
        side: "SELL",
      }, { tickSize: TICK_SIZE, negRisk: NEG_RISK });

      const { OrderType } = require("@polymarket/clob-client");
      orderResult = await client.postOrder(signedOrder, OrderType.GTC);
      console.log("[polymarket-close] GTC sell result:", JSON.stringify(orderResult));
    } catch (gtcErr: any) {
      console.error("[polymarket-close] GTC sell failed:", gtcErr?.message);

      // Strategy 2: Try at a lower price (1 tick below best bid)
      try {
        method = "GTC-aggressive-sell";
        const aggressivePrice = Math.max(TICK_NUM, clampedPrice - TICK_NUM);

        const signedOrder = await client.createOrder({
          tokenID: assetToken,
          price: aggressivePrice,
          size: roundedSize,
          side: "SELL",
        }, { tickSize: TICK_SIZE, negRisk: NEG_RISK });

        const { OrderType } = require("@polymarket/clob-client");
        orderResult = await client.postOrder(signedOrder, OrderType.GTC);
        console.log("[polymarket-close] Aggressive sell result:", JSON.stringify(orderResult));
      } catch (aggErr: any) {
        console.error("[polymarket-close] Aggressive sell failed:", aggErr?.message);

        // Strategy 3: Try createAndPostOrder
        try {
          method = "createAndPost-sell";
          orderResult = await client.createAndPostOrder({
            tokenID: assetToken,
            price: clampedPrice,
            size: roundedSize,
            side: "SELL",
            feeRateBps: 0,
            nonce: 0,
          });
          console.log("[polymarket-close] createAndPost sell:", JSON.stringify(orderResult));
        } catch (finalErr: any) {
          return NextResponse.json(
            {
              success: false,
              error: `All close strategies failed. Last error: ${finalErr?.message}`,
              debug: {
                asset: assetToken.slice(0, 20) + "...",
                size: roundedSize,
                bestBid,
                sellPrice: clampedPrice,
              },
            },
            { status: 500 }
          );
        }
      }
    }

    const orderId = orderResult?.orderID
      || orderResult?.orderIds?.[0]
      || orderResult?.id
      || "submitted";

    return NextResponse.json({
      success: true,
      method,
      orderId,
      status: orderResult?.status || "LIVE",
      sharesSold: roundedSize,
      sellPrice: clampedPrice,
      estimatedProceeds: (roundedSize * clampedPrice).toFixed(4),
    });
  } catch (err: any) {
    console.error("[polymarket-close] Route error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
