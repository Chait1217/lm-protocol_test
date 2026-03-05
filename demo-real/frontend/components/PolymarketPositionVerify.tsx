"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount } from "wagmi";

interface PositionData {
  market: string;
  slug: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  size: number;
  avgPrice: number;
  currentPrice: number;
  initialValue: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  realizedPnl: number;
  totalBought: number;
  asset: string;
  oppositeAsset: string;
  conditionId: string;
  redeemable: boolean;
  mergeable: boolean;
  negativeRisk: boolean;
  endDate: string;
  icon: string;
}

export default function PolymarketPositionVerify() {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [closingAsset, setClosingAsset] = useState<string | null>(null);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/polymarket-positions?address=${address}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch positions");
      const data = await res.json();
      if (data.success) {
        setPositions(data.positions || []);
      } else {
        throw new Error(data.error || "Unknown error");
      }
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Auto-fetch on mount and every 10s
  const fetchRef = useRef(fetchPositions);
  fetchRef.current = fetchPositions;
  useEffect(() => {
    if (!isConnected || !address) return;
    fetchRef.current();
    const id = setInterval(() => fetchRef.current(), 10000);
    return () => clearInterval(id);
  }, [isConnected, address]);

  // Close a specific position
  const closePosition = useCallback(async (pos: PositionData) => {
    if (!address) return;
    setClosingAsset(pos.asset);
    setCloseMsg("Closing position...");
    setCloseError(null);

    try {
      const res = await fetch("/api/polymarket-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          asset: pos.asset,
          size: pos.size,
          side: pos.outcome.toUpperCase(),
          negativeRisk: pos.negativeRisk,
          conditionId: pos.conditionId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Close failed");
      }
      setCloseMsg(`Sell order placed! ${data.closeMethod} order: ${data.closeOrderId?.slice(0, 12) || "submitted"}...`);
      // Refresh positions after a short delay
      setTimeout(() => {
        fetchRef.current();
        setClosingAsset(null);
        setCloseMsg(null);
      }, 5000);
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : "Unknown error");
      setClosingAsset(null);
      setCloseMsg(null);
    }
  }, [address]);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-[#8b5cf6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Polymarket Positions
        </h3>
        <button
          onClick={fetchPositions}
          disabled={!isConnected || loading}
          className="text-xs font-medium text-[#00ff88] hover:text-[#33ffaa] disabled:text-[#444] disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          {loading ? (
            <><div className="spinner" style={{ width: 12, height: 12 }} /> Checking...</>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {!isConnected ? (
          <p className="text-[#555] text-xs text-center py-6">Connect wallet to verify positions</p>
        ) : positions.length === 0 && !loading ? (
          <div className="text-center py-6">
            <p className="text-[#555] text-xs mb-2">No open positions found</p>
            {lastChecked && (
              <p className="text-[#444] text-[10px]">Last checked: {lastChecked}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {positions.map((pos, i) => {
              const isClosing = closingAsset === pos.asset;
              const pnlColor = pos.pnl >= 0 ? "text-[#00ff88]" : "text-red-400";
              const sideColor = pos.outcome === "Yes" ? "text-[#00ff88]" : "text-red-400";

              return (
                <div key={`${pos.asset}-${i}`} className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                  {/* Market Title + PnL */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <a
                        href={`https://polymarket.com/event/${pos.eventSlug || pos.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-white hover:text-[#00ff88] transition-colors truncate block"
                        title={pos.market}
                      >
                        {pos.market}
                        <svg className="w-3 h-3 inline-block ml-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                    <span className={`text-xs font-bold mono whitespace-nowrap ${pnlColor}`}>
                      {pos.pnl >= 0 ? "+" : ""}{pos.pnl.toFixed(3)} ({pos.pnlPct.toFixed(1)}%)
                    </span>
                  </div>

                  {/* Position Details */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] mb-3">
                    <div className="flex justify-between">
                      <span className="text-[#666]">Side</span>
                      <span className={`font-medium ${sideColor}`}>{pos.outcome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#666]">Shares</span>
                      <span className="text-[#999] mono">{pos.size.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#666]">Entry</span>
                      <span className="text-[#999] mono">${pos.avgPrice.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#666]">Current</span>
                      <span className="text-white mono font-medium">${pos.currentPrice.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#666]">Value</span>
                      <span className="text-[#999] mono">${pos.currentValue.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#666]">Cost</span>
                      <span className="text-[#999] mono">${pos.initialValue.toFixed(3)}</span>
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={() => closePosition(pos)}
                    disabled={isClosing}
                    className="w-full btn-danger py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isClosing ? (
                      <><div className="spinner" style={{ width: 12, height: 12 }} /> Closing...</>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Close Position ({pos.size.toFixed(2)} shares)
                      </>
                    )}
                  </button>

                  {/* Close status messages */}
                  {isClosing && closeMsg && (
                    <div className="mt-2 rounded-lg bg-[#00ff88]/5 border border-[#00ff88]/20 px-3 py-2 text-[11px] text-[#00ff88]">
                      {closeMsg}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Close error */}
        {closeError && (
          <div className="mt-3 rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            Close error: {closeError}
            <button
              onClick={() => setCloseError(null)}
              className="ml-2 text-red-300 hover:text-red-200 underline"
            >
              dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {lastChecked && positions.length > 0 && (
          <p className="text-[#444] text-[10px] mt-3 text-center">
            Auto-refreshes every 10s · Last: {lastChecked}
          </p>
        )}
      </div>
    </div>
  );
}
