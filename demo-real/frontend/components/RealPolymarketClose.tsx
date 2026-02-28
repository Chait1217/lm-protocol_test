"use client";

import { useState, useCallback, useEffect } from "react";
import { AlertTriangle, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { useAccount, useChainId, useReadContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { polygon } from "wagmi/chains";
import {
  POLYMARKET_CLOB_API,
  POLYMKT_CTF_ADDRESS,
  POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS,
  POLYMKT_NEG_RISK_ADAPTER_ADDRESS,
} from "@/lib/polymarketConfig";
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

type PositionApiRow = {
  asset?: string;
  size?: number;
};

/** Turn thrown errors into a short message and suggested action. */
function parseCloseError(err: unknown, step: "sell" | "transfer" | "vault"): { message: string; action: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (step === "sell") {
    if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request"))
      return { message: "You rejected the transaction in your wallet.", action: "Try again and approve the signature and transaction." };
    if (lower.includes("invalid amounts") || lower.includes("maker amount") || lower.includes("2 decimals") || lower.includes("accuracy"))
      return { message: "Polymarket rejected the order (decimal precision).", action: "Try again; we rounded the order. If it still fails, try closing when the market is less volatile." };
    if (lower.includes("not enough balance") || lower.includes("not enough allowance"))
      return {
        message: "Polymarket reports not enough position size or allowance for this outcome.",
        action:
          "Open the 'Verify on Polymarket API' section to see your exact on-Polymarket position and close from there, or ensure you haven’t already closed or partially sold this position.",
      };
    if (lower.includes("insufficient") && (lower.includes("liquidity") || lower.includes("balance")))
      return {
        message: "Not enough liquidity or balance to fill the sell order.",
        action: "Try again in a few minutes or when there’s more market activity.",
      };
    if (lower.includes("liquidity") || lower.includes("fill") || lower.includes("fok"))
      return { message: "The instant sell couldn’t be filled at current prices.", action: "Try again shortly or refresh; liquidity may have been low." };
    if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout"))
      return { message: "Network or Polymarket API issue.", action: "Check your connection and try again." };
    if (lower.includes("api") || lower.includes("key") || lower.includes("signature"))
      return { message: "Polymarket API or signature error.", action: "Refresh the page and try again. If it persists, try another browser or clear site data." };
  }

  if (step === "vault") {
    if (lower.includes("chain") || lower.includes("network") || lower.includes("wrong network"))
      return {
        message: "Wallet is on the wrong network for vault close.",
        action: "Switch wallet to Polygon and retry vault-only close.",
      };
    if (lower.includes("nonetwork") || lower.includes("could not detect network"))
      return {
        message: "Could not detect wallet network.",
        action: "Ensure your wallet is unlocked and switched to Polygon, then retry.",
      };
    if (lower.includes("user rejected") || lower.includes("user denied"))
      return { message: "You rejected the close transaction.", action: "Try again and approve. Your repay was already sent." };
    if (lower.includes("stale") || lower.includes("invalid oracle") || lower.includes("oracle"))
      return {
        message: "Vault close failed because oracle price is stale/invalid.",
        action: "Refresh oracle and try again. The app will attempt server auto-refresh before closing.",
      };
    if (lower.includes("position") || lower.includes("closed") || lower.includes("invalid"))
      return { message: "Vault close was rejected.", action: "Repay was sent. Contact support or try refreshing and closing again." };
  }

  return {
    message: raw.length > 120 ? raw.slice(0, 120) + "…" : raw,
    action: step === "sell" ? "Try again. If it keeps failing, liquidity may be low." : "Try again or refresh the page.",
  };
}

function isNoSellablePolymarketBalanceError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  return (
    lower.includes("not enough balance") ||
    lower.includes("not enough allowance") ||
    lower.includes("no open polymarket position found")
  );
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
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
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
  const [vaultOnly, setVaultOnly] = useState(false);
  const [result, setResult] = useState<{
    polyOrderId?: string;
    polyTxHash?: string;
    vaultTxHash?: string;
    actualExitPrice?: number;
    pnl?: number;
    info?: string;
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
  const liveExitPrice = livePrice;
  const previewExitPrice = liveExitPrice ?? oracleExitPrice ?? entryPrice;

  const pnlPreview = position.isLong
    ? notionalUsdc * ((previewExitPrice - entryPrice) / (entryPrice || 1))
    : notionalUsdc * ((entryPrice - previewExitPrice) / (entryPrice || 1));

  const tokenId = position.isLong ? clobTokenIds[0] : clobTokenIds[1];
  const canCloseWithSell = Boolean(address && tokenId && position.isOpen);
  const canCloseVaultOnly = Boolean(address && position.isOpen);
  const canClose = canCloseWithSell || canCloseVaultOnly;
  const isAnyLoading = step !== "idle" && step !== "done";

  const ensureVaultOracleFreshForClose = useCallback(async (): Promise<boolean> => {
    const { ethers } = await import("ethers");
    const rpcUrl =
      (process.env.NEXT_PUBLIC_POLYGON_RPC_URL || "").trim() ||
      "https://polygon-bor-rpc.publicnode.com";
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const reader = new ethers.Contract(
      addresses.marginEngine,
      ["function getPositionOraclePrice(uint256 positionId) view returns (uint256)"],
      provider
    );
    try {
      const px = await reader.getPositionOraclePrice(BigInt(positionId));
      if (Number(px) > 0) return true;
    } catch {
      // Attempt backend oracle refresh below.
    }

    const refreshRes = await fetch("/api/oracle-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketId: position.marketId }),
    });
    const refreshJson = await refreshRes.json().catch(() => ({}));
    if (!refreshRes.ok || !refreshJson?.success) return true;

    await new Promise((r) => setTimeout(r, 1200));
    try {
      const px2 = await reader.getPositionOraclePrice(BigInt(positionId));
      return Number(px2) > 0;
    } catch {
      // Do not block vault close if post-refresh read fails.
      return true;
    }
  }, [positionId, position.marketId]);

  const ensureWalletOnPolygon = useCallback(async () => {
    if (chainId === polygon.id) return;
    if (!switchChainAsync) {
      throw new Error("Wallet is not on Polygon and automatic network switch is unavailable.");
    }
    await switchChainAsync({ chainId: polygon.id });
  }, [chainId, switchChainAsync]);

  /* ── Step 1: Sell outcome tokens on Polymarket (Polygon) ── */
  const sellOnPolymarket = useCallback(async (): Promise<number> => {
    if (!tokenId) throw new Error("Missing token ID for Polymarket sell");
    if (typeof window === "undefined" || !window.ethereum) throw new Error("No wallet found");

    setStep("selling");

    const { ethers } = await import("ethers");
    const { ClobClient, Side, OrderType, AssetType } = await import("@polymarket/clob-client");

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const walletAddress = await signer.getAddress();
    if (address && walletAddress.toLowerCase() !== address.toLowerCase()) {
      throw new Error("Connected wallet does not match active wallet.");
    }

    const host = POLYMARKET_CLOB_API;
    const baseClient = new ClobClient(host, 137, signer);
    const creds = await baseClient.createOrDeriveApiKey();
    const client = new ClobClient(host, 137, signer, creds, 0, walletAddress);

    // Ensure CTF approvals so sells can transfer outcome tokens.
    const ctfAbi = [
      "function setApprovalForAll(address operator, bool approved) external",
      "function isApprovedForAll(address account, address operator) view returns (bool)",
    ];
    const ctf = new ethers.Contract(POLYMKT_CTF_ADDRESS, ctfAbi, signer);
    const operators = [POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS, POLYMKT_NEG_RISK_ADAPTER_ADDRESS];
    for (const op of operators) {
      const approved = await ctf.isApprovedForAll(walletAddress, op);
      if (!approved) {
        const tx = await ctf.setApprovalForAll(op, true);
        await tx.wait(1);
      }
    }
    await client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });

    const ts = (tickSize as "0.1" | "0.01" | "0.001" | "0.0001") ?? "0.01";
    const nr = negRisk ?? false;

    // Use actual Polymarket position size for this token so close is accurate.
    let sellAmount = notionalUsdc;
    let sizeFromPositionsApi: number | null = null;
    try {
      const res = await fetch(`/api/polymarket-positions?user=${walletAddress}&size=50&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        const rows: PositionApiRow[] = Array.isArray(j?.positions) ? j.positions : [];
        const exact = rows.find((r) => String(r.asset ?? "") === String(tokenId));
        const amt = Number(exact?.size ?? 0);
        if (Number.isFinite(amt) && amt > 0) {
          sellAmount = amt;
          sizeFromPositionsApi = amt;
        } else if (Number.isFinite(amt) && amt === 0) {
          sizeFromPositionsApi = 0;
        }
      }
    } catch {
      // keep notional fallback when API is unavailable
    }
    if (sizeFromPositionsApi === 0) {
      throw new Error("No open Polymarket position found for this outcome (size=0).");
    }

    // Clamp sell size to what Polymarket reports as available for this wallet to avoid
    // "not enough balance / allowance" errors when size has changed since open.
    try {
      const bal = await client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
      const clobBalanceUsdc = Number(bal?.balance ?? "0") / 1e6;
      if (Number.isFinite(clobBalanceUsdc) && clobBalanceUsdc > 0) {
        if (sellAmount > clobBalanceUsdc) {
          sellAmount = clobBalanceUsdc;
        }
      } else {
        throw new Error("No Polymarket wallet balance available for this outcome.");
      }
    } catch {
      // If balance endpoint fails, continue with API-derived size; CLOB will return a clear error.
    }

    const postSell = (orderType: typeof OrderType.FOK | typeof OrderType.FAK) =>
      client.createAndPostMarketOrder(
        { tokenID: tokenId, amount: sellAmount, side: Side.SELL },
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

    const statusTag = (resp?.status ?? resp?.errorMsg ?? resp?.error ?? "").toString().toLowerCase();
    const orderId = resp?.orderID ?? resp?.orderId ?? resp?.id ?? resp?.order_id;
    const polyTxHash = resp?.transactionHash ?? resp?.txHash ?? resp?.transaction_hash;
    const fillPrice = resp?.averagePrice ?? resp?.avg_price ?? previewExitPrice;
    const ok = Boolean(
      orderId ||
      polyTxHash ||
      ["matched", "filled", "live", "posted", "open", "accepted"].some((s) => statusTag.includes(s))
    );
    if (!ok) {
      throw new Error((resp?.errorMsg ?? resp?.error ?? resp?.message ?? "Sell was not accepted").toString());
    }

    setResult((prev) => ({ ...prev, polyOrderId: orderId ?? `status:${statusTag || "matched"}`, polyTxHash, actualExitPrice: fillPrice }));
    return typeof fillPrice === "number" ? fillPrice : parseFloat(String(fillPrice)) || previewExitPrice;
  }, [tokenId, notionalUsdc, tickSize, negRisk, previewExitPrice, address]);

  /* ── Step 2: Close position on Polygon vault (oracle-driven) ── */
  const closeOnVault = useCallback(async () => {
    await ensureWalletOnPolygon();
    const oracleOk = await ensureVaultOracleFreshForClose();
    if (!oracleOk) throw new Error("oracle not fresh after refresh");
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
  }, [writeContract, positionId, ensureVaultOracleFreshForClose, ensureWalletOnPolygon]);

  /* ── When vault tx confirms, we're done ── */
  useEffect(() => {
    if (isVaultTxSuccess && step === "vault-confirming") {
      setResult((prev) => ({ ...prev, vaultTxHash: vaultTxHash }));
      setStep("done");
      onSuccess?.();
    }
  }, [isVaultTxSuccess, step, vaultTxHash, onSuccess]);

  /* ── Combined close: (optional) sell on Polymarket → closePosition (oracle settles exit) ── */
  const handleClose = useCallback(async () => {
    setResult(null);
    setVaultTxHash(undefined);
    setConfirmOpen(false);

    // Vault-only path: skip Polymarket sell and just close the vault leg.
    if (vaultOnly) {
      try {
        setStep("closing-vault");
        await closeOnVault();
      } catch (err: unknown) {
        const { message, action } = parseCloseError(err, "vault");
        setResult((prev) => ({
          ...prev,
          error: `Vault close failed: ${message}`,
          errorAction: action,
        }));
        setStep("done");
      }
      return;
    }

    let sellDone = false;
    try {
      const realExitPrice = await sellOnPolymarket();
      setResult((prev) => ({ ...prev, actualExitPrice: realExitPrice }));
      sellDone = true;
      setStep("closing-vault");
      await closeOnVault();
    } catch (err: unknown) {
      if (!sellDone && isNoSellablePolymarketBalanceError(err)) {
        try {
          setStep("closing-vault");
          await closeOnVault();
          setResult((prev) => ({
            ...(prev ?? {}),
            info: "Polymarket sell skipped (no sellable position size). Vault close submitted.",
          }));
          return;
        } catch (vaultErr: unknown) {
          const { message, action } = parseCloseError(vaultErr, "vault");
          setResult((prev) => ({
            ...(prev ?? {}),
            error: `Vault close failed: ${message}`,
            errorAction: action,
          }));
          setStep("done");
          return;
        }
      }

      const stepLabel: "sell" | "vault" = sellDone ? "vault" : "sell";
      const { message, action } = parseCloseError(err, stepLabel);
      const prefix = stepLabel === "sell" ? "Sell failed" : "Vault close failed";
      setResult((prev) => ({
        ...prev,
        error: `${prefix}: ${message}`,
        errorAction: action,
      }));
      setStep("done");
    }
  }, [sellOnPolymarket, closeOnVault, vaultOnly]);

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
          <span className="text-gray-400">Live exit (bid/ask)</span>
          <span className="text-emerald-400 font-mono font-semibold">
            {liveExitPrice != null ? `${(liveExitPrice * 100).toFixed(1)}¢` : "--"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Oracle price (vault)</span>
          <span className="text-gray-300 font-mono">
            {oracleExitPrice != null ? `${(oracleExitPrice * 100).toFixed(1)}¢` : "pending"}
          </span>
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
        <p className="text-[9px] text-gray-500 mt-1.5 border-t border-emerald-900/20 pt-1.5">
          Vault close gas is higher because it reads the oracle (router → feed), repays the vault, and sends you USDC. Try during lower network activity if gas feels high.
        </p>
      </div>

      {!address && (
        <p className="text-amber-400/90 text-[11px]">Connect your wallet to close this position.</p>
      )}
      {address && !tokenId && !vaultOnly && (
        <p className="text-amber-400/90 text-[11px]">Market token IDs not loaded. Refresh the page or try again in a moment.</p>
      )}
      {address && tokenId && notionalUsdc > 0 && notionalUsdc < 1 && (
        <p className="text-amber-400/90 text-[11px]">This position’s notional (${notionalUsdc.toFixed(2)}) is below Polymarket’s $1 minimum; the sell step may be rejected.</p>
      )}
      {address && (
        <p className="text-[10px] text-gray-500">
          If Polymarket shows no open position for this outcome, you can skip the sell step and close the vault only.
        </p>
      )}
      {address && (
        <label className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-3 h-3 rounded border border-gray-600 bg-black"
            checked={vaultOnly}
            onChange={(e) => setVaultOnly(e.target.checked)}
            disabled={isAnyLoading}
          />
          <span>Vault-only close (skip Polymarket sell leg)</span>
        </label>
      )}
      <button type="button" onClick={() => setConfirmOpen(true)} disabled={!canClose || isAnyLoading}
        className="w-full rounded-lg bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/40 text-emerald-400 py-2.5 text-sm font-semibold hover:from-emerald-500/30 hover:to-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
        {isAnyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {vaultOnly ? "Close vault position only" : "Sell on Polymarket"}
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
            <h4 className="text-white font-semibold mb-2">
              {vaultOnly ? "Confirm vault-only close" : "Confirm Live Close"}
            </h4>
            <p className="text-gray-400 text-sm mb-3 truncate" title={marketTitle}>{marketTitle}</p>

            <div className="bg-black/50 rounded p-3 border border-gray-800 space-y-2 text-[11px] mb-4">
              <div className="text-emerald-400 text-[10px] font-bold uppercase mb-1">
                {vaultOnly ? "Vault-only close (Polygon)" : "Single-chain close (Polygon)"}
              </div>

              {vaultOnly ? (
                <div className="border-l-2 border-amber-500/30 pl-2">
                  <div className="text-amber-400 font-semibold text-[10px]">Close vault only</div>
                  <div className="text-gray-300">
                    Close position #{positionId} · no Polymarket sell. Oracle settles exit; collateral ± PnL returned to your wallet.
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}

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
          {result.info && (
            <div className="text-amber-300">{result.info}</div>
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
