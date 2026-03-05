"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface MarketData {
  yesPrice: number | null;
  noPrice: number | null;
  yesBestBid: number | null;
  yesBestAsk: number | null;
  yesSpread: number | null;
  noBestBid: number | null;
  noBestAsk: number | null;
  noSpread: number | null;
  volume24hr: number | null;
  oneDayPriceChange: number | null;
  lastTradePrice: number | null;
  lastTradeSide: string | null;
}

interface Props {
  refreshMs?: number;
  onData?: (data: MarketData) => void;
}

const MARKET_URL = "https://polymarket.com/event/will-the-iranian-regime-fall-by-june-30";
const PORTFOLIO_URL = "https://polymarket.com/portfolio?address=0x6CcBdc898016F2E49ada47496696d635b8D4fB31";

function cents(v: number | null): string {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "¢";
}

function pct(v: number | null): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return sign + (v * 100).toFixed(1) + "%";
}

export default function TradingHeader({ refreshMs = 1000, onData }: Props) {
  const [data, setData] = useState<MarketData | null>(null);
  const [flash, setFlash] = useState(false);
  const prevYes = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/polymarket-live", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.market) {
        const m = json.market;
        const newData: MarketData = {
          yesPrice: m.yesPrice ?? null,
          noPrice: m.noPrice ?? null,
          yesBestBid: m.yesBestBid ?? null,
          yesBestAsk: m.yesBestAsk ?? null,
          yesSpread: m.yesSpread ?? null,
          noBestBid: m.noBestBid ?? null,
          noBestAsk: m.noBestAsk ?? null,
          noSpread: m.noSpread ?? null,
          volume24hr: m.volume24hr ?? null,
          oneDayPriceChange: m.oneDayPriceChange ?? null,
          lastTradePrice: m.lastTradePrice ?? null,
          lastTradeSide: m.lastTradeSide ?? null,
        };
        setData(newData);
        onData?.(newData);

        // Flash on price change
        if (prevYes.current !== null && newData.yesPrice !== prevYes.current) {
          setFlash(true);
          setTimeout(() => setFlash(false), 600);
        }
        prevYes.current = newData.yesPrice;
      }
    } catch {}
  }, [onData]);

  const ref = useRef(fetchData);
  ref.current = fetchData;

  useEffect(() => {
    ref.current();
    const id = setInterval(() => ref.current(), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  const changeColor =
    data?.oneDayPriceChange != null
      ? data.oneDayPriceChange >= 0
        ? "text-[#00ff88]"
        : "text-red-400"
      : "text-[#888]";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
      {/* Title bar */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <a
              href={MARKET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-semibold text-base hover:text-[#00ff88] transition-colors inline-flex items-center gap-2"
            >
              Will the Iranian regime fall by June 30?
              <svg className="w-3.5 h-3.5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-[#666]">Polymarket Binary</span>
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
              >
                View Portfolio
              </a>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold mono ${flash ? "ticker-flash" : ""}`}>
              <span className="text-[#00ff88]">{cents(data?.yesPrice ?? null)}</span>
              <span className="text-[#555] mx-1">/</span>
              <span className="text-red-400">{cents(data?.noPrice ?? null)}</span>
            </div>
            <div className={`text-xs mono ${changeColor}`}>
              {pct(data?.oneDayPriceChange ?? null)} 24h
            </div>
          </div>
        </div>
      </div>

      {/* Market data grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/5">
        {/* YES Bid/Ask */}
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-[#666] font-medium mb-1">YES Bid / Ask</div>
          <div className="text-sm font-semibold mono text-[#00ff88]">
            {cents(data?.yesBestBid ?? null)} / {cents(data?.yesBestAsk ?? null)}
          </div>
          <div className="text-[10px] text-[#555] mono mt-0.5">
            spread: {data?.yesSpread != null ? (data.yesSpread * 100).toFixed(1) + "¢" : "—"}
          </div>
        </div>

        {/* NO Bid/Ask */}
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-[#666] font-medium mb-1">NO Bid / Ask</div>
          <div className="text-sm font-semibold mono text-red-400">
            {cents(data?.noBestBid ?? null)} / {cents(data?.noBestAsk ?? null)}
          </div>
          <div className="text-[10px] text-[#555] mono mt-0.5">
            spread: {data?.noSpread != null ? (data.noSpread * 100).toFixed(1) + "¢" : "—"}
          </div>
        </div>

        {/* Volume */}
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-[#666] font-medium mb-1">24h Volume</div>
          <div className="text-sm font-semibold mono text-white">
            {data?.volume24hr != null ? "$" + data.volume24hr.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
          </div>
        </div>

        {/* Last Trade */}
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-[#666] font-medium mb-1">Last Trade</div>
          <div className="text-sm font-semibold mono text-white">
            {cents(data?.lastTradePrice ?? null)}
            {data?.lastTradeSide && (
              <span className={`ml-1 text-[10px] ${data.lastTradeSide === "BUY" ? "text-[#00ff88]" : "text-red-400"}`}>
                {data.lastTradeSide}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
