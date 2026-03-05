import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/polymarket-close
 *
 * Close a position by selling shares.
 * Accepts either:
 *   - orderId (to cancel an open order first)
 *   - asset + size (to sell shares directly from a known position)
 *
 * Uses GTC limit sell at aggressive price, with FAK fallback.
 */

const CLOB_HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137;

type TickSize = "0.1" | "0.01" | "0.001" | "0.0001";

function toTickSize(s: string): TickSize {
  if (s === "0.1" || s === "0.01" || s === "0.001" || s === "0.0001") return s as TickSize;
  return "0.01";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      wallet,
      orderId,
      side,
      asset,         // token ID of the position to close
      size,          // number of shares to sell
      notional,
      borrowAmount,
      negativeRisk,
      conditionId,
    } = body;

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "Missing wallet address" },
        { status: 400 }
      );
    }

    const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { success: false, error: "POLYMARKET_PRIVATE_KEY not configured" },
        { status: 500 }
      );
    }

    // Determine the token ID to sell
    const tokenId = asset || (side === "YES"
      ? (process.env.POLYMARKET_TOKEN_YES || "38397507750621893057346880033441136112987238933685677349709401910643842844855")
      : (process.env.POLYMARKET_TOKEN_NO || "95949957895141858444199258452803633110472396604599808168788254125381075552218"));

    // Determine tick size — try to fetch from CLOB, fallback to env or 0.01
    let tickSizeStr = process.env.POLYMARKET_TICK_SIZE || "0.01";
    try {
      const tickRes = await fetch(`${CLOB_HOST}/tick-size?token_id=${tokenId}`);
      if (tickRes.ok) {
        const tickData = await tickRes.json();
        if (tickData.minimum_tick_size) tickSizeStr = tickData.minimum_tick_size;
      }
    } catch { /* use default */ }

    const tickNum = parseFloat(tickSizeStr);
    const orderTickSize = toTickSize(tickSizeStr);
    const isNegRisk = negativeRisk ?? (process.env.POLYMARKET_NEG_RISK === "true");
    const steps: string[] = [];

    const { ClobClient, Side, OrderType } = await import("@polymarket/clob-client");
    const { Wallet } = await import("ethers");

    const signer = new Wallet(privateKey);
    const tempClient = new ClobClient(CLOB_HOST, CHAIN_ID, signer);
    const apiCreds = await tempClient.createOrDeriveApiKey();

    const client = new ClobClient(
      CLOB_HOST,
      CHAIN_ID,
      signer,
      apiCreds,
      0,
      signer.address,
    );

    // Cancel existing order if provided
    if (orderId) {
      try {
        await client.cancelOrder(orderId);
        steps.push(`Cancelled open order: ${orderId}`);
      } catch {
        steps.push(`Order ${orderId} already filled/cancelled`);
      }
    }

    // Determine shares to sell
    let sharesToSell = size ? parseFloat(String(size)) : 0;

    // If no size provided, estimate from notional
    if (sharesToSell <= 0 && notional) {
      try {
        const priceRes = await fetch(`${CLOB_HOST}/price?token_id=${tokenId}&side=SELL`);
        const priceData = await priceRes.json();
        const sellPrice = parseFloat(priceData.price || "0.5");
        sharesToSell = Math.floor((notional / sellPrice) * 100) / 100;
      } catch {
        sharesToSell = Math.floor(notional * 2);
      }
    }

    if (sharesToSell <= 0) {
      return NextResponse.json({
        success: false,
        error: "No shares to sell. Position may already be closed.",
      }, { status: 400 });
    }

    // Get current sell price
    let sellPrice: number;
    try {
      const priceRes = await fetch(`${CLOB_HOST}/price?token_id=${tokenId}&side=SELL`);
      const priceData = await priceRes.json();
      sellPrice = parseFloat(priceData.price || "0.5");
    } catch {
      sellPrice = 0.5;
    }

    // Aggressive price: 5% below market, rounded to tick
    const aggressivePrice = Math.max(
      tickNum,
      Math.floor((sellPrice * 0.95) / tickNum) * tickNum
    );

    // Round shares down to 2 decimal places
    sharesToSell = Math.floor(sharesToSell * 100) / 100;

    steps.push(`Selling ${sharesToSell} shares @ $${aggressivePrice.toFixed(4)} (market: $${sellPrice.toFixed(4)})`);

    // Try GTC first, then FAK
    let closeResponse: any = null;
    let closeMethod = "";

    try {
      closeResponse = await client.createAndPostOrder(
        { tokenID: tokenId, price: aggressivePrice, size: sharesToSell, side: Side.SELL },
        { tickSize: orderTickSize, negRisk: isNegRisk },
        OrderType.GTC,
      );
      closeMethod = "GTC";
      steps.push(`GTC sell order placed: ${closeResponse.orderID || "submitted"}, status: ${closeResponse.status || "pending"}`);
    } catch (gtcErr) {
      steps.push(`GTC sell failed: ${gtcErr instanceof Error ? gtcErr.message : "unknown"}`);
      try {
        const signedOrder = await client.createOrder(
          { tokenID: tokenId, price: aggressivePrice, size: sharesToSell, side: Side.SELL },
          { tickSize: orderTickSize, negRisk: isNegRisk },
        );
        closeResponse = await client.postOrder(signedOrder, OrderType.FAK);
        closeMethod = "FAK";
        steps.push(`FAK sell order placed: ${closeResponse.orderID || "submitted"}`);
      } catch (fakErr) {
        steps.push(`All sell methods failed: ${fakErr instanceof Error ? fakErr.message : "unknown"}`);
        return NextResponse.json({
          success: false,
          error: "Could not close position. Try again when more liquidity is available.",
          steps,
          details: { sharesToSell, sellPrice, aggressivePrice, tokenId },
        }, { status: 500 });
      }
    }

    if (closeResponse?.status === "rejected" || closeResponse?.errorMsg) {
      return NextResponse.json({
        success: false,
        error: `Close order rejected: ${closeResponse.errorMsg || "unknown"}`,
        steps,
      }, { status: 400 });
    }

    // Repay vault borrow if applicable
    if (borrowAmount && borrowAmount > 0) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/vault-repay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, amount: borrowAmount }),
        });
        steps.push(`Vault repayment initiated: $${borrowAmount.toFixed(2)}`);
      } catch {
        steps.push("Vault repayment handled by MarginEngine on-chain");
      }
    }

    return NextResponse.json({
      success: true,
      closeOrderId: closeResponse?.orderID,
      closeMethod,
      sellPrice: aggressivePrice.toString(),
      sharesSold: sharesToSell.toString(),
      steps,
    });
  } catch (err) {
    console.error("Close trade error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
