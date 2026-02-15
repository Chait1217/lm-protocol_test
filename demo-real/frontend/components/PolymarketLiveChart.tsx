"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  ExternalLink,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111111] border border-emerald-500/30 rounded-lg px-3 py-2 shadow-glow">
        <p className="text-emerald-400 font-semibold text-sm">
          {payload[0].value.toFixed(1)}%
        </p>
        <p className="text-gray-400 text-xs">{label}</p>
      </div>
    );
  }
  return null;
}

// Animated number
function AnimatedValue({
  value,
  format,
  className,
  prefix = "",
  suffix = "",
}: {
  value: any;
  format?: (v: any) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isChanging, setIsChanging] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current && value !== null) {
      setIsChanging(true);
      setDisplayValue(value);
      prevValue.current = value;
      const timer = setTimeout(() => setIsChanging(false), 500);
      return () => clearTimeout(timer);
    }
  }, [value]);

  if (value === null || value === undefined)
    return <span className={className}>N/A</span>;

  return (
    <motion.span
      className={`${className} ${isChanging ? "text-neon" : ""}`}
      animate={isChanging ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {prefix}
      {format ? format(displayValue) : displayValue}
      {suffix}
    </motion.span>
  );
}

interface MarketData {
  title: string;
  slug: string | null;
  probability: number | null;
  volume: number;
  volume24h: number;
  liquidity: number;
  lastPrice: number;
  clobTokenIds: string[];
  oneDayPriceChange: number;
  yesPriceCents: number | null;
  noPriceCents: number | null;
}

interface ChartPoint {
  probability: number;
  date: string;
  time: string;
  timestamp: number;
}

const POLYMARKET_BASE = "https://polymarket.com";

export default function PolymarketLiveChart({
  settlementDate = "Dec 31, 2026",
  refreshInterval = 2000,
}: {
  settlementDate?: string;
  refreshInterval?: number;
}) {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [priceHistory, setPriceHistory] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState(0);
  const prevProbability = useRef<number | null>(null);
  const chartUpdateCount = useRef(0);

  const parseMarketData = (m: any): MarketData => {
    try {
      let outcomePrices: number[] = [];
      try {
        if (typeof m?.outcomePrices === "string") outcomePrices = JSON.parse(m.outcomePrices);
        else if (Array.isArray(m?.outcomePrices)) outcomePrices = m.outcomePrices;
      } catch {
        outcomePrices = [];
      }

      const yesPrice = outcomePrices[0] != null ? parseFloat(String(outcomePrices[0])) : null;
      let probability: number | null = null;
      if (yesPrice != null && yesPrice > 0 && yesPrice <= 1) {
        probability = Math.round(yesPrice * 1000) / 10;
      } else if (m?.lastTradePrice != null && parseFloat(String(m.lastTradePrice)) <= 1) {
        probability = Math.round(parseFloat(String(m.lastTradePrice)) * 1000) / 10;
      }

      let clobTokenIds: string[] = [];
      try {
        if (typeof m?.clobTokenIds === "string") clobTokenIds = JSON.parse(m.clobTokenIds);
        else if (Array.isArray(m?.clobTokenIds)) clobTokenIds = m.clobTokenIds;
      } catch {
        clobTokenIds = [];
      }

      const noPrice = outcomePrices[1] != null ? parseFloat(String(outcomePrices[1])) : yesPrice != null ? 1 - yesPrice : null;
      return {
        title: m?.question || "Will Bitcoin reach $100,000 by December 31, 2026?",
        slug: m?.slug ?? null,
        probability,
        volume: parseFloat(m?.volume) || parseFloat(m?.volumeNum) || 0,
        volume24h: parseFloat(m?.volume24hr) || 0,
        liquidity: parseFloat(m?.liquidity) || 0,
        lastPrice: yesPrice ?? (parseFloat(String(m?.lastTradePrice)) || 0.41),
        clobTokenIds,
        oneDayPriceChange: parseFloat(m?.oneDayPriceChange) || 0,
        yesPriceCents: yesPrice != null ? Math.round(yesPrice * 1000) / 10 : null,
        noPriceCents: noPrice != null ? Math.round(noPrice * 1000) / 10 : null,
      };
    } catch {
      return {
        title: "Will Bitcoin reach $100,000 by December 31, 2026?",
        slug: null,
        probability: null,
        volume: 0,
        volume24h: 0,
        liquidity: 0,
        lastPrice: 0.41,
        clobTokenIds: [],
        oneDayPriceChange: 0,
        yesPriceCents: null,
        noPriceCents: null,
      };
    }
  };

  const fetchPriceHistory = useCallback(async (tokenId: string) => {
    if (!tokenId) return null;
    try {
      const response = await fetch(
        `https://clob.polymarket.com/prices-history?market=${tokenId}&tokenId=${tokenId}&interval=1d&fidelity=60`
      );
      if (!response.ok) return null;
      const data = await response.json();
      const history = data.history || data || [];
      if (!Array.isArray(history) || history.length === 0) return null;

      const sorted = [...history].sort((a: any, b: any) => (a.t || 0) - (b.t || 0));
      return sorted.map((point: any) => {
        const p = point.p != null ? point.p : point.price;
        const prob = typeof p === "number" ? (p <= 1 ? p * 100 : p) : 0;
        const timestamp = point.t ? new Date(point.t * 1000) : new Date();
        return {
          probability: Math.round(prob * 10) / 10,
          date: timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          time: timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          timestamp: point.t || Date.now() / 1000,
        };
      });
    } catch {
      return null;
    }
  }, []);

  const fetchMarket = useCallback(async (retryCount = 0): Promise<MarketData | null> => {
    try {
      const response = await fetch(`/api/polymarket-live?t=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!response.ok) {
        if (retryCount < 3) {
          await new Promise((r) => setTimeout(r, 1000));
          return fetchMarket(retryCount + 1);
        }
        throw new Error(`Server error: ${response.status}`);
      }
      const result = await response.json();
      if (result.success && result.market) {
        setDataSource("live");
        setError(null);
        return parseMarketData(result.market);
      }
      throw new Error(result.error || "Failed to fetch");
    } catch (err: any) {
      if (retryCount < 3) {
        await new Promise((r) => setTimeout(r, 1000));
        return fetchMarket(retryCount + 1);
      }
      setError(err.message);
      setDataSource("fallback");
      return null;
    }
  }, []);

  const loadAllData = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setIsRefreshing(true);
      try {
        const marketData = await fetchMarket();
        if (marketData) {
          if (prevProbability.current !== null && marketData.probability !== null) {
            setPriceChange(marketData.probability - prevProbability.current);
          }
          prevProbability.current = marketData.probability;
          setMarket(marketData);

          if (marketData.probability !== null) {
            setError(null);
            const now = new Date();
            const newPoint: ChartPoint = {
              probability: marketData.probability,
              date: now.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
              timestamp: Date.now() / 1000,
            };
            setPriceHistory((prev) => {
              if (prev.length > 0) return [...prev, newPoint].slice(-100);
              return [newPoint];
            });
          }

          chartUpdateCount.current++;
          if (chartUpdateCount.current % 5 === 1 && marketData.clobTokenIds?.length > 0) {
            const history = await fetchPriceHistory(marketData.clobTokenIds[0]);
            if (history && history.length > 0) setPriceHistory(history);
          }
          setLastUpdate(new Date());
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [fetchMarket, fetchPriceHistory]
  );

  const loadAllDataRef = useRef(loadAllData);
  loadAllDataRef.current = loadAllData;
  useEffect(() => {
    loadAllDataRef.current();
    const interval = setInterval(() => loadAllDataRef.current(false), refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const marketKey = `${market?.probability ?? ""}-${market?.yesPriceCents ?? ""}-${market?.noPriceCents ?? ""}`;

  const formatVolume = (v: number) => {
    if (v === null || v === undefined || isNaN(v)) return "N/A";
    if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${Math.round(v).toLocaleString()}`;
  };

  const chartData = useMemo(() => {
    if (priceHistory.length > 0) return priceHistory;
    const prob = market?.probability || 41;
    const now = new Date();
    const data: ChartPoint[] = [];
    for (let i = 50; i >= 0; i--) {
      const variation = Math.sin(i / 5) * 1 + (Math.random() - 0.5) * 0.5;
      const value = Math.max(0, Math.min(100, prob + variation));
      const datePoint = new Date(now.getTime() - i * 30 * 60 * 1000);
      data.push({
        probability: Math.round(value * 10) / 10,
        date: datePoint.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        time: datePoint.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        timestamp: datePoint.getTime() / 1000,
      });
    }
    return data;
  }, [priceHistory, market?.probability]);

  if (loading) {
    return (
      <div className="rounded-xl border border-neon/20 bg-gradient-to-br from-gray-900 to-black p-4">
        <div className="flex items-center justify-center py-10">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <RefreshCw className="w-6 h-6 text-neon" />
          </motion.div>
          <span className="ml-3 text-gray-400 text-sm">Loading live market data...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border border-neon/20 bg-gradient-to-br from-gray-900 to-black overflow-hidden shadow-[0_0_40px_rgba(57,255,20,0.06)]"
    >
      {/* Compact header row */}
      <div className="px-3 py-2 border-b border-neon/10 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded-full text-[0.55rem] bg-neon/15 text-neon border border-neon/40 uppercase tracking-widest font-semibold flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-neon animate-pulse" />
            {dataSource === "live" ? "LIVE" : "PM"}
          </span>
          <AnimatedValue value={market?.probability} className="text-lg font-extrabold text-neon leading-none" suffix="%" />
          <AnimatePresence>
            {priceChange !== 0 && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className={`flex items-center gap-0.5 text-[10px] font-semibold ${priceChange > 0 ? "text-green-400" : "text-red-400"}`}>
                {priceChange > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {Math.abs(priceChange).toFixed(1)}
              </motion.span>
            )}
          </AnimatePresence>
          <div className="w-px h-3.5 bg-gray-700" />
          <div key={marketKey} className="flex gap-2.5">
            <span className="text-[10px] text-gray-500">YES <AnimatedValue value={market?.yesPriceCents} className="text-neon font-mono font-bold text-[11px]" suffix="¢" /></span>
            <span className="text-[10px] text-gray-500">NO <AnimatedValue value={market?.noPriceCents} className="text-red-400 font-mono font-bold text-[11px]" suffix="¢" /></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-gray-500">Vol <AnimatedValue value={market?.volume24h ?? market?.volume} format={formatVolume} className="text-white font-bold text-[10px]" /></span>
          <span className="text-[9px] text-gray-500">Liq <AnimatedValue value={market?.liquidity} format={formatVolume} className="text-white font-bold text-[10px]" /></span>
          <button onClick={() => loadAllData(true)} disabled={isRefreshing} className="p-1 rounded hover:bg-neon/10 transition-colors disabled:opacity-50">
            <motion.div animate={isRefreshing ? { rotate: 360 } : {}} transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}>
              <RefreshCw className="w-3 h-3 text-neon" />
            </motion.div>
          </button>
          <a href={market?.slug ? `${POLYMARKET_BASE}/market/${market.slug}` : `${POLYMARKET_BASE}/event/what-price-will-bitcoin-hit-before-2027`}
            target="_blank" rel="noopener noreferrer" className="text-[9px] text-gray-400 hover:text-neon transition-colors">
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {error && dataSource !== "live" && (
        <div className="mx-3 mt-1.5 p-1.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px]">
          Could not fetch live data. Try refreshing.
        </div>
      )}

      {/* Chart */}
      <div className="px-3 py-2">
        <div className="h-32 sm:h-36 md:h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 15 }}>
              <defs>
                <linearGradient id="colorProbLiveNext" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#39FF14" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#39FF14" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                stroke="#444"
                tick={{ fill: "#888", fontSize: 9 }}
                axisLine={{ stroke: "#333" }}
                tickLine={{ stroke: "#333" }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#444"
                tick={{ fill: "#888", fontSize: 9 }}
                axisLine={{ stroke: "#333" }}
                tickLine={{ stroke: "#333" }}
                domain={[0, Math.max(50, Math.min(100, Math.ceil((market?.probability || 41) * 1.5)))]}
                tickFormatter={(v) => `${v}%`}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="probability"
                stroke="#39FF14"
                strokeWidth={2}
                fill="url(#colorProbLiveNext)"
                dot={false}
                activeDot={{ r: 4, fill: "#39FF14", stroke: "#000", strokeWidth: 2 }}
                isAnimationActive={true}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-1 pt-1 border-t border-neon/10 flex items-center justify-between">
          <p className="text-[9px] text-gray-500 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-neon animate-pulse" />
            Live · {refreshInterval / 1000}s
          </p>
          {lastUpdate && <p className="text-[9px] text-gray-500 font-mono">{lastUpdate.toLocaleTimeString()}</p>}
        </div>
      </div>
    </motion.div>
  );
}
