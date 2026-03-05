import { NextRequest, NextResponse } from "next/server";

const CLOB_URL = "https://clob.polymarket.com";
const TICK_SIZE = "0.01";
const TICK_NUM = 0.01;
const WALLET =
  process.env.NEXT_PUBLIC_TRADER_WALLET ||
  "0x6CcBdc898016F2E49ada47496696d635b8D4fB31";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { asset, size: requestedSize } = body;
    // asset = the token ID of the position to close
    // size = number of shares to sell (optional — if not provided, fetches from data-api)

    const pk = process.env.POLYMARKET_PRIVATE_KEY;
    if (!pk) {
      return NextResponse.json(
        { success: false, error: "POLYMARKET_PRIVATE_KEY not set" },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ClobClient, Side: ClobSide, OrderType } = require("@polymarket/clob-client");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Wallet } = require("ethers");

    // Determine token ID and size
    let tokenID = asset;
    let shareSize = requestedSize ? parseFloat(requestedSize) : 0;

    // If no asset provided, try to find the position from data-api
    if (!tokenID) {
      const posRes = await fetch(
        `https://data-api.polymarket.com/positions?user=${WALLET}&sizeThreshold=0&limit=100`,
        { cache: "no-store" }
      );
      const positions = await posRes.json();
      if (Array.isArray(positions)) {
        const active = positions.filter(
          (p: any) => parseFloat(p.size || "0") > 0.001
        );
        if (active.length > 0) {
          tokenID = active[0].asset;
          shareSize = parseFloat(active[0].size);
        }
      }
    }

    if (!tokenID || shareSize <= 0) {
      return NextResponse.json(
        { success: false, error: "No position found to close" },
        { status: 400 }
      );
    }

    // Get current bid price
    const bidRes = await fetch(
      `${CLOB_URL}/price?token_id=${tokenID}&side=buy`,
      { cache: "no-store" }
    );
    const bidData = await bidRes.json();
    const bidPrice = parseFloat(bidData?.price || "0.01");

    // Create wallet and client
    const wallet = new Wallet(pk);
    const tempClient = new ClobClient(CLOB_URL, 137, wallet);
    const apiCreds = await tempClient.createOrDeriveApiKey();
    const client = new ClobClient(
      CLOB_URL,
      137,
      wallet,
      apiCreds,
      0,
      wallet.address
    );

    // Round size down to integer (Polymarket requires integer shares for sell)
    const sellSize = Math.floor(shareSize);
    if (sellSize < 1) {
      return NextResponse.json(
        {
          success: false,
          error: `Position too small to sell (${shareSize} shares, need at least 1)`,
        },
        { status: 400 }
      );
    }

    // Price for sell: use bid price, rounded to tick
    const roundedBid = Math.round(bidPrice / TICK_NUM) * TICK_NUM;
    const sellPrice = Math.max(TICK_NUM, Math.min(1 - TICK_NUM, roundedBid));

    let orderResult: any = null;
    let method = "";

    // Strategy 1: GTC limit sell at bid price (rests on book, most reliable)
    try {
      method = "GTC";
      const signedOrder = await client.createOrder(
        {
          tokenID,
          price: sellPrice,
          size: sellSize,
          side: ClobSide.SELL,
        },
        { tickSize: TICK_SIZE, negRisk: false }
      );
      orderResult = await client.postOrder(signedOrder, OrderType.GTC);
    } catch (e1: any) {
      console.error("GTC sell failed:", e1?.message);

      // Strategy 2: GTC at lower price (more aggressive)
      try {
        method = "GTC-aggressive";
        const aggressivePrice = Math.max(
          TICK_NUM,
          sellPrice - 3 * TICK_NUM
        );
        const signedOrder = await client.createOrder(
          {
            tokenID,
            price: aggressivePrice,
            size: sellSize,
            side: ClobSide.SELL,
          },
          { tickSize: TICK_SIZE, negRisk: false }
        );
        orderResult = await client.postOrder(signedOrder, OrderType.GTC);
      } catch (e2: any) {
        console.error("Aggressive GTC sell failed:", e2?.message);

        // Strategy 3: FOK at minimum price
        try {
          method = "FOK";
          const signedOrder = await client.createOrder(
            {
              tokenID,
              price: TICK_NUM,
              size: sellSize,
              side: ClobSide.SELL,
            },
            { tickSize: TICK_SIZE, negRisk: false }
          );
          orderResult = await client.postOrder(signedOrder, OrderType.FOK);
        } catch (e3: any) {
          return NextResponse.json(
            {
              success: false,
              error: `All sell strategies failed. GTC: ${e1?.message}. Aggressive: ${e2?.message}. FOK: ${e3?.message}`,
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      method,
      orderId: orderResult?.orderID || orderResult?.id || "submitted",
      status: orderResult?.status || "LIVE",
      sharesSold: sellSize,
      sellPrice,
      tokenID: tokenID.slice(0, 20) + "...",
      wallet: wallet.address,
    });
  } catch (err: any) {
    console.error("Close route error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
