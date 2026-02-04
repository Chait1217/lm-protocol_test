import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Label,
} from "recharts";
import { ExternalLink, RefreshCw, MessageCircle } from "lucide-react";

// Polymarket API endpoints (using Vite proxy to bypass CORS)
const POLYMARKET_APIS = {
  GAMMA: "/polymarket-gamma",
  CLOB: "/polymarket-clob",
};

// Generate fallback chart data
const generateChartData = (centerProbability = 50, points = 50) => {
  const data = [];
  const spread = Math.max(3, Math.min(10, centerProbability * 0.3));
  const now = new Date();
  
  for (let i = 0; i < points; i++) {
    const variation = Math.sin(i / 5) * spread * 0.5 + (Math.random() - 0.5) * spread;
    const value = Math.max(0, Math.min(100, centerProbability + variation));
    const datePoint = new Date(now.getTime() - (points - i) * 24 * 60 * 60 * 1000);
    const dateStr = datePoint.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    data.push({
      time: i + 1,
      probability: Math.round(value * 10) / 10,
      date: dateStr,
    });
  }
  return data;
};

// Custom tooltip for chart
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 border border-[#00FF99]/30 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-[#00FF99] font-semibold text-sm">
          {payload[0].value.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

export default function PolymarketLivePrediction({
  slug = "will-jesus-christ-return-before-2027",
  settlementDate = "Dec 31, 2026",
  refreshInterval = 15000, // 15 seconds for updates
}) {
  const [market, setMarket] = useState(null);
  const [priceHistory, setPriceHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState(null);

  // Fetch market data from Gamma API
  const fetchMarket = useCallback(async () => {
    try {
      // Try to get all markets and find the Jesus Christ one
      const response = await fetch(`${POLYMARKET_APIS.GAMMA}/markets?closed=false&limit=500`);
      
      if (!response.ok) {
        throw new Error(`Gamma API error: ${response.status}`);
      }
      
      const data = await response.json();
      const markets = Array.isArray(data) ? data : [];
      
      // Find the Jesus Christ market by searching the question text
      const jesusMarket = markets.find(m => {
        const question = (m.question || '').toLowerCase();
        return question.includes('jesus') && question.includes('christ') && question.includes('2027');
      });
      
      if (jesusMarket) {
        setDataSource('live');
        setError(null);
        return parseMarketData(jesusMarket);
      }
      
      // If not found, try searching with different terms
      const altMarket = markets.find(m => {
        const question = (m.question || '').toLowerCase();
        return question.includes('jesus') && question.includes('return');
      });
      
      if (altMarket) {
        setDataSource('live');
        setError(null);
        return parseMarketData(altMarket);
      }
      
      throw new Error("Market not found in Polymarket API");
    } catch (err) {
      console.error("Failed to fetch market:", err);
      setError(err.message);
      setDataSource('fallback');
      return getFallbackData();
    }
  }, []);

  // Parse market data from API response
  const parseMarketData = (m) => {
    // Parse outcomePrices - can be string or array
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
    
    // YES price is the first outcome
    const yesPrice = outcomePrices[0] ? parseFloat(outcomePrices[0]) : null;
    
    // Calculate probability
    let probability;
    if (yesPrice !== null && yesPrice > 0 && yesPrice <= 1) {
      probability = Math.round(yesPrice * 100);
    } else if (m.lastTradePrice && parseFloat(m.lastTradePrice) <= 1) {
      probability = Math.round(parseFloat(m.lastTradePrice) * 100);
    } else {
      probability = 4; // Current approximate value
    }

    // Parse volume
    const volume = parseFloat(m.volume) || parseFloat(m.volumeNum) || 0;
    const volume24h = parseFloat(m.volume24hr) || 0;
    
    // Parse traders count
    const traders = parseInt(m.uniqueBettors) || parseInt(m.uniqueTraders) || 0;

    // Parse clobTokenIds for price history
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
      volume,
      volume24h,
      liquidity: parseFloat(m.liquidity) || 0,
      traders,
      url: `https://polymarket.com/event/${slug}`,
      lastPrice: yesPrice || parseFloat(m.lastTradePrice) || 0.04,
      clobTokenIds,
    };
  };

  // Fallback data - should match current Polymarket values approximately
  const getFallbackData = () => ({
    conditionId: null,
    slug,
    title: "Will Jesus Christ return before 2027?",
    probability: 4,
    volume: 450000,
    volume24h: 2500,
    liquidity: 18000,
    traders: 1400,
    url: `https://polymarket.com/event/${slug}`,
    lastPrice: 0.04,
    clobTokenIds: [],
  });

  // Fetch price history
  const fetchPriceHistory = useCallback(async (tokenId) => {
    if (!tokenId) return null;
    
    try {
      const response = await fetch(
        `${POLYMARKET_APIS.CLOB}/prices-history?market=${tokenId}&interval=1d&fidelity=60`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const history = data.history || data || [];

      if (!Array.isArray(history) || history.length === 0) {
        return null;
      }

      // Sort by timestamp and convert to chart format
      const sorted = [...history].sort((a, b) => (a.t || 0) - (b.t || 0));
      return sorted.map((point, i) => {
        const p = point.p != null ? point.p : point.price;
        const prob = typeof p === "number" ? (p <= 1 ? p * 100 : p) : 0;
        const timestamp = point.t ? new Date(point.t * 1000) : new Date();
        const dateStr = timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return { time: i + 1, probability: Math.round(prob * 10) / 10, date: dateStr };
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
      setMarket(marketData);

      // Try to fetch price history if we have token IDs
      if (marketData.clobTokenIds && marketData.clobTokenIds.length > 0) {
        const history = await fetchPriceHistory(marketData.clobTokenIds[0]);
        setPriceHistory(history);
      }

      setLastUpdate(new Date());
    } catch (e) {
      console.error("Failed to load data:", e);
      setError(e.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchMarket, fetchPriceHistory]);

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => loadAllData(true), refreshInterval);
    return () => clearInterval(interval);
  }, [loadAllData, refreshInterval]);

  // Chart data
  const chartData = useMemo(() => {
    if (priceHistory && priceHistory.length > 0) {
      return priceHistory;
    }
    return generateChartData(market?.probability ?? 4);
  }, [priceHistory, market?.probability]);

  // Format helpers
  const formatVolume = (v) => {
    if (!v || isNaN(v)) return "$0";
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${Math.round(v / 1000)}K`;
    return `$${Math.round(v).toLocaleString()}`;
  };

  const formatNumber = (n) => {
    if (!n || isNaN(n)) return "0";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const handleManualRefresh = () => {
    loadAllData(true);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#00FF99]/20 bg-gradient-to-br from-gray-900 to-black p-6 sm:p-8">
        <div className="flex items-center justify-center py-16">
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
      className="rounded-2xl border border-[#00FF99]/20 bg-gradient-to-br from-gray-900 to-black overflow-hidden shadow-[0_0_60px_rgba(0,255,153,0.08)]"
    >
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-[#00FF99]/10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-full text-[0.7rem] bg-[#00FF99]/15 text-[#00FF99] border border-[#00FF99]/40 uppercase tracking-widest font-semibold">
              {dataSource === 'live' ? '● Live' : 'Polymarket'}
            </span>
            <span className="text-xs text-gray-500">
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

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
            ⚠️ Could not fetch live data. Showing approximate values.
          </div>
        )}

        {/* Market Question */}
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-6">
          {market?.title || "Will Jesus Christ return before 2027?"}
        </h2>

        {/* Stats Row */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <motion.span
              key={market?.probability}
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-[#00FF99] leading-none"
            >
              {market?.probability ?? 4}%
            </motion.span>
            <div className="flex flex-col gap-1">
              <span className="text-gray-400 text-xs uppercase tracking-widest">
                Implied Chance
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                <span className={`w-2 h-2 rounded-full ${dataSource === 'live' ? 'bg-[#00FF99] animate-pulse' : 'bg-yellow-500'}`} />
                YES outcome
              </span>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="text-right">
              <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">
                Volume
              </div>
              <div className="text-white text-xl sm:text-2xl font-bold">
                {formatVolume(market?.volume)}
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">
                Traders
              </div>
              <div className="text-white text-xl sm:text-2xl font-bold">
                {formatNumber(market?.traders)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 sm:p-6">
        <div className="h-56 sm:h-64 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
              <defs>
                <linearGradient id="colorProbLive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00FF99" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00FF99" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#444"
                tick={{ fill: "#888", fontSize: 10 }}
                axisLine={{ stroke: "#333" }}
                tickLine={{ stroke: "#333" }}
                interval="preserveStartEnd"
              >
                <Label
                  value="Time"
                  position="bottom"
                  offset={10}
                  style={{ fill: "#888", fontSize: 12, fontWeight: 500 }}
                />
              </XAxis>
              <YAxis
                stroke="#444"
                tick={{ fill: "#888", fontSize: 10 }}
                axisLine={{ stroke: "#333" }}
                tickLine={{ stroke: "#333" }}
                domain={[0, Math.max(20, Math.min(100, Math.ceil((market?.probability || 10) * 2.5)))]}
                tickFormatter={(v) => `${v}%`}
              >
                <Label
                  value="Probability (%)"
                  angle={-90}
                  position="insideLeft"
                  offset={5}
                  style={{ fill: "#888", fontSize: 12, fontWeight: 500, textAnchor: "middle" }}
                />
              </YAxis>
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="probability"
                stroke="#00FF99"
                strokeWidth={2}
                fill="url(#colorProbLive)"
                dot={false}
                activeDot={{ r: 4, fill: "#00FF99", stroke: "#000", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Data source note */}
        <div className="mt-4 pt-4 border-t border-[#00FF99]/10 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            {dataSource === 'live' ? '● Live data from Polymarket' : '○ Approximate data'} • {priceHistory ? "Live chart" : "Simulated chart"}
          </p>
          {lastUpdate && (
            <p className="text-xs text-gray-500">
              Updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Comments Section - Link to Polymarket */}
      <div className="p-4 sm:p-6 border-t border-[#00FF99]/10">
        <a
          href="https://polymarket.com/event/will-jesus-christ-return-before-2027"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50 border border-gray-700/50 hover:border-[#00FF99]/30 hover:bg-gray-800/70 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00FF99]/30 to-[#00FF99]/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-[#00FF99]" />
            </div>
            <div>
              <h3 className="text-white font-semibold group-hover:text-[#00FF99] transition-colors">
                View Comments & Discussion
              </h3>
              <p className="text-sm text-gray-400">
                Join the conversation on Polymarket
              </p>
            </div>
          </div>
          <ExternalLink className="w-5 h-5 text-gray-500 group-hover:text-[#00FF99] transition-colors" />
        </a>
      </div>
    </motion.div>
  );
}
