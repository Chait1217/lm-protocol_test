import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ExternalLink, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign,
  Activity,
  Zap,
} from "lucide-react";

// Animated number component
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

  if (value === null || value === undefined) return <span className={className}>--</span>;

  return (
    <motion.span
      className={`${className} transition-colors duration-300 ${isChanging ? 'text-[#00FF99]' : ''}`}
      animate={isChanging ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {prefix}{format ? format(displayValue) : displayValue}{suffix}
    </motion.span>
  );
};

export default function PolymarketLivePredictionBoxLeverage({
  slug = "will-jesus-christ-return-before-2027",
  refreshInterval = 5000, // 5s for real-time feel
}) {
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState("YES");
  const [priceChange, setPriceChange] = useState(0);
  const prevProbability = useRef(null);
  // Demo leverage section
  const [leverage, setLeverage] = useState(2);
  const [amount, setAmount] = useState("100");

  // Fetch market data
  const fetchMarket = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    
    try {
      const response = await fetch(`/api/polymarket-live?t=${Date.now()}`, {
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
      
      throw new Error(result.error || "Failed to fetch");
    } catch (err) {
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchMarket(retryCount + 1);
      }
      setError(err.message);
      setDataSource('fallback');
      return null;
    }
  }, []);

  // Parse market data
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
    const noPrice = outcomePrices[1] ? parseFloat(outcomePrices[1]) : (yesPrice ? 1 - yesPrice : null);
    
    let yesProbability = null;
    let noProbability = null;
    
    if (yesPrice !== null && yesPrice > 0 && yesPrice <= 1) {
      yesProbability = Math.round(yesPrice * 1000) / 10;
      noProbability = Math.round((1 - yesPrice) * 1000) / 10;
    }

    return {
      title: m.question || "Will Jesus Christ return before 2027?",
      yesProbability,
      noProbability,
      yesPrice: yesPrice ? (yesPrice * 100).toFixed(1) : null,
      noPrice: noPrice ? (noPrice * 100).toFixed(1) : null,
      volume: parseFloat(m.volume) || parseFloat(m.volumeNum) || 0,
      volume24h: parseFloat(m.volume24hr) || 0,
      liquidity: parseFloat(m.liquidity) || parseFloat(m.liquidityNum) || 0,
      traders: parseInt(m.uniqueBettors) || parseInt(m.uniqueTraders) || null,
      oneDayChange: parseFloat(m.oneDayPriceChange) || 0,
      bestBid: parseFloat(m.bestBid) || null,
      bestAsk: parseFloat(m.bestAsk) || null,
    };
  };

  // Load data
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);

    try {
      const marketData = await fetchMarket();
      
      if (marketData) {
        // Track price change
        if (prevProbability.current !== null && marketData.yesProbability !== null) {
          const change = marketData.yesProbability - prevProbability.current;
          setPriceChange(change);
        }
        prevProbability.current = marketData.yesProbability;
        
        setMarket(marketData);
        setLastUpdate(new Date());
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchMarket]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(false), refreshInterval);
    return () => clearInterval(interval);
  }, [loadData, refreshInterval]);

  // Format helpers
  const formatVolume = (v) => {
    if (v === null || v === undefined || isNaN(v)) return "--";
    if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${Math.round(v).toLocaleString()}`;
  };

  const formatNumber = (n) => {
    if (n === null || n === undefined || isNaN(n)) return "--";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // Demo leverage calculations (entry = live best ask for selected outcome)
  const amountNum = parseFloat(amount) || 0;
  const entryPriceDecimal = selectedOutcome === "YES"
    ? (market?.bestAsk ?? (market?.yesProbability != null ? market.yesProbability / 100 : 0.04))
    : (market?.bestBid != null ? 1 - market.bestBid : (market?.noProbability != null ? market.noProbability / 100 : 0.96));
  const entryPriceCents = Math.round(entryPriceDecimal * 1000) / 10;
  const positionSize = amountNum * leverage;
  const shares = entryPriceDecimal > 0 ? positionSize / entryPriceDecimal : 0;
  const liquidationDecimal = entryPriceDecimal * (1 - 1 / leverage);
  const liquidationCents = Math.max(0, Math.round(liquidationDecimal * 1000) / 10);
  const maxWin = entryPriceDecimal > 0 && entryPriceDecimal < 1
    ? shares * (1 - entryPriceDecimal)
    : 0;

  if (loading) {
    return (
      <div className="bg-gray-950 p-4 sm:p-6 rounded-2xl border border-[#00FF99]/25 shadow-[0_0_40px_rgba(0,255,153,0.08)] h-full flex flex-col justify-center items-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-8 h-8 text-[#00FF99]" />
        </motion.div>
        <span className="mt-3 text-gray-400 text-sm">Loading live market data...</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 p-4 sm:p-6 rounded-2xl border border-[#00FF99]/25 shadow-[0_0_40px_rgba(0,255,153,0.08)] h-full flex flex-col min-w-0">
      {/* Header with Live Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[0.65rem] bg-[#00FF99]/15 text-[#00FF99] border border-[#00FF99]/40 uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF99] animate-pulse" />
            LIVE
          </span>
          <span className="text-xs text-gray-500">Real-time from Polymarket</span>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="p-1.5 rounded-lg hover:bg-[#00FF99]/10 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <motion.div
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
          >
            <RefreshCw className="w-4 h-4 text-[#00FF99]" />
          </motion.div>
        </button>
      </div>

      {/* Market Question */}
      <h3 className="text-white font-bold text-lg sm:text-xl mb-4 leading-tight">
        {market?.title || "Will Jesus Christ return before 2027?"}
      </h3>

      {/* Outcome Buttons - YES/NO */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <motion.button
          onClick={() => setSelectedOutcome("YES")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative p-4 rounded-xl border-2 transition-all ${
            selectedOutcome === "YES"
              ? "bg-[#00FF99]/10 border-[#00FF99] shadow-[0_0_20px_rgba(0,255,153,0.2)]"
              : "bg-gray-900/50 border-gray-700 hover:border-[#00FF99]/50"
          }`}
        >
          <div className="flex flex-col items-center">
            <span className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
              selectedOutcome === "YES" ? "text-[#00FF99]" : "text-gray-400"
            }`}>
              Yes
            </span>
            <AnimatedValue
              value={market?.yesProbability}
              className={`text-2xl sm:text-3xl font-bold ${
                selectedOutcome === "YES" ? "text-[#00FF99]" : "text-white"
              }`}
              suffix="%"
            />
            <span className="text-xs text-gray-500 mt-1">
              {market?.yesPrice ? `${market.yesPrice}¢` : '--'}
            </span>
          </div>
          {/* Price change indicator */}
          <AnimatePresence>
            {selectedOutcome === "YES" && priceChange !== 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`absolute top-2 right-2 flex items-center gap-0.5 text-xs font-semibold ${
                  priceChange > 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {priceChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(priceChange).toFixed(1)}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        <motion.button
          onClick={() => setSelectedOutcome("NO")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative p-4 rounded-xl border-2 transition-all ${
            selectedOutcome === "NO"
              ? "bg-red-500/10 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
              : "bg-gray-900/50 border-gray-700 hover:border-red-500/50"
          }`}
        >
          <div className="flex flex-col items-center">
            <span className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
              selectedOutcome === "NO" ? "text-red-400" : "text-gray-400"
            }`}>
              No
            </span>
            <AnimatedValue
              value={market?.noProbability}
              className={`text-2xl sm:text-3xl font-bold ${
                selectedOutcome === "NO" ? "text-red-400" : "text-white"
              }`}
              suffix="%"
            />
            <span className="text-xs text-gray-500 mt-1">
              {market?.noPrice ? `${market.noPrice}¢` : '--'}
            </span>
          </div>
        </motion.button>
      </div>

      {/* Market Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-black/40 rounded-lg p-3 border border-gray-800/50">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span>24h Volume</span>
          </div>
          <AnimatedValue
            value={market?.volume24h || market?.volume}
            format={formatVolume}
            className="text-white font-bold text-lg"
          />
        </div>
        
        <div className="bg-black/40 rounded-lg p-3 border border-gray-800/50">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Total Volume</span>
          </div>
          <AnimatedValue
            value={market?.volume}
            format={formatVolume}
            className="text-white font-bold text-lg"
          />
        </div>

        <div className="bg-black/40 rounded-lg p-3 border border-gray-800/50">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Liquidity</span>
          </div>
          <AnimatedValue
            value={market?.liquidity}
            format={formatVolume}
            className="text-white font-bold text-lg"
          />
        </div>

        <div className="bg-black/40 rounded-lg p-3 border border-gray-800/50">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>Traders</span>
          </div>
          <AnimatedValue
            value={market?.traders}
            format={formatNumber}
            className="text-white font-bold text-lg"
          />
        </div>
      </div>

      {/* Best Bid/Ask Display - updates by selected outcome (YES vs NO) */}
      {(market?.bestBid != null || market?.bestAsk != null) && (
        <div className="bg-black/40 rounded-lg p-3 border border-gray-800/50 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">
              Order book for <span className={selectedOutcome === "YES" ? "text-[#00FF99] font-medium" : "text-red-400 font-medium"}>{selectedOutcome}</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-gray-400 text-xs">Best Bid</span>
              <motion.div
                key={`bid-${selectedOutcome}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className={selectedOutcome === "YES" ? "text-[#00FF99] font-mono font-bold" : "text-red-400 font-mono font-bold"}
              >
                {selectedOutcome === "YES"
                  ? (market.bestBid != null ? `${(market.bestBid * 100).toFixed(1)}¢` : '--')
                  : (market.bestAsk != null ? `${((1 - market.bestAsk) * 100).toFixed(1)}¢` : '--')}
              </motion.div>
            </div>
            <div className="h-8 w-px bg-gray-700" />
            <div className="text-right">
              <span className="text-gray-400 text-xs">Best Ask</span>
              <motion.div
                key={`ask-${selectedOutcome}`}
                initial={{ opacity: 0, x: 4 }}
                animate={{ opacity: 1, x: 0 }}
                className={selectedOutcome === "YES" ? "text-[#00FF99] font-mono font-bold" : "text-red-400 font-mono font-bold"}
              >
                {selectedOutcome === "YES"
                  ? (market.bestAsk != null ? `${(market.bestAsk * 100).toFixed(1)}¢` : '--')
                  : (market.bestBid != null ? `${((1 - market.bestBid) * 100).toFixed(1)}¢` : '--')}
              </motion.div>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5">
            {selectedOutcome === "YES"
              ? "Bid = buy YES · Ask = sell YES"
              : "Bid = buy NO · Ask = sell NO (inverted from YES)"}
          </p>
        </div>
      )}

      {/* Demo: Leverage, Amount, Liquidation */}
      <div className="border border-[#00FF99]/20 rounded-xl p-4 bg-black/30 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Leverage demo</span>
          <span className="text-[10px] text-gray-500">Simulation only</span>
        </div>

        {/* Leverage 1x–5x */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <label className="text-gray-400 text-sm">Leverage</label>
            <span className="text-[#00FF99] font-bold">{leverage.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="0.5"
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#00FF99]"
            style={{
              background: `linear-gradient(to right, #00FF99 0%, #00FF99 ${((leverage - 1) / 4) * 100}%, #333 ${((leverage - 1) / 4) * 100}%, #333 100%)`,
            }}
          />
          <div className="flex justify-between gap-1">
            {[1, 2, 3, 4, 5].map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setLeverage(x)}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                  Math.round(leverage) === x
                    ? "bg-[#00FF99] text-black border-[#00FF99]"
                    : "bg-gray-900 text-gray-300 border-gray-700 hover:border-[#00FF99]/60"
                }`}
              >
                {x}x
              </button>
            ))}
          </div>
        </div>

        {/* Amount (margin) */}
        <div className="mb-4">
          <label className="text-gray-400 text-sm block mb-1">Amount (margin)</label>
          <div className="flex rounded-lg border border-gray-700 bg-black overflow-hidden">
            <span className="px-3 py-2.5 text-gray-400 text-sm border-r border-gray-700">$</span>
            <input
              type="number"
              min="0"
              step="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="flex-1 bg-transparent px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Summary: Entry, Position, Liquidation, Max win (all update with live market) */}
        <div className="bg-black/50 rounded-lg p-3 border border-[#00FF99]/10 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Entry price</span>
            <AnimatedValue value={entryPriceCents} format={(v) => (v ?? 0).toFixed(1)} className="text-white font-mono font-semibold" suffix="¢" />
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Position size</span>
            <AnimatedValue value={positionSize} format={(v) => (v ?? 0).toFixed(2)} className="text-white font-medium" prefix="$" />
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Liquidation price</span>
            <AnimatedValue value={liquidationCents} format={(v) => (v ?? 0).toFixed(1)} className="text-red-400 font-semibold font-mono" suffix="¢" />
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">To win (max)</span>
            <AnimatedValue value={maxWin} format={(v) => (v ?? 0).toFixed(2)} className="text-[#00FF99] font-semibold" prefix="$" />
          </div>
        </div>
      </div>

      {/* Spacer to push button to bottom */}
      <div className="flex-1" />

      {/* Footer with last update */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF99] animate-pulse" />
          <span>Real-time · every 5s</span>
        </div>
        {lastUpdate && (
          <span className="font-mono">{lastUpdate.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
