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
  slug = "will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568",
  settlementDate = "Nov 7, 2028",
  refreshInterval = 5000, // 5 seconds for real-time quote updates
  compact = false,
  demoAmount,
  demoLeverage,
  demoOutcome,
  onExecuteDemoTrade,
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

    // Live CLOB: bestAsk = YES price (0–1). Use it for YES cents, NO cents (100 - YES), and implied probability.
    const bestBid = m.bestBid != null ? parseFloat(m.bestBid) : null;
    const bestAsk = m.bestAsk != null ? parseFloat(m.bestAsk) : null;
    const yesCentsFromClob = bestAsk != null && bestAsk >= 0 && bestAsk <= 1 ? Math.round(bestAsk * 1000) / 10 : null;
    const noCentsFromClob = yesCentsFromClob != null ? Math.round((100 - yesCentsFromClob) * 10) / 10 : (bestBid != null && bestBid >= 0 && bestBid <= 1 ? Math.round((1 - bestBid) * 1000) / 10 : null);
    // Probability = live YES implied chance (same as YES cents when we have CLOB)
    const probability = yesCentsFromClob != null ? yesCentsFromClob : (yesPrice !== null && yesPrice > 0 && yesPrice <= 1 ? Math.round(yesPrice * 1000) / 10 : (m.lastTradePrice != null && parseFloat(m.lastTradePrice) <= 1 ? Math.round(parseFloat(m.lastTradePrice) * 1000) / 10 : null));

    return {
      conditionId: m.conditionId || m.id,
      slug: m.slug || slug,
      title: m.question || "Will Gavin Newsom win the 2028 Democratic presidential nomination?",
      probability,
      yesPriceCents: yesCentsFromClob ?? (yesPrice != null ? Math.round(yesPrice * 1000) / 10 : null),
      noPriceCents: noCentsFromClob ?? (noPrice != null ? Math.round(noPrice * 1000) / 10 : null),
      volume: totalVolume,
      volume24h,
      liquidity: parseFloat(m.liquidity) || parseFloat(m.liquidityNum) || 0,
      traders: parseInt(m.uniqueBettors) || parseInt(m.uniqueTraders) || null,
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

  const formatNumber = (n) => {
    if (n === null || n === undefined || isNaN(n)) return "N/A";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
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

  if (!market) {
    return (
      <div className="rounded-xl md:rounded-2xl border border-[#00FF99]/20 bg-gradient-to-br from-gray-900 to-black p-6 md:p-8">
        <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
          <p className="text-gray-400 mb-4">
            {error || "Could not load market data from Polymarket."}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              loadAllData(true);
            }}
            className="px-4 py-2 rounded-lg bg-[#00FF99]/20 text-[#00FF99] border border-[#00FF99]/40 hover:bg-[#00FF99]/30 transition-colors"
          >
            Retry
          </button>
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 text-sm text-gray-500 hover:text-[#00FF99] transition-colors"
          >
            Open Polymarket →
          </a>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="h-full rounded-lg md:rounded-xl border border-[#00FF99]/20 bg-gradient-to-br from-gray-900 to-black overflow-hidden shadow-[0_0_40px_rgba(0,255,153,0.06)]"
    >
      {/* Header – compact */}
      <div className="p-2 md:p-3 border-b border-[#00FF99]/10">
        <div className="flex flex-wrap items-center justify-between gap-1 md:gap-2 mb-1 md:mb-2">
          <div className="flex items-center gap-1.5 md:gap-3">
            <span className="px-1.5 py-0.5 md:px-2 md:py-1 rounded-full text-[0.55rem] md:text-[0.65rem] bg-[#00FF99]/15 text-[#00FF99] border border-[#00FF99]/40 uppercase tracking-widest font-semibold flex items-center gap-0.5">
              <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-[#00FF99] animate-pulse" />
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
              href={`https://polymarket.com/market/${market?.slug || slug}`}
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
        <h2 className="text-xs md:text-base sm:text-lg font-bold text-white mb-1 md:mb-2 leading-tight">
          {market?.title || "Will Gavin Newsom win the 2028 Democratic presidential nomination?"}
        </h2>

        {/* YES / NO quotes — live */}
        <div className="flex gap-3 mb-1 md:mb-2">
          <div className="flex items-center gap-1">
            <span className="text-[9px] md:text-[10px] text-gray-500 uppercase">YES</span>
            <AnimatedValue
              value={market?.yesPriceCents}
              className="text-[#00FF99] font-mono font-bold text-xs md:text-sm"
              suffix="¢"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] md:text-[10px] text-gray-500 uppercase">NO</span>
            <AnimatedValue
              value={market?.noPriceCents}
              className="text-red-400 font-mono font-bold text-xs md:text-sm"
              suffix="¢"
            />
          </div>
        </div>

        {/* Stats Row – compact */}
        <div className="flex flex-wrap items-end justify-between gap-1.5 md:gap-2">
          <div className="flex items-baseline gap-1.5 md:gap-2">
            <div className="relative">
              <AnimatedValue
                value={market?.probability}
                className="text-2xl md:text-4xl sm:text-5xl font-extrabold text-[#00FF99] leading-none"
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
            <div className="flex flex-col gap-0">
              <span className="text-gray-400 text-[8px] md:text-[9px] uppercase tracking-wider">
                Implied Chance
              </span>
              <span className="inline-flex items-center gap-0.5 text-[8px] md:text-[9px] text-gray-400">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#00FF99] animate-pulse" />
                YES outcome • Live every {refreshInterval / 1000}s
              </span>
            </div>
          </div>

          <div className="flex gap-2 md:gap-3">
            <div className="text-right">
              <div className="text-gray-400 text-[8px] md:text-[9px] uppercase tracking-wider mb-0">
                24h Vol
              </div>
              <AnimatedValue
                value={market?.volume24h ?? market?.volume}
                format={formatVolume}
                className="text-white text-xs md:text-base font-bold block"
              />
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-[8px] md:text-[9px] uppercase tracking-wider mb-0">
                Volume
              </div>
              <AnimatedValue
                value={market?.volume}
                format={formatVolume}
                className="text-white text-xs md:text-base font-bold block"
              />
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-gray-400 text-[8px] md:text-[9px] uppercase tracking-wider mb-0">
                Liquidity
              </div>
              <AnimatedValue
                value={market?.liquidity}
                format={formatVolume}
                className="text-white text-xs md:text-base font-bold block"
              />
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-gray-400 text-[8px] md:text-[9px] uppercase tracking-wider mb-0">
                Traders
              </div>
              <AnimatedValue
                value={market?.traders}
                format={formatNumber}
                className="text-white text-xs md:text-base font-bold block"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Chart – compact */}
      <div className="p-2 md:p-3">
        <div className="h-24 md:h-36 sm:h-40">
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

        {/* Data source note */}
        <div className="mt-1 md:mt-2 pt-1 md:pt-2 border-t border-[#00FF99]/10 flex flex-wrap items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-[#00FF99] animate-pulse" />
            <p className="text-[9px] md:text-[10px] text-gray-500">
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

      {/* Comments + Execute – compact */}
      <div className="p-2 md:p-3 border-t border-[#00FF99]/10">
        <a
          href={`https://polymarket.com/market/${market?.slug || slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-1.5 md:p-2 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-[#00FF99]/30 hover:bg-gray-800/70 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-gradient-to-br from-[#00FF99]/30 to-[#00FF99]/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-[#00FF99]" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-[10px] md:text-xs group-hover:text-[#00FF99] transition-colors">
                View Comments & Discussion
              </h3>
              <p className="text-[9px] md:text-[10px] text-gray-400">Join the conversation on Polymarket</p>
            </div>
          </div>
          <ExternalLink className="w-3 h-3 md:w-4 md:h-4 text-gray-500 group-hover:text-[#00FF99] transition-colors flex-shrink-0" />
        </a>

        {typeof onExecuteDemoTrade === "function" && (
          <div className="mt-2">
            <button
              type="button"
              onClick={onExecuteDemoTrade}
              className="w-full py-2 md:py-2.5 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer bg-[#00FF99] text-black hover:bg-[#00FF99]/90 hover:shadow-[0_0_20px_rgba(0,255,153,0.25)]"
            >
              Execute Demo Trade
            </button>
            <p className="text-[9px] md:text-[10px] text-gray-500 mt-0.5 text-center">
              ${demoAmount || "100"} @ {demoLeverage ?? 2}x {demoOutcome || "YES"} from leverage box →
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
