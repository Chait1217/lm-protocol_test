"use client";

import { DEFAULT_MARKET_SLUG, DEFAULT_MARKET_TITLE } from "@/lib/polymarketConfig";

interface TradingHeaderProps {
  yesProbability: number | null;
  noProbability: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  oneDayChange: number;
  spread: number | null;
  volume24hr: number | null;
  lastTradePrice?: number | null;
  traderWallet?: string;
}

const MARKET_URL = `https://polymarket.com/event/${DEFAULT_MARKET_SLUG}`;

function pct(v: number | null): string {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

function cents(v: number | null): string {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "¢";
}

function fmtVol(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return "$" + (v / 1_000).toFixed(1) + "K";
  return "$" + v.toFixed(0);
}

export default function TradingHeader({
  yesProbability,
  noProbability,
  bestBid,
  bestAsk,
  oneDayChange,
  spread,
  volume24hr,
  lastTradePrice,
  traderWallet,
}: TradingHeaderProps) {
  const changeColor = oneDayChange >= 0 ? "text-[#00ff88]" : "text-red-400";
  const changeSign = oneDayChange >= 0 ? "+" : "";
  const portfolioUrl = traderWallet
    ? `https://polymarket.com/portfolio?address=${traderWallet}`
    : null;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
      {/* Title Row */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
          <a
            href={MARKET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-white hover:text-[#00ff88] transition-colors flex items-center gap-1.5"
          >
            {DEFAULT_MARKET_TITLE}
            <svg className="w-3.5 h-3.5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
        <div className="flex items-center gap-3">
          {portfolioUrl && (
            <a
              href={portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#00ff88] hover:text-[#33ffaa] border border-[#00ff88]/20 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1"
            >
              View on Polymarket
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
          <span className={`text-xs font-semibold mono ${changeColor}`}>
            {changeSign}{(oneDayChange * 100).toFixed(1)}% 24h
          </span>
        </div>
      </div>

      {/* Data Row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-white/5">
        {/* YES Price */}
        <div className="px-4 py-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#666] font-medium mb-0.5">YES</div>
          <div className="text-sm font-bold text-[#00ff88] mono">{pct(yesProbability)}</div>
        </div>

        {/* NO Price */}
        <div className="px-4 py-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#666] font-medium mb-0.5">NO</div>
          <div className="text-sm font-bold text-red-400 mono">{pct(noProbability)}</div>
        </div>

        {/* Best Bid */}
        <div className="px-4 py-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#666] font-medium mb-0.5">Best Bid</div>
          <div className="text-sm font-bold text-white mono">{cents(bestBid)}</div>
        </div>

        {/* Best Ask */}
        <div className="px-4 py-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#666] font-medium mb-0.5">Best Ask</div>
          <div className="text-sm font-bold text-white mono">{cents(bestAsk)}</div>
        </div>

        {/* Spread */}
        <div className="px-4 py-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#666] font-medium mb-0.5">Spread</div>
          <div className="text-sm font-bold text-[#f59e0b] mono">{cents(spread)}</div>
        </div>

        {/* Volume */}
        <div className="px-4 py-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#666] font-medium mb-0.5">24h Vol</div>
          <div className="text-sm font-bold text-white mono">{fmtVol(volume24hr)}</div>
        </div>
      </div>
    </div>
  );
}
