"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Target } from "lucide-react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { polygon } from "wagmi/chains";
import {
  getContractAddresses,
  MARGIN_ENGINE_ABI,
} from "@/lib/contracts";
import { formatUSDC } from "@/lib/utils";
import LivePositionTracker from "@/components/LivePositionTracker";
import RealPolymarketClose from "@/components/RealPolymarketClose";
import { useRiskMonitor, type RiskMonitorPosition } from "@/hooks/useRiskMonitor";

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
  marketId: `0x${string}`;
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
      title: m?.question || "Will the Iranian regime fall by June 30?",
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
      title: "Will the Iranian regime fall by June 30?",
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

function toRiskPosition(entry: { id: bigint; pos: PositionData }, clobTokenIds: string[]): RiskMonitorPosition {
  const pos = entry.pos;
  const notional = Number(pos.notional) / 1e6;
  const entryPrice = Number(pos.entryPriceMock) / 1e6 || 0.01;
  const tokenBalance = entryPrice > 0 ? notional / entryPrice : 0;
  const tokenId = pos.isLong ? (clobTokenIds[0] ?? "") : (clobTokenIds[1] ?? "");
  return {
    id: Number(entry.id),
    tokenId,
    tokenBalance,
    collateral: Number(pos.collateral) / 1e6,
    borrowed: Number(pos.borrowed) / 1e6,
    entryPrice,
    isYes: pos.isLong,
    openedAt: Number(pos.openTimestamp),
  };
}

/* ────────────────────────────────────────────────────────────────── */

export default function PositionsPanel({
  refreshTrigger,
  onVaultRefetch,
}: {
  refreshTrigger?: number;
  onVaultRefetch?: () => void;
}) {
  const { address, isConnected } = useAccount();

  // ─── Market data (for live tracker + close) ────────────────────
  const [market, setMarket] = useState<MarketData | null>(null);

  const SLUG = "will-the-iranian-regime-fall-by-june-30";
  const fetchMarket = useCallback(async () => {
    try {
      let m: Record<string, unknown> | null = null;
      const res = await fetch(`/api/polymarket-live?t=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const j = await res.json();
        if (j.success && j.market) m = j.market;
      }
      if (!m) {
        const fallback = await fetch(`/api/gamma/markets/slug/${encodeURIComponent(SLUG)}?t=${Date.now()}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (fallback.ok) {
          const data = await fallback.json();
          m = Array.isArray(data) ? data[0] : data;
        }
      }
      if (m && typeof m === "object") setMarket(parseMarketData(m));
    } catch { /* ignore */ }
  }, []);

  const fetchRef = useRef(fetchMarket);
  fetchRef.current = fetchMarket;

  // ─── Position contract reads (Polygon chain) ────────

  const { data: userPositionIdsRaw, refetch: refetchUserPositions } = useReadContract({
    address: addresses.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: "getUserPositions",
    args: address ? [address] : undefined,
    chainId: polygon.id,
    query: { refetchInterval: 8000 },
  });

  const userPositionIds = (userPositionIdsRaw as bigint[] | undefined) ?? [];
  const recentPositionIds = [...userPositionIds].reverse().slice(0, 10);

  const { data: positionsListData, refetch: refetchPositionsList } = useReadContracts({
    contracts: recentPositionIds.map((id) => ({
      address: addresses.marginEngine,
      abi: MARGIN_ENGINE_ABI,
      functionName: "getPosition" as const,
      args: [id],
      chainId: polygon.id,
    })),
  });

  const positionsList = (positionsListData ?? []).map((r) => r.result as PositionData | undefined);
  const openPositionEntries = recentPositionIds
    .map((id, idx) => ({ id, pos: positionsList[idx] }))
    .filter((entry): entry is { id: bigint; pos: PositionData } => entry.pos != null && entry.pos.isOpen);

  const riskMonitorPositions = useMemo(
    () => openPositionEntries.map((e) => toRiskPosition(e, market?.clobTokenIds ?? [])).filter((p) => p.tokenId),
    [openPositionEntries, market?.clobTokenIds]
  );
  const { riskStatuses } = useRiskMonitor(riskMonitorPositions, 10000);

  const openIds = useMemo(() => new Set(openPositionEntries.map((e) => Number(e.id))), [openPositionEntries]);
  const firstOpenId = openPositionEntries.length > 0 ? Number(openPositionEntries[0].id) : null;

  // ─── Active position ──────────────────────────────────────────
  const [activePositionId, setActivePositionId] = useState<number | null>(null);
  const prevPositionCountRef = useRef(userPositionIds.length);

  // When user has open positions, auto-select the most recent so live tracking is visible
  useEffect(() => {
    if (firstOpenId !== null && (activePositionId === null || !openIds.has(activePositionId))) {
      setActivePositionId(firstOpenId);
    }
  }, [firstOpenId, activePositionId, openIds]);

  useEffect(() => {
    if (activePositionId !== null && !openIds.has(activePositionId)) {
      setActivePositionId(null);
    }
  }, [activePositionId, openIds]);

  // Live price polling: faster when tracking a position
  const pollIntervalMs = activePositionId !== null ? 2000 : 5000;
  useEffect(() => {
    fetchRef.current();
    const id = setInterval(() => fetchRef.current(), pollIntervalMs);
    return () => clearInterval(id);
  }, [pollIntervalMs]);

  const { data: positionData, refetch: refetchPosition } = useReadContract({
    address: addresses.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: "getPosition",
    args: activePositionId !== null ? [BigInt(activePositionId)] : undefined,
    chainId: polygon.id,
    query: { refetchInterval: activePositionId !== null ? 5000 : undefined },
  });

  const position = positionData as PositionData | undefined;

  // ─── Auto-select newest position when a new one appears ───────
  useEffect(() => {
    const count = userPositionIds.length;
    if (count > prevPositionCountRef.current && count > 0) {
      const newestId = Number(userPositionIds[count - 1]);
      setActivePositionId(newestId);
    }
    prevPositionCountRef.current = count;
  }, [userPositionIds]);

  // ─── Refetch when parent signals a new trade ──────────────────
  useEffect(() => {
    if (refreshTrigger != null && refreshTrigger > 0) {
      const doRefetch = () => {
        refetchUserPositions();
        refetchPositionsList();
        if (activePositionId !== null) refetchPosition();
      };
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

  if (!isConnected) return null;

  return (
    <div className="glass-card rounded-xl border border-emerald-500/20 shadow-glow p-2.5 mt-2">
      {/* ── Open positions only ── */}
      <h4 className="text-white font-semibold text-[10px] mb-1.5 flex items-center gap-1">
        <Target className="w-2.5 h-2.5 text-emerald-400" />
        Open positions
      </h4>
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {openPositionEntries.length === 0 ? (
          <div className="text-[10px] py-2 space-y-2">
            <p className="text-gray-500">No open positions</p>
            <p className="text-gray-500 border-t border-gray-800/50 pt-2">
              To close a position: it will appear here once the vault leg has opened. Click &quot;Track &amp; close&quot; then &quot;Sell on Polymarket → Close vault position&quot;.
            </p>
            <p className="text-amber-400/90">
              <strong>Don’t see your trade on Polymarket?</strong> Connect the <strong>same wallet</strong> on <strong>Polygon</strong> at{" "}
              <a href="https://polymarket.com/portfolio" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">polymarket.com/portfolio</a>
              {" "}or the market page. Orders placed here use that wallet; outcome tokens live in it.
            </p>
            <p className="text-gray-500 border-t border-gray-800/50 pt-2">
              <strong>No position here or on Polymarket?</strong> This app only lists positions where the <strong>vault leg</strong> opened. If only the Polymarket order filled, you won’t see anything here. To see every token move (USDC.e, outcome tokens), check{" "}
              {address && (
                <a
                  href={`https://polygonscan.com/address/${address}#tokentxns`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  Polygonscan → Token transfers
                </a>
              )}
              {!address && "Polygonscan → Token transfers for your wallet."}
            </p>
          </div>
        ) : (
          openPositionEntries.map(({ id, pos }) => {
            const isSelected = activePositionId === Number(id);
            const riskStatus = riskStatuses.get(Number(id));
            return (
              <div key={id.toString()} className="space-y-1">
                <div
                  className={`rounded border p-1.5 text-[10px] ${
                    isSelected ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/20" : "border-emerald-500/30 bg-emerald-500/5"
                  } ${riskStatus?.isLiquidatable ? "border-red-500/50 bg-red-500/10" : ""}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-semibold text-white text-[10px]">
                      #{id.toString()} {pos.isLong ? <span className="text-green-400">YES</span> : <span className="text-red-400">NO</span>} @ ${(Number(pos.entryPriceMock) / 1e6).toFixed(3)}
                    </span>
                    <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                      {riskStatus != null && (
                        <>
                          <span className={riskStatus.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                            {riskStatus.pnl >= 0 ? "+" : ""}{riskStatus.pnl.toFixed(2)} ({riskStatus.pnlPercent.toFixed(1)}%)
                          </span>
                          <span className={riskStatus.healthFactor < 1.5 ? "text-red-400" : "text-gray-400"}>
                            HF: {Number.isFinite(riskStatus.healthFactor) ? riskStatus.healthFactor.toFixed(2) : "—"}
                          </span>
                          {riskStatus.isLiquidatable && (
                            <span className="px-1 py-0.5 rounded text-[8px] font-semibold bg-red-500/30 text-red-400">LIQUIDATABLE</span>
                          )}
                        </>
                      )}
                      <span className="px-1 py-0.5 rounded text-[8px] font-semibold bg-emerald-500/20 text-emerald-400">OPEN</span>
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-400 mt-0.5">
                    Collateral: ${formatUSDC(pos.collateral, 6)} | Borrowed: ${formatUSDC(pos.borrowed, 6)}
                  </div>
                  {!isSelected && (
                    <button type="button" onClick={() => setActivePositionId(Number(id))}
                      className="mt-1 w-full rounded bg-amber-500/20 py-1 text-[9px] font-semibold text-amber-400 hover:bg-amber-500/30 transition">
                      Track & close
                    </button>
                  )}
                  {isSelected && <div className="mt-0.5 text-[8px] text-emerald-400/70 text-center">▼ tracking</div>}
                </div>

                {isSelected && market && (
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
          })
        )}
      </div>

      {activePositionId !== null && position && position.isOpen && (
        <div className="border border-emerald-900/20 rounded p-2 bg-black/30 mt-1.5">
          <h4 className="text-white font-semibold text-[10px] mb-1 flex items-center gap-1">
            <Target className="w-2.5 h-2.5 text-emerald-400" />
            Close #{activePositionId}
          </h4>

          {market ? (
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
          ) : (
            <div className="text-amber-400/90 text-[11px] space-y-1">
              <p>Loading market data for closing…</p>
              <button type="button" onClick={() => fetchRef.current()} className="text-emerald-400 hover:underline">
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
