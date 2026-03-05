import { NextRequest, NextResponse } from "next/server";

const YES_TOKEN =
  "38397507750621893057346880033441136112987238933685677349709401910643842844855";
const NO_TOKEN =
  "95949957895141858444199258452803633110472396604599808168788254125381075552218";
const CLOB_URL = "https://clob.polymarket.com";
const TICK_SIZE = "0.01";
const TICK_NUM = 0.01;

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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ClobClient, Side: ClobSide, OrderType } = require("@polymarket/clob-client");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Wallet } = require("ethers");

    const tokenID = side === "YES" ? YES_TOKEN : NO_TOKEN;
    const notional = parseFloat(amount);

    if (isNaN(notional) || notional < 1) {
      return NextResponse.json(
        { success: false, error: "Amount must be at least $1" },
        { status: 400 }
      );
    }

    // Step 1: Get current market price from CLOB
    const priceRes = await fetch(
      `${CLOB_URL}/price?token_id=${tokenID}&side=sell`,
      { cache: "no-store" }
    );
    const priceData = await priceRes.json();
    const marketAsk = parseFloat(priceData?.price || "0.5");

    // Step 2: Create wallet and CLOB client
    const wallet = new Wallet(pk);

    // Step 3: Create temp client to derive API credentials
    const tempClient = new ClobClient(CLOB_URL, 137, wallet);
    const apiCreds = await tempClient.createOrDeriveApiKey();

    // Step 4: Create full authenticated client
    const client = new ClobClient(
      CLOB_URL,
      137,
      wallet,
      apiCreds,
      0, // feeRateBps — 0 means default
      wallet.address
    );

    // Step 5: Calculate order parameters
    // Round price to tick size and clamp to valid range
    const rawPrice = marketAsk;
    const roundedPrice = Math.round(rawPrice / TICK_NUM) * TICK_NUM;
    const clampedPrice = Math.max(TICK_NUM, Math.min(1 - TICK_NUM, roundedPrice));
    const size = Math.max(5, Math.round(notional / clampedPrice)); // minimum 5 shares

    // Step 6: Try GTC limit order first
    let orderResult: any = null;
    let method = "GTC";

    try {
      const signedOrder = await client.createOrder({
        tokenID,
        price: clampedPrice,
        size,
        side: ClobSide.BUY,
      }, { tickSize: TICK_SIZE, negRisk: false });

      orderResult = await client.postOrder(signedOrder, OrderType.GTC);
    } catch (gtcErr: any) {
      console.error("GTC order failed:", gtcErr?.message);

      // Fallback: try FOK market order
      try {
        method = "FOK";
        const signedOrder = await client.createOrder({
          tokenID,
          price: clampedPrice,
          size,
          side: ClobSide.BUY,
        }, { tickSize: TICK_SIZE, negRisk: false });

        orderResult = await client.postOrder(signedOrder, OrderType.FOK);
      } catch (fokErr: any) {
        console.error("FOK order also failed:", fokErr?.message);
        return NextResponse.json(
          {
            success: false,
            error: `Order placement failed: ${fokErr?.message || gtcErr?.message}`,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      method,
      orderId: orderResult?.orderID || orderResult?.id || "submitted",
      status: orderResult?.status || "LIVE",
      side,
      tokenID: tokenID.slice(0, 20) + "...",
      price: clampedPrice,
      size,
      notional: (size * clampedPrice).toFixed(2),
      wallet: wallet.address,
    });
  } catch (err: any) {
    console.error("Trade route error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
