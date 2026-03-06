"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { placeSignedSellOrder } from "@/lib/polymarketBrowserClient";

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
  const { address, isConnected } = useAccount();

  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingAsset, setClosingAsset] = useState<string | null>(null);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setLoading(false);
      setPositions([]);
      setError(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/polymarket-positions?user=${encodeURIComponent(address)}`,
        { cache: "no-store" }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (data.success && Array.isArray(data.positions)) {
        setPositions(data.positions);
        setError(null);
      } else {
        setPositions([]);
        setError(data.error || "Failed to fetch positions");
      }
    } catch (err) {
      setPositions([]);
      setError(err instanceof Error ? err.message : "Failed");
    }

    setLoading(false);
  }, [address]);

  const ref = useRef(fetchPositions);
  ref.current = fetchPositions;

  useEffect(() => {
    ref.current();
    if (!address) return;
    const id = setInterval(() => ref.current(), 5000);
    return () => clearInterval(id);
  }, [address]);

  const closePosition = useCallback(async (pos: Position) => {
    setClosingAsset(pos.asset);
    setCloseMsg(null);

    try {
      const size = parseFloat(pos.size);
      const referencePrice = parseFloat(pos.currentPrice || "0.5");

      if (!(size > 0)) {
        throw new Error("Position size is zero");
      }

      const result = await placeSignedSellOrder({
        tokenID: pos.asset,
        size,
        referencePrice,
      });

      setCloseMsg(
        `Wallet-signed close submitted: sold ${result.size} shares at ${(
          result.price * 100
        ).toFixed(1)}¢`
      );

      setTimeout(() => {
        ref.current();
        setCloseMsg(null);
      }, 3000);
    } catch (err) {
      setCloseMsg(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    }

    setClosingAsset(null);
  }, []);

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Open Positions</h3>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
          <p className="text-sm text-gray-300">Connect wallet to view positions</p>
          <p className="text-xs text-gray-500 mt-1">
            Your Polymarket positions will appear here once connected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Open Positions</h3>
        <button
          onClick={() => {
            setLoading(true);
            ref.current();
          }}
          className="text-[10px] text-[#00ff88] hover:text-[#33ffaa] font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading && positions.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
          <p className="text-sm text-gray-300">Loading positions...</p>
        </div>
      ) : error && positions.length === 0 ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : positions.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
          <p className="text-sm text-gray-300">No open positions</p>
          <p className="text-xs text-gray-500 mt-1">
            Place a trade to see positions here
          </p>
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
                key={`${pos.asset}-${i}`}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-white">{pos.market}</div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      {pos.outcome.toUpperCase()} · {parseFloat(pos.size).toFixed(2)} shares
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${
                        isPositive ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {pnl.toFixed(4)}
                    </div>
                    <div
                      className={`text-[11px] ${
                        isPositive ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {pnlPct.toFixed(2)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                  <div className="rounded-lg bg-black/20 p-2">
                    <div className="text-gray-500">Avg Entry</div>
                    <div className="text-white mt-1">
                      {(parseFloat(pos.avgPrice) * 100).toFixed(1)}¢
                    </div>
                  </div>

                  <div className="rounded-lg bg-black/20 p-2">
                    <div className="text-gray-500">Current</div>
                    <div className="text-white mt-1">
                      {(parseFloat(pos.currentPrice) * 100).toFixed(1)}¢
                    </div>
                  </div>

                  <div className="rounded-lg bg-black/20 p-2">
                    <div className="text-gray-500">Value</div>
                    <div className="text-white mt-1">
                      ${parseFloat(pos.currentValue).toFixed(4)}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => closePosition(pos)}
                  disabled={isClosing}
                  className="w-full py-2 mt-3 rounded-lg text-[11px] font-semibold transition-all bg-red-500/8 text-red-400 border border-red-500/20 hover:bg-red-500/15 hover:border-red-500/30 disabled:opacity-50"
                >
                  {isClosing ? "Closing..." : "Close Position"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {closeMsg && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-gray-300">
          {closeMsg}
        </div>
      )}
    </div>
  );
}
