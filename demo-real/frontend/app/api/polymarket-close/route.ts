import { NextResponse } from "next/server";

/**
 * POST /api/polymarket-close
 *
 * Closes a REAL position on Polymarket by placing a SELL order via @polymarket/clob-client.
 *
 * From the Polymarket docs (verified 2026-03-05):
 *   - SELL orders: amount = number of shares to sell
 *   - Market order (FOK): client.createMarketOrder({ tokenID, side: SELL, amount: shares, price: worstPrice })
 *   - Limit order (GTC): client.createAndPostOrder({ tokenID, price, size: shares, side: SELL })
 *   - Strategy: Try GTC at aggressive price first, then FAK, then FOK
 *
 * Accepts either:
 *   - { asset, size, side } from positions panel (close specific position)
 *   - { orderId, side, notional } from leverage box (close trade opened in session)
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
    const { asset, size, side, orderId, notional } = body;

    const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ success: false, error: "POLYMARKET_PRIVATE_KEY not set" }, { status: 500 });
    }

    // Dynamic imports
    const { ClobClient, Side: ClobSide, OrderType } = await import("@polymarket/clob-client");
    const { Wallet } = await import("ethers");

    const signer = new Wallet(privateKey);

    // Derive API credentials
    const tempClient = new ClobClient(CLOB_HOST, CHAIN_ID, signer);
    let apiCreds;
    try {
      apiCreds = await tempClient.createOrDeriveApiKey();
    } catch (credErr: any) {
      return NextResponse.json({
        success: false,
        error: `API key derivation failed: ${credErr.message}`,
      }, { status: 500 });
    }

    // Initialize trading client
    const client = new ClobClient(
      CLOB_HOST,
      CHAIN_ID,
      signer,
      apiCreds,
      0, // EOA
      signer.address,
    );

    // Determine token ID and shares to sell
    let tokenID: string;
    let sharesToSell: number;

    if (asset) {
      // Called from positions panel with specific asset token ID
      tokenID = asset;
      sharesToSell = parseFloat(size);
    } else {
      // Called from leverage box — determine token from side
      tokenID = side === "YES" ? YES_TOKEN : NO_TOKEN;
      // We need to figure out how many shares we have
      // If notional and we know the entry price, estimate shares
      // But better to check actual position
      try {
        const posRes = await fetch(
          `https://data-api.polymarket.com/positions?user=${signer.address}&asset=${tokenID}&sizeThreshold=0`,
          { cache: "no-store" }
        );
        const positions = await posRes.json();
        if (Array.isArray(positions) && positions.length > 0) {
          sharesToSell = parseFloat(positions[0].size || "0");
        } else {
          sharesToSell = 0;
        }
      } catch {
        sharesToSell = 0;
      }
    }

    if (sharesToSell <= 0) {
      return NextResponse.json({
        success: false,
        error: "No shares to sell. Position may already be closed.",
      }, { status: 400 });
    }

    // Get current bid price (what we'd get for selling)
    let bidPrice: number;
    try {
      const priceRes = await fetch(`${CLOB_HOST}/price?token_id=${tokenID}&side=BUY`, { cache: "no-store" });
      const priceData = await priceRes.json();
      bidPrice = parseFloat(priceData.price);
    } catch {
      bidPrice = 0.01;
    }

    console.log(`[CLOSE] Selling ${sharesToSell} shares of token ${tokenID.slice(0, 20)}... at bid ~${bidPrice}`);

    // Round shares down to avoid selling more than we have
    const roundedShares = Math.floor(sharesToSell * 100) / 100;

    // STRATEGY 1: GTC limit sell at bid price (most reliable)
    // This places a resting order that will get filled
    const tickNum = parseFloat(TICK_SIZE);
    const sellPrice = Math.max(tickNum, Math.round(bidPrice / tickNum) * tickNum);

    let closeResponse: any = null;
    let closeMethod = "";

    // Try GTC limit sell first
    try {
      console.log(`[CLOSE] Strategy 1: GTC limit SELL at ${sellPrice} for ${roundedShares} shares`);
      closeResponse = await client.createAndPostOrder(
        {
          tokenID,
          price: sellPrice,
          size: roundedShares,
          side: ClobSide.SELL,
        },
        { tickSize: TICK_SIZE, negRisk: NEG_RISK },
        OrderType.GTC,
      );
      closeMethod = "GTC";
      console.log("[CLOSE] GTC response:", JSON.stringify(closeResponse));
    } catch (gtcErr: any) {
      console.error("[CLOSE] GTC failed:", gtcErr.message);

      // Try FAK (partial fill) as fallback
      try {
        console.log(`[CLOSE] Strategy 2: FAK market SELL for ${roundedShares} shares`);
        const fakOrder = await client.createMarketOrder(
          {
            tokenID,
            side: ClobSide.SELL,
            amount: roundedShares,
            price: Math.max(tickNum, sellPrice - 0.05), // 5% slippage
          },
          { tickSize: TICK_SIZE, negRisk: NEG_RISK },
        );
        closeResponse = await client.postOrder(fakOrder, OrderType.FAK);
        closeMethod = "FAK";
        console.log("[CLOSE] FAK response:", JSON.stringify(closeResponse));
      } catch (fakErr: any) {
        console.error("[CLOSE] FAK failed:", fakErr.message);

        // Try FOK as last resort
        try {
          console.log(`[CLOSE] Strategy 3: FOK market SELL for ${roundedShares} shares`);
          const fokOrder = await client.createMarketOrder(
            {
              tokenID,
              side: ClobSide.SELL,
              amount: roundedShares,
              price: tickNum, // worst case price
            },
            { tickSize: TICK_SIZE, negRisk: NEG_RISK },
          );
          closeResponse = await client.postOrder(fokOrder, OrderType.FOK);
          closeMethod = "FOK";
          console.log("[CLOSE] FOK response:", JSON.stringify(closeResponse));
        } catch (fokErr: any) {
          return NextResponse.json({
            success: false,
            error: `All close strategies failed. GTC: ${gtcErr.message}. FAK: ${fakErr.message}. FOK: ${fokErr.message}`,
          }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      orderId: closeResponse?.orderID || null,
      status: closeResponse?.status || "submitted",
      method: closeMethod,
      sharesSold: roundedShares,
      sellPrice: sellPrice.toFixed(4),
      tokenID,
      message: `Position close order placed via ${closeMethod}`,
    });
  } catch (err) {
    console.error("[CLOSE] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
