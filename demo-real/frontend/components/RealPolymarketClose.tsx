"use client";

import { useState, useCallback, useEffect } from "react";
import { AlertTriangle, ExternalLink, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { useAccount, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { base } from "wagmi/chains";
import { POLYGON_CHAIN_ID, POLYMARKET_CLOB_API } from "@/lib/polymarketConfig";
import { getContractAddresses, MARGIN_ENGINE_ABI } from "@/lib/contracts";
import { parsePrice, formatUSDC, formatPrice } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────── */

interface PositionData {
  owner: string;
  collateral: bigint;
  borrowed: bigint;
  notional: bigint;
  entryPriceMock: bigint;
  leverage: bigint;
  isLong: boolean;
  openTimestamp: bigint;
  isOpen: boolean;
}

interface Props {
  positionId: number;
  position: PositionData;
  /** Current live market price (decimal, e.g. 0.41 for YES) */
  livePrice: number;
  /** CLOB token IDs: [yesTokenId, noTokenId] */
  clobTokenIds: string[];
  tickSize?: string;
  negRisk?: boolean;
  marketTitle: string;
  /** Called after close succeeds to refresh state */
  onSuccess?: () => void;
}

const POLYGONSCAN_TX = "https://polygonscan.com/tx/";
const BASESCAN_TX = "https://basescan.org/tx/";
const addresses = getContractAddresses();

type CloseStep = "idle" | "switch-polygon" | "selling" | "switch-base" | "closing-vault" | "vault-confirming" | "done";

/* ────────────────────────────────────────────────────────────────── */

export default function RealPolymarketClose({
  positionId,
  position,
  livePrice,
  clobTokenIds,
  tickSize,
  negRisk,
  marketTitle,
  onSuccess,
}: Props) {
  const { address, chain } = useAccount();
  const { switchChainAsync, isPending: isSwitchPending } = useSwitchChain();
  const { writeContract, isPending: isWritePending } = useWriteContract();

  /* ── State ── */
  const [step, setStep] = useState<CloseStep>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{
    polyOrderId?: string;
    polyTxHash?: string;
    baseTxHash?: string;
    actualExitPrice?: number;
    pnl?: number;
    error?: string;
  } | null>(null);

  /* ── Base tx tracking ── */
  const [baseTxHash, setBaseTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isBaseTxSuccess } = useWaitForTransactionReceipt({ hash: baseTxHash });

  /* ── Derived values ── */
  const entryPrice = Number(position.entryPriceMock) / 1e6;
  const notionalUsdc = Number(position.notional) / 1e6;
  const collateralUsdc = Number(position.collateral) / 1e6;
  const borrowedUsdc = Number(position.borrowed) / 1e6;
  const leverageNum = Number(position.leverage);

  // Live exit price for the direction of this position
  const exitPrice = livePrice;

  // PnL calculation
  const pnlPreview = position.isLong
    ? notionalUsdc * ((exitPrice - entryPrice) / (entryPrice || 1))
    : notionalUsdc * ((entryPrice - exitPrice) / (entryPrice || 1));

  // Token ID based on position direction
  const tokenId = position.isLong ? clobTokenIds[0] : clobTokenIds[1];
  const canClose = Boolean(address && tokenId && position.isOpen);

  const isAnyLoading = step !== "idle" && step !== "done";

  /* ── When base tx confirms, we're done ── */
  useEffect(() => {
    if (isBaseTxSuccess && step === "vault-confirming") {
      setResult((prev) => ({ ...prev, baseTxHash: baseTxHash }));
      setStep("done");
      onSuccess?.();
    }
  }, [isBaseTxSuccess, step, baseTxHash, onSuccess]);

  /* ── Step 1: Sell outcome tokens on Polymarket ── */
  const sellOnPolymarket = useCallback(async (): Promise<number> => {
    if (!tokenId) throw new Error("Missing token ID for Polymarket sell");
    if (typeof window === "undefined" || !window.ethereum) throw new Error("No wallet found");

    setStep("switch-polygon");
    if (chain?.id !== POLYGON_CHAIN_ID) {
      await switchChainAsync?.({ chainId: POLYGON_CHAIN_ID });
    }

    setStep("selling");

    const { ethers } = await import("ethers");
    const { ClobClient, Side, OrderType } = await import("@polymarket/clob-client");

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const walletAddress = await signer.getAddress();

    const host = POLYMARKET_CLOB_API;
    const baseClient = new ClobClient(host, 137, signer);
    const creds = await baseClient.createOrDeriveApiKey();
    const client = new ClobClient(host, 137, signer, creds, 0, walletAddress);

    const ts = (tickSize as "0.1" | "0.01" | "0.001" | "0.0001") ?? "0.01";
    const nr = negRisk ?? false;

    // Sell the outcome tokens — amount is the notional we want to close
    const resp = await client.createAndPostMarketOrder(
      {
        tokenID: tokenId,
        amount: notionalUsdc,
        side: Side.SELL,
      },
      { tickSize: ts, negRisk: nr },
      OrderType.FOK
    );

    const orderId = resp?.orderID ?? resp?.id ?? resp?.order_id;
    const polyTxHash = resp?.transactionHash ?? resp?.txHash ?? resp?.transaction_hash;
    const fillPrice = resp?.averagePrice ?? resp?.avg_price ?? exitPrice;

    setResult((prev) => ({
      ...prev,
      polyOrderId: orderId,
      polyTxHash,
      actualExitPrice: fillPrice,
    }));

    return typeof fillPrice === "number" ? fillPrice : parseFloat(String(fillPrice)) || exitPrice;
  }, [tokenId, chain, switchChainAsync, notionalUsdc, tickSize, negRisk, exitPrice]);

  /* ── Step 2: Close position on Base vault ── */
  const closeOnBase = useCallback(async (realExitPrice: number) => {
    setStep("switch-base");

    // Always switch to Base (don't rely on stale `chain` from closure)
    await switchChainAsync?.({ chainId: base.id });
    // Give wagmi/React time to propagate the chain change
    await new Promise((r) => setTimeout(r, 1500));

    setStep("closing-vault");
    const exitPriceBigInt = parsePrice(realExitPrice.toString());

    return new Promise<void>((resolve, reject) => {
      writeContract(
        {
          address: addresses.marginEngine,
          abi: MARGIN_ENGINE_ABI,
          functionName: "closePosition",
          args: [BigInt(positionId), exitPriceBigInt],
          chainId: base.id, // Explicitly target Base chain
        },
        {
          onSuccess: (hash) => {
            setBaseTxHash(hash);
            setStep("vault-confirming");
            resolve();
          },
          onError: (err) => reject(err),
        }
      );
    });
  }, [switchChainAsync, writeContract, positionId]);

  /* ── Combined close: Polymarket sell → Base vault close ── */
  const handleClose = useCallback(async () => {
    setResult(null);
    setBaseTxHash(undefined);
    setConfirmOpen(false);

    let sellDone = false;
    try {
      // Step 1: Sell on Polymarket
      const realExitPrice = await sellOnPolymarket();
      sellDone = true;

      // Step 2: Close on Base vault with the real price
      await closeOnBase(realExitPrice);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult((prev) => ({
        ...prev,
        error: sellDone
          ? `Polymarket sell succeeded, but Base vault close failed: ${msg}. Your position on Base is still open. Switch to Base and close it manually in "Simulated PnL" mode.`
          : `Polymarket sell failed: ${msg}. Nothing was changed.`,
      }));
      setStep("done");
    }
  }, [sellOnPolymarket, closeOnBase]);

  /* ── Render ── */
  if (!position.isOpen) return null;

  return (
    <div className="glass-card rounded-xl p-3 space-y-3 mt-2">
      {/* Header */}
      <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Close position live on Polymarket
      </div>

      {/* Live PnL preview */}
      <div className="bg-black/50 rounded p-2.5 border border-emerald-900/20 space-y-1.5 text-[11px]">
        <div className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider mb-1">
          Live Close Preview
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Position</span>
          <span className="text-white font-mono">
            #{positionId} · {position.isLong ? <span className="text-green-400">LONG</span> : <span className="text-red-400">SHORT</span>} {leverageNum}x
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Entry price</span>
          <span className="text-white font-mono">{(entryPrice * 100).toFixed(1)}¢</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Current exit price (live)</span>
          <span className="text-emerald-400 font-mono font-semibold">{(exitPrice * 100).toFixed(1)}¢</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Notional</span>
          <span className="text-white font-mono">${notionalUsdc.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Collateral</span>
          <span className="text-white font-mono">${collateralUsdc.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Borrowed</span>
          <span className="text-yellow-400 font-mono">${borrowedUsdc.toFixed(2)}</span>
        </div>
        <div className="border-t border-emerald-900/20 pt-1.5">
          <div className="flex justify-between">
            <span className="text-gray-400 font-semibold">Estimated PnL</span>
            <span className={`font-mono font-bold ${pnlPreview >= 0 ? "text-green-400" : "text-red-400"}`}>
              {pnlPreview >= 0 ? "+" : ""}${pnlPreview.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Execute button */}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={!canClose || isAnyLoading || isSwitchPending}
        className="w-full rounded-lg bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/40 text-emerald-400 py-2.5 text-sm font-semibold hover:from-emerald-500/30 hover:to-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
      >
        {isAnyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Sell on Polymarket → Close vault position
      </button>

      {/* Progress indicator */}
      {isAnyLoading && (
        <div className="rounded border border-emerald-900/20 bg-black/40 p-2.5 space-y-2">
          <StepIndicator label="1. Switch to Polygon" status={
            step === "switch-polygon" ? "active" :
            (step === "selling" || step === "switch-base" || step === "closing-vault" || step === "vault-confirming" || step === "done") ? "done" : "pending"
          } />
          <StepIndicator label="2. Sell outcome tokens on Polymarket" status={
            step === "selling" ? "active" :
            (step === "switch-base" || step === "closing-vault" || step === "vault-confirming" || step === "done") ? "done" : "pending"
          } />
          <StepIndicator label="3. Switch to Base" status={
            step === "switch-base" ? "active" :
            (step === "closing-vault" || step === "vault-confirming" || step === "done") ? "done" : "pending"
          } />
          <StepIndicator label="4. Close vault position" status={
            step === "closing-vault" ? "active" :
            step === "vault-confirming" ? "confirming" :
            step === "done" ? "done" : "pending"
          } />
        </div>
      )}

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 max-w-sm w-full shadow-xl">
            <h4 className="text-white font-semibold mb-2">Confirm Live Close</h4>
            <p className="text-gray-400 text-sm mb-3 truncate" title={marketTitle}>
              {marketTitle}
            </p>

            <div className="bg-black/50 rounded p-3 border border-gray-800 space-y-2 text-[11px] mb-4">
              <div className="text-emerald-400 text-[10px] font-bold uppercase mb-1">Two-step close</div>

              <div className="border-l-2 border-emerald-500/30 pl-2">
                <div className="text-emerald-400 font-semibold text-[10px]">Step 1: Sell on Polymarket (Polygon)</div>
                <div className="text-gray-300">
                  Sell {position.isLong ? "YES" : "NO"} tokens · ~${notionalUsdc.toFixed(2)} notional
                </div>
                <div className="text-gray-400">Current price: {(exitPrice * 100).toFixed(1)}¢</div>
              </div>

              <div className="flex justify-center">
                <ArrowRight className="w-3 h-3 text-gray-500" />
              </div>

              <div className="border-l-2 border-amber-500/30 pl-2">
                <div className="text-amber-400 font-semibold text-[10px]">Step 2: Close on Base Vault</div>
                <div className="text-gray-300">
                  Close position #{positionId} · repay ${borrowedUsdc.toFixed(2)} + interest
                </div>
              </div>

              <div className="border-t border-emerald-900/20 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Estimated PnL</span>
                  <span className={`font-mono font-bold ${pnlPreview >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pnlPreview >= 0 ? "+" : ""}${pnlPreview.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isAnyLoading}
                className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={isAnyLoading}
                className="flex-1 py-2 rounded-lg bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 font-semibold hover:bg-emerald-500/40 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isAnyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Close position
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded border p-2.5 text-[11px] space-y-1.5 ${result.error ? "border-red-500/50 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>
          {result.polyOrderId && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-300">
                Sold on Polymarket: {String(result.polyOrderId).slice(0, 16)}…
              </span>
            </div>
          )}
          {result.polyTxHash && (
            <a href={`${POLYGONSCAN_TX}${result.polyTxHash}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-emerald-400 hover:underline">
              Polygonscan <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {result.baseTxHash && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-amber-300">
                Vault position closed
                <a href={`${BASESCAN_TX}${result.baseTxHash}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 ml-1 text-amber-400 hover:underline">
                  Basescan <ExternalLink className="w-3 h-3" />
                </a>
              </span>
            </div>
          )}
          {result.actualExitPrice != null && !result.error && (
            <div className="text-gray-300">
              Exit price: {(result.actualExitPrice * 100).toFixed(1)}¢
              {result.pnl != null && (
                <span className={`ml-2 font-bold ${result.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  PnL: {result.pnl >= 0 ? "+" : ""}${result.pnl.toFixed(2)}
                </span>
              )}
            </div>
          )}
          {result.baseTxHash && !result.error && (
            <div className="border-t border-emerald-900/20 pt-1.5 mt-1 text-gray-300">
              Your collateral ± PnL has been returned to your wallet on <strong className="text-emerald-400">Base</strong>.
              Switch your wallet to Base to see your updated USDC balance.
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
      {status === "confirming" && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin flex-shrink-0" />}
      {status === "pending" && <div className="w-3.5 h-3.5 rounded-full border border-emerald-900/40 flex-shrink-0" />}
      <span className={
        status === "done" ? "text-emerald-400" :
        status === "active" ? "text-emerald-400" :
        status === "confirming" ? "text-amber-400" :
        "text-gray-500"
      }>
        {label}
        {status === "confirming" && " (confirming tx…)"}
      </span>
    </div>
  );
}
