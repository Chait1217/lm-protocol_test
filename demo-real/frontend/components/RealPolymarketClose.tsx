"use client";

import { useState, useCallback, useEffect } from "react";
import { AlertTriangle, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { polygon } from "wagmi/chains";
import { POLYMARKET_CLOB_API } from "@/lib/polymarketConfig";
import { getContractAddresses, MARGIN_ENGINE_ABI } from "@/lib/contracts";

/* ────────────────────────────────────────────────────────────────── */

interface PositionData {
  owner: string;
  collateral: bigint;
  borrowed: bigint;
  notional: bigint;
  entryPriceMock: bigint;
  leverage: bigint;
  isLong: boolean;
  marketId: `0x${string}`;
  openTimestamp: bigint;
  isOpen: boolean;
}

interface Props {
  positionId: number;
  position: PositionData;
  livePrice: number;
  clobTokenIds: string[];
  tickSize?: string;
  negRisk?: boolean;
  marketTitle: string;
  onSuccess?: () => void;
}

const POLYGONSCAN_TX = "https://polygonscan.com/tx/";
const addresses = getContractAddresses();

type CloseStep = "idle" | "selling" | "closing-vault" | "vault-confirming" | "done";

/** Turn thrown errors into a short message and suggested action. */
function parseCloseError(err: unknown, step: "sell" | "transfer" | "vault"): { message: string; action: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (step === "sell") {
    if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request"))
      return { message: "You rejected the transaction in your wallet.", action: "Try again and approve the signature and transaction." };
    if (lower.includes("invalid amounts") || lower.includes("maker amount") || lower.includes("2 decimals") || lower.includes("accuracy"))
      return { message: "Polymarket rejected the order (decimal precision).", action: "Try again; we rounded the order. If it still fails, try closing when the market is less volatile." };
    if (lower.includes("insufficient") && (lower.includes("liquidity") || lower.includes("balance")))
      return { message: "Not enough liquidity or balance to fill the sell order.", action: "Try again in a few minutes or when there’s more market activity." };
    if (lower.includes("liquidity") || lower.includes("fill") || lower.includes("fok"))
      return { message: "The instant sell couldn’t be filled at current prices.", action: "Try again shortly or refresh; liquidity may have been low." };
    if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout"))
      return { message: "Network or Polymarket API issue.", action: "Check your connection and try again." };
    if (lower.includes("api") || lower.includes("key") || lower.includes("signature"))
      return { message: "Polymarket API or signature error.", action: "Refresh the page and try again. If it persists, try another browser or clear site data." };
  }

  if (step === "vault") {
    if (lower.includes("user rejected") || lower.includes("user denied"))
      return { message: "You rejected the close transaction.", action: "Try again and approve. Your repay was already sent." };
    if (lower.includes("position") || lower.includes("closed") || lower.includes("invalid"))
      return { message: "Vault close was rejected.", action: "Repay was sent. Contact support or try refreshing and closing again." };
  }

  return {
    message: raw.length > 120 ? raw.slice(0, 120) + "…" : raw,
    action: step === "sell" ? "Try again. If it keeps failing, liquidity may be low." : "Try again or refresh the page.",
  };
}

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
  const { address } = useAccount();
  const { writeContract, isPending: isWritePending } = useWriteContract();

  /* ── Interest (needed to repay vault: user must send borrowed + interest to MarginEngine) ── */
  const { data: interestRaw } = useReadContract({
    address: addresses.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: "calculateInterest",
    args: [position.borrowed, position.openTimestamp],
    chainId: polygon.id,
  });
  const interest = (interestRaw as bigint | undefined) ?? BigInt(0);
  const { data: oracleExitRaw } = useReadContract({
    address: addresses.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: "getPositionOraclePrice",
    args: [BigInt(positionId)],
    chainId: polygon.id,
    query: { refetchInterval: 5000 },
  });

  /* ── State ── */
  const [step, setStep] = useState<CloseStep>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{
    polyOrderId?: string;
    polyTxHash?: string;
    vaultTxHash?: string;
    actualExitPrice?: number;
    pnl?: number;
    error?: string;
    errorAction?: string;
  } | null>(null);

  /* ── Vault tx tracking ── */
  const [vaultTxHash, setVaultTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isVaultTxSuccess } = useWaitForTransactionReceipt({ hash: vaultTxHash });

  /* ── Derived values ── */
  const entryPrice = Number(position.entryPriceMock) / 1e6;
  const notionalUsdc = Number(position.notional) / 1e6;
  const collateralUsdc = Number(position.collateral) / 1e6;
  const borrowedUsdc = Number(position.borrowed) / 1e6;
  const leverageNum = Number(position.leverage);
  const oracleExitPrice = oracleExitRaw != null ? Number(oracleExitRaw as bigint) / 1e6 : null;
  const exitPrice = oracleExitPrice ?? livePrice;

  const pnlPreview = position.isLong
    ? notionalUsdc * ((exitPrice - entryPrice) / (entryPrice || 1))
    : notionalUsdc * ((entryPrice - exitPrice) / (entryPrice || 1));

  const tokenId = position.isLong ? clobTokenIds[0] : clobTokenIds[1];
  const canClose = Boolean(address && tokenId && position.isOpen);
  const isAnyLoading = step !== "idle" && step !== "done";

  /* ── Step 1: Sell outcome tokens on Polymarket (Polygon) ── */
  const sellOnPolymarket = useCallback(async (): Promise<number> => {
    if (!tokenId) throw new Error("Missing token ID for Polymarket sell");
    if (typeof window === "undefined" || !window.ethereum) throw new Error("No wallet found");

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

    const postSell = (orderType: typeof OrderType.FOK | typeof OrderType.FAK) =>
      client.createAndPostMarketOrder(
        { tokenID: tokenId, amount: notionalUsdc, side: Side.SELL },
        { tickSize: ts, negRisk: nr },
        orderType
      );

    let resp: any;
    try {
      resp = await postSell(OrderType.FOK);
    } catch (fokErr: unknown) {
      const msg = fokErr instanceof Error ? fokErr.message : String(fokErr);
      if (msg.toLowerCase().includes("fully filled") || msg.toLowerCase().includes("couldn't be fully filled") || msg.toLowerCase().includes("no orders found to match")) {
        resp = await postSell(OrderType.FAK);
      } else {
        throw fokErr;
      }
    }

    const orderId = resp?.orderID ?? resp?.id ?? resp?.order_id;
    const polyTxHash = resp?.transactionHash ?? resp?.txHash ?? resp?.transaction_hash;
    const fillPrice = resp?.averagePrice ?? resp?.avg_price ?? exitPrice;

    setResult((prev) => ({ ...prev, polyOrderId: orderId, polyTxHash, actualExitPrice: fillPrice }));
    return typeof fillPrice === "number" ? fillPrice : parseFloat(String(fillPrice)) || exitPrice;
  }, [tokenId, notionalUsdc, tickSize, negRisk, exitPrice]);

  /* ── Step 2: Close position on Polygon vault (oracle-driven) ── */
  const closeOnVault = useCallback(async () => {
    return new Promise<void>((resolve, reject) => {
      writeContract(
        {
          address: addresses.marginEngine,
          abi: MARGIN_ENGINE_ABI,
          functionName: "closePosition",
          args: [BigInt(positionId)],
          chainId: polygon.id,
        },
        {
          onSuccess: (hash) => {
            setVaultTxHash(hash);
            setStep("vault-confirming");
            resolve();
          },
          onError: (err) => reject(err),
        }
      );
    });
  }, [writeContract, positionId]);

  /* ── When vault tx confirms, we're done ── */
  useEffect(() => {
    if (isVaultTxSuccess && step === "vault-confirming") {
      setResult((prev) => ({ ...prev, vaultTxHash: vaultTxHash }));
      setStep("done");
      onSuccess?.();
    }
  }, [isVaultTxSuccess, step, vaultTxHash, onSuccess]);

  /* ── Combined close: Sell on Polymarket → closePosition (oracle settles exit) ── */
  const handleClose = useCallback(async () => {
    setResult(null);
    setVaultTxHash(undefined);
    setConfirmOpen(false);

    let sellDone = false;
    try {
      const realExitPrice = await sellOnPolymarket();
      setResult((prev) => ({ ...prev, actualExitPrice: realExitPrice }));
      sellDone = true;
      setStep("closing-vault");
      await closeOnVault();
    } catch (err: unknown) {
      const step: "sell" | "vault" = sellDone ? "vault" : "sell";
      const { message, action } = parseCloseError(err, step);
      const prefix = step === "sell" ? "Sell failed" : "Vault close failed";
      setResult((prev) => ({
        ...prev,
        error: `${prefix}: ${message}`,
        errorAction: action,
      }));
      setStep("done");
    }
  }, [sellOnPolymarket, closeOnVault]);

  /* ── Render ── */
  if (!position.isOpen) return null;

  return (
    <div className="glass-card rounded-xl p-3 space-y-3 mt-2">
      <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Close position live on Polymarket
      </div>
      <p className="text-gray-400 text-[10px]">
        You’re selling the outcome tokens that were bought when you opened this position (with collateral + vault borrow).
      </p>

      <div className="bg-black/50 rounded p-2.5 border border-emerald-900/20 space-y-1.5 text-[11px]">
        <div className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider mb-1">
          Live Close Preview · Polygon
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
          <span className="text-gray-400">Settlement price (oracle)</span>
          <span className="text-emerald-400 font-mono font-semibold">{(exitPrice * 100).toFixed(1)}¢</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Notional</span>
          <span className="text-white font-mono">${notionalUsdc.toFixed(6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Borrowed</span>
          <span className="text-yellow-400 font-mono">${borrowedUsdc.toFixed(6)}</span>
        </div>
        <div className="border-t border-emerald-900/20 pt-1.5">
          <div className="flex justify-between">
            <span className="text-gray-400 font-semibold">Estimated PnL</span>
            <span className={`font-mono font-bold ${pnlPreview >= 0 ? "text-green-400" : "text-red-400"}`}>
              {pnlPreview >= 0 ? "+" : ""}${pnlPreview.toFixed(6)}
            </span>
          </div>
        </div>
      </div>

      {!address && (
        <p className="text-amber-400/90 text-[11px]">Connect your wallet to close this position.</p>
      )}
      {address && !tokenId && (
        <p className="text-amber-400/90 text-[11px]">Market token IDs not loaded. Refresh the page or try again in a moment.</p>
      )}
      {address && tokenId && notionalUsdc > 0 && notionalUsdc < 1 && (
        <p className="text-amber-400/90 text-[11px]">This position’s notional (${notionalUsdc.toFixed(2)}) is below Polymarket’s $1 minimum; the sell step may be rejected.</p>
      )}
      <button type="button" onClick={() => setConfirmOpen(true)} disabled={!canClose || isAnyLoading}
        className="w-full rounded-lg bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/40 text-emerald-400 py-2.5 text-sm font-semibold hover:from-emerald-500/30 hover:to-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
        {isAnyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Sell on Polymarket → Close vault position
      </button>

      {/* Progress indicator */}
      {isAnyLoading && (() => {
        type Status = "pending" | "active" | "confirming" | "done";
        const stepStatus = (s: CloseStep): [Status, Status] => {
          const done1 = !(s === "idle" || s === "selling");
          const done2 = s === "vault-confirming" || s === "done";
          const step1: Status = s === "selling" ? "active" : done1 ? "done" : "pending";
          const step2: Status = s === "closing-vault" ? "active" : s === "vault-confirming" ? "confirming" : done2 ? "done" : "pending";
          return [step1, step2];
        };
        const [step1Status, step2Status] = stepStatus(step);
        return (
          <div className="rounded border border-emerald-900/20 bg-black/40 p-2.5 space-y-2">
            <StepIndicator label="1. Sell outcome tokens on Polymarket" status={step1Status} />
            <StepIndicator label="2. Close position (oracle-settled)" status={step2Status} />
          </div>
        );
      })()}

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 max-w-sm w-full shadow-xl">
            <h4 className="text-white font-semibold mb-2">Confirm Live Close</h4>
            <p className="text-gray-400 text-sm mb-3 truncate" title={marketTitle}>{marketTitle}</p>

            <div className="bg-black/50 rounded p-3 border border-gray-800 space-y-2 text-[11px] mb-4">
              <div className="text-emerald-400 text-[10px] font-bold uppercase mb-1">Single-chain close (Polygon)</div>

              <div className="border-l-2 border-emerald-500/30 pl-2">
                <div className="text-emerald-400 font-semibold text-[10px]">Step 1: Sell on Polymarket</div>
                <div className="text-gray-300">
                  Sell {position.isLong ? "YES" : "NO"} tokens · ~${notionalUsdc.toFixed(6)} notional
                </div>
              </div>

              <div className="border-l-2 border-emerald-500/30 pl-2">
                <div className="text-emerald-400 font-semibold text-[10px]">Step 2: Close vault position</div>
                <div className="text-gray-300">
                  Close #{positionId} · oracle settles exit, collateral ± PnL returned
                </div>
              </div>

              <div className="border-t border-emerald-900/20 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Estimated PnL</span>
                  <span className={`font-mono font-bold ${pnlPreview >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pnlPreview >= 0 ? "+" : ""}${pnlPreview.toFixed(6)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={isAnyLoading}
                className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800">Cancel</button>
              <button type="button" onClick={handleClose} disabled={isAnyLoading}
                className="flex-1 py-2 rounded-lg bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 font-semibold hover:bg-emerald-500/40 disabled:opacity-50 flex items-center justify-center gap-1">
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
              <span className="text-emerald-300">Sold on Polymarket: {String(result.polyOrderId).slice(0, 16)}…</span>
            </div>
          )}
          {result.polyTxHash && (
            <a href={`${POLYGONSCAN_TX}${result.polyTxHash}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-emerald-400 hover:underline">
              Polygonscan <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {result.vaultTxHash && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-amber-300">
                Vault position closed
                <a href={`${POLYGONSCAN_TX}${result.vaultTxHash}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 ml-1 text-amber-400 hover:underline">
                  Polygonscan <ExternalLink className="w-3 h-3" />
                </a>
              </span>
            </div>
          )}
          {result.actualExitPrice != null && !result.error && (
            <div className="text-gray-300">
              Exit price: {(result.actualExitPrice * 100).toFixed(1)}¢
            </div>
          )}
          {result.vaultTxHash && !result.error && (
            <div className="border-t border-emerald-900/20 pt-1.5 mt-1 text-gray-300">
              Your collateral ± PnL has been returned to your wallet on <strong className="text-emerald-400">Polygon</strong>.
            </div>
          )}
          {result.error && (
            <div className="space-y-1">
              <div className="text-red-300">{result.error}</div>
              {result.errorAction && (
                <div className="text-amber-200/90 text-[10px]">
                  What to do: {result.errorAction}
                </div>
              )}
            </div>
          )}
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
