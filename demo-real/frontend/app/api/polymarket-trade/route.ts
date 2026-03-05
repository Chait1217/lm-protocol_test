import { NextRequest, NextResponse } from "next/server";

const YES_TOKEN =
  "38397507750621893057346880033441136112987238933685677349709401910643842844855";
const NO_TOKEN =
  "95949957895141858444199258452803633110472396604599808168788254125381075552218";
const CLOB_URL = "https://clob.polymarket.com";
const TICK_SIZE = "0.01";
const TICK_NUM = 0.01;
const NEG_RISK = false;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { side, amount } = body; // side = "YES" | "NO", amount = notional in USD

    if (!side || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing side or amount" },
        { status: 400 }
      );
    }

    const pk = process.env.POLYMARKET_PRIVATE_KEY;
    if (!pk) {
      return NextResponse.json(
        { success: false, error: "POLYMARKET_PRIVATE_KEY not set in .env.local" },
        { status: 500 }
      );
    }

    // Dynamic require to avoid Next.js bundling issues
    const { ClobClient } = require("@polymarket/clob-client");
    const { ethers } = require("ethers");

    const tokenID = side === "YES" ? YES_TOKEN : NO_TOKEN;
    const notional = parseFloat(amount);

    if (isNaN(notional) || notional < 0.5) {
      return NextResponse.json(
        { success: false, error: "Amount must be at least $0.50" },
        { status: 400 }
      );
    }

    // Step 1: Get current market price from CLOB
    let marketAsk = 0.5;
    try {
      const priceRes = await fetch(
        `${CLOB_URL}/price?token_id=${tokenID}&side=sell`,
        { cache: "no-store" }
      );
      const priceData = await priceRes.json();
      if (priceData?.price) marketAsk = parseFloat(priceData.price);
    } catch {
      // Use default
    }

    // Step 2: Create wallet signer
    const wallet = new ethers.Wallet(pk);
    console.log("[polymarket-trade] Wallet address:", wallet.address);

    // Step 3: Create CLOB client and derive API credentials
    const tempClient = new ClobClient(CLOB_URL, 137, wallet);
    let apiCreds;
    try {
      apiCreds = await tempClient.createOrDeriveApiKey();
    } catch (credErr: any) {
      console.error("[polymarket-trade] API key derivation failed:", credErr?.message);
      return NextResponse.json(
        { success: false, error: `API key derivation failed: ${credErr?.message}` },
        { status: 500 }
      );
    }

    // Step 4: Create authenticated client
    const client = new ClobClient(CLOB_URL, 137, wallet, apiCreds);

    // Step 5: Calculate order parameters
    // Round price to tick size
    const rawPrice = marketAsk;
    const roundedPrice = Math.round(rawPrice / TICK_NUM) * TICK_NUM;
    const clampedPrice = Math.max(TICK_NUM, Math.min(1 - TICK_NUM, roundedPrice));
    // Size = notional / price, rounded to 2 decimal places
    const rawSize = notional / clampedPrice;
    const size = Math.round(rawSize * 100) / 100;

    if (size < 1) {
      return NextResponse.json(
        { success: false, error: `Calculated size too small: ${size}. Increase amount.` },
        { status: 400 }
      );
    }

    console.log("[polymarket-trade] Order params:", {
      tokenID: tokenID.slice(0, 20) + "...",
      side,
      price: clampedPrice,
      size,
      notional: (size * clampedPrice).toFixed(2),
      negRisk: NEG_RISK,
    });

    // Step 6: Create and post order
    let orderResult: any = null;
    let method = "GTC";

    try {
      // Use createAndPostOrder for simplicity — it handles signing internally
      orderResult = await client.createAndPostOrder({
        tokenID,
        price: clampedPrice,
        size,
        side: "BUY",
        feeRateBps: 0,
        nonce: 0,
      });
      console.log("[polymarket-trade] GTC order result:", JSON.stringify(orderResult));
    } catch (gtcErr: any) {
      console.error("[polymarket-trade] createAndPostOrder failed:", gtcErr?.message);

      // Fallback: try with createOrder + postOrder separately
      try {
        method = "GTC-manual";
        const signedOrder = await client.createOrder({
          tokenID,
          price: clampedPrice,
          size,
          side: "BUY",
        }, { tickSize: TICK_SIZE, negRisk: NEG_RISK });

        const { OrderType } = require("@polymarket/clob-client");
        orderResult = await client.postOrder(signedOrder, OrderType.GTC);
        console.log("[polymarket-trade] Manual GTC result:", JSON.stringify(orderResult));
      } catch (manualErr: any) {
        console.error("[polymarket-trade] Manual order also failed:", manualErr?.message);
        return NextResponse.json(
          {
            success: false,
            error: `Order placement failed: ${manualErr?.message || gtcErr?.message}`,
            debug: {
              wallet: wallet.address,
              tokenID: tokenID.slice(0, 20) + "...",
              price: clampedPrice,
              size,
            },
          },
          { status: 500 }
        );
      }
    }

    // Extract order ID from various possible response formats
    const orderId = orderResult?.orderID
      || orderResult?.orderIds?.[0]
      || orderResult?.id
      || "submitted";

    return NextResponse.json({
      success: true,
      method,
      orderId,
      status: orderResult?.status || "LIVE",
      side,
      tokenID: tokenID.slice(0, 20) + "...",
      price: clampedPrice,
      size,
      notional: (size * clampedPrice).toFixed(2),
      wallet: wallet.address,
    });
  } catch (err: any) {
    console.error("[polymarket-trade] Route error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
