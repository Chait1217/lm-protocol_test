"use client";

import { useState, useCallback, useEffect } from "react";
import { AlertTriangle, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { polygon } from "wagmi/chains";
import { POLYGON_CHAIN_ID, POLYMKT_USDCE_ADDRESS, POLYMARKET_CLOB_API } from "@/lib/polymarketConfig";
import { erc20PolyAbi } from "@/lib/polymarketAbi";
import { getContractAddresses, USDC_ABI, MARGIN_ENGINE_ABI } from "@/lib/contracts";
import { parseUSDC, parsePrice, formatUSDC, bpsToPercent } from "@/lib/utils";

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

type FlowStep = "idle" | "borrow" | "borrow-confirming" | "polymarket" | "done";

/* ────────────────────────────────────────────────────────────────── */

export default function RealPolymarketTrade({ market, selectedOutcome, collateral, leverage, entryPrice, onSuccess }: Props) {
  const { address } = useAccount();

  /* ── Derived values ── */
  const notional = collateral * leverage;
  const borrowed = notional - collateral;
  const isLong = selectedOutcome === "YES";

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
  const { isLoading: isVaultConfirming, isSuccess: isVaultTxSuccess } =
    useWaitForTransactionReceipt({ hash: vaultTxHash });

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
  } | null>(null);

  /* ── CLOB token ── */
  const clobTokenIds = market?.clobTokenIds ?? [];
  const tokenId = selectedOutcome === "YES" ? clobTokenIds[0] : clobTokenIds[1];
  const price = selectedOutcome === "YES"
    ? (market?.bestAsk ?? 0.5)
    : market?.bestBid != null ? 1 - market.bestBid : 0.5;

  const meetsPolymarketMin = notional >= 1;
  const canTrade = Boolean(
    address && tokenId && collateral >= 0.5 && leverage >= 2 && market && meetsPolymarketMin
  );

  /* ── After vault tx confirms, place Polymarket order ── */
  useEffect(() => {
    if (isVaultTxSuccess && step === "borrow-confirming") {
      placePolymarketOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVaultTxSuccess, step]);

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

      // Open position on MarginEngine (Polygon)
      const mockPrice = parsePrice(entryPrice.toString());
      writeContract(
        {
          address: addresses.marginEngine,
          abi: MARGIN_ENGINE_ABI,
          functionName: "openPosition",
          args: [parseUSDC(collateral.toString()), BigInt(leverage), isLong, mockPrice],
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

  /* ── Step 2: Place real Polymarket order (same chain!) ── */
  const placePolymarketOrder = useCallback(async () => {
    if (!market?.clobTokenIds?.length || !tokenId) {
      setResult({ error: "Missing market token IDs for Polymarket order" });
      setStep("idle");
      return;
    }
    if (typeof window === "undefined" || !window.ethereum) {
      setResult({ error: "No wallet (e.g. MetaMask) found" });
      setStep("idle");
      return;
    }

    setStep("polymarket");
    setPolymarketLoading(true);

    try {
      const { ethers } = await import("ethers");
      const { ClobClient, Side, OrderType } = await import("@polymarket/clob-client");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const walletAddress = await signer.getAddress();
      if (!walletAddress || walletAddress === "0x") {
        setResult({ error: "Could not get wallet address" });
        setStep("idle");
        setPolymarketLoading(false);
        return;
      }

      const host = POLYMARKET_CLOB_API;
      const baseClient = new ClobClient(host, 137, signer);
      const creds = await baseClient.createOrDeriveApiKey();
      const client = new ClobClient(host, 137, signer, creds, 0, walletAddress);

      const tickSize = (market.tickSize as "0.1" | "0.01" | "0.001" | "0.0001") ?? "0.01";
      const negRisk = market.negRisk ?? false;

      const resp = await client.createAndPostMarketOrder(
        {
          tokenID: tokenId,
          amount: notional,
          side: Side.BUY,
        },
        { tickSize, negRisk },
        OrderType.FOK
      );

      const orderId = resp?.orderID ?? resp?.id ?? resp?.order_id;
      const polyTxHash = resp?.transactionHash ?? resp?.txHash ?? resp?.transaction_hash;

      setResult({
        positionId: vaultTxHash ? "confirmed" : undefined,
        vaultTx: vaultTxHash,
        orderId,
        polyTxHash,
      });
      setStep("done");
      setConfirmOpen(false);
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult((prev) => ({
        ...prev,
        error: `Polymarket order failed: ${message}. Vault position was still opened.`,
      }));
      setStep("done");
    } finally {
      setPolymarketLoading(false);
    }
  }, [market, tokenId, notional, vaultTxHash, onSuccess]);

  /* ── Combined execute ── */
  const handleExecute = useCallback(() => {
    setResult(null);
    setVaultTxHash(undefined);
    if (!hasVault) {
      placePolymarketOrder();
    } else {
      startBorrow();
    }
  }, [startBorrow, placePolymarketOrder]);

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
        This will <strong>borrow from the vault</strong> (leverage) and then place a{" "}
        <strong>real BUY order on Polymarket</strong> with that notional — all on <strong>Polygon</strong>. You receive the outcome tokens; when you close a position we sell those same tokens. Polymarket requires a minimum of <strong>$1</strong> per order (notional = collateral × leverage).
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
          {polygonUsdc < collateral && hasVault && (
            <p className="text-amber-400 text-[10px]">
              Your USDC.e balance (${polygonUsdc.toFixed(6)}) is below collateral (${collateral.toFixed(6)}). The vault borrow will fail.
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
              ? `Borrow ${leverage}x → Trade on Polymarket`
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
              const step1: Status = s === "borrow" ? "active" : s === "borrow-confirming" ? "confirming" : (s === "polymarket" || s === "done") ? "done" : "pending";
              const step2: Status = s === "polymarket" ? "active" : s === "done" ? "done" : "pending";
              return [step1, step2];
            };
            const [step1Status, step2Status] = stepStatus(step);
            return (
              <div className="rounded border border-emerald-900/20 bg-black/40 p-2.5 space-y-2">
                <StepIndicator label="1. Borrow from Polygon vault" status={step1Status} />
                <StepIndicator label="2. Place Polymarket order" status={step2Status} />
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
                <div className="text-emerald-400 font-semibold text-[10px]">Step 1: Polygon Vault</div>
                <div className="text-gray-300">
                  Open position: ${collateral.toFixed(6)} collateral × {leverage}x = ${notional.toFixed(6)} notional
                </div>
                <div className="text-yellow-400">Borrows ${borrowed.toFixed(6)} from vault</div>
              </div>

              <div className="border-l-2 border-amber-500/30 pl-2">
                <div className="text-amber-400 font-semibold text-[10px]">Step 2: Polymarket (same chain!)</div>
                <div className="text-gray-300">
                  Buy {selectedOutcome} @ ~{(price * 100).toFixed(1)}¢ with ${notional.toFixed(6)} USDC.e
                </div>
              </div>

              <div className="border-t border-gray-800 pt-2 mt-2 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Your Polygon USDC.e</span>
                  <span className={`font-mono ${polygonUsdc >= collateral ? "text-green-400" : "text-amber-400"}`}>
                    ${polygonUsdc.toFixed(6)} {polygonUsdc < collateral && "(insufficient)"}
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
        <div className={`rounded border p-2.5 text-[11px] space-y-1.5 ${result.error ? "border-red-500/50 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>
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
