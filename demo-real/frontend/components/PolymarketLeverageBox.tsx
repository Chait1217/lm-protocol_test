"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { polygon } from "wagmi/chains";
import { formatUnits } from "viem";
import { getContractAddresses, VAULT_ABI, MARGIN_ENGINE_ABI } from "@/lib/contracts";

const USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const addresses = getContractAddresses();

/* ─── Fee Constants ─── */
const OPEN_FEE_RATE = 0.004; // 0.4% open fee on notional

interface PolymarketLeverageBoxProps {
  onVaultRefetch?: () => void;
}

type TradeStatus = "idle" | "submitting" | "success" | "error";
type CloseStatus = "idle" | "closing" | "success" | "error";

export default function PolymarketLeverageBox({ onVaultRefetch }: PolymarketLeverageBoxProps) {
  const { address, isConnected } = useAccount();

  // Form State
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [leverage, setLeverage] = useState(2);
  const [collateral, setCollateral] = useState("");
  const [tradeStatus, setTradeStatus] = useState<TradeStatus>("idle");
  const [closeStatus, setCloseStatus] = useState<CloseStatus>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [tradeResult, setTradeResult] = useState<any>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // ─── LIVE PRICES (updated every 1s) ───
  const [yesPrice, setYesPrice] = useState<number | null>(null);
  const [noPrice, setNoPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch("/api/polymarket-live", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.market) {
          const prices = data.market.outcomePrices;
          if (Array.isArray(prices) && prices.length >= 2) {
            setYesPrice(parseFloat(String(prices[0])));
            setNoPrice(parseFloat(String(prices[1])));
          } else if (data.market.bestBid != null) {
            setYesPrice(parseFloat(String(data.market.bestBid)));
            setNoPrice(1 - parseFloat(String(data.market.bestBid)));
          }
        }
      }
    } catch { /* ignore */ }
    setPriceLoading(false);
  }, []);

  const priceRef = useRef(fetchPrices);
  priceRef.current = fetchPrices;
  useEffect(() => {
    priceRef.current();
    const id = setInterval(() => priceRef.current(), 1000);
    return () => clearInterval(id);
  }, []);

  // Current entry price based on selected side
  const entryPrice = side === "YES" ? yesPrice : noPrice;

  // Balances
  const { data: usdcBalance } = useBalance({
    address,
    token: USDC_E as `0x${string}`,
    chainId: polygon.id,
  });

  const walletBalance = usdcBalance
    ? parseFloat(formatUnits(usdcBalance.value, usdcBalance.decimals))
    : 0;

  // Vault available liquidity
  const { data: vaultAssets } = useReadContract({
    address: addresses.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "totalAssets",
    chainId: polygon.id,
  });
  const { data: vaultBorrowed } = useReadContract({
    address: addresses.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "totalBorrowed",
    chainId: polygon.id,
  });

  const vaultAssetsNum = vaultAssets ? parseFloat(formatUnits(vaultAssets as bigint, 6)) : 0;
  const vaultBorrowedNum = vaultBorrowed ? parseFloat(formatUnits(vaultBorrowed as bigint, 6)) : 0;
  const availableLiquidity = vaultAssetsNum - vaultBorrowedNum;

  // ─── Borrow APR from MarginEngine ───
  const { data: borrowAprRaw } = useReadContract({
    address: addresses.marginEngine as `0x${string}`,
    abi: MARGIN_ENGINE_ABI,
    functionName: "borrowAPR",
    chainId: polygon.id,
  });

  // borrowAPR is in basis points (e.g. 800 = 8.00%)
  const borrowAprBps = borrowAprRaw ? Number(borrowAprRaw) : 0;
  const borrowAprPct = borrowAprBps / 100; // e.g. 8.00

  // ─── Computed values ───
  const collateralNum = parseFloat(collateral) || 0;
  const notional = collateralNum * leverage;
  const borrowAmount = notional - collateralNum;
  const estimatedShares = entryPrice && entryPrice > 0 ? notional / entryPrice : 0;

  // ─── Fee Calculations ───
  const openFee = notional * OPEN_FEE_RATE;                      // 0.4% of notional
  const dailyInterest = borrowAmount * (borrowAprPct / 100) / 365; // daily interest on borrowed amount
  const hourlyInterest = dailyInterest / 24;                       // hourly interest
  const totalUpfrontCost = collateralNum + openFee;                // what you pay upfront

  // FIXED: Only check collateral + open fee, not full notional
  const hasEnoughCollateral = walletBalance >= totalUpfrontCost;
  const hasEnoughVaultLiquidity = leverage <= 1 || availableLiquidity >= borrowAmount;

  const getValidationMessage = (): string | null => {
    if (!isConnected) return "Connect wallet to trade";
    if (collateralNum <= 0) return "Enter collateral amount";
    if (!hasEnoughCollateral)
      return `Insufficient balance. You have $${walletBalance.toFixed(2)}, need $${totalUpfrontCost.toFixed(4)} (collateral + open fee)`;
    if (!hasEnoughVaultLiquidity)
      return `Vault liquidity too low. Available: $${availableLiquidity.toFixed(2)}, need to borrow: $${borrowAmount.toFixed(2)}`;
    return null;
  };

  const validationMsg = getValidationMessage();
  const canTrade = !validationMsg && tradeStatus === "idle" && !activeOrderId;

  // ─── EXECUTE TRADE ───
  const executeTrade = useCallback(async () => {
    if (!canTrade || !address) return;
    setTradeStatus("submitting");
    setStatusMsg(leverage > 1 ? "Borrowing from vault & placing order..." : "Placing order on Polymarket...");
    setErrorMsg("");
    setTradeResult(null);

    try {
      const res = await fetch("/api/polymarket-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          side,
          collateral: collateralNum,
          leverage,
          notional,
          borrowAmount: leverage > 1 ? borrowAmount : 0,
          openFee,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Trade execution failed");
      }

      setTradeResult(data);
      if (data.orderId) setActiveOrderId(data.orderId);
      setTradeStatus("success");
      setStatusMsg(`Trade executed! Order: ${data.orderId ? data.orderId.slice(0, 10) + "..." : "confirmed"}`);
      onVaultRefetch?.();
    } catch (err) {
      setTradeStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setStatusMsg("");
    }
  }, [canTrade, address, side, collateralNum, leverage, notional, borrowAmount, openFee, onVaultRefetch]);

  // ─── CLOSE TRADE ───
  const closeTrade = useCallback(async () => {
    if (!address || !activeOrderId) return;
    setCloseStatus("closing");
    setErrorMsg("");
    setStatusMsg("Closing position...");

    try {
      const res = await fetch("/api/polymarket-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          orderId: activeOrderId,
          side,
          notional,
          borrowAmount: leverage > 1 ? borrowAmount : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Close trade failed");
      }

      setCloseStatus("success");
      setStatusMsg("Position closed successfully!");
      setActiveOrderId(null);
      setTradeResult(null);
      onVaultRefetch?.();
      setTimeout(() => {
        setCloseStatus("idle");
        setTradeStatus("idle");
        setStatusMsg("");
      }, 3000);
    } catch (err) {
      setCloseStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }, [address, activeOrderId, side, notional, borrowAmount, leverage, onVaultRefetch]);

  const resetTrade = () => {
    setTradeStatus("idle");
    setCloseStatus("idle");
    setStatusMsg("");
    setErrorMsg("");
    setTradeResult(null);
    setActiveOrderId(null);
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-[#00ff88]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Leveraged Trade
        </h3>
        {activeOrderId && (
          <span className="tag-neon text-[10px]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse-neon" />
            POSITION OPEN
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* ─── Side Selection — LIVE PRICES EVERY 1s ─── */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#666] font-medium mb-2 block">Direction</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSide("YES")}
              disabled={tradeStatus !== "idle"}
              className={`py-3 rounded-xl text-sm font-semibold transition-all relative ${
                side === "YES"
                  ? "bg-[#00ff88]/12 text-[#00ff88] border border-[#00ff88]/30 shadow-[0_0_15px_rgba(0,255,136,0.08)]"
                  : "bg-white/[0.02] text-[#666] border border-white/5 hover:border-white/10"
              }`}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span>YES</span>
                <span className={`text-[11px] mono font-bold ${side === "YES" ? "text-[#00ff88]" : "text-[#888]"}`}>
                  {priceLoading ? "..." : yesPrice != null ? `${(yesPrice * 100).toFixed(1)}¢` : "—"}
                </span>
              </div>
            </button>
            <button
              onClick={() => setSide("NO")}
              disabled={tradeStatus !== "idle"}
              className={`py-3 rounded-xl text-sm font-semibold transition-all relative ${
                side === "NO"
                  ? "bg-red-500/12 text-red-400 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.08)]"
                  : "bg-white/[0.02] text-[#666] border border-white/5 hover:border-white/10"
              }`}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span>NO</span>
                <span className={`text-[11px] mono font-bold ${side === "NO" ? "text-red-400" : "text-[#888]"}`}>
                  {priceLoading ? "..." : noPrice != null ? `${(noPrice * 100).toFixed(1)}¢` : "—"}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* ─── Collateral Input ─── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-wider text-[#666] font-medium">
              Collateral (USDC.e)
            </label>
            <button
              onClick={() => setCollateral(walletBalance.toFixed(2))}
              className="text-[10px] text-[#00ff88] hover:text-[#33ffaa] font-medium transition-colors"
            >
              Max: ${walletBalance.toFixed(2)}
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555] text-sm">$</span>
            <input
              type="number"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              placeholder="0.00"
              disabled={tradeStatus !== "idle"}
              className="w-full input-dark pl-8 pr-4 py-3 text-sm mono"
              step="0.01"
              min="0"
            />
          </div>
        </div>

        {/* ─── Leverage Slider ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-[10px] uppercase tracking-wider text-[#666] font-medium">Leverage</label>
            <span className="text-sm font-bold text-[#00ff88] mono">{leverage}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={0.5}
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value))}
            disabled={tradeStatus !== "idle"}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/5
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00ff88]
              [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,255,136,0.4)]
              [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:hover:scale-110"
          />
          <div className="flex justify-between text-[10px] text-[#555] mt-1 mono">
            <span>1x</span><span>2x</span><span>3x</span><span>4x</span><span>5x</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            TRADE SUMMARY — includes Open Fee + Interest Fees
            ═══════════════════════════════════════════════════════ */}
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-2.5">
          {/* Entry Price */}
          <div className="flex justify-between text-xs">
            <span className="text-[#666]">Entry Price ({side})</span>
            <span className={`mono font-bold ${side === "YES" ? "text-[#00ff88]" : "text-red-400"}`}>
              {entryPrice != null ? `$${entryPrice.toFixed(4)}` : "—"}
            </span>
          </div>

          {/* Collateral */}
          <div className="flex justify-between text-xs">
            <span className="text-[#666]">Your Collateral</span>
            <span className="text-white mono font-medium">${collateralNum.toFixed(2)}</span>
          </div>

          {/* Borrowed */}
          {leverage > 1 && (
            <div className="flex justify-between text-xs">
              <span className="text-[#666]">Borrowed from Vault</span>
              <span className="text-[#f59e0b] mono font-medium">${borrowAmount.toFixed(2)}</span>
            </div>
          )}

          <div className="h-px bg-white/5" />

          {/* Total Notional */}
          <div className="flex justify-between text-xs">
            <span className="text-[#888] font-medium">Total Notional</span>
            <span className="text-white mono font-bold">${notional.toFixed(2)}</span>
          </div>

          {/* Est. Shares */}
          {estimatedShares > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-[#666]">Est. Shares</span>
              <span className="text-[#ccc] mono font-medium">{estimatedShares.toFixed(2)}</span>
            </div>
          )}

          {/* Direction */}
          <div className="flex justify-between text-xs">
            <span className="text-[#666]">Direction</span>
            <span className={side === "YES" ? "text-[#00ff88] font-medium" : "text-red-400 font-medium"}>
              {side}
            </span>
          </div>

          {/* Vault Available */}
          {leverage > 1 && (
            <div className="flex justify-between text-xs">
              <span className="text-[#666]">Vault Available</span>
              <span className={`mono font-medium ${availableLiquidity >= borrowAmount ? "text-[#00ff88]" : "text-red-400"}`}>
                ${availableLiquidity.toFixed(2)}
              </span>
            </div>
          )}

          {/* ─── FEES SECTION ─── */}
          <div className="h-px bg-white/5" />
          <div className="text-[10px] uppercase tracking-wider text-[#888] font-semibold pt-0.5">Fees</div>

          {/* Open Fee: 0.4% */}
          <div className="flex justify-between text-xs">
            <span className="text-[#666] flex items-center gap-1">
              Open Fee
              <span className="text-[10px] text-[#555]">(0.4%)</span>
            </span>
            <span className="text-[#f59e0b] mono font-medium">
              {collateralNum > 0 ? `-$${openFee.toFixed(4)}` : "$0.00"}
            </span>
          </div>

          {/* Interest Rate (APR) */}
          {leverage > 1 && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-[#666] flex items-center gap-1">
                  Borrow APR
                  <span className="text-[10px] text-[#555]">(on borrowed)</span>
                </span>
                <span className="text-[#f59e0b] mono font-medium">
                  {borrowAprPct > 0 ? `${borrowAprPct.toFixed(2)}%` : "—"}
                </span>
              </div>

              {/* Daily Interest */}
              <div className="flex justify-between text-xs">
                <span className="text-[#666] flex items-center gap-1">
                  Daily Interest
                  <span className="text-[10px] text-[#555]">(est.)</span>
                </span>
                <span className="text-[#f59e0b] mono font-medium">
                  {collateralNum > 0 && borrowAmount > 0
                    ? `-$${dailyInterest.toFixed(4)}/day`
                    : "$0.00/day"}
                </span>
              </div>

              {/* Hourly Interest */}
              <div className="flex justify-between text-xs">
                <span className="text-[#666] flex items-center gap-1">
                  Hourly Interest
                  <span className="text-[10px] text-[#555]">(est.)</span>
                </span>
                <span className="text-[#888] mono text-[11px]">
                  {collateralNum > 0 && borrowAmount > 0
                    ? `-$${hourlyInterest.toFixed(6)}/hr`
                    : "$0.00/hr"}
                </span>
              </div>
            </>
          )}

          {/* Total Upfront Cost */}
          <div className="h-px bg-white/5" />
          <div className="flex justify-between text-xs">
            <span className="text-[#888] font-semibold">Total Upfront Cost</span>
            <span className="text-white mono font-bold">
              ${totalUpfrontCost.toFixed(4)}
            </span>
          </div>
          <div className="text-[10px] text-[#555] leading-tight">
            Collateral (${collateralNum.toFixed(2)}) + Open Fee (${openFee.toFixed(4)})
            {leverage > 1 && <> · Interest accrues on ${borrowAmount.toFixed(2)} borrowed</>}
          </div>
        </div>

        {/* ─── Validation / Status Messages ─── */}
        {validationMsg && tradeStatus === "idle" && (
          <div className="rounded-lg bg-[#f59e0b]/5 border border-[#f59e0b]/20 px-4 py-2.5 text-xs text-[#f59e0b]">
            {validationMsg}
          </div>
        )}

        {statusMsg && (
          <div className={`rounded-lg px-4 py-2.5 text-xs border ${
            tradeStatus === "success" || closeStatus === "success"
              ? "bg-[#00ff88]/5 border-[#00ff88]/20 text-[#00ff88]"
              : tradeStatus === "error" || closeStatus === "error"
              ? "bg-red-500/5 border-red-500/20 text-red-400"
              : "bg-[#3b82f6]/5 border-[#3b82f6]/20 text-[#3b82f6]"
          }`}>
            <div className="flex items-center gap-2">
              {(tradeStatus === "submitting" || closeStatus === "closing") && <div className="spinner" />}
              {statusMsg}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-4 py-2.5 text-xs text-red-400">
            {errorMsg}
          </div>
        )}

        {/* ─── Action Buttons ─── */}
        <div className="space-y-2">
          {!activeOrderId ? (
            <button
              onClick={executeTrade}
              disabled={!canTrade}
              className="w-full btn-primary py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {tradeStatus === "submitting" ? (
                <><div className="spinner" /> Executing Trade...</>
              ) : (
                `Open ${side} Position — $${notional.toFixed(2)} (${leverage}x)`
              )}
            </button>
          ) : (
            <button
              onClick={closeTrade}
              disabled={closeStatus === "closing"}
              className="w-full btn-danger py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {closeStatus === "closing" ? (
                <><div className="spinner" /> Closing Position...</>
              ) : (
                "Close Position"
              )}
            </button>
          )}

          {(tradeStatus === "error" || tradeStatus === "success" || closeStatus === "error") && (
            <button
              onClick={resetTrade}
              className="w-full bg-white/[0.03] text-[#888] border border-white/5 py-2.5 rounded-xl text-xs font-medium hover:bg-white/[0.06] hover:text-white transition-all"
            >
              Reset
            </button>
          )}
        </div>

        {/* ─── Trade Result Details ─── */}
        {tradeResult && (
          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
            <div className="text-[10px] uppercase tracking-wider text-[#666] font-medium mb-2">Trade Details</div>
            <div className="space-y-1.5 text-xs">
              {tradeResult.orderId && (
                <div className="flex justify-between">
                  <span className="text-[#666]">Order ID</span>
                  <span className="text-[#999] mono text-[11px]">{tradeResult.orderId.slice(0, 16)}...</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#666]">Entry Price</span>
                <span className="text-white mono font-bold">
                  ${tradeResult.fillPrice ? parseFloat(tradeResult.fillPrice).toFixed(4) : entryPrice?.toFixed(4) || "—"}
                </span>
              </div>
              {tradeResult.yesPrice && (
                <div className="flex justify-between">
                  <span className="text-[#666]">YES Price</span>
                  <span className="text-[#00ff88] mono">${parseFloat(tradeResult.yesPrice).toFixed(4)}</span>
                </div>
              )}
              {tradeResult.noPrice && (
                <div className="flex justify-between">
                  <span className="text-[#666]">NO Price</span>
                  <span className="text-red-400 mono">${parseFloat(tradeResult.noPrice).toFixed(4)}</span>
                </div>
              )}
              {tradeResult.shares && (
                <div className="flex justify-between">
                  <span className="text-[#666]">Shares</span>
                  <span className="text-white mono">{parseFloat(tradeResult.shares).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#666]">Notional</span>
                <span className="text-white mono">${tradeResult.notional ? parseFloat(tradeResult.notional).toFixed(2) : notional.toFixed(2)}</span>
              </div>
              {tradeResult.borrowAmount && parseFloat(tradeResult.borrowAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#666]">Borrowed</span>
                  <span className="text-[#f59e0b] mono">${parseFloat(tradeResult.borrowAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="h-px bg-white/5 my-1" />
              <div className="flex justify-between">
                <span className="text-[#666]">Open Fee Paid</span>
                <span className="text-[#f59e0b] mono">-${openFee.toFixed(4)}</span>
              </div>
              {leverage > 1 && borrowAprPct > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#666]">Interest Rate</span>
                  <span className="text-[#f59e0b] mono">{borrowAprPct.toFixed(2)}% APR</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
