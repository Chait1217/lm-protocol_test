import { NextResponse } from "next/server";

/**
 * POST /api/polymarket-trade
 *
 * Places a REAL order on Polymarket using @polymarket/clob-client.
 *
 * From the Polymarket docs (verified 2026-03-05):
 *   - npm install @polymarket/clob-client ethers@5
 *   - ClobClient(HOST, CHAIN_ID, signer, apiCreds, signatureType, funder)
 *   - client.createAndPostOrder({ tokenID, price, size, side }, { tickSize, negRisk }, OrderType)
 *   - BUY size = dollar amount to spend
 *   - SELL size/amount = number of shares to sell
 *   - Response: { success, orderID, status: "live"|"matched"|"delayed" }
 *
 * Market: "Will the Iranian regime fall by June 30?"
 *   YES token: 38397507750621893057346880033441136112987238933685677349709401910643842844855
 *   NO token:  95949957895141858444199258452803633110472396604599808168788254125381075552218
 *   tickSize: "0.01", negRisk: false, min_order_size: 5
 */

const YES_TOKEN = "38397507750621893057346880033441136112987238933685677349709401910643842844855";
const NO_TOKEN  = "95949957895141858444199258452803633110472396604599808168788254125381075552218";
const TICK_SIZE = "0.01";
const NEG_RISK  = false;
const CLOB_HOST = "https://clob.polymarket.com";
const CHAIN_ID  = 137;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { side, collateral, leverage, notional, borrowAmount, openFee } = body;

    // Validate
    if (!side || !collateral || !notional) {
      return NextResponse.json({ success: false, error: "Missing required fields: side, collateral, notional" }, { status: 400 });
    }

    const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ success: false, error: "POLYMARKET_PRIVATE_KEY not set in environment" }, { status: 500 });
    }

    // Dynamic import to avoid build issues
    const { ClobClient, Side: ClobSide, OrderType } = await import("@polymarket/clob-client");
    const { Wallet } = await import("ethers");

    const signer = new Wallet(privateKey);

    // Step 1: Derive API credentials
    const tempClient = new ClobClient(CLOB_HOST, CHAIN_ID, signer);
    let apiCreds;
    try {
      apiCreds = await tempClient.createOrDeriveApiKey();
    } catch (credErr: any) {
      console.error("API key derivation failed:", credErr);
      return NextResponse.json({
        success: false,
        error: `API key derivation failed: ${credErr.message}. Make sure the wallet has traded on Polymarket before.`,
      }, { status: 500 });
    }

    // Step 2: Initialize full trading client
    const client = new ClobClient(
      CLOB_HOST,
      CHAIN_ID,
      signer,
      apiCreds,
      0, // EOA signature type
      signer.address,
    );

    // Step 3: Get current market price for the selected side
    const tokenID = side === "YES" ? YES_TOKEN : NO_TOKEN;

    // Fetch best ask price (what we'd pay to buy)
    let marketPrice: number;
    try {
      const priceRes = await fetch(`${CLOB_HOST}/price?token_id=${tokenID}&side=SELL`, { cache: "no-store" });
      const priceData = await priceRes.json();
      marketPrice = parseFloat(priceData.price);
    } catch {
      marketPrice = 0.5; // fallback
    }

    // Step 4: Place the order
    // For BUY orders: size = dollar amount to spend
    // We use GTC limit order at the current ask price (acts like a market order if there's liquidity)
    const orderSize = parseFloat(notional);

    // Round price to tick size
    const tickNum = parseFloat(TICK_SIZE);
    const roundedPrice = Math.round(marketPrice / tickNum) * tickNum;
    // Ensure price is within valid range
    const clampedPrice = Math.max(tickNum, Math.min(1 - tickNum, roundedPrice));

    console.log(`[TRADE] Placing REAL ${side} BUY order: $${orderSize} at price ${clampedPrice} on token ${tokenID.slice(0, 20)}...`);

    let orderResponse;
    try {
      orderResponse = await client.createAndPostOrder(
        {
          tokenID,
          price: clampedPrice,
          size: orderSize,
          side: ClobSide.BUY,
        },
        {
          tickSize: TICK_SIZE,
          negRisk: NEG_RISK,
        },
        OrderType.GTC,
      );
    } catch (orderErr: any) {
      console.error("[TRADE] Order placement failed:", orderErr);

      // If GTC fails, try FOK market order as fallback
      try {
        console.log("[TRADE] Trying FOK market order as fallback...");
        const marketOrder = await client.createMarketOrder(
          {
            tokenID,
            side: ClobSide.BUY,
            amount: orderSize,
            price: Math.min(0.99, clampedPrice + 0.05), // 5% slippage tolerance
          },
          { tickSize: TICK_SIZE, negRisk: NEG_RISK },
        );
        orderResponse = await client.postOrder(marketOrder, OrderType.FOK);
      } catch (fokErr: any) {
        return NextResponse.json({
          success: false,
          error: `Order failed: ${orderErr.message}. FOK fallback also failed: ${fokErr.message}`,
        }, { status: 500 });
      }
    }

    console.log("[TRADE] Order response:", JSON.stringify(orderResponse));

    // Step 5: Fetch current prices for response
    let yesPrice: string | null = null;
    let noPrice: string | null = null;
    try {
      const midRes = await fetch(`${CLOB_HOST}/midpoint?token_id=${YES_TOKEN}`, { cache: "no-store" });
      const midData = await midRes.json();
      const mid = parseFloat(midData.mid);
      yesPrice = mid.toFixed(4);
      noPrice = (1 - mid).toFixed(4);
    } catch { /* ignore */ }

    const estimatedShares = clampedPrice > 0 ? orderSize / clampedPrice : 0;

    return NextResponse.json({
      success: true,
      orderId: orderResponse?.orderID || orderResponse?.orderID || null,
      status: orderResponse?.status || "submitted",
      fillPrice: clampedPrice.toFixed(4),
      yesPrice,
      noPrice,
      shares: estimatedShares.toFixed(2),
      notional: orderSize.toFixed(2),
      borrowAmount: (borrowAmount || 0).toFixed(2),
      openFee: (openFee || 0).toFixed(4),
      side,
      tokenID,
      message: `Real ${side} order placed on Polymarket`,
    });
  } catch (err) {
    console.error("[TRADE] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
