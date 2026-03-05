"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { useBalance } from "wagmi";
import { formatUnits } from "viem";
import { polygon } from "wagmi/chains";
import { getContractAddresses, VAULT_ABI, MARGIN_ENGINE_ABI } from "@/lib/contracts";

const USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const addresses = getContractAddresses();
const ZERO = "0x0000000000000000000000000000000000000000";
const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;
const hasMargin = addresses.marginEngine !== ZERO && addresses.marginEngine.length === 42;

const OPEN_FEE_RATE = 0.004; // 0.4%

interface LivePrices {
  yesPrice: number | null;
  noPrice: number | null;
  yesBestBid: number | null;
  yesBestAsk: number | null;
  noBestBid: number | null;
  noBestAsk: number | null;
}

export default function PolymarketLeverageBox() {
  const { address, isConnected } = useAccount();
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [collateral, setCollateral] = useState("");
  const [leverage, setLeverage] = useState(2);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<LivePrices>({
    yesPrice: null, noPrice: null,
    yesBestBid: null, yesBestAsk: null,
    noBestBid: null, noBestAsk: null,
  });

  // Fetch live prices every 1 second
  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch("/api/polymarket-live", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.market) {
        setPrices({
          yesPrice: data.market.yesPrice ?? null,
          noPrice: data.market.noPrice ?? null,
          yesBestBid: data.market.yesBestBid ?? null,
          yesBestAsk: data.market.yesBestAsk ?? null,
          noBestBid: data.market.noBestBid ?? null,
          noBestAsk: data.market.noBestAsk ?? null,
        });
      }
    } catch {}
  }, []);

  const priceRef = useRef(fetchPrices);
  priceRef.current = fetchPrices;

  useEffect(() => {
    priceRef.current();
    const id = setInterval(() => priceRef.current(), 1000);
    return () => clearInterval(id);
  }, []);

  // USDC.e balance
  const { data: usdcBalance } = useBalance({
    address,
    token: USDC_E as `0x${string}`,
    chainId: polygon.id,
  });

  // Vault data for borrow capacity
  const { data: vaultData } = useReadContracts({
    contracts: hasVault
      ? [
          { address: addresses.vault, abi: VAULT_ABI, functionName: "totalAssets", chainId: polygon.id },
          { address: addresses.vault, abi: VAULT_ABI, functionName: "totalBorrowed", chainId: polygon.id },
        ]
      : [],
    query: { refetchInterval: 5000 },
  });

  // Borrow APR from margin engine
  const { data: marginData } = useReadContracts({
    contracts: hasMargin
      ? [
          { address: addresses.marginEngine, abi: MARGIN_ENGINE_ABI, functionName: "borrowAPR", chainId: polygon.id },
        ]
      : [],
    query: { refetchInterval: 30000 },
  });

  const walletBalance = usdcBalance
    ? parseFloat(formatUnits(usdcBalance.value, usdcBalance.decimals))
    : 0;

  const totalAssets = vaultData?.[0]?.result as bigint | undefined;
  const totalBorrowed = vaultData?.[1]?.result as bigint | undefined;
  const vaultAvailable =
    totalAssets != null && totalBorrowed != null
      ? parseFloat(formatUnits(totalAssets - totalBorrowed, 6))
      : 0;

  const borrowAprRaw = marginData?.[0]?.result as bigint | undefined;
  const borrowAprPct = borrowAprRaw != null ? Number(borrowAprRaw) / 100 : 8.0; // default 8%

  // Calculations
  const collateralNum = parseFloat(collateral) || 0;
  const notional = collateralNum * leverage;
  const borrowAmount = notional - collateralNum;
  const openFee = notional * OPEN_FEE_RATE;
  const totalUpfront = collateralNum + openFee;
  const dailyInterest = borrowAmount * (borrowAprPct / 100) / 365;
  const hourlyInterest = dailyInterest / 24;

  // Entry price = current ask for the selected side
  const entryPrice = side === "YES" ? prices.yesBestAsk : prices.noBestAsk;
  const estimatedShares = entryPrice && entryPrice > 0 ? notional / entryPrice : 0;

  const canTrade =
    isConnected &&
    collateralNum > 0 &&
    walletBalance >= totalUpfront &&
    (leverage <= 1 || borrowAmount <= vaultAvailable);

  const handleTrade = async () => {
    if (!canTrade) return;
    setExecuting(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/polymarket-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side,
          amount: notional.toFixed(2),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Trade failed (HTTP ${res.status})`);
      }
      setResult({
        ...data,
        entryPrice: entryPrice,
        collateral: collateralNum,
        leverage,
        openFee,
        borrowApr: borrowAprPct,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed");
    }
    setExecuting(false);
  };

  const formatCents = (v: number | null) =>
    v != null ? (v * 100).toFixed(1) + "¢" : "—";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">Leveraged Trade</h3>
      </div>

      <div className="p-5 space-y-5">
        {/* Side selector with live prices */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#666] font-medium mb-2 block">
            Direction
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSide("YES")}
              className={`py-3 rounded-xl text-sm font-bold transition-all flex flex-col items-center gap-0.5 ${
                side === "YES"
                  ? "bg-[#00ff88]/15 text-[#00ff88] border-2 border-[#00ff88]/50 shadow-[0_0_15px_rgba(0,255,136,0.1)]"
                  : "bg-white/[0.03] text-[#666] border-2 border-transparent hover:border-white/10"
              }`}
            >
              <span>YES</span>
              <span className={`text-xs mono ${side === "YES" ? "text-[#00ff88]/70" : "text-[#555]"}`}>
                {formatCents(prices.yesBestAsk)}
              </span>
            </button>
            <button
              onClick={() => setSide("NO")}
              className={`py-3 rounded-xl text-sm font-bold transition-all flex flex-col items-center gap-0.5 ${
                side === "NO"
                  ? "bg-red-500/15 text-red-400 border-2 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                  : "bg-white/[0.03] text-[#666] border-2 border-transparent hover:border-white/10"
              }`}
            >
              <span>NO</span>
              <span className={`text-xs mono ${side === "NO" ? "text-red-400/70" : "text-[#555]"}`}>
                {formatCents(prices.noBestAsk)}
              </span>
            </button>
          </div>
        </div>

        {/* Collateral input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-wider text-[#666] font-medium">
              Collateral (USDC.e)
            </label>
            <button
              onClick={() => setCollateral(Math.max(0, walletBalance - openFee).toFixed(2))}
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
              className="w-full input-dark pl-8 pr-4 py-3 text-sm mono"
              step="0.01"
              min="0"
            />
          </div>
        </div>

        {/* Leverage slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-wider text-[#666] font-medium">
              Leverage
            </label>
            <span className="text-sm font-bold mono text-[#00ff88]">{leverage}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="0.5"
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value))}
            className="w-full accent-[#00ff88] h-2 bg-white/5 rounded-full appearance-none cursor-pointer"
          />
          <div className="flex justify-between mt-1 text-[10px] text-[#555] mono">
            <span>1x</span>
            <span>2x</span>
            <span>3x</span>
            <span>4x</span>
            <span>5x</span>
          </div>
        </div>

        {/* Trade Summary */}
        {collateralNum > 0 && (
          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-[#666] font-medium mb-2">
              Trade Summary
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-[#888]">Entry Price ({side})</span>
              <span className="text-white mono font-medium">{formatCents(entryPrice)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#888]">Notional</span>
              <span className="text-white mono font-medium">${notional.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#888]">Est. Shares</span>
              <span className="text-white mono font-medium">{estimatedShares.toFixed(2)}</span>
            </div>
            {leverage > 1 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#888]">Borrowed from Vault</span>
                <span className="text-[#f59e0b] mono font-medium">${borrowAmount.toFixed(2)}</span>
              </div>
            )}
            {leverage > 1 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#888]">Vault Available</span>
                <span className={`mono font-medium ${vaultAvailable >= borrowAmount ? "text-[#00ff88]" : "text-red-400"}`}>
                  ${vaultAvailable.toFixed(2)}
                </span>
              </div>
            )}

            {/* Fees section */}
            <div className="border-t border-white/5 pt-2 mt-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#888]">Open Fee (0.4%)</span>
                <span className="text-[#f59e0b] mono font-medium">${openFee.toFixed(4)}</span>
              </div>
              {leverage > 1 && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#888]">Borrow APR</span>
                    <span className="text-[#f59e0b] mono font-medium">{borrowAprPct.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#888]">Daily Interest</span>
                    <span className="text-[#888] mono">${dailyInterest.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#888]">Hourly Interest</span>
                    <span className="text-[#888] mono">${hourlyInterest.toFixed(6)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Total */}
            <div className="border-t border-white/5 pt-2 mt-2">
              <div className="flex justify-between text-xs">
                <span className="text-white font-semibold">Total Upfront</span>
                <span className="text-white mono font-bold">${totalUpfront.toFixed(4)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Warnings */}
        {collateralNum > 0 && walletBalance < totalUpfront && (
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2 text-[11px] text-red-400">
            Wallet balance (${walletBalance.toFixed(2)}) is below total upfront cost (${totalUpfront.toFixed(4)}).
          </div>
        )}
        {collateralNum > 0 && leverage > 1 && borrowAmount > vaultAvailable && (
          <div className="rounded-lg bg-[#f59e0b]/5 border border-[#f59e0b]/20 px-3 py-2 text-[11px] text-[#f59e0b]">
            Borrow amount (${borrowAmount.toFixed(2)}) exceeds vault available liquidity (${vaultAvailable.toFixed(2)}).
          </div>
        )}

        {/* Execute button */}
        <button
          onClick={handleTrade}
          disabled={!canTrade || executing}
          className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            side === "YES"
              ? "btn-primary"
              : "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          {executing ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16 }} />
              Executing...
            </>
          ) : !isConnected ? (
            "Connect Wallet"
          ) : (
            `Buy ${side} — $${notional.toFixed(2)} (${leverage}x)`
          )}
        </button>

        {/* Result */}
        {result && (
          <div className="rounded-xl bg-[#00ff88]/5 border border-[#00ff88]/20 p-4 space-y-2">
            <div className="text-[11px] font-bold text-[#00ff88] uppercase tracking-wider">
              Trade Executed
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#888]">Order ID</span>
                <span className="text-white mono text-[10px]">{String(result.orderId).slice(0, 16)}...</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#888]">Side</span>
                <span className={result.side === "YES" ? "text-[#00ff88]" : "text-red-400"}>{result.side}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#888]">Entry Price</span>
                <span className="text-white mono">{formatCents(result.entryPrice)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#888]">Shares</span>
                <span className="text-white mono">{result.size}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#888]">Notional</span>
                <span className="text-white mono">${result.notional}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#888]">Open Fee</span>
                <span className="text-[#f59e0b] mono">${result.openFee?.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#888]">Method</span>
                <span className="text-[#888] mono text-[10px]">{result.method}</span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4">
            <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-1">
              Trade Failed
            </div>
            <div className="text-xs text-red-300">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
