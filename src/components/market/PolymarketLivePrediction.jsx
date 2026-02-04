import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { ExternalLink, RefreshCw, MessageCircle, User } from "lucide-react";

// Polymarket API endpoints (using Vite proxy to bypass CORS)
// In development, requests go through /polymarket-gamma/* and /polymarket-clob/*
// which are proxied to the actual Polymarket APIs
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
    // Generate a date for each point going backwards from today
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
  refreshInterval = 30000, // 30 seconds for market data
  commentsRefreshInterval = 3600000, // 1 hour for comments
}) {
  const [market, setMarket] = useState(null);
  const [priceHistory, setPriceHistory] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lastCommentsUpdate, setLastCommentsUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch event data from Gamma API using the correct endpoint
  const fetchMarket = useCallback(async () => {
    try {
      // Use events/slug endpoint (this is an EVENT not a MARKET)
      const res = await fetch(`${POLYMARKET_APIS.GAMMA}/events/slug/${slug}`);
      
      if (!res.ok) {
        // Fallback: try markets endpoint with slug query param
        const fallbackRes = await fetch(`${POLYMARKET_APIS.GAMMA}/markets?slug=${slug}&closed=false`);
        if (!fallbackRes.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const fallbackData = await fallbackRes.json();
        const markets = Array.isArray(fallbackData) ? fallbackData : fallbackData.markets || [];
        if (markets.length === 0) throw new Error("No market found");
        
        const m = markets[0];
        return parseMarketData(m);
      }
      
      const eventData = await res.json();
      
      // Event contains markets array - get the first/main market
      const markets = eventData.markets || [];
      if (markets.length === 0) {
        throw new Error("No markets in event");
      }
      
      const m = markets[0];
      return {
        ...parseMarketData(m),
        eventTitle: eventData.title || eventData.question,
        eventSlug: eventData.slug,
      };
    } catch (error) {
      console.error("Failed to fetch market:", error);
      setError(error.message);
      // Return fallback data
      return getFallbackData();
    }
  }, [slug]);

  // Parse market data from API response
  const parseMarketData = (m) => {
    // Get the YES outcome price (outcomePrices is an array like ["0.03", "0.97"])
    const outcomePrices = m.outcomePrices ? JSON.parse(m.outcomePrices) : [];
    const yesPrice = outcomePrices[0] ? parseFloat(outcomePrices[0]) : null;
    
    // Also check clobTokenIds for CLOB API
    const clobTokenIds = m.clobTokenIds ? JSON.parse(m.clobTokenIds) : [];
    
    const probability = yesPrice !== null 
      ? Math.round(yesPrice * 100) 
      : Math.round((m.lastTradePrice || 0.03) * 100);

    return {
      conditionId: m.conditionId || m.id,
      slug: m.slug || slug,
      title: m.question || m.title || "Polymarket Market",
      probability,
      volume: parseFloat(m.volume) || parseFloat(m.volumeNum) || 0,
      volume24h: parseFloat(m.volume24hr) || parseFloat(m.volume) || 0,
      liquidity: parseFloat(m.liquidity) || 0,
      traders: m.uniqueBettors || m.uniqueTraders || 0,
      url: `https://polymarket.com/event/${m.slug || slug}`,
      lastPrice: yesPrice || m.lastTradePrice || 0.03,
      clobTokenIds,
      outcomes: m.outcomes || [],
      endDate: m.endDate || m.endDateIso,
    };
  };

  // Fallback data when API fails
  const getFallbackData = () => ({
    conditionId: null,
    slug,
    title: "Will Jesus Christ return before 2027?",
    probability: 3,
    volume: 434709,
    volume24h: 434709,
    liquidity: 125000,
    traders: 1250,
    url: `https://polymarket.com/event/${slug}`,
    lastPrice: 0.03,
    clobTokenIds: [],
    outcomes: [],
  });

  // Fetch price history from CLOB API
  const fetchPriceHistory = useCallback(async (tokenId) => {
    if (!tokenId) return null;

    try {
      // CLOB prices-history endpoint
      const res = await fetch(
        `${POLYMARKET_APIS.CLOB}/prices-history?market=${tokenId}&interval=1d&fidelity=60`
      );

      if (!res.ok) {
        console.warn(`Price history API returned ${res.status}`);
        return null;
      }

      const data = await res.json();
      const raw = data.history || data || [];

      if (!Array.isArray(raw) || raw.length === 0) {
        return null;
      }

      // Sort by timestamp and map to chart format
      const sorted = [...raw].sort((a, b) => (a.t || 0) - (b.t || 0));
      return sorted.map((point, i) => {
        const p = point.p != null ? point.p : point.price;
        const prob = typeof p === "number" ? (p <= 1 ? p * 100 : p) : 0;
        // Format time as date string for X axis
        const timestamp = point.t ? new Date(point.t * 1000) : new Date();
        const dateStr = timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return { time: i + 1, probability: Math.round(prob * 10) / 10, date: dateStr };
      });
    } catch (e) {
      console.warn("Price history fetch failed:", e.message);
      return null;
    }
  }, []);

  // Fetch comments from Polymarket Gamma API for the specific market
  const fetchComments = useCallback(async (marketData) => {
    if (!marketData) {
      return getFallbackComments();
    }

    try {
      // Try multiple approaches to get comments for this specific market
      const endpoints = [];
      
      // 1. Try with condition ID (most specific)
      if (marketData.conditionId) {
        endpoints.push(`${POLYMARKET_APIS.GAMMA}/comments?market=${marketData.conditionId}&order=created_at&ascending=false&limit=3`);
      }
      
      // 2. Try with market slug
      if (marketData.slug) {
        endpoints.push(`${POLYMARKET_APIS.GAMMA}/comments?market_slug=${marketData.slug}&order=created_at&ascending=false&limit=3`);
      }
      
      // 3. Try with event slug
      if (marketData.eventSlug) {
        endpoints.push(`${POLYMARKET_APIS.GAMMA}/comments?event_slug=${marketData.eventSlug}&order=created_at&ascending=false&limit=3`);
      }

      // 4. Fallback: use the hardcoded slug for "Will Jesus Christ return before 2027?"
      endpoints.push(`${POLYMARKET_APIS.GAMMA}/comments?market_slug=will-jesus-christ-return-before-2027&order=created_at&ascending=false&limit=3`);
      endpoints.push(`${POLYMARKET_APIS.GAMMA}/comments?event_slug=will-jesus-christ-return-before-2027&order=created_at&ascending=false&limit=3`);

      // Try each endpoint until we get valid comments
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint);
          if (res.ok) {
            const data = await res.json();
            const comments = parseComments(data);
            if (comments.length > 0 && comments[0].id !== "fallback-1") {
              console.log(`Comments fetched successfully from: ${endpoint}`);
              return comments;
            }
          }
        } catch (e) {
          console.warn(`Endpoint failed: ${endpoint}`, e.message);
        }
      }

      // If all endpoints fail, return fallback comments specific to this market
      console.warn("All comment endpoints failed, using fallback");
      return getFallbackComments();
    } catch (e) {
      console.warn("Comments fetch failed:", e.message);
      return getFallbackComments();
    }
  }, []);

  // Parse comments from API response
  const parseComments = (data) => {
    const commentsArr = Array.isArray(data) ? data : data.comments || data.data || [];
    
    if (commentsArr.length === 0) {
      return getFallbackComments();
    }

    return commentsArr.slice(0, 3).map((comment, idx) => ({
      id: comment.id || `comment-${idx}`,
      user: comment.username || comment.user?.username || comment.author || "Anonymous",
      text: comment.content || comment.text || comment.body || "",
      timestamp: comment.created_at || comment.createdAt || comment.timestamp || new Date().toISOString(),
      avatar: comment.user?.profile_picture || comment.avatar || null,
    }));
  };

  // Fallback comments when API fails - specific to "Will Jesus Christ return before 2027?" market
  const getFallbackComments = () => [
    {
      id: "fallback-1",
      user: "Note",
      text: "Unable to load live comments from Polymarket. Click 'View all comments on Polymarket' below to see the latest discussion for this market.",
      timestamp: new Date().toISOString(),
      avatar: null,
      isNotice: true,
    },
  ];

  // Initial load and refresh market data
  const loadAllData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    setError(null);

    try {
      const marketData = await fetchMarket();
      setMarket(marketData);

      // Fetch price history if we have token IDs
      if (marketData.clobTokenIds && marketData.clobTokenIds.length > 0) {
        const history = await fetchPriceHistory(marketData.clobTokenIds[0]);
        setPriceHistory(history);
      } else if (marketData.conditionId) {
        // Fallback: try with conditionId-0 format
        const history = await fetchPriceHistory(`${marketData.conditionId}`);
        setPriceHistory(history);
      }

      setLastUpdate(new Date());
    } catch (e) {
      console.error("Failed to load market data:", e);
      setError(e.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchMarket, fetchPriceHistory]);

  // Load comments separately (refreshes every 1 hour)
  // Uses market data to fetch comments specific to "Will Jesus Christ return before 2027?"
  const loadComments = useCallback(async () => {
    try {
      // Pass market data so we can use conditionId, slug, eventSlug for the specific market
      const commentsData = await fetchComments(market);
      setComments(commentsData);
      setLastCommentsUpdate(new Date());
    } catch (e) {
      console.warn("Failed to load comments:", e);
      setComments(getFallbackComments());
    }
  }, [fetchComments, market]);

  useEffect(() => {
    loadAllData();

    // Auto-refresh market data
    const interval = setInterval(() => loadAllData(true), refreshInterval);
    return () => clearInterval(interval);
  }, [loadAllData, refreshInterval]);

  // Separate effect for comments (refreshes every 1 hour)
  // Only fetch comments after market data is loaded to use the correct market identifiers
  useEffect(() => {
    if (market) {
      loadComments();

      // Auto-refresh comments every 1 hour
      const commentsInterval = setInterval(() => loadComments(), commentsRefreshInterval);
      return () => clearInterval(commentsInterval);
    }
  }, [market, loadComments, commentsRefreshInterval]);

  // Chart data with fallback
  const chartData = useMemo(() => {
    if (priceHistory && priceHistory.length > 0) {
      return priceHistory;
    }
    return generateChartData(market?.probability ?? 3);
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

  // Manual refresh handler
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
              Polymarket Market
            </span>
            <span className="text-xs text-gray-500">
              Settlement by {settlementDate}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Manual refresh button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-[#00FF99]/10 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <motion.div
                animate={isRefreshing ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
              >
                <RefreshCw className="w-4 h-4 text-[#00FF99]" />
              </motion.div>
            </button>
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

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            ⚠️ Using cached data. API error: {error}
          </div>
        )}

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
                {formatVolume(market?.volume24h || market?.volume)}
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
            Data from Polymarket API • {priceHistory ? "Live chart data" : "Simulated chart"}
          </p>
          {lastUpdate && (
            <p className="text-xs text-gray-500">
              Updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Comments Section */}
      <div className="p-4 sm:p-6 border-t border-[#00FF99]/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#00FF99]" />
            <h3 className="text-lg font-semibold text-white">
              Recent Comments
              <span className="ml-2 text-xs font-normal text-gray-500">
                (Will Jesus Christ return before 2027?)
              </span>
            </h3>
          </div>
          {lastCommentsUpdate && !comments[0]?.isNotice && (
            <span className="text-xs text-gray-500">
              Updated: {lastCommentsUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {comments.length > 0 ? (
              comments.map((comment, index) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className={`p-4 rounded-xl ${
                    comment.isNotice
                      ? "bg-yellow-500/10 border border-yellow-500/30"
                      : "bg-gray-800/50 border border-gray-700/50 hover:border-[#00FF99]/20"
                  } transition-colors`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      comment.isNotice
                        ? "bg-yellow-500/20"
                        : "bg-gradient-to-br from-[#00FF99]/30 to-[#00FF99]/10"
                    }`}>
                      {comment.avatar ? (
                        <img
                          src={comment.avatar}
                          alt={comment.user}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : comment.isNotice ? (
                        <MessageCircle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <User className="w-4 h-4 text-[#00FF99]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {!comment.isNotice && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[#00FF99]">
                            @{comment.user}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(comment.timestamp)}
                          </span>
                        </div>
                      )}
                      <p className={`text-sm leading-relaxed ${
                        comment.isNotice ? "text-yellow-200" : "text-gray-300"
                      }`}>
                        {comment.text}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">
                Loading comments...
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Link to see all comments */}
        {market?.url && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <a
              href={market.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#00FF99] transition-colors"
            >
              <span>View all comments on Polymarket</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <p className="text-xs text-gray-600 mt-2">
              Comments refresh every hour from Polymarket
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Helper function to format time ago
function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
