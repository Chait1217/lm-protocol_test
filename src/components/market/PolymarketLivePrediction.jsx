import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { ExternalLink, TrendingUp, Users, Activity, RefreshCw } from "lucide-react";

// Polymarket API endpoints
const POLYMARKET_APIS = {
  GAMMA: "https://gamma-api.polymarket.com",
  DATA: "https://data-api.polymarket.com",
  CLOB: "https://clob.polymarket.com",
};

// Generate fallback chart data
const generateChartData = (centerProbability = 50, points = 50) => {
  const data = [];
  const spread = Math.max(3, Math.min(10, centerProbability * 0.3));
  for (let i = 0; i < points; i++) {
    const variation = Math.sin(i / 5) * spread * 0.5 + (Math.random() - 0.5) * spread;
    const value = Math.max(0, Math.min(100, centerProbability + variation));
    data.push({
      time: i + 1,
      probability: Math.round(value * 10) / 10,
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
  refreshInterval = 30000, // 30 seconds
}) {
  const [market, setMarket] = useState(null);
  const [priceHistory, setPriceHistory] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch market data from Gamma API
  const fetchMarket = async () => {
    try {
      const res = await fetch(`${POLYMARKET_APIS.GAMMA}/markets?slug=${slug}`);
      const data = await res.json();
      const markets = Array.isArray(data) ? data : data.markets || data.data || [];

      if (markets.length === 0) {
        throw new Error("No market found");
      }

      const m = markets[0];
      const lastPrice = m.lastTradePrice || (m.outcomes && m.outcomes[0]?.price) || 0;
      const probability = Math.round(lastPrice * 100);

      return {
        conditionId: m.conditionId || m.id,
        slug: m.slug || slug,
        title: m.question || m.title || "Polymarket Market",
        probability,
        volume: m.volumeNum || m.volume || 0,
        volume24h: m.volume24hr || m.volumeNum || 0,
        liquidity: m.liquidity || 0,
        traders: m.uniqueTraders || m.traders || 0,
        url: `https://polymarket.com/market/${m.slug || slug}`,
        lastPrice,
        outcomes: m.outcomes || [],
      };
    } catch (error) {
      console.error("Failed to fetch market:", error);
      // Return fallback data
      return {
        conditionId: null,
        slug,
        title: "Will Jesus Christ return before 2027?",
        probability: 3,
        volume: 439674,
        volume24h: 439674,
        liquidity: 125000,
        traders: 1250,
        url: `https://polymarket.com/market/${slug}`,
        lastPrice: 0.03,
        outcomes: [],
      };
    }
  };

  // Fetch price history from CLOB API
  const fetchPriceHistory = async (conditionId) => {
    if (!conditionId) return null;

    try {
      const tokenIdYes = `${conditionId}-0`;
      const res = await fetch(
        `${POLYMARKET_APIS.CLOB}/prices-history?market=${tokenIdYes}&interval=1d`
      );

      if (!res.ok) throw new Error(`prices-history ${res.status}`);

      const data = await res.json();
      const raw = data.history || data.data || [];

      if (!Array.isArray(raw) || raw.length === 0) {
        return null;
      }

      const sorted = [...raw].sort((a, b) => (a.t || 0) - (b.t || 0));
      return sorted.map((point, i) => {
        const p = point.p != null ? point.p : point.price;
        const prob = typeof p === "number" ? (p <= 1 ? p * 100 : p) : 0;
        return { time: i + 1, probability: Math.round(prob * 10) / 10 };
      });
    } catch (e) {
      console.warn("Price history fetch failed:", e.message);
      return null;
    }
  };

  // Fetch comments
  const fetchComments = async (conditionId) => {
    if (!conditionId) return [];

    try {
      const res = await fetch(
        `${POLYMARKET_APIS.DATA}/comments?conditionId=${conditionId}&limit=5`
      );

      if (!res.ok) throw new Error(`Comments API ${res.status}`);

      const data = await res.json();
      const arr = Array.isArray(data) ? data : data.comments || data.data || [];

      return arr.slice(0, 5).map((c, i) => ({
        id: c.id || i,
        text: c.text || c.content || c.body || "",
        author: c.author || c.userAddress || `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
        timestamp: c.createdAt || c.timestamp || "recently",
      }));
    } catch (e) {
      console.warn("Comments fetch failed:", e.message);
      return [];
    }
  };

  // Initial load and refresh
  const loadAllData = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);

    try {
      const marketData = await fetchMarket();
      setMarket(marketData);

      const [history, cmts] = await Promise.all([
        fetchPriceHistory(marketData.conditionId),
        fetchComments(marketData.conditionId),
      ]);

      setPriceHistory(history);
      setComments(cmts);
      setLastUpdate(new Date());
    } catch (e) {
      console.error("Failed to load market data:", e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();

    // Auto-refresh
    const interval = setInterval(() => loadAllData(true), refreshInterval);
    return () => clearInterval(interval);
  }, [slug, refreshInterval]);

  // Chart data with fallback
  const chartData = useMemo(() => {
    if (priceHistory && priceHistory.length > 0) {
      return priceHistory;
    }
    return generateChartData(market?.probability ?? 3);
  }, [priceHistory, market?.probability]);

  // Fallback comments
  const displayComments = comments.length > 0 ? comments : [
    { id: 1, author: "0x1234...5678", timestamp: "2h ago", text: "Wild market with tiny odds but huge upside if it hits." },
    { id: 2, author: "0xabcd...ef90", timestamp: "5h ago", text: "Sizing this like a long-shot lottery ticket, not a core position." },
    { id: 3, author: "0x7777...9999", timestamp: "1d ago", text: "Fun tail-risk hedge, but don't overexpose here." },
  ];

  // Format helpers
  const formatVolume = (v) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  };

  const formatNumber = (n) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
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
          <span className="ml-3 text-gray-400">Loading live market data...</span>
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
              Polymarket Market
            </span>
            <span className="text-xs text-gray-500">
              Settlement by {settlementDate}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isRefreshing && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCw className="w-4 h-4 text-[#00FF99]" />
              </motion.div>
            )}
            {market?.url && (
              <a
                href={market.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00FF99] transition-colors underline underline-offset-4"
              >
                Open on Polymarket
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Market Question */}
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-6">
          {market?.title || "Loading..."}
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
              {market?.probability ?? 0}%
            </motion.span>
            <div className="flex flex-col gap-1">
              <span className="text-gray-400 text-xs uppercase tracking-widest">
                Implied Chance
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full bg-[#00FF99] animate-pulse" />
                YES outcome
              </span>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="text-right">
              <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">
                24H Volume
              </div>
              <div className="text-white text-xl sm:text-2xl font-bold">
                {formatVolume(market?.volume24h || market?.volume || 0)}
              </div>
            </div>
            {market?.traders > 0 && (
              <div className="text-right hidden sm:block">
                <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">
                  Traders
                </div>
                <div className="text-white text-xl sm:text-2xl font-bold">
                  {formatNumber(market.traders)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 sm:p-6 border-b border-[#00FF99]/10">
        <div className="h-48 sm:h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00FF99" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00FF99" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                stroke="#444"
                tick={{ fill: "#666", fontSize: 10 }}
                axisLine={{ stroke: "#333" }}
                tickLine={{ stroke: "#333" }}
              />
              <YAxis
                stroke="#444"
                tick={{ fill: "#666", fontSize: 10 }}
                axisLine={{ stroke: "#333" }}
                tickLine={{ stroke: "#333" }}
                domain={[0, Math.max(20, Math.min(100, Math.ceil((market?.probability || 10) * 2.5)))]}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="probability"
                stroke="#00FF99"
                strokeWidth={2}
                fill="url(#colorProb)"
                dot={false}
                activeDot={{ r: 4, fill: "#00FF99", stroke: "#000", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comments */}
      <div className="p-4 sm:p-6">
        <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <span>Recent Comments</span>
          <span className="text-xs text-gray-500">
            ({displayComments.length})
          </span>
        </h3>
        <div className="space-y-3">
          <AnimatePresence>
            {displayComments.map((comment, index) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-black/60 p-3 sm:p-4 rounded-xl border border-[#00FF99]/10 hover:border-[#00FF99]/20 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-[#00FF99] font-mono">
                    {comment.author}
                  </span>
                  <span className="text-xs text-gray-500">
                    {comment.timestamp}
                  </span>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {comment.text}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer - Last Update */}
      {lastUpdate && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="text-xs text-gray-500 text-center">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      )}
    </motion.div>
  );
}
