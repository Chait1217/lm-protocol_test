"use client";

interface TradingHeaderProps {
  yesProbability: number | null;
  noProbability: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  oneDayChange: number;
  spread: number | null;
  volume24hr?: number | null;
  lastTradePrice?: number | null;
  lastTradeSide?: string | null;
}

const POLYMARKET_URL =
  "https://polymarket.com/event/will-the-iranian-regime-fall-by-june-30";
const TRADER_WALLET =
  process.env.NEXT_PUBLIC_TRADER_WALLET ||
  "0x6CcBdc898016F2E49ada47496696d635b8D4fB31";
const PORTFOLIO_URL = `https://polymarket.com/portfolio?address=${TRADER_WALLET}`;

export default function TradingHeader({
  yesProbability,
  noProbability,
  bestBid,
  bestAsk,
  oneDayChange,
  spread,
  volume24hr,
  lastTradePrice,
  lastTradeSide,
}: TradingHeaderProps) {
  const changeColor =
    oneDayChange > 0
      ? "text-emerald-400"
      : oneDayChange < 0
        ? "text-red-400"
        : "text-gray-400";
  const changeSign = oneDayChange > 0 ? "+" : "";

  return (
    <div className="border-b border-emerald-900/30 bg-[#0a0a0a]/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-3">
        {/* Market title + links */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <a
              href={POLYMARKET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-semibold text-sm hover:text-emerald-400 transition-colors"
            >
              Will the Iranian regime fall by June 30?
              <span className="ml-1.5 text-gray-600 text-xs">↗</span>
            </a>
          </div>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-emerald-400 transition-colors"
          >
            View on Polymarket ↗
          </a>
        </div>

        {/* Data grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* YES Price */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
              YES
            </div>
            <div className="text-emerald-400 font-bold text-lg font-mono">
              {yesProbability != null ? `${yesProbability}%` : "—"}
            </div>
          </div>

          {/* NO Price */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
              NO
            </div>
            <div className="text-red-400 font-bold text-lg font-mono">
              {noProbability != null ? `${noProbability}%` : "—"}
            </div>
          </div>

          {/* Best Bid */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
              Best Bid
            </div>
            <div className="text-white font-semibold text-sm font-mono">
              {bestBid != null ? `${(bestBid * 100).toFixed(1)}¢` : "—"}
            </div>
          </div>

          {/* Best Ask */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
              Best Ask
            </div>
            <div className="text-white font-semibold text-sm font-mono">
              {bestAsk != null ? `${(bestAsk * 100).toFixed(1)}¢` : "—"}
            </div>
          </div>

          {/* Spread */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
              Spread
            </div>
            <div className="text-white font-semibold text-sm font-mono">
              {spread != null ? `${(spread * 100).toFixed(1)}¢` : "—"}
            </div>
          </div>

          {/* 24h Change */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
              24h Chg
            </div>
            <div className={`font-semibold text-sm font-mono ${changeColor}`}>
              {changeSign}
              {(oneDayChange * 100).toFixed(1)}%
            </div>
          </div>

          {/* Volume */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
              24h Vol
            </div>
            <div className="text-white font-semibold text-sm font-mono">
              {volume24hr != null
                ? `$${(volume24hr / 1000).toFixed(0)}K`
                : "—"}
            </div>
          </div>

          {/* Last Trade */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
              Last Trade
            </div>
            <div className="text-white font-semibold text-sm font-mono">
              {lastTradePrice != null
                ? `${(lastTradePrice * 100).toFixed(1)}¢`
                : "—"}
              {lastTradeSide && (
                <span
                  className={`ml-1 text-[10px] ${lastTradeSide === "BUY" ? "text-emerald-400" : "text-red-400"}`}
                >
                  {lastTradeSide}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
