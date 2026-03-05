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
    const id = setInterval(() => ref.current(), 5000);
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
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Close failed");
      }
      setCloseMsg(
        `Closed via ${data.method}: sold ${data.sharesSold} shares at ${(parseFloat(String(data.sellPrice)) * 100).toFixed(1)}¢`
      );
      // Refresh positions after delay
      setTimeout(() => {
        ref.current();
        setCloseMsg(null);
      }, 4000);
    } catch (err) {
      setCloseMsg(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    }
    setClosingAsset(null);
  }, []);

  return (
    <div className="rounded-2xl border border-emerald-900/30 bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-emerald-900/20 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Open Positions</h3>
        <button
          onClick={() => {
            setLoading(true);
            ref.current();
          }}
          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="p-5">
        {loading && positions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="spinner" />
              Loading positions...
            </div>
          </div>
        ) : error && positions.length === 0 ? (
          <div className="text-center py-8 text-red-400 text-xs">{error}</div>
        ) : positions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 text-sm">No open positions</div>
            <div className="text-gray-600 text-xs mt-1">
              Place a trade to see positions here
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {positions.map((pos, i) => {
              const pnl = parseFloat(pos.pnl);
              const pnlPct = parseFloat(pos.pnlPct);
              const isPositive = pnl >= 0;
              const isClosing = closingAsset === pos.asset;

              return (
                <div
                  key={pos.asset + i}
                  className="rounded-xl bg-white/[0.02] border border-white/5 p-4"
                >
                  {/* Market name */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {pos.market}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            pos.outcome.toLowerCase() === "yes"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {pos.outcome.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {parseFloat(pos.size).toFixed(2)} shares
                        </span>
                      </div>
                    </div>
                    {/* PnL */}
                    <div className="text-right ml-3">
                      <div
                        className={`text-sm font-bold font-mono ${isPositive ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {isPositive ? "+" : ""}${Math.abs(pnl).toFixed(4)}
                      </div>
                      <div
                        className={`text-[10px] font-mono ${isPositive ? "text-emerald-400/70" : "text-red-400/70"}`}
                      >
                        {isPositive ? "+" : ""}
                        {pnlPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Price details */}
                  <div className="grid grid-cols-3 gap-2 text-[10px] mb-3">
                    <div>
                      <div className="text-gray-600">Avg Entry</div>
                      <div className="text-white font-mono font-medium">
                        {(parseFloat(pos.avgPrice) * 100).toFixed(1)}¢
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">Current</div>
                      <div className="text-white font-mono font-medium">
                        {(parseFloat(pos.currentPrice) * 100).toFixed(1)}¢
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">Value</div>
                      <div className="text-white font-mono font-medium">
                        ${parseFloat(pos.currentValue).toFixed(4)}
                      </div>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => closePosition(pos)}
                    disabled={isClosing}
                    className="w-full py-2 rounded-lg text-[11px] font-semibold transition-all bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isClosing ? (
                      <>
                        <div className="spinner" style={{ width: 14, height: 14 }} />
                        Closing...
                      </>
                    ) : (
                      "Close Position"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Close message */}
        {closeMsg && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-xs border ${
              closeMsg.startsWith("Error")
                ? "bg-red-500/5 border-red-500/20 text-red-400"
                : "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
            }`}
          >
            {closeMsg}
          </div>
        )}
      </div>
    </div>
  );
}
