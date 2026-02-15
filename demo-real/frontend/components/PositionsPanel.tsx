"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Target } from "lucide-react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { base } from "wagmi/chains";
import {
  getContractAddresses,
  MARGIN_ENGINE_ABI,
} from "@/lib/contracts";
import { formatUSDC } from "@/lib/utils";
import LivePositionTracker from "@/components/LivePositionTracker";
import RealPolymarketClose from "@/components/RealPolymarketClose";

/* ────────────────────────────────────────────────────────────────── */

const addresses = getContractAddresses();

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

interface MarketData {
  title: string;
  slug: string | null;
  yesProbability: number | null;
  noProbability: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  clobTokenIds: string[];
  tickSize?: string;
  negRisk?: boolean;
}

function parseMarketData(m: any): MarketData {
  try {
    let outcomePrices: number[] = [];
    try {
      if (typeof m?.outcomePrices === "string") outcomePrices = JSON.parse(m.outcomePrices);
      else if (Array.isArray(m?.outcomePrices)) outcomePrices = m.outcomePrices;
    } catch { outcomePrices = []; }

    const yesPrice = outcomePrices[0] != null ? parseFloat(String(outcomePrices[0])) : null;
    let yesProbability: number | null = null;
    let noProbability: number | null = null;
    if (yesPrice != null && yesPrice > 0 && yesPrice <= 1) {
      yesProbability = Math.round(yesPrice * 1000) / 10;
      noProbability = Math.round((1 - yesPrice) * 1000) / 10;
    }
    let clobTokenIds: string[] = [];
    try {
      if (typeof m?.clobTokenIds === "string") clobTokenIds = JSON.parse(m.clobTokenIds);
      else if (Array.isArray(m?.clobTokenIds)) clobTokenIds = m.clobTokenIds;
    } catch { clobTokenIds = []; }

    return {
      title: m?.question || "Will Bitcoin reach $100,000 by December 31, 2026?",
      slug: m?.slug ?? null,
      yesProbability,
      noProbability,
      bestBid: m?.bestBid != null ? parseFloat(String(m.bestBid)) : null,
      bestAsk: m?.bestAsk != null ? parseFloat(String(m.bestAsk)) : null,
      clobTokenIds,
      tickSize: typeof m?.tickSize === "string" ? m.tickSize : undefined,
      negRisk: typeof m?.negRisk === "boolean" ? m.negRisk : undefined,
    };
  } catch {
    return {
      title: "Will Bitcoin reach $100,000 by December 31, 2026?",
      slug: null,
      yesProbability: null,
      noProbability: null,
      bestBid: null,
      bestAsk: null,
      clobTokenIds: [],
      tickSize: undefined,
      negRisk: undefined,
    };
  }
}

/* ────────────────────────────────────────────────────────────────── */

export default function PositionsPanel({
  refreshTrigger,
  onVaultRefetch,
}: {
  /** Bump this number to trigger a refetch (e.g. after opening a new position) */
  refreshTrigger?: number;
  onVaultRefetch?: () => void;
}) {
  const { address, isConnected } = useAccount();

  // ─── Market data (for live tracker + close) ────────────────────
  const [market, setMarket] = useState<MarketData | null>(null);

  const fetchMarket = useCallback(async () => {
    try {
      const res = await fetch(`/api/polymarket-live?t=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;
      const j = await res.json();
      if (j.success && j.market) setMarket(parseMarketData(j.market));
    } catch { /* ignore */ }
  }, []);

  const fetchRef = useRef(fetchMarket);
  fetchRef.current = fetchMarket;
  useEffect(() => {
    fetchRef.current();
    const id = setInterval(() => fetchRef.current(), 5000);
    return () => clearInterval(id);
  }, []);

  // ─── Position contract reads (always target Base chain) ────────

  const { data: userPositionIdsRaw, refetch: refetchUserPositions } = useReadContract({
    address: addresses.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: "getUserPositions",
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { refetchInterval: 8000 }, // auto-poll every 8s
  });

  const userPositionIds = (userPositionIdsRaw as bigint[] | undefined) ?? [];
  const recentPositionIds = [...userPositionIds].reverse().slice(0, 10);

  const { data: positionsListData, refetch: refetchPositionsList } = useReadContracts({
    contracts: recentPositionIds.map((id) => ({
      address: addresses.marginEngine,
      abi: MARGIN_ENGINE_ABI,
      functionName: "getPosition" as const,
      args: [id],
      chainId: base.id,
    })),
  });

  const positionsList = (positionsListData ?? []).map((r) => r.result as PositionData | undefined);

  // ─── Active position ──────────────────────────────────────────
  const [activePositionId, setActivePositionId] = useState<number | null>(null);
  const prevPositionCountRef = useRef(userPositionIds.length);

  const { data: positionData, refetch: refetchPosition } = useReadContract({
    address: addresses.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: "getPosition",
    args: activePositionId !== null ? [BigInt(activePositionId)] : undefined,
    chainId: base.id,
    query: { refetchInterval: activePositionId !== null ? 5000 : undefined },
  });

  const position = positionData as PositionData | undefined;

  // ─── Auto-select newest position when a new one appears ───────
  useEffect(() => {
    const count = userPositionIds.length;
    if (count > prevPositionCountRef.current && count > 0) {
      // A new position was just added — auto-select it
      const newestId = Number(userPositionIds[count - 1]);
      setActivePositionId(newestId);
    }
    prevPositionCountRef.current = count;
  }, [userPositionIds]);

  // ─── Refetch when parent signals a new trade ──────────────────
  // Retry multiple times with delays to handle RPC propagation lag
  useEffect(() => {
    if (refreshTrigger != null && refreshTrigger > 0) {
      const doRefetch = () => {
        refetchUserPositions();
        refetchPositionsList();
        if (activePositionId !== null) refetchPosition();
      };
      // Immediate + staggered retries to catch the new position
      doRefetch();
      const t1 = setTimeout(doRefetch, 2000);
      const t2 = setTimeout(doRefetch, 5000);
      const t3 = setTimeout(doRefetch, 10000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [refreshTrigger, refetchUserPositions, refetchPositionsList, refetchPosition, activePositionId]);

  // ─── Derived ──────────────────────────────────────────────────
  const entryPriceDecimal =
    market?.bestAsk ?? (market?.yesProbability != null ? market.yesProbability / 100 : 0.41);

  // ─── Render ───────────────────────────────────────────────────

  if (!isConnected || recentPositionIds.length === 0) return null;

  return (
    <div className="glass-card rounded-xl border border-emerald-500/20 shadow-glow p-2.5 mt-2">
      {/* ── Positions list ── */}
      <h4 className="text-white font-semibold text-[10px] mb-1.5 flex items-center gap-1">
        <Target className="w-2.5 h-2.5 text-emerald-400" />
        Positions
      </h4>
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {recentPositionIds.map((id, idx) => {
          const pos = positionsList[idx];
          if (!pos) return <div key={id.toString()} className="text-gray-500 text-[10px]">#{id.toString()} loading…</div>;
          const isOpen = pos.isOpen;
          const isSelected = activePositionId === Number(id);
          return (
            <div key={id.toString()} className="space-y-1">
              {/* Position header card */}
              <div
                className={`rounded border p-1.5 text-[10px] ${
                  isSelected ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/20" :
                  isOpen ? "border-emerald-500/30 bg-emerald-500/5" : "border-gray-800 bg-white/[0.02] opacity-70"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono font-semibold text-white text-[10px]">
                    #{id.toString()} {pos.isLong ? <span className="text-green-400">L</span> : <span className="text-red-400">S</span>} {Number(pos.leverage)}x
                  </span>
                  <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                    <span>${formatUSDC(pos.collateral, 2)} / ${formatUSDC(pos.notional, 2)}</span>
                    <span className={`px-1 py-0.5 rounded text-[8px] font-semibold ${isOpen ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-700 text-gray-400"}`}>
                      {isOpen ? "OPEN" : "CLOSED"}
                    </span>
                  </div>
                </div>
                {isOpen && !isSelected && (
                  <button type="button" onClick={() => setActivePositionId(Number(id))}
                    className="mt-1 w-full rounded bg-amber-500/20 py-1 text-[9px] font-semibold text-amber-400 hover:bg-amber-500/30 transition">
                    Track & close
                  </button>
                )}
                {isSelected && <div className="mt-0.5 text-[8px] text-emerald-400/70 text-center">▼ tracking</div>}
              </div>

              {/* ── Live Tracker (shown for selected open position) ── */}
              {isOpen && isSelected && market && (
                <LivePositionTracker
                  positionId={Number(id)}
                  position={pos}
                  liveBestBid={market.bestBid}
                  liveBestAsk={market.bestAsk}
                  yesProbability={market.yesProbability}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Active Position: Close controls ── */}
      {activePositionId !== null && position && position.isOpen && (
        <div className="border border-emerald-900/20 rounded p-2 bg-black/30 mt-1.5">
          <h4 className="text-white font-semibold text-[10px] mb-1 flex items-center gap-1">
            <Target className="w-2.5 h-2.5 text-emerald-400" />
            Close #{activePositionId}
          </h4>

          {market && (
            <RealPolymarketClose
              positionId={activePositionId}
              position={position}
              livePrice={
                position.isLong
                  ? (market.bestBid ?? (market.yesProbability != null ? market.yesProbability / 100 : entryPriceDecimal))
                  : (market.bestAsk != null ? 1 - market.bestAsk : (market.noProbability != null ? market.noProbability / 100 : entryPriceDecimal))
              }
              clobTokenIds={market.clobTokenIds}
              tickSize={market.tickSize}
              negRisk={market.negRisk}
              marketTitle={market.title}
              onSuccess={() => {
                refetchUserPositions();
                refetchPositionsList();
                refetchPosition();
                onVaultRefetch?.();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
