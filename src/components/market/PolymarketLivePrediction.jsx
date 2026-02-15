import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Label,
} from "recharts";
import { ExternalLink, RefreshCw, MessageCircle, TrendingUp, TrendingDown } from "lucide-react";

// Custom tooltip for chart
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 border border-[#00FF99]/30 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-[#00FF99] font-semibold text-sm">
          {payload[0].value.toFixed(1)}%
        </p>
        <p className="text-gray-400 text-xs">{label}</p>
      </div>
    );
  }
  return null;
};

// Animated number component for smooth transitions
const AnimatedValue = ({ value, format, className, prefix = "", suffix = "" }) => {
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

  if (value === null || value === undefined) return <span className={className}>N/A</span>;

  return (
    <motion.span
      className={`${className} ${isChanging ? 'text-[#00FF99]' : ''}`}
      animate={isChanging ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {prefix}{format ? format(displayValue) : displayValue}{suffix}
    </motion.span>
  );
};

export default function PolymarketLivePrediction({
  slug = "will-jesus-christ-return-before-2027",
  settlementDate = "Dec 31, 2026",
  refreshInterval = 5000, // 5 seconds for real-time quote updates
}) {
  const [market, setMarket] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const prevProbability = useRef(null);
  const chartUpdateCount = useRef(0);

  // Fetch market data from server-side endpoint (no cache for real-time quotes)
  const fetchMarket = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;

    try {
      const response = await fetch(`/api/polymarket-live?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      
      if (!response.ok) {
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchMarket(retryCount + 1);
        }
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.market) {
        setDataSource('live');
        setError(null);
        return parseMarketData(result.market);
      }
      
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchMarket(retryCount + 1);
      }
      
      throw new Error(result.error || "Failed to fetch market data");
    } catch (err) {
      console.error("[PolymarketLivePrediction] Failed to fetch market:", err);
      
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchMarket(retryCount + 1);
      }
      
      setError(err.message);
      setDataSource('fallback');
      return null;
    }
  }, []);

  // Parse market data from API response
  const parseMarketData = (m) => {
    let outcomePrices = [];
    try {
      if (typeof m.outcomePrices === 'string') {
        outcomePrices = JSON.parse(m.outcomePrices);
      } else if (Array.isArray(m.outcomePrices)) {
        outcomePrices = m.outcomePrices;
      }
    } catch (e) {
      outcomePrices = [];
    }
    
    const yesPrice = outcomePrices[0] ? parseFloat(outcomePrices[0]) : null;
    const noPrice = outcomePrices[1] ? parseFloat(outcomePrices[1]) : (yesPrice != null ? 1 - yesPrice : null);

    let probability;
    if (yesPrice !== null && yesPrice > 0 && yesPrice <= 1) {
      probability = Math.round(yesPrice * 1000) / 10;
    } else if (m.lastTradePrice && parseFloat(m.lastTradePrice) <= 1) {
      probability = Math.round(parseFloat(m.lastTradePrice) * 1000) / 10;
    } else {
      probability = null;
    }

    const totalVolume = parseFloat(m.volume) || parseFloat(m.volumeNum) || parseFloat(m.volumeClob) || 0;
    const volume24h = parseFloat(m.volume24hr) || parseFloat(m.volume24hrClob) || 0;

    let clobTokenIds = [];
    try {
      if (typeof m.clobTokenIds === 'string') {
        clobTokenIds = JSON.parse(m.clobTokenIds);
      } else if (Array.isArray(m.clobTokenIds)) {
        clobTokenIds = m.clobTokenIds;
      }
    } catch (e) {
      clobTokenIds = [];
    }

    return {
      conditionId: m.conditionId || m.id,
      slug: m.slug || slug,
      title: m.question || "Will Jesus Christ return before 2027?",
      probability,
      yesPriceCents: yesPrice != null ? Math.round(yesPrice * 1000) / 10 : null,
      noPriceCents: noPrice != null ? Math.round(noPrice * 1000) / 10 : null,
      volume: totalVolume,
      volume24h,
      liquidity: parseFloat(m.liquidity) || parseFloat(m.liquidityNum) || 0,
      lastPrice: yesPrice || parseFloat(m.lastTradePrice) || 0.04,
      clobTokenIds,
      oneDayPriceChange: parseFloat(m.oneDayPriceChange) || 0,
      oneHourPriceChange: parseFloat(m.oneHourPriceChange) || 0,
    };
  };

  // Fetch price history from CLOB API (works in both dev and production)
  const fetchPriceHistory = useCallback(async (tokenId) => {
    if (!tokenId) return null;
    
    try {
      // This URL works in both dev (via Vite proxy) and production (via Vercel rewrite)
      const response = await fetch(
        `/polymarket-clob/prices-history?market=${tokenId}&tokenId=${tokenId}&interval=1d&fidelity=60`,
        {
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      );

      if (!response.ok) {
        console.warn("Price history response not ok:", response.status);
        return null;
      }

      const data = await response.json();
      const history = data.history || data || [];

      if (!Array.isArray(history) || history.length === 0) {
        console.warn("No price history data received");
        return null;
      }

      console.log("[PriceHistory] Got", history.length, "data points");

      // Sort by timestamp and convert to chart format
      const sorted = [...history].sort((a, b) => (a.t || 0) - (b.t || 0));
      return sorted.map((point) => {
        const p = point.p != null ? point.p : point.price;
        const prob = typeof p === "number" ? (p <= 1 ? p * 100 : p) : 0;
        const timestamp = point.t ? new Date(point.t * 1000) : new Date();
        const dateStr = timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const timeStr = timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        return { 
          probability: Math.round(prob * 10) / 10, 
          date: dateStr,
          time: timeStr,
          timestamp: point.t || Date.now() / 1000,
        };
      });
    } catch (e) {
      console.warn("Price history fetch failed:", e.message);
      return null;
    }
  }, []);

  // Load all data
  const loadAllData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);

    try {
      const marketData = await fetchMarket();
      
      if (marketData) {
        // Track price change
        if (prevProbability.current !== null && marketData.probability !== null) {
          const change = marketData.probability - prevProbability.current;
          setPriceChange(change);
        }
        prevProbability.current = marketData.probability;
        
        setMarket(marketData);
        
        if (marketData.probability !== null) {
          setError(null);
        }

        // Add current price to chart data for real-time updates
        if (marketData.probability !== null) {
          const now = new Date();
          const newPoint = {
            probability: marketData.probability,
            date: now.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
            timestamp: Date.now() / 1000,
          };
          
          setPriceHistory(prev => {
            // If we have history, append the new point
            if (prev && prev.length > 0) {
              // Keep last 100 points for performance
              const updated = [...prev, newPoint].slice(-100);
              return updated;
            }
            return [newPoint];
          });
        }

        // Fetch full price history every 5 updates (50 seconds) to sync with Polymarket
        chartUpdateCount.current++;
        if (chartUpdateCount.current % 5 === 1 && marketData.clobTokenIds && marketData.clobTokenIds.length > 0) {
          const history = await fetchPriceHistory(marketData.clobTokenIds[0]);
          if (history && history.length > 0) {
            setPriceHistory(history);
          }
        }

        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error("Failed to load data:", e);
      setError(e.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchMarket, fetchPriceHistory]);

  // Initial load and real-time polling
  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => loadAllData(false), refreshInterval);
    return () => clearInterval(interval);
  }, [loadAllData, refreshInterval]);

  // Format helpers
  const formatVolume = (v) => {
    if (v === null || v === undefined || isNaN(v)) return "N/A";
    if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${Math.round(v).toLocaleString()}`;
  };

  const handleManualRefresh = () => {
    loadAllData(true);
  };

  // Chart data - use price history or generate based on current probability
  const chartData = useMemo(() => {
    if (priceHistory && priceHistory.length > 0) {
      return priceHistory;
    }
    
    // Generate initial chart data if no history
    const prob = market?.probability || 4;
    const now = new Date();
    const data = [];
    for (let i = 50; i >= 0; i--) {
      const variation = Math.sin(i / 5) * 1 + (Math.random() - 0.5) * 0.5;
      const value = Math.max(0, Math.min(100, prob + variation));
      const datePoint = new Date(now.getTime() - i * 30 * 60 * 1000); // 30 min intervals
      data.push({
        probability: Math.round(value * 10) / 10,
        date: datePoint.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        time: datePoint.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      });
    }
    return data;
  }, [priceHistory, market?.probability]);

  if (loading) {
    return (
      <div className="rounded-xl md:rounded-2xl border border-[#00FF99]/20 bg-gradient-to-br from-gray-900 to-black p-3 md:p-6 sm:p-8">
        <div className="flex items-center justify-center py-8 md:py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="w-8 h-8 text-[#00FF99]" />
          </motion.div>
          <span className="ml-3 text-gray-400">Loading live market data from Polymarket...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl md:rounded-2xl border border-[#00FF99]/20 bg-gradient-to-br from-gray-900 to-black overflow-hidden shadow-[0_0_60px_rgba(0,255,153,0.08)]"
    >
      {/* Header */}
      <div className="p-2.5 md:p-4 sm:p-6 border-b border-[#00FF99]/10">
        <div className="flex flex-wrap items-center justify-between gap-1.5 md:gap-3 mb-2 md:mb-4">
          <div className="flex items-center gap-1.5 md:gap-3">
            <span className="px-2 py-1 md:px-3 md:py-1.5 rounded-full text-[0.6rem] md:text-[0.7rem] bg-[#00FF99]/15 text-[#00FF99] border border-[#00FF99]/40 uppercase tracking-widest font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#00FF99] animate-pulse" />
              {dataSource === 'live' ? 'LIVE' : 'Polymarket'}
            </span>
            <span className="text-[10px] md:text-xs text-gray-500">
              Settlement by {settlementDate}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-[#00FF99]/10 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh data"
            >
              <motion.div
                animate={isRefreshing ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
              >
                <RefreshCw className="w-4 h-4 text-[#00FF99]" />
              </motion.div>
            </button>
            <a
              href="https://polymarket.com/event/will-jesus-christ-return-before-2027"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00FF99] transition-colors underline underline-offset-4 cursor-pointer"
            >
              Open on Polymarket
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Error message - only show if we don't have live data */}
        {error && dataSource !== 'live' && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
            ⚠️ Could not fetch live data from Polymarket. Please try refreshing or visit Polymarket directly.
          </div>
        )}

        {/* Market Question */}
        <h2 className="text-sm md:text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 md:mb-6 leading-tight">
          {market?.title || "Will Jesus Christ return before 2027?"}
        </h2>

        {/* YES / NO quotes — live */}
        <div className="flex gap-4 mb-2 md:mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] md:text-xs text-gray-500 uppercase">YES</span>
            <AnimatedValue
              value={market?.yesPriceCents}
              className="text-[#00FF99] font-mono font-bold text-sm md:text-base"
              suffix="¢"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] md:text-xs text-gray-500 uppercase">NO</span>
            <AnimatedValue
              value={market?.noPriceCents}
              className="text-red-400 font-mono font-bold text-sm md:text-base"
              suffix="¢"
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap items-end justify-between gap-2 md:gap-4">
          <div className="flex items-baseline gap-2 md:gap-4">
            <div className="relative">
              <AnimatedValue
                value={market?.probability}
                className="text-3xl md:text-5xl sm:text-6xl md:text-7xl font-extrabold text-[#00FF99] leading-none"
                suffix="%"
              />
              {/* Price change indicator */}
              <AnimatePresence>
                {priceChange !== 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`absolute -top-2 -right-8 flex items-center gap-0.5 text-xs font-semibold ${
                      priceChange > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {priceChange > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(priceChange).toFixed(1)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex flex-col gap-0.5 md:gap-1">
              <span className="text-gray-400 text-[9px] md:text-xs uppercase tracking-widest">
                Implied Chance
              </span>
              <span className="inline-flex items-center gap-1 md:gap-1.5 text-[9px] md:text-xs text-gray-400">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#00FF99] animate-pulse" />
                YES outcome • Live every {refreshInterval / 1000}s
              </span>
            </div>
          </div>

          <div className="flex gap-3 md:gap-6">
            <div className="text-right">
              <div className="text-gray-400 text-[10px] md:text-xs uppercase tracking-widest mb-0.5 md:mb-1">
                24h Volume
              </div>
              <AnimatedValue
                value={market?.volume24h ?? market?.volume}
                format={formatVolume}
                className="text-white text-sm md:text-xl sm:text-2xl font-bold block"
              />
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-[10px] md:text-xs uppercase tracking-widest mb-0.5 md:mb-1">
                Total Volume
              </div>
              <AnimatedValue
                value={market?.volume}
                format={formatVolume}
                className="text-white text-sm md:text-xl sm:text-2xl font-bold block"
              />
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-gray-400 text-[10px] md:text-xs uppercase tracking-widest mb-0.5 md:mb-1">
                Liquidity
              </div>
              <AnimatedValue
                value={market?.liquidity}
                format={formatVolume}
                className="text-white text-sm md:text-xl font-bold block"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Chart */}
      <div className="p-2.5 md:p-4 sm:p-6">
        <div className="h-32 md:h-56 sm:h-64 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 15 }}>
              <defs>
                <linearGradient id="colorProbLive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00FF99" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00FF99" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                stroke="#444"
                tick={{ fill: "#888", fontSize: 9 }}
                axisLine={{ stroke: "#333" }}
                tickLine={{ stroke: "#333" }}
                interval="preserveStartEnd"
                hide={typeof window !== 'undefined' && window.innerWidth < 640}
              />
              <YAxis
                stroke="#444"
                tick={{ fill: "#888", fontSize: 9 }}
                axisLine={{ stroke: "#333" }}
                tickLine={{ stroke: "#333" }}
                domain={[0, Math.max(15, Math.min(100, Math.ceil((market?.probability || 10) * 2)))]}
                tickFormatter={(v) => `${v}%`}
                width={typeof window !== 'undefined' && window.innerWidth < 640 ? 32 : 60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="probability"
                stroke="#00FF99"
                strokeWidth={2}
                fill="url(#colorProbLive)"
                dot={false}
                activeDot={{ r: 4, fill: "#00FF99", stroke: "#000", strokeWidth: 2 }}
                isAnimationActive={true}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Data source note with live indicator */}
        <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-[#00FF99]/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#00FF99] animate-pulse" />
            <p className="text-[10px] md:text-xs text-gray-500">
              Real-time data from Polymarket • Auto-updates every {refreshInterval / 1000}s
            </p>
          </div>
          {lastUpdate && (
            <p className="text-[10px] md:text-xs text-gray-400 font-mono">
              Last update: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Comments Section - Link to Polymarket */}
      <div className="p-2.5 md:p-4 sm:p-6 border-t border-[#00FF99]/10">
        <a
          href="https://polymarket.com/event/will-jesus-christ-return-before-2027"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-2 md:p-4 rounded-lg md:rounded-xl bg-gray-800/50 border border-gray-700/50 hover:border-[#00FF99]/30 hover:bg-gray-800/70 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#00FF99]/30 to-[#00FF99]/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-3.5 h-3.5 md:w-5 md:h-5 text-[#00FF99]" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-xs md:text-base group-hover:text-[#00FF99] transition-colors">
                View Comments & Discussion
              </h3>
              <p className="text-[10px] md:text-sm text-gray-400">
                Join the conversation on Polymarket
              </p>
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 md:w-5 md:h-5 text-gray-500 group-hover:text-[#00FF99] transition-colors flex-shrink-0" />
        </a>
      </div>
    </motion.div>
  );
}
