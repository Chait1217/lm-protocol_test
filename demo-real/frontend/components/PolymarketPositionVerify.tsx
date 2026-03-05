"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Position {
  market: string;
  slug: string;
  outcome: string;
  size: string;
  avgPrice: string;
  currentPrice: string;
  currentValue: string;
  cost: string;
  pnl: string;
  pnlPct: string;
  asset: string;
  conditionId: string;
  negRisk: boolean;
}

export default function PolymarketPositionVerify() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingAsset, setClosingAsset] = useState<string | null>(null);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch("/api/polymarket-positions", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && data.positions) {
        setPositions(data.positions);
        setError(null);
      } else {
        setError(data.error || "Failed to fetch positions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
    setLoading(false);
  }, []);

  const ref = useRef(fetchPositions);
  ref.current = fetchPositions;

  useEffect(() => {
    ref.current();
    const id = setInterval(() => ref.current(), 5000); // refresh every 5s
    return () => clearInterval(id);
  }, []);

  const closePosition = useCallback(async (pos: Position) => {
    setClosingAsset(pos.asset);
    setCloseMsg(null);
    try {
      const res = await fetch("/api/polymarket-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: pos.asset,
          size: pos.size,
          side: pos.outcome.toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Close failed");
      }
      setCloseMsg(`Closed via ${data.method}: sold ${data.sharesSold} shares at ${data.sellPrice}`);
      // Refresh positions after a short delay
      setTimeout(() => {
        ref.current();
        setCloseMsg(null);
      }, 3000);
    } catch (err) {
      setCloseMsg(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    }
    setClosingAsset(null);
  }, []);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-[#a78bfa]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Open Positions
        </h3>
        <button onClick={() => { setLoading(true); ref.current(); }} className="text-[10px] text-[#00ff88] hover:text-[#33ffaa] font-medium transition-colors">
          Refresh
        </button>
      </div>

      <div className="p-5">
        {loading && positions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-[#666] text-sm">
              <div className="spinner" />
              Loading positions...
            </div>
          </div>
        ) : error && positions.length === 0 ? (
          <div className="text-center py-8 text-red-400 text-xs">{error}</div>
        ) : positions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-[#555] text-sm">No open positions</div>
            <div className="text-[#444] text-xs mt-1">Place a trade to see positions here</div>
          </div>
        ) : (
          <div className="space-y-3">
            {positions.map((pos, i) => {
              const pnl = parseFloat(pos.pnl);
              const pnlPct = parseFloat(pos.pnlPct);
              const isPositive = pnl >= 0;
              const isClosing = closingAsset === pos.asset;

              return (
                <div key={pos.asset + i} className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                  {/* Market name */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{pos.market}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          pos.outcome.toLowerCase() === "yes"
                            ? "bg-[#00ff88]/10 text-[#00ff88]"
                            : "bg-red-500/10 text-red-400"
                        }`}>
                          {pos.outcome.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-[#666] mono">{parseFloat(pos.size).toFixed(2)} shares</span>
                      </div>
                    </div>
                    {/* PnL */}
                    <div className="text-right ml-3">
                      <div className={`text-sm font-bold mono ${isPositive ? "text-[#00ff88]" : "text-red-400"}`}>
                        {isPositive ? "+" : ""}{pnl.toFixed(4)}
                      </div>
                      <div className={`text-[10px] mono ${isPositive ? "text-[#00ff88]/70" : "text-red-400/70"}`}>
                        {isPositive ? "+" : ""}{pnlPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Price details */}
                  <div className="grid grid-cols-3 gap-2 text-[10px] mb-3">
                    <div>
                      <div className="text-[#555]">Avg Entry</div>
                      <div className="text-white mono font-medium">{(parseFloat(pos.avgPrice) * 100).toFixed(1)}¢</div>
                    </div>
                    <div>
                      <div className="text-[#555]">Current</div>
                      <div className="text-white mono font-medium">{(parseFloat(pos.currentPrice) * 100).toFixed(1)}¢</div>
                    </div>
                    <div>
                      <div className="text-[#555]">Value</div>
                      <div className="text-white mono font-medium">${parseFloat(pos.currentValue).toFixed(4)}</div>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => closePosition(pos)}
                    disabled={isClosing}
                    className="w-full py-2 rounded-lg text-[11px] font-semibold transition-all bg-red-500/8 text-red-400 border border-red-500/20 hover:bg-red-500/15 hover:border-red-500/30 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isClosing ? (<><div className="spinner-sm" /> Closing...</>) : "Close Position"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Close message */}
        {closeMsg && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs border ${
            closeMsg.startsWith("Error") ? "bg-red-500/5 border-red-500/20 text-red-400" : "bg-[#00ff88]/5 border-[#00ff88]/20 text-[#00ff88]"
          }`}>
            {closeMsg}
          </div>
        )}
      </div>
    </div>
  );
}
