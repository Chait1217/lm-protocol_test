import { NextResponse } from "next/server";
import {
  POLYMARKET_YES_TOKEN,
  POLYMARKET_NO_TOKEN,
  POLYMARKET_CLOB_API,
  POLYMARKET_TICK_SIZE,
  POLYMARKET_NEG_RISK,
  POLYGON_CHAIN_ID,
} from "@/lib/polymarketConfig";

/**
 * POST /api/polymarket-trade (server wallet - kept for backward compat; UI uses browser signer)
 * Places order using POLYMARKET_PRIVATE_KEY. Prefer browser wallet via polymarketBrowserClient.
 */

const yesTokenId = POLYMARKET_YES_TOKEN;
const noTokenId = POLYMARKET_NO_TOKEN;
const clobUrl = POLYMARKET_CLOB_API;
const chainId = POLYGON_CHAIN_ID;
const negRisk = POLYMARKET_NEG_RISK;
const tickSize = POLYMARKET_TICK_SIZE as "0.1" | "0.01" | "0.001" | "0.0001";

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
    const tempClient = new ClobClient(clobUrl, chainId, signer);
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
      clobUrl,
      chainId,
      signer,
      apiCreds,
      0, // EOA signature type
      signer.address,
    );

    // Step 3: Get current market price for the selected side
    const tokenID = side === "YES" ? yesTokenId : noTokenId;

    // Fetch best ask price (what we'd pay to buy)
    let marketPrice: number;
    try {
      const priceRes = await fetch(`${clobUrl}/price?token_id=${tokenID}&side=SELL`, { cache: "no-store" });
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
    const tickNum = parseFloat(tickSize);
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
          tickSize,
          negRisk,
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
          { tickSize, negRisk },
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
      const midRes = await fetch(`${clobUrl}/midpoint?token_id=${yesTokenId}`, { cache: "no-store" });
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
