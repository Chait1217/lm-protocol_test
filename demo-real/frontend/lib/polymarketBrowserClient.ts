"use client";

import { ethers } from "ethers";
import { ClobClient, OrderType, Side } from "@polymarket/clob-client";
import {
  POLYGON_CHAIN_ID,
  POLYMARKET_CLOB_API,
  POLYMARKET_NEG_RISK,
  POLYMARKET_TICK_NUM,
  POLYMARKET_TICK_SIZE,
  POLYMKT_CTF_ADDRESS,
  POLYMKT_CTF_EXCHANGE_ADDRESS,
  POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS,
  POLYMKT_USDCE_ADDRESS,
} from "./polymarketConfig";

const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
];

const CTF_ABI = [
  "function isApprovedForAll(address owner,address operator) view returns (bool)",
  "function setApprovalForAll(address operator,bool approved)",
];

const MAX_UINT256 = ethers.constants.MaxUint256;

type CachedCreds = {
  key: string;
  secret: string;
  passphrase: string;
};

function cacheKey(address: string) {
  return `polymarket_api_creds:${address.toLowerCase()}`;
}

function loadCreds(address: string): CachedCreds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.key && parsed?.secret && parsed?.passphrase) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveCreds(address: string, creds: CachedCreds) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(cacheKey(address), JSON.stringify(creds));
}

export async function getBrowserPolymarketClient() {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No injected wallet found");
  }

  const provider = new ethers.providers.Web3Provider(
    (window as any).ethereum,
    "any"
  );

  await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();

  if (network.chainId !== POLYGON_CHAIN_ID) {
    throw new Error("Please switch your wallet to Polygon");
  }

  const signer = provider.getSigner();
  const address = await signer.getAddress();

  let apiCreds = loadCreds(address);

  if (!apiCreds) {
    const tempClient = new ClobClient(
      POLYMARKET_CLOB_API,
      POLYGON_CHAIN_ID,
      signer as any
    );

    const derived = await tempClient.createOrDeriveApiKey();
    apiCreds = {
      key: derived.key,
      secret: derived.secret,
      passphrase: derived.passphrase,
    };
    saveCreds(address, apiCreds);
  }

  const client = new ClobClient(
    POLYMARKET_CLOB_API,
    POLYGON_CHAIN_ID,
    signer as any,
    apiCreds,
    0,
    address
  );

  return { client, signer, provider, address };
}

export async function ensurePolymarketApprovals(requiredUsdc: string) {
  const { signer, address } = await getBrowserPolymarketClient();

  const usdc = new ethers.Contract(POLYMKT_USDCE_ADDRESS, ERC20_ABI, signer);
  const ctf = new ethers.Contract(POLYMKT_CTF_ADDRESS, CTF_ABI, signer);

  const required = ethers.utils.parseUnits(requiredUsdc, 6);

  const usdcAllowance = await usdc.allowance(address, POLYMKT_CTF_EXCHANGE_ADDRESS);
  if (usdcAllowance.lt(required)) {
    const tx = await usdc.approve(POLYMKT_CTF_EXCHANGE_ADDRESS, MAX_UINT256);
    await tx.wait(1);
  }

  const approvedMain = await ctf.isApprovedForAll(
    address,
    POLYMKT_CTF_EXCHANGE_ADDRESS
  );
  if (!approvedMain) {
    const tx = await ctf.setApprovalForAll(POLYMKT_CTF_EXCHANGE_ADDRESS, true);
    await tx.wait(1);
  }

  const approvedNegRisk = await ctf.isApprovedForAll(
    address,
    POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS
  );
  if (!approvedNegRisk) {
    const tx = await ctf.setApprovalForAll(
      POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS,
      true
    );
    await tx.wait(1);
  }
}

export function clampOrderPrice(price: number) {
  const rounded =
    Math.round(price / POLYMARKET_TICK_NUM) * POLYMARKET_TICK_NUM;
  return Math.max(
    POLYMARKET_TICK_NUM,
    Math.min(1 - POLYMARKET_TICK_NUM, rounded)
  );
}

export async function placeSignedBuyOrder(params: {
  tokenID: string;
  amountUsd: number;
  referencePrice: number;
}) {
  const { client, address } = await getBrowserPolymarketClient();

  const price = clampOrderPrice(params.referencePrice);
  const size = Math.round((params.amountUsd / price) * 100) / 100;

  if (!(size > 0)) {
    throw new Error("Computed order size is zero");
  }

  await ensurePolymarketApprovals(params.amountUsd.toFixed(6));

  const response = await client.createAndPostOrder(
    {
      tokenID: params.tokenID,
      side: Side.BUY,
      price,
      size,
    },
    {
      tickSize: POLYMARKET_TICK_SIZE as "0.1" | "0.01" | "0.001" | "0.0001",
      negRisk: POLYMARKET_NEG_RISK,
    },
    OrderType.GTC
  );

  return {
    address,
    response,
    price,
    size,
    orderId: response?.orderID || response?.id || "submitted",
  };
}

export async function placeSignedSellOrder(params: {
  tokenID: string;
  size: number;
  referencePrice: number;
}) {
  const { client, address } = await getBrowserPolymarketClient();

  const price = clampOrderPrice(params.referencePrice);

  const response = await client.createAndPostOrder(
    {
      tokenID: params.tokenID,
      side: Side.SELL,
      price,
      size: Math.round(params.size * 100) / 100,
    },
    {
      tickSize: POLYMARKET_TICK_SIZE as "0.1" | "0.01" | "0.001" | "0.0001",
      negRisk: POLYMARKET_NEG_RISK,
    },
    OrderType.GTC
  );

  return {
    address,
    response,
    price,
    size: Math.round(params.size * 100) / 100,
    orderId: response?.orderID || response?.id || "submitted",
  };
}
