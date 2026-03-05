"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useReadContract } from "wagmi";
import { polygon } from "wagmi/chains";
import { formatUnits } from "viem";
import { getContractAddresses, VAULT_ABI, MARGIN_ENGINE_ABI } from "@/lib/contracts";

const addresses = getContractAddresses();
const ZERO = "0x0000000000000000000000000000000000000000";
const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;
const USDC_ADDR = addresses.usdc as `0x${string}`;
const OPEN_FEE_RATE = 0.004; // 0.4%

// Minimal ERC20 ABI for balanceOf
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface PolymarketLeverageBoxProps {
  onVaultRefetch?: () => void;
}

export default function PolymarketLeverageBox({
  onVaultRefetch,
}: PolymarketLeverageBoxProps) {
  const { address, isConnected } = useAccount();

  // ── State ──
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [collateral, setCollateral] = useState("");
  const [leverage, setLeverage] = useState(2);
  const [trading, setTrading] = useState(false);
  const [tradeResult, setTradeResult] = useState<any>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // ── Live prices from CLOB (1-second refresh) ──
  const [yesPrice, setYesPrice] = useState<number | null>(null);
  const [noPrice, setNoPrice] = useState<number | null>(null);
  const [bestBid, setBestBid] = useState<number | null>(null);
  const [bestAsk, setBestAsk] = useState<number | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch("/api/polymarket-live", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      if (j?.success && j?.market) {
        setYesPrice(j.market.yesPrice);
        setNoPrice(j.market.noPrice);
        setBestBid(j.market.bestBid);
        setBestAsk(j.market.bestAsk);
      }
    } catch { /* ignore */ }
  }, []);

  const priceRef = useRef(fetchPrices);
  priceRef.current = fetchPrices;
  useEffect(() => {
    priceRef.current();
    const id = setInterval(() => priceRef.current(), 1000);
    return () => clearInterval(id);
  }, []);

  // ── USDC.e balance ──
  const { data: usdcBalRaw } = useReadContract({
    address: USDC_ADDR,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: polygon.id,
    query: { refetchInterval: 5000 },
  });
  const usdcBalance = usdcBalRaw
    ? parseFloat(formatUnits(usdcBalRaw as bigint, 6))
    : 0;

  // ── Vault available liquidity ──
  const { data: totalAssetsRaw } = useReadContract({
    address: hasVault ? (addresses.vault as `0x${string}`) : undefined,
    abi: VAULT_ABI,
    functionName: "totalAssets",
    chainId: polygon.id,
    query: { refetchInterval: 5000 },
  });
  const { data: totalBorrowedRaw } = useReadContract({
    address: hasVault ? (addresses.vault as `0x${string}`) : undefined,
    abi: VAULT_ABI,
    functionName: "totalBorrowed",
    chainId: polygon.id,
    query: { refetchInterval: 5000 },
  });
  const vaultAvailable =
    totalAssetsRaw && totalBorrowedRaw
      ? parseFloat(formatUnits(totalAssetsRaw as bigint, 6)) -
        parseFloat(formatUnits(totalBorrowedRaw as bigint, 6))
      : 0;

  // ── Borrow APR ──
  const { data: borrowAprRaw } = useReadContract({
    address: hasVault ? (addresses.marginEngine as `0x${string}`) : undefined,
    abi: MARGIN_ENGINE_ABI,
    functionName: "borrowAPR",
    chainId: polygon.id,
    query: { refetchInterval: 10000 },
  });
  const borrowAprPct = borrowAprRaw
    ? Number(borrowAprRaw) / 100
    : 8; // default 8% if can't read

  // ── Computed values ──
  const collateralNum = parseFloat(collateral) || 0;
  const notional = collateralNum * leverage;
  const borrowAmount = notional - collateralNum;
  const openFee = notional * OPEN_FEE_RATE;
  const totalUpfront = collateralNum + openFee;
  const dailyInterest = borrowAmount * (borrowAprPct / 100) / 365;
  const hourlyInterest = dailyInterest / 24;
  const entryPrice = side === "YES" ? bestAsk : (noPrice != null ? 1 - (bestBid ?? 0) : null);
  const estimatedShares = entryPrice && entryPrice > 0 ? notional / entryPrice : 0;

  // ── Validation ──
  // Only check collateral + fee against wallet balance (NOT full notional)
  const hasEnoughBalance = usdcBalance >= totalUpfront;
  const hasEnoughVault = borrowAmount <= 0 || vaultAvailable >= borrowAmount;
  const canTrade = isConnected && collateralNum > 0 && hasEnoughBalance && hasEnoughVault && !trading;

  // ── Execute trade ──
  const executeTrade = useCallback(async () => {
    if (!canTrade) return;
    setTrading(true);
    setTradeError(null);
    setTradeResult(null);

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
      setTradeResult(data);
      onVaultRefetch?.();
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : "Trade failed");
    }
    setTrading(false);
  }, [canTrade, side, notional, onVaultRefetch]);

  return (
    <div className="rounded-2xl border border-emerald-900/30 bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-emerald-900/20">
        <h3 className="text-sm font-semibold text-white">
          Leveraged Trade
        </h3>
      </div>

      <div className="p-5 space-y-4">
        {/* Side selector with live prices */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2 block">
            Direction
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSide("YES")}
              className={`py-3 rounded-lg text-sm font-semibold transition-all border ${
                side === "YES"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                  : "bg-white/[0.02] text-gray-400 border-white/5 hover:border-white/10"
              }`}
            >
              YES{" "}
              {yesPrice != null && (
                <span className="font-mono text-xs opacity-70">
                  {(yesPrice * 100).toFixed(1)}¢
                </span>
              )}
            </button>
            <button
              onClick={() => setSide("NO")}
              className={`py-3 rounded-lg text-sm font-semibold transition-all border ${
                side === "NO"
                  ? "bg-red-500/15 text-red-400 border-red-500/40"
                  : "bg-white/[0.02] text-gray-400 border-white/5 hover:border-white/10"
              }`}
            >
              NO{" "}
              {noPrice != null && (
                <span className="font-mono text-xs opacity-70">
                  {(noPrice * 100).toFixed(1)}¢
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Collateral input */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2 block">
            Collateral (USDC.e)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              $
            </span>
            <input
              type="number"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-7 pr-16 py-3 text-sm font-mono text-white placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none transition"
              step="0.01"
              min="0"
            />
            <button
              onClick={() => setCollateral(Math.max(0, usdcBalance - 0.01).toFixed(2))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1 rounded bg-emerald-500/10"
            >
              MAX
            </button>
          </div>
          <div className="text-[10px] text-gray-600 mt-1 font-mono">
            Balance: ${usdcBalance.toFixed(4)}
          </div>
        </div>

        {/* Leverage slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
              Leverage
            </label>
            <span className="text-emerald-400 font-bold text-sm font-mono">
              {leverage}x
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={0.5}
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[9px] text-gray-600 font-mono mt-1">
            <span>1x</span>
            <span>2x</span>
            <span>3x</span>
            <span>4x</span>
            <span>5x</span>
          </div>
        </div>

        {/* Trade summary */}
        {collateralNum > 0 && (
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2">
              Trade Summary
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Collateral</span>
              <span className="text-white font-mono">${collateralNum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Leverage</span>
              <span className="text-white font-mono">{leverage}x</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Notional</span>
              <span className="text-white font-mono font-semibold">${notional.toFixed(2)}</span>
            </div>
            {borrowAmount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Borrow from Vault</span>
                <span className="text-yellow-400 font-mono">${borrowAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Entry price */}
            {entryPrice != null && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Entry Price ({side})</span>
                <span className="text-emerald-400 font-mono">
                  {(entryPrice * 100).toFixed(1)}¢
                </span>
              </div>
            )}

            {/* Estimated shares */}
            {estimatedShares > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Est. Shares</span>
                <span className="text-white font-mono">
                  ~{estimatedShares.toFixed(1)}
                </span>
              </div>
            )}

            {/* Fees section */}
            <div className="border-t border-white/5 pt-2 mt-2">
              <div className="text-[9px] uppercase tracking-wider text-gray-600 mb-1">
                Fees
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Open Fee (0.4%)</span>
                <span className="text-yellow-400 font-mono">${openFee.toFixed(4)}</span>
              </div>
              {borrowAmount > 0 && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Borrow APR</span>
                    <span className="text-white font-mono">{borrowAprPct.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Daily Interest</span>
                    <span className="text-yellow-400 font-mono">${dailyInterest.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Hourly Interest</span>
                    <span className="text-gray-400 font-mono">${hourlyInterest.toFixed(6)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Total upfront */}
            <div className="border-t border-white/5 pt-2 mt-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-400">Total Upfront</span>
                <span className="text-white font-mono">${totalUpfront.toFixed(4)}</span>
              </div>
            </div>

            {/* Vault liquidity info */}
            {borrowAmount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Vault Available</span>
                <span
                  className={`font-mono ${hasEnoughVault ? "text-emerald-400" : "text-red-400"}`}
                >
                  ${vaultAvailable.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Warnings */}
        {collateralNum > 0 && !hasEnoughBalance && (
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2 text-[11px] text-red-400">
            Insufficient USDC.e balance. Need ${totalUpfront.toFixed(4)} (collateral + fee), have ${usdcBalance.toFixed(4)}.
          </div>
        )}
        {collateralNum > 0 && borrowAmount > 0 && !hasEnoughVault && (
          <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/20 px-3 py-2 text-[11px] text-yellow-400">
            Vault has insufficient liquidity. Need ${borrowAmount.toFixed(2)}, available ${vaultAvailable.toFixed(2)}.
          </div>
        )}

        {/* Execute button */}
        <button
          onClick={executeTrade}
          disabled={!canTrade}
          className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
            side === "YES"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40"
              : "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40"
          } disabled:cursor-not-allowed flex items-center justify-center gap-2`}
        >
          {trading ? (
            <>
              <div className="spinner" />
              Placing Order on Polymarket...
            </>
          ) : (
            `Open ${side} — $${notional.toFixed(2)} at ${leverage}x`
          )}
        </button>

        {/* Trade result */}
        {tradeResult && (
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4 space-y-1">
            <div className="text-emerald-400 text-xs font-semibold mb-2">
              ✓ Order Placed on Polymarket
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Order ID</span>
              <span className="text-white font-mono text-[10px]">
                {tradeResult.orderId}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Method</span>
              <span className="text-white font-mono">{tradeResult.method}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Side</span>
              <span className={tradeResult.side === "YES" ? "text-emerald-400" : "text-red-400"}>
                {tradeResult.side}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Entry Price</span>
              <span className="text-emerald-400 font-mono">
                {tradeResult.price ? `${(tradeResult.price * 100).toFixed(1)}¢` : "—"}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Shares</span>
              <span className="text-white font-mono">{tradeResult.size}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Notional</span>
              <span className="text-white font-mono">${tradeResult.notional}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Wallet</span>
              <span className="text-gray-400 font-mono text-[10px]">
                {tradeResult.wallet}
              </span>
            </div>
          </div>
        )}

        {/* Trade error */}
        {tradeError && (
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-4 py-3 text-xs text-red-400">
            {tradeError}
          </div>
        )}
      </div>
    </div>
  );
}
