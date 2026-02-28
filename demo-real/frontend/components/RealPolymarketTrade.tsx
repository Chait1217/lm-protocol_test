"use client";

import { useState, useCallback, useEffect } from "react";
import { AlertTriangle, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { polygon } from "wagmi/chains";
import {
  POLYGON_CHAIN_ID,
  POLYMKT_USDCE_ADDRESS,
  POLYMKT_CTF_ADDRESS,
  POLYMKT_CTF_EXCHANGE_ADDRESS,
  POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS,
  POLYMKT_NEG_RISK_ADAPTER_ADDRESS,
  POLYMARKET_CLOB_API,
} from "@/lib/polymarketConfig";
import { erc20PolyAbi } from "@/lib/polymarketAbi";
import { getContractAddresses, USDC_ABI, MARGIN_ENGINE_ABI } from "@/lib/contracts";
import { parseUSDC, formatUSDC, bpsToPercent } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────── */

/** Market slice needed for real Polymarket order. */
export interface RealTradeMarket {
  title: string;
  slug: string | null;
  bestBid: number | null;
  bestAsk: number | null;
  clobTokenIds: string[];
  tickSize?: string;
  negRisk?: boolean;
}

interface Props {
  market: RealTradeMarket | null;
  selectedOutcome: "YES" | "NO";
  collateral: number;
  leverage: number;
  entryPrice: number;
  onSuccess?: () => void;
}

const POLYGONSCAN_TX = "https://polygonscan.com/tx/";
const addresses = getContractAddresses();
const ZERO = "0x0000000000000000000000000000000000000000";
const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;

type FlowStep = "idle" | "polymarket" | "borrow" | "borrow-confirming" | "done";
type NoLiquidityMode = "abort" | "rest";
type ExecutionMode = "market_first" | "rest_first";
const NO_LIQUIDITY_MODE: NoLiquidityMode =
  ((process.env.NEXT_PUBLIC_POLYMARKET_NO_LIQUIDITY_MODE || "abort").toLowerCase() === "abort"
    ? "abort"
    : "rest");
const POLYMARKET_EXECUTION_MODE: ExecutionMode =
  ((process.env.NEXT_PUBLIC_POLYMARKET_EXECUTION_MODE || "market_first").toLowerCase() === "market_first"
    ? "market_first"
    : "rest_first");
const FAK_SLIPPAGE_BPS = 300; // 3.00%
const MIN_RESTING_ORDER_SIZE = 5;

function toErrorMessage(resp: any): string {
  const parts = [
    resp?.errorMsg,
    resp?.error,
    resp?.message,
    resp?.status,
    resp?.detail,
    resp?.reason,
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  if (parts.length > 0) return parts.join(" | ");
  try {
    return JSON.stringify(resp);
  } catch {
    return "Unknown CLOB response";
  }
}

function parseOrderOutcome(resp: any): { ok: boolean; orderId?: string; txHash?: string; error?: string } {
  if (typeof resp === "string") {
    const tag = resp.trim().toLowerCase();
    const successLikeTag = new Set(["matched", "filled", "live", "accepted", "posted", "open"]);
    if (successLikeTag.has(tag)) {
      return { ok: true, orderId: `status:${tag}` };
    }
  }

  const normalizedError =
    typeof resp?.error === "string"
      ? resp.error.trim().toLowerCase()
      : typeof resp?.data?.error === "string"
        ? resp.data.error.trim().toLowerCase()
        : "";
  const normalizedErrorMsg =
    typeof resp?.errorMsg === "string"
      ? resp.errorMsg.trim().toLowerCase()
      : typeof resp?.data?.errorMsg === "string"
        ? resp.data.errorMsg.trim().toLowerCase()
        : "";
  const normalizedStatus =
    typeof resp?.status === "string"
      ? resp.status.trim().toLowerCase()
      : typeof resp?.data?.status === "string"
        ? resp.data.status.trim().toLowerCase()
        : "";
  const successLikeTag = new Set(["matched", "filled", "live", "accepted", "posted", "open"]);

  const orderId =
    resp?.orderID ??
    resp?.orderId ??
    resp?.id ??
    resp?.order_id ??
    resp?.data?.orderID ??
    resp?.data?.orderId ??
    resp?.data?.id ??
    resp?.data?.order_id;

  const txHash =
    resp?.transactionHash ??
    resp?.txHash ??
    resp?.transaction_hash ??
    (Array.isArray(resp?.transactionsHashes) ? resp.transactionsHashes[0] : undefined) ??
    (Array.isArray(resp?.transactionHashes) ? resp.transactionHashes[0] : undefined);

  const explicitFailure =
    resp?.success === false ||
    resp?.data?.success === false ||
    (typeof resp?.errorMsg === "string" && !successLikeTag.has(String(resp.errorMsg).trim().toLowerCase())) ||
    (typeof resp?.error === "string" && !successLikeTag.has(normalizedError)) ||
    (typeof resp?.data?.errorMsg === "string" && !successLikeTag.has(String(resp.data.errorMsg).trim().toLowerCase())) ||
    (typeof resp?.data?.error === "string" && !successLikeTag.has(normalizedError));

  // Some market order responses can be successful without an explicit order id.
  const explicitSuccess =
    resp?.success === true ||
    resp?.data?.success === true ||
    successLikeTag.has(normalizedStatus) ||
    successLikeTag.has(normalizedError) ||
    successLikeTag.has(normalizedErrorMsg) ||
    (typeof resp?.status === "string" && !["error", "failed", "rejected"].includes(resp.status.toLowerCase()));

  if (explicitFailure) {
    return { ok: false, error: toErrorMessage(resp) };
  }

  if (orderId || txHash || explicitSuccess) {
    return {
      ok: true,
      orderId: orderId ?? (txHash ? `tx:${String(txHash).slice(0, 16)}` : undefined),
      txHash,
    };
  }

  return { ok: false, error: toErrorMessage(resp) };
}

function getOutcomeTag(resp: any): string {
  if (typeof resp === "string") return resp.trim().toLowerCase();
  const candidates = [resp?.status, resp?.errorMsg, resp?.error];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim().toLowerCase();
  }
  return "";
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isFokNoFillError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("fully filled or killed") || m.includes("couldn't be fully filled");
}

function isNoLiquidityError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("no orders found to match") ||
    m.includes("no match") ||
    m.includes("partially filled or killed") ||
    m.includes("fully filled or killed") ||
    m.includes("couldn't be fully filled")
  );
}

function isMinRestingSizeError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("size") && m.includes("minimum");
}

function isTransientRestingOrderError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("service not ready") ||
    m.includes("temporarily unavailable") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("try again later") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("gateway")
  );
}

function isRestingFallbackUnavailableError(message: string): boolean {
  return isMinRestingSizeError(message) || isTransientRestingOrderError(message);
}

function toLevels(levels: Array<{ price: string; size: string }> | undefined): Array<{ price: number; size: number }> {
  return (levels || [])
    .map((l) => ({ price: Number(l.price), size: Number(l.size) }))
    .filter((l) => Number.isFinite(l.price) && Number.isFinite(l.size) && l.price > 0 && l.size > 0);
}

function checkFakLiquidity(params: {
  side: "BUY" | "SELL";
  notional: number;
  targetPrice: number;
  orderbook: any;
}) {
  const bids = toLevels(params.orderbook?.bids);
  const asks = toLevels(params.orderbook?.asks);
  const bestBid = bids.length > 0 ? bids[0].price : null;
  const bestAsk = asks.length > 0 ? asks[0].price : null;
  const maxBuyPrice = params.targetPrice * (1 + FAK_SLIPPAGE_BPS / 10_000);
  const minSellPrice = Math.max(0, params.targetPrice * (1 - FAK_SLIPPAGE_BPS / 10_000));

  let availableNotional = 0;
  if (params.side === "BUY") {
    for (const lvl of asks) {
      if (lvl.price <= maxBuyPrice) {
        availableNotional += lvl.price * lvl.size;
      }
    }
  } else {
    for (const lvl of bids) {
      if (lvl.price >= minSellPrice) {
        availableNotional += lvl.price * lvl.size;
      }
    }
  }

  const canSend = availableNotional >= params.notional;
  return {
    canSend,
    availableNotional,
    bestBid,
    bestAsk,
    depthBids: bids.slice(0, 5),
    depthAsks: asks.slice(0, 5),
    targetPrice: params.targetPrice,
    maxBuyPrice,
    minSellPrice,
  };
}

/* ────────────────────────────────────────────────────────────────── */

export default function RealPolymarketTrade({ market, selectedOutcome, collateral, leverage, entryPrice, onSuccess }: Props) {
  const { address } = useAccount();

  /* ── Derived values ── */
  const notional = collateral * leverage;
  const borrowed = notional - collateral;
  const isLong = selectedOutcome === "YES";
  const spendBufferPercent = 3;
  const expectedPolymarketSpend = Number((notional * (1 + spendBufferPercent / 100)).toFixed(6));

  /* ── Polygon USDC.e balance ── */
  const polygonBalance = useReadContract({
    address: POLYMKT_USDCE_ADDRESS,
    abi: erc20PolyAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: POLYGON_CHAIN_ID,
  });
  const polygonUsdc = polygonBalance.data != null ? Number(polygonBalance.data) / 1e6 : 0;

  /* ── USDC.e allowance for MarginEngine (all on Polygon now) ── */
  const { data: meAllowance, refetch: refetchAllowance } = useReadContract({
    address: addresses.usdc,
    abi: USDC_ABI,
    functionName: "allowance",
    args: address ? [address, addresses.marginEngine] : undefined,
    chainId: polygon.id,
  });
  const needsApproval = meAllowance !== undefined
    ? (meAllowance as bigint) < parseUSDC(collateral.toString())
    : true;

  /* ── Write contract (all on Polygon) ── */
  const { writeContract, isPending: isWritePending } = useWriteContract();
  const [vaultTxHash, setVaultTxHash] = useState<`0x${string}` | undefined>();
  const {
    isLoading: isVaultConfirming,
    isSuccess: isVaultTxSuccess,
    isError: isVaultTxError,
    error: vaultTxError,
  } = useWaitForTransactionReceipt({ hash: vaultTxHash, chainId: polygon.id });

  /* ── Flow state ── */
  const [step, setStep] = useState<FlowStep>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [polymarketLoading, setPolymarketLoading] = useState(false);
  const [result, setResult] = useState<{
    positionId?: string;
    vaultTx?: string;
    orderId?: string;
    polyTxHash?: string;
    error?: string;
    info?: string;
  } | null>(null);

  /* ── CLOB token ── */
  const clobTokenIds = market?.clobTokenIds ?? [];
  const tokenId = selectedOutcome === "YES" ? clobTokenIds[0] : clobTokenIds[1];
  const price = selectedOutcome === "YES"
    ? (market?.bestAsk ?? 0.5)
    : market?.bestBid != null ? 1 - market.bestBid : 0.5;

  const meetsPolymarketMin = notional >= 1;
  const hasEnoughForPolymarket = polygonUsdc >= notional;
  const canTrade = Boolean(
    address && tokenId && collateral >= 0.5 && leverage >= 2 && market && meetsPolymarketMin
  );

  useEffect(() => {
    if (isVaultTxSuccess && step === "borrow-confirming") {
      setResult((prev) => ({ ...(prev ?? {}), positionId: "confirmed", vaultTx: vaultTxHash }));
      setStep("done");
      setConfirmOpen(false);
      onSuccess?.();
    }
  }, [isVaultTxSuccess, step, vaultTxHash, onSuccess]);

  useEffect(() => {
    if (isVaultTxError && step === "borrow-confirming") {
      const message = vaultTxError instanceof Error ? vaultTxError.message : "Vault tx failed";
      const stale = message.toLowerCase().includes("stale price");
      setResult((prev) => ({
        ...(prev ?? {}),
        error: stale
          ? `Vault confirmation failed because oracle price is stale. Polymarket order already executed. Close from "Verify on Polymarket API" and retry after oracle refresh.`
          : `Vault confirmation failed after Polymarket order succeeded: ${message}`,
      }));
      setStep("done");
    }
  }, [isVaultTxError, step, vaultTxError]);

  const ensureVaultOracleFresh = useCallback(async (): Promise<boolean> => {
    if (!hasVault) return true;
    if (typeof window === "undefined" || !window.ethereum) {
      setResult({ error: "No wallet found to verify oracle freshness." });
      setStep("done");
      return false;
    }
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const reader = new ethers.Contract(
        addresses.marginEngine,
        ["function getMarketOraclePrice(bytes32 marketId) view returns (uint256)"],
        provider
      );
      const px = await reader.getMarketOraclePrice(addresses.marketId);
      const ok = Number(px) > 0;
      if (!ok) throw new Error("oracle returned zero");
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stale = msg.toLowerCase().includes("stale price");
      if (stale) {
        try {
          const refreshRes = await fetch("/api/oracle-refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ marketId: addresses.marketId }),
          });
          const refreshJson = await refreshRes.json().catch(() => ({}));
          if (!refreshRes.ok || !refreshJson?.success) {
            throw new Error((refreshJson?.error || "oracle refresh endpoint failed").toString());
          }
          await sleep(1200);
          const { ethers } = await import("ethers");
          const provider = new ethers.providers.Web3Provider(window.ethereum);

          const reader = new ethers.Contract(
            addresses.marginEngine,
            ["function getMarketOraclePrice(bytes32 marketId) view returns (uint256)"],
            provider
          );
          const px = await reader.getMarketOraclePrice(addresses.marketId);
          if (Number(px) > 0) return true;
        } catch (refreshErr: unknown) {
          const refreshMsg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
          setResult({
            error: `Oracle is stale and server auto-refresh failed (${refreshMsg}). Configure POLYMARKET_FEED_PRIVATE_KEY for the backend updater bot and retry.`,
          });
          setStep("done");
          return false;
        }
      }
      setResult({
        error: stale
          ? "Oracle is stale right now, so vault open would revert. Wait for feed refresh (about 30-60s) and retry."
          : `Vault oracle check failed: ${msg}`,
      });
      setStep("done");
      return false;
    }
  }, []);

  /* ── Step 1: Open position on Polygon vault (borrow) ── */
  const startBorrow = useCallback(async () => {
    if (!hasVault) {
      setResult({ error: "Vault not configured. Set NEXT_PUBLIC_VAULT_ADDRESS and NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS." });
      return;
    }
    try {
      setStep("borrow");

      // Approve if needed (all on Polygon — no chain switch needed)
      if (needsApproval) {
        await new Promise<void>((resolve, reject) => {
          writeContract(
            {
              address: addresses.usdc,
              abi: USDC_ABI,
              functionName: "approve",
              args: [addresses.marginEngine, parseUSDC("999999999")],
              chainId: polygon.id,
            },
            {
              onSuccess: () => { refetchAllowance(); resolve(); },
              onError: (err) => reject(err),
            }
          );
        });
        await new Promise((r) => setTimeout(r, 2000));
      }

      // Open position on MarginEngine (Polygon) with marketId; entry is snapshotted from oracle on-chain.
      const marketId = addresses.marketId;
      writeContract(
        {
          address: addresses.marginEngine,
          abi: MARGIN_ENGINE_ABI,
          functionName: "openPosition",
          args: [parseUSDC(collateral.toString()), BigInt(leverage), isLong, marketId],
          chainId: polygon.id,
        },
        {
          onSuccess: (hash) => {
            setVaultTxHash(hash);
            setStep("borrow-confirming");
          },
          onError: (err) => {
            setStep("idle");
            setResult({ error: `Vault borrow failed: ${err.message}` });
          },
        }
      );
    } catch (err: unknown) {
      setStep("idle");
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ error: `Borrow step failed: ${msg}` });
    }
  }, [needsApproval, writeContract, refetchAllowance, collateral, leverage, isLong, entryPrice]);

  /* ── Step 1: Place real Polymarket order (same chain!) ── */
  const placePolymarketOrder = useCallback(async (): Promise<boolean> => {
    if (!market?.clobTokenIds?.length || !tokenId) {
      setResult({ error: "Missing market token IDs for Polymarket order" });
      setStep("idle");
      return false;
    }
    if (typeof window === "undefined" || !window.ethereum) {
      setResult({ error: "No wallet (e.g. MetaMask) found" });
      setStep("idle");
      return false;
    }

    setStep("polymarket");
    setPolymarketLoading(true);

    try {
      const { ethers } = await import("ethers");
      const { ClobClient, Side, OrderType, AssetType } = await import("@polymarket/clob-client");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const walletAddress = await signer.getAddress();
      if (!walletAddress || walletAddress === "0x") {
        setResult({ error: "Could not get wallet address" });
        setStep("idle");
        setPolymarketLoading(false);
        return false;
      }

      const host = POLYMARKET_CLOB_API;
      const getClientForSig = async (signatureType: number) => {
        const base = new ClobClient(host, 137, signer, undefined, signatureType, walletAddress);
        const creds = await base.createOrDeriveApiKey();
        return new ClobClient(host, 137, signer, creds, signatureType, walletAddress);
      };
      const client = await getClientForSig(0);

      const usdc = new ethers.Contract(
        POLYMKT_USDCE_ADDRESS,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
        ],
        signer
      );

      const requiredWithBuffer = Number((notional * 1.03).toFixed(6));
      const requiredRaw = ethers.utils.parseUnits(requiredWithBuffer.toFixed(6), 6);
      const spenderSet = [
        POLYMKT_CTF_EXCHANGE_ADDRESS,
        POLYMKT_CTF_ADDRESS,
        POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS,
        POLYMKT_NEG_RISK_ADAPTER_ADDRESS,
      ];
      for (const spender of spenderSet) {
        const current = await usdc.allowance(walletAddress, spender);
        if (current.lt(requiredRaw)) {
          const approveTx = await usdc.approve(spender, ethers.constants.MaxUint256);
          await approveTx.wait(1);
        }
      }
      const exchangeAllowanceRaw = await usdc.allowance(walletAddress, POLYMKT_CTF_EXCHANGE_ADDRESS);
      const ctfAllowanceRaw = await usdc.allowance(walletAddress, POLYMKT_CTF_ADDRESS);
      const negRiskExchangeAllowanceRaw = await usdc.allowance(walletAddress, POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS);
      const negRiskAdapterAllowanceRaw = await usdc.allowance(walletAddress, POLYMKT_NEG_RISK_ADAPTER_ADDRESS);

      // Ensure CLOB collateral allowance is synced before submitting market order.
      await client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
      let clobBalance = 0;
      let clobAllowance = 0;
      for (let i = 0; i < 5; i++) {
        const bal = await client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
        clobBalance = Number(bal?.balance ?? "0") / 1e6;
        clobAllowance = Number(bal?.allowance ?? "0") / 1e6;
        if (Number.isFinite(clobBalance) && Number.isFinite(clobAllowance) && clobAllowance >= notional) break;
        await client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
        await sleep(1200);
      }
      if (!Number.isFinite(clobBalance) || !Number.isFinite(clobAllowance)) {
        throw new Error("Could not read Polymarket balance/allowance");
      }
      const exchangeAllowance = Number(ethers.utils.formatUnits(exchangeAllowanceRaw, 6));
      const ctfAllowance = Number(ethers.utils.formatUnits(ctfAllowanceRaw, 6));
      const onchainAllowance = Math.max(exchangeAllowance, ctfAllowance);
      const hasBalance = clobBalance >= requiredWithBuffer;
      const hasAllowance = clobAllowance >= requiredWithBuffer || onchainAllowance >= requiredWithBuffer;
      if (!hasBalance) {
        throw new Error(
          `not enough balance / allowance (need ${requiredWithBuffer.toFixed(6)} USDC.e, have balance ${clobBalance.toFixed(6)}, clob allowance ${clobAllowance.toFixed(6)}, onchain allowance ${onchainAllowance.toFixed(6)})`
        );
      }
      if (!hasAllowance) {
        // CLOB allowance endpoint can lag despite onchain approvals; proceed and let post-order check be source of truth.
        console.warn("[Polymarket] allowance mismatch", {
          requiredWithBuffer,
          clobAllowance,
          onchainAllowance,
        });
      }

      const tickSize = (market.tickSize as "0.1" | "0.01" | "0.001" | "0.0001") ?? "0.01";
      const negRisk = market.negRisk ?? false;

      const submitOrder = async (typedClient: any, orderType: any) => {
        return typedClient.createAndPostMarketOrder(
          {
            tokenID: tokenId,
            amount: notional,
            side: Side.BUY,
          },
          { tickSize, negRisk },
          orderType
        );
      };

      const postRestingLimitOrder = async (typedClient: any) => {
        const limitPrice = Math.max(0.01, Math.min(0.99, Number(price.toFixed(4))));
        const size = Number((notional / limitPrice).toFixed(6));
        if (size < MIN_RESTING_ORDER_SIZE) {
          const minNotional = MIN_RESTING_ORDER_SIZE * limitPrice;
          throw new Error(
            `Resting GTC minimum size is ${MIN_RESTING_ORDER_SIZE}. Current size is ${size.toFixed(2)} at ${(limitPrice * 100).toFixed(1)}¢. Increase notional to at least $${minNotional.toFixed(2)}.`
          );
        }
        return typedClient.createAndPostOrder(
          {
            tokenID: tokenId,
            price: limitPrice,
            size,
            side: Side.BUY,
          },
          { tickSize, negRisk },
          OrderType.GTC
        );
      };

      if (POLYMARKET_EXECUTION_MODE === "rest_first") {
        try {
          let limitResp: any;
          try {
            limitResp = await postRestingLimitOrder(client);
          } catch (firstRestErr: unknown) {
            const firstMsg = firstRestErr instanceof Error ? firstRestErr.message : String(firstRestErr);
            if (!isTransientRestingOrderError(firstMsg)) throw firstRestErr;
            await sleep(1200);
            limitResp = await postRestingLimitOrder(client);
          }
          const limitParsed = parseOrderOutcome(limitResp);
          const tag = getOutcomeTag(limitResp);
          const msg = toErrorMessage(limitResp).toLowerCase();
          const successLike = ["matched", "filled", "live", "open", "posted", "accepted"];
          const looksSuccessful = successLike.some((s) => tag.includes(s) || msg === s || msg.includes(`"${s}"`));
          if (limitParsed.ok || looksSuccessful) {
            const matchedNow = tag.includes("matched") || tag.includes("filled") || msg.includes("matched") || msg.includes("filled");
            const orderId = limitParsed.orderId ?? (tag ? `status:${tag}` : "status:matched");
            if (matchedNow) {
              setResult({
                orderId,
                polyTxHash: limitParsed.txHash,
              });
              return true;
            }
            setResult({
              orderId,
              polyTxHash: limitParsed.txHash,
              info: "Posted resting GTC order on Polymarket (rest-first mode). Vault leg was not opened because the order is resting.",
            });
            setStep("done");
            return false;
          }
          throw new Error(`Could not post resting GTC order in rest-first mode: ${toErrorMessage(limitResp)}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          // Small orders and temporary rest service errors should continue with market execution path.
          if (!isMinRestingSizeError(msg) && !isTransientRestingOrderError(msg)) {
            throw err;
          }
        }
      }

      // Global preflight: avoid sending FAK/FOK when immediate opposite liquidity is absent.
      const preflightBook = await client.getOrderBook(tokenId);
      const preflightLiq = checkFakLiquidity({
        side: "BUY",
        notional,
        targetPrice: price,
        orderbook: preflightBook,
      });
      console.log("[Polymarket][orderbook-snapshot]", {
        reason: "preflight_before_any_market_order",
        marketSlug: market?.slug,
        tokenId,
        orderType: "FAK",
        side: "BUY",
        notional,
        tickSize,
        negRisk,
        liq: preflightLiq,
      });
      if (!preflightLiq.canSend) {
        let continueWithMarketAttempt = false;
        if (NO_LIQUIDITY_MODE === "rest") {
          try {
            const limitResp = await postRestingLimitOrder(client);
            const limitParsed = parseOrderOutcome(limitResp);
            if (limitParsed.ok) {
              setResult({
                orderId: limitParsed.orderId,
                polyTxHash: limitParsed.txHash,
                info: "No immediate liquidity for FAK/FOK. A resting GTC limit order was posted on Polymarket; vault leg was not opened yet.",
              });
              setStep("done");
              return false;
            }
            throw new Error(`Could not post resting GTC order: ${toErrorMessage(limitResp)}`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            // If resting fallback is unavailable (min size / transient service), continue to market execution.
            if (!isRestingFallbackUnavailableError(msg)) {
              throw err;
            }
            continueWithMarketAttempt = true;
          }
        }
        if (!continueWithMarketAttempt) {
          setResult({
            error: "No opposite liquidity at a fillable price/size for FAK/FOK. Vault leg not opened.",
          });
          setStep("done");
          return false;
        }
      }

      let resp: any;
      let noLiquidityDetected = false;
      let activeClient: any = client;
      let lastErr: unknown;
      const signatureTypeCandidates = [0, 1, 2];
      for (const sigType of signatureTypeCandidates) {
        try {
          const typedClient = sigType === 0 ? client : await getClientForSig(sigType);
          activeClient = typedClient;
          await typedClient.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
          await sleep(900);
          try {
            resp = await submitOrder(typedClient, OrderType.FOK);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            // FOK can fail on thin books; retry with FAK for partial fill.
            if (isFokNoFillError(msg)) {
              const orderbook = await typedClient.getOrderBook(tokenId);
              const liq = checkFakLiquidity({
                side: "BUY",
                notional,
                targetPrice: price,
                orderbook,
              });
              const debugPayload = {
                reason: "precheck_before_fak_after_fok_fail",
                marketSlug: market?.slug,
                tokenId,
                orderType: "FAK",
                side: "BUY",
                notional,
                tickSize,
                negRisk,
                liq,
              };
              console.log("[Polymarket][orderbook-snapshot]", debugPayload);
              if (!liq.canSend) {
                if (NO_LIQUIDITY_MODE === "rest") {
                  try {
                    resp = await postRestingLimitOrder(typedClient);
                  } catch (restErr: unknown) {
                    const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
                    if (isRestingFallbackUnavailableError(restMsg)) {
                      noLiquidityDetected = true;
                      break;
                    }
                    throw restErr;
                  }
                } else {
                  noLiquidityDetected = true;
                  break;
                }
              } else {
                resp = await submitOrder(typedClient, OrderType.FAK);
              }
            } else if (isNoLiquidityError(msg)) {
              const orderbook = await typedClient.getOrderBook(tokenId);
              const liq = checkFakLiquidity({
                side: "BUY",
                notional,
                targetPrice: price,
                orderbook,
              });
              console.log("[Polymarket][orderbook-snapshot]", {
                reason: "fak_no_match_throw",
                marketSlug: market?.slug,
                tokenId,
                orderType: "FAK",
                side: "BUY",
                notional,
                tickSize,
                negRisk,
                liq,
              });
              if (NO_LIQUIDITY_MODE === "rest") {
                try {
                  resp = await postRestingLimitOrder(typedClient);
                } catch (restErr: unknown) {
                  const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
                  if (isRestingFallbackUnavailableError(restMsg)) {
                    noLiquidityDetected = true;
                    break;
                  }
                  throw restErr;
                }
              } else {
                noLiquidityDetected = true;
                break;
              }
            } else {
              throw err;
            }
          }
          // Some client responses return soft errors instead of throwing.
          const firstParse = parseOrderOutcome(resp);
          if (!firstParse.ok && isFokNoFillError(firstParse.error || "")) {
            const orderbook = await typedClient.getOrderBook(tokenId);
            const liq = checkFakLiquidity({
              side: "BUY",
              notional,
              targetPrice: price,
              orderbook,
            });
            console.log("[Polymarket][orderbook-snapshot]", {
              reason: "fak_soft_error_after_fok",
              marketSlug: market?.slug,
              tokenId,
              orderType: "FAK",
              side: "BUY",
              notional,
              tickSize,
              negRisk,
              liq,
            });
            if (!liq.canSend) {
              if (NO_LIQUIDITY_MODE === "rest") {
                try {
                  resp = await postRestingLimitOrder(typedClient);
                } catch (restErr: unknown) {
                  const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
                  if (isRestingFallbackUnavailableError(restMsg)) {
                    noLiquidityDetected = true;
                    break;
                  }
                  throw restErr;
                }
              } else {
                noLiquidityDetected = true;
                break;
              }
            } else {
              resp = await submitOrder(typedClient, OrderType.FAK);
            }
          } else if (!firstParse.ok && isNoLiquidityError(firstParse.error || "")) {
            const orderbook = await typedClient.getOrderBook(tokenId);
            const liq = checkFakLiquidity({
              side: "BUY",
              notional,
              targetPrice: price,
              orderbook,
            });
            console.log("[Polymarket][orderbook-snapshot]", {
              reason: "fak_soft_no_match",
              marketSlug: market?.slug,
              tokenId,
              orderType: "FAK",
              side: "BUY",
              notional,
              tickSize,
              negRisk,
              liq,
            });
            if (NO_LIQUIDITY_MODE === "rest") {
              try {
                resp = await postRestingLimitOrder(typedClient);
              } catch (restErr: unknown) {
                const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
                if (isRestingFallbackUnavailableError(restMsg)) {
                  noLiquidityDetected = true;
                  break;
                }
                throw restErr;
              }
            } else {
              noLiquidityDetected = true;
              break;
            }
          }
          lastErr = undefined;
          break;
        } catch (err: unknown) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          if (isNoLiquidityError(msg)) {
            noLiquidityDetected = true;
            break;
          }
          if (!msg.toLowerCase().includes("not enough balance / allowance")) {
            throw err;
          }
          // Try next signature type.
        }
      }
      if (noLiquidityDetected && !resp) {
        if (NO_LIQUIDITY_MODE === "rest") {
          try {
            const limitResp = await postRestingLimitOrder(activeClient);
            const limitParsed = parseOrderOutcome(limitResp);
            if (limitParsed.ok) {
              setResult({
                orderId: limitParsed.orderId,
                polyTxHash: limitParsed.txHash,
                info: "No immediate liquidity for FAK. A resting GTC limit order was posted on Polymarket; vault leg was not opened yet.",
              });
              setStep("done");
              return false;
            }
          } catch (restErr: unknown) {
            const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
            if (!isRestingFallbackUnavailableError(restMsg)) {
              throw restErr;
            }
          }
        }
        setResult({
          error: "No liquidity – order failed. No vault opened.",
        });
        setStep("done");
        return false;
      }
      if (lastErr && !resp) throw lastErr;
      console.log("[Polymarket] market order response", resp);

      const parsed = parseOrderOutcome(resp);
      if (!parsed.ok) {
        const rawMsg = (parsed.error || "").toLowerCase();
        const successLike = ["matched", "filled", "live", "open", "posted", "accepted"];
        if (
          successLike.some(
            (s) =>
              rawMsg === s ||
              rawMsg.includes(`"${s}"`) ||
              rawMsg.includes(` ${s} `) ||
              rawMsg.startsWith(`${s} `) ||
              rawMsg.startsWith(`${s}|`) ||
              rawMsg.includes(`${s} |`) ||
              rawMsg.endsWith(` ${s}`)
          )
        ) {
          setResult({
            orderId: `status:${rawMsg.split("|")[0].trim() || "matched"}`,
            polyTxHash: undefined,
          });
          return true;
        }
        if (isNoLiquidityError(parsed.error || "")) {
          if (NO_LIQUIDITY_MODE === "rest") {
            try {
              const limitResp = await postRestingLimitOrder(activeClient);
              const limitParsed = parseOrderOutcome(limitResp);
              if (limitParsed.ok) {
                setResult({
                  orderId: limitParsed.orderId,
                  polyTxHash: limitParsed.txHash,
                  info: "No immediate liquidity for FAK/FOK. A resting GTC limit order was posted on Polymarket; vault leg was not opened yet.",
                });
                setStep("done");
                return false;
              }
            } catch (restErr: unknown) {
              const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
              if (!isRestingFallbackUnavailableError(restMsg)) {
                throw restErr;
              }
            }
          }
          setResult({
            error: "No opposite liquidity at a fillable price/size for FAK/FOK. Vault leg not opened.",
          });
          setStep("done");
          return false;
        }
        const exchangeAllowance = Number(ethers.utils.formatUnits(exchangeAllowanceRaw, 6));
        const ctfAllowance = Number(ethers.utils.formatUnits(ctfAllowanceRaw, 6));
        const negRiskExchangeAllowance = Number(ethers.utils.formatUnits(negRiskExchangeAllowanceRaw, 6));
        const negRiskAdapterAllowance = Number(ethers.utils.formatUnits(negRiskAdapterAllowanceRaw, 6));
        throw new Error(
          `${parsed.error || "Polymarket order failed"} | need=${requiredWithBuffer.toFixed(6)} balance=${clobBalance.toFixed(6)} clobAllowance=${clobAllowance.toFixed(6)} exchangeAllowance=${exchangeAllowance.toFixed(6)} ctfAllowance=${ctfAllowance.toFixed(6)} negRiskExchangeAllowance=${negRiskExchangeAllowance.toFixed(6)} negRiskAdapterAllowance=${negRiskAdapterAllowance.toFixed(6)}`
        );
      }

      setResult({
        orderId: parsed.orderId,
        polyTxHash: parsed.txHash,
      });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ error: `Polymarket order failed: ${message}` });
      setStep("done");
      return false;
    } finally {
      setPolymarketLoading(false);
    }
  }, [market, tokenId, notional]);

  /* ── Combined execute ── */
  const handleExecute = useCallback(async () => {
    setResult(null);
    setVaultTxHash(undefined);
    const oracleOk = await ensureVaultOracleFresh();
    if (!oracleOk) return;
    const polyOk = await placePolymarketOrder();
    if (!polyOk) return;

    if (!hasVault) {
      setStep("done");
      setConfirmOpen(false);
      onSuccess?.();
      return;
    }
    startBorrow();
  }, [ensureVaultOracleFresh, placePolymarketOrder, startBorrow, onSuccess]);

  /* ── Render ── */
  if (!market) return null;

  const isAnyLoading = step !== "idle" && step !== "done";

  return (
    <div className="glass-card rounded-xl p-3 space-y-3">
      <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Leveraged Real Polymarket Trade
      </div>
      <p className="text-slate-300 text-[11px] leading-relaxed">
        This places a <strong>real BUY order on Polymarket first</strong>, then opens the vault leverage leg on <strong>Polygon</strong>. This guarantees a successful flow always has an on-Polymarket order ID. Polymarket requires a minimum of <strong>$1</strong> per order (notional = collateral × leverage).
      </p>

      {!address ? (
        <p className="text-gray-400 text-[11px]">Connect wallet to trade.</p>
      ) : (
        <>
          {/* ── Trade Summary ── */}
          <div className="bg-black/50 rounded p-2.5 border border-emerald-900/20 space-y-1.5 text-[11px]">
            <div className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider mb-1">
              Trade Summary · Polygon
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Direction</span>
              <span className={isLong ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                {selectedOutcome} {isLong ? "(Long)" : "(Short)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Collateral</span>
              <span className="text-white font-mono">${collateral.toFixed(6)} USDC.e</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Leverage</span>
              <span className="text-emerald-400 font-bold">{leverage}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Notional (leveraged)</span>
              <span className="text-white font-mono font-semibold">${notional.toFixed(6)} USDC.e</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Expected wallet spend</span>
              <span className="text-amber-300 font-mono">${expectedPolymarketSpend.toFixed(6)} USDC.e</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Price/fee buffer</span>
              <span className="text-gray-300 font-mono">+{spendBufferPercent.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Borrowed from vault</span>
              <span className="text-yellow-400 font-mono">${borrowed.toFixed(6)} USDC.e</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">~Entry price</span>
              <span className="text-white font-mono">{(price * 100).toFixed(1)}¢</span>
            </div>
            <div className="border-t border-gray-800/50 pt-1.5 mt-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Polygon USDC.e balance</span>
                <span className="text-gray-300 font-mono">${polygonUsdc.toFixed(6)}</span>
              </div>
            </div>
          </div>

          {/* Balance warning */}
          {(!hasEnoughForPolymarket || (polygonUsdc < collateral && hasVault)) && (
            <p className="text-amber-400 text-[10px]">
              Your USDC.e balance (${polygonUsdc.toFixed(6)}) is below Polymarket notional (${notional.toFixed(6)}). Polymarket submit can fail with balance/allowance errors.
            </p>
          )}

          {/* ── Execute button ── */}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!canTrade || isAnyLoading}
            className="w-full rounded-lg bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/40 text-emerald-400 py-2.5 text-sm font-semibold hover:from-emerald-500/30 hover:to-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isAnyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {hasVault
              ? `Trade on Polymarket → Borrow ${leverage}x`
              : `Execute $${notional.toFixed(6)} Polymarket trade`
            }
          </button>

          {!canTrade && address && (
            <p className="text-[10px] text-gray-500">
              {clobTokenIds.length === 0 ? "Waiting for market token IDs…" : ""}
              {collateral < 0.5 ? "Set collateral ≥ $0.50." : !meetsPolymarketMin ? "Notional must be ≥ $1 (Polymarket min)." : ""}
            </p>
          )}

          {/* ── Progress indicator ── */}
          {isAnyLoading && (() => {
            type Status = "pending" | "active" | "confirming" | "done";
            const stepStatus = (s: FlowStep): [Status, Status] => {
              const step1: Status = s === "polymarket" ? "active" : (s === "borrow" || s === "borrow-confirming" || s === "done") ? "done" : "pending";
              const step2: Status = s === "borrow" ? "active" : s === "borrow-confirming" ? "confirming" : s === "done" ? "done" : "pending";
              return [step1, step2];
            };
            const [step1Status, step2Status] = stepStatus(step);
            return (
              <div className="rounded border border-emerald-900/20 bg-black/40 p-2.5 space-y-2">
                <StepIndicator label="1. Place Polymarket order" status={step1Status} />
                <StepIndicator label="2. Open Polygon vault position" status={step2Status} />
              </div>
            );
          })()}
        </>
      )}

      {/* ── Confirmation modal ── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 max-w-sm w-full shadow-xl">
            <h4 className="text-white font-semibold mb-2">Confirm Leveraged Real Trade</h4>
            <p className="text-gray-400 text-sm mb-3 truncate" title={market.title}>
              {market.title}
            </p>

            <div className="bg-black/50 rounded p-3 border border-gray-800 space-y-2 text-[11px] mb-4">
              <div className="text-emerald-400 text-[10px] font-bold uppercase mb-1">Single-chain execution (Polygon)</div>

              <div className="border-l-2 border-emerald-500/30 pl-2">
                <div className="text-emerald-400 font-semibold text-[10px]">Step 1: Polymarket</div>
                <div className="text-gray-300">
                  Buy {selectedOutcome} @ ~{(price * 100).toFixed(1)}¢ with ${notional.toFixed(6)} USDC.e
                </div>
                <div className="text-gray-400 text-[10px] mt-0.5">
                  Expected spend with buffer: ${expectedPolymarketSpend.toFixed(6)} USDC.e
                </div>
                <div className="text-gray-400 text-[10px]">You will receive position tokens on Polymarket after fill.</div>
              </div>

              <div className="border-l-2 border-amber-500/30 pl-2">
                <div className="text-amber-400 font-semibold text-[10px]">Step 2: Polygon Vault</div>
                <div className="text-gray-300">
                  Open position: ${collateral.toFixed(6)} collateral × {leverage}x = ${notional.toFixed(6)} notional
                </div>
                <div className="text-yellow-400">Borrows ${borrowed.toFixed(6)} from vault</div>
              </div>

              <div className="border-t border-gray-800 pt-2 mt-2 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Your Polygon USDC.e</span>
                  <span className={`font-mono ${polygonUsdc >= notional ? "text-green-400" : "text-amber-400"}`}>
                    ${polygonUsdc.toFixed(6)} {polygonUsdc < notional && "(below notional)"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={isAnyLoading}
                className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800">
                Cancel
              </button>
              <button type="button" onClick={() => { setConfirmOpen(false); handleExecute(); }} disabled={isAnyLoading}
                className="flex-1 py-2 rounded-lg bg-amber-500/30 border border-amber-500/50 text-amber-400 font-semibold hover:bg-amber-500/40 disabled:opacity-50 flex items-center justify-center gap-1">
                {isAnyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Execute trade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {result && (
        <div className={`rounded border p-2.5 text-[11px] space-y-1.5 ${result.error ? "border-red-500/50 bg-red-500/10 text-red-300" : result.info ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>
          {!result.error && (result.vaultTx || result.orderId) && (
            <div className="text-emerald-300 font-semibold">Trade executed successfully.</div>
          )}
          {result.vaultTx && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-300">
                Vault position opened on Polygon
                <a href={`${POLYGONSCAN_TX}${result.vaultTx}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 ml-1 text-emerald-400 hover:underline">
                  Polygonscan <ExternalLink className="w-3 h-3" />
                </a>
              </span>
            </div>
          )}
          {result.orderId && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-amber-300">
                Polymarket order placed: {String(result.orderId).slice(0, 16)}…
              </span>
            </div>
          )}
          {result.polyTxHash && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <a href={`${POLYGONSCAN_TX}${result.polyTxHash}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-emerald-400 hover:underline">
                View on Polygonscan <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {result.info && <div className="text-amber-300">{result.info}</div>}
          {result.error && <div className="text-red-300">{result.error}</div>}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function StepIndicator({ label, status }: { label: string; status: "pending" | "active" | "confirming" | "done" }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      {status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
      {status === "active" && <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin flex-shrink-0" />}
      {status === "confirming" && <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin flex-shrink-0" />}
      {status === "pending" && <div className="w-3.5 h-3.5 rounded-full border border-emerald-900/40 flex-shrink-0" />}
      <span className={
        status === "done" ? "text-emerald-400" :
        status === "active" ? "text-emerald-400" :
        status === "confirming" ? "text-emerald-400" :
        "text-gray-500"
      }>
        {label}
        {status === "confirming" && " (confirming tx…)"}
      </span>
    </div>
  );
}
