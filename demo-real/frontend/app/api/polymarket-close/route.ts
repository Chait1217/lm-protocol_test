import { NextResponse } from "next/server";
import {
  POLYMARKET_YES_TOKEN,
  POLYMARKET_NO_TOKEN,
  POLYMARKET_CLOB_API,
  POLYMARKET_DATA_API,
  POLYMARKET_TICK_SIZE,
  POLYMARKET_NEG_RISK,
  POLYGON_CHAIN_ID,
} from "@/lib/polymarketConfig";

/**
 * POST /api/polymarket-close (server wallet - kept for backward compat; UI uses browser signer)
 * Accepts: { asset, size, side } or { user, asset, size, side }
 */

const yesTokenId = POLYMARKET_YES_TOKEN;
const noTokenId = POLYMARKET_NO_TOKEN;
const clobUrl = POLYMARKET_CLOB_API;
const dataApiUrl = POLYMARKET_DATA_API;
const chainId = POLYGON_CHAIN_ID;
const negRisk = POLYMARKET_NEG_RISK;
const tickSize = POLYMARKET_TICK_SIZE as "0.1" | "0.01" | "0.001" | "0.0001";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { asset, size, side, user } = body;

    const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ success: false, error: "POLYMARKET_PRIVATE_KEY not set" }, { status: 500 });
    }

    // Dynamic imports
    const { ClobClient, Side: ClobSide, OrderType } = await import("@polymarket/clob-client");
    const { Wallet } = await import("ethers");

    const signer = new Wallet(privateKey);

    // Derive API credentials
    const tempClient = new ClobClient(clobUrl, chainId, signer);
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
      clobUrl,
      chainId,
      signer,
      apiCreds,
      0, // EOA
      signer.address,
    );

    // Determine token ID and shares to sell
    let tokenID: string;
    let sharesToSell: number;

    const assetToken = asset || body.tokenID;
    if (assetToken) {
      // Called from positions panel with specific asset token ID
      tokenID = String(assetToken);
      sharesToSell = parseFloat(size);
    } else {
      // Called from leverage box — determine token from side, lookup by user or server wallet
      tokenID = side === "YES" ? yesTokenId : noTokenId;
      const lookupUser = user && /^0x[a-fA-F0-9]{40}$/.test(user) ? user : signer.address;
      try {
        const posRes = await fetch(
          `${dataApiUrl}/positions?user=${lookupUser}&asset=${tokenID}&sizeThreshold=0`,
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
        method: null,
        orderId: null,
        status: null,
        sharesSold: 0,
        sellPrice: null,
        estimatedProceeds: null,
        error: "No shares to sell. Position may already be closed.",
      }, { status: 400 });
    }

    // Get current bid price (what we'd get for selling)
    let bidPrice: number;
    try {
      const priceRes = await fetch(`${clobUrl}/price?token_id=${tokenID}&side=BUY`, { cache: "no-store" });
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
    const tickNum = parseFloat(tickSize);
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
        { tickSize, negRisk },
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
          { tickSize, negRisk },
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
            { tickSize, negRisk },
          );
          closeResponse = await client.postOrder(fokOrder, OrderType.FOK);
          closeMethod = "FOK";
          console.log("[CLOSE] FOK response:", JSON.stringify(closeResponse));
        } catch (fokErr: any) {
        return NextResponse.json({
          success: false,
          method: null,
          orderId: null,
          status: null,
          sharesSold: 0,
          sellPrice: null,
          estimatedProceeds: null,
          error: `All close strategies failed. GTC: ${gtcErr.message}. FAK: ${fakErr.message}. FOK: ${fokErr.message}`,
        }, { status: 500 });
        }
      }
    }

    const estimatedProceeds = roundedShares * sellPrice;
    return NextResponse.json({
      success: true,
      method: closeMethod,
      orderId: closeResponse?.orderID ?? closeResponse?.orderId ?? null,
      status: closeResponse?.status ?? "submitted",
      sharesSold: roundedShares,
      sellPrice: sellPrice.toFixed(4),
      estimatedProceeds: estimatedProceeds.toFixed(4),
      tokenID,
      error: null,
    });
  } catch (err) {
    console.error("[CLOSE] Unexpected error:", err);
    return NextResponse.json(
      {
        success: false,
        method: null,
        orderId: null,
        status: null,
        sharesSold: 0,
        sellPrice: null,
        estimatedProceeds: null,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
