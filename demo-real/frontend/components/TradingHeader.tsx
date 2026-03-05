"use client";

interface TradingHeaderProps {
  yesProbability: number | null;
  noProbability: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  oneDayChange: number;
  spread: number | null;
  volume24hr?: number | null;
}

const POLYMARKET_URL = "https://polymarket.com/event/will-the-iranian-regime-fall-by-june-30";

export default function TradingHeader({
  yesProbability,
  noProbability,
  bestBid,
  bestAsk,
  oneDayChange,
  spread,
  volume24hr,
}: TradingHeaderProps) {
  const changeColor = oneDayChange >= 0 ? "text-[#00ff88]" : "text-red-400";
  const changePrefix = oneDayChange >= 0 ? "+" : "";

  return (
    <div className="border-b border-white/5 bg-[#050505]/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-4">
        {/* Market Title + Link */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <a
            href={POLYMARKET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-bold text-white tracking-tight hover:text-[#00ff88] transition-colors inline-flex items-center gap-2"
          >
            Will the Iranian regime fall by June 30?
            <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <div className="flex items-center gap-2">
            <span className="tag-neon text-[10px]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse-neon" />
              LIVE
            </span>
            {volume24hr != null && (
              <span className="text-[10px] text-[#666] uppercase tracking-wider font-medium">
                24h Vol: ${(volume24hr / 1000).toFixed(0)}K
              </span>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap gap-6 sm:gap-8">
          {/* YES Price */}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1 font-medium">Yes</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#00ff88] mono">
                {yesProbability != null ? `${yesProbability}%` : "—"}
              </span>
              {oneDayChange !== 0 && (
                <span className={`text-xs font-medium mono ${changeColor}`}>
                  {changePrefix}{(oneDayChange * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          {/* NO Price */}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1 font-medium">No</div>
            <span className="text-2xl font-bold text-red-400 mono">
              {noProbability != null ? `${noProbability}%` : "—"}
            </span>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-12 bg-white/5 self-center" />

          {/* Best Bid */}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1 font-medium">Best Bid</div>
            <span className="text-sm font-semibold text-[#ccc] mono">
              {bestBid != null ? `$${bestBid.toFixed(2)}` : "—"}
            </span>
          </div>

          {/* Best Ask */}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1 font-medium">Best Ask</div>
            <span className="text-sm font-semibold text-[#ccc] mono">
              {bestAsk != null ? `$${bestAsk.toFixed(2)}` : "—"}
            </span>
          </div>

          {/* Spread */}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1 font-medium">Spread</div>
            <span className="text-sm font-semibold text-[#ccc] mono">
              {spread != null ? `$${spread.toFixed(3)}` : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
