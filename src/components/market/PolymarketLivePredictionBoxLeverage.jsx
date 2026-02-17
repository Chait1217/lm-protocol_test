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
  slug = "will-bitcoin-reach-100000-by-december-31-2026-571",
  refreshInterval = 5000, // 5s for real-time feel
  compact = false,
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

  // Parse market data – prefer CLOB bestBid/bestAsk for live cents
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
    
    const bestBid = m.bestBid != null ? parseFloat(m.bestBid) : null;
    const bestAsk = m.bestAsk != null ? parseFloat(m.bestAsk) : null;
    const yesPriceFromGamma = outcomePrices[0] ? parseFloat(outcomePrices[0]) : null;
    const noPriceFromGamma = outcomePrices[1] ? parseFloat(outcomePrices[1]) : (yesPriceFromGamma ? 1 - yesPriceFromGamma : null);
    // Live cents: CLOB bestAsk = YES price (0–1), (1 - bestBid) = NO price
    const yesCents = bestAsk != null && bestAsk >= 0 && bestAsk <= 1
      ? Math.round(bestAsk * 1000) / 10
      : (yesPriceFromGamma != null ? Math.round(yesPriceFromGamma * 1000) / 10 : null);
    const noCents = bestBid != null && bestBid >= 0 && bestBid <= 1
      ? Math.round((1 - bestBid) * 1000) / 10
      : (noPriceFromGamma != null ? Math.round(noPriceFromGamma * 1000) / 10 : null);
    const yesProbability = yesCents != null ? yesCents : null;
    const noProbability = noCents != null ? noCents : null;

    return {
      title: m.question || "Will Bitcoin reach $100,000 by December 31, 2026?",
      yesProbability,
      noProbability,
      yesPrice: yesCents != null ? yesCents.toFixed(1) : null,
      noPrice: noCents != null ? noCents.toFixed(1) : null,
      volume: parseFloat(m.volume) || parseFloat(m.volumeNum) || parseFloat(m.volumeClob) || 0,
      volume24h: parseFloat(m.volume24hr) || parseFloat(m.volume24hrClob) || 0,
      liquidity: parseFloat(m.liquidity) || parseFloat(m.liquidityNum) || 0,
      traders: parseInt(m.uniqueBettors) || parseInt(m.uniqueTraders) || null,
      oneDayChange: parseFloat(m.oneDayPriceChange) || 0,
      bestBid: bestBid ?? null,
      bestAsk: bestAsk ?? null,
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
      <div className="bg-gray-950 p-3 md:p-4 sm:p-6 rounded-xl md:rounded-2xl border border-[#00FF99]/25 shadow-[0_0_40px_rgba(0,255,153,0.08)] h-full flex flex-col justify-center items-center min-h-[200px] md:min-h-[400px]">
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
    <div className="bg-gray-950 rounded-xl md:rounded-2xl border border-[#00FF99]/25 h-full min-h-0 flex flex-col min-w-0 p-2.5 md:p-4 sm:p-6 shadow-[0_0_40px_rgba(0,255,153,0.08)]">
      {/* Header with Live Badge */}
      <div className="flex items-center justify-between mb-2 md:mb-4 flex-shrink-0">
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full text-[0.55rem] md:text-[0.65rem] bg-[#00FF99]/15 text-[#00FF99] border border-[#00FF99]/40 uppercase tracking-widest font-semibold flex items-center gap-1 md:gap-1.5">
            <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-[#00FF99] animate-pulse" />
            LIVE
          </span>
          <span className="text-[9px] md:text-xs text-gray-500 hidden sm:inline">Real-time from Polymarket</span>
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

      <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Market Question */}
      <h3 className="text-white font-bold text-xs md:text-lg sm:text-xl mb-2 md:mb-4 leading-tight">
        {market?.title || "Will Bitcoin reach $100,000 by December 31, 2026?"}
      </h3>

      {/* Outcome Buttons - YES/NO (cents only) */}
      <div className="grid grid-cols-2 gap-1.5 md:gap-3 mb-2 md:mb-5">
        <motion.button
          onClick={() => setSelectedOutcome("YES")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative p-2 md:p-4 rounded-lg md:rounded-xl border-2 transition-all ${
            selectedOutcome === "YES"
              ? "bg-[#00FF99]/10 border-[#00FF99] shadow-[0_0_20px_rgba(0,255,153,0.2)]"
              : "bg-gray-900/50 border-gray-700 hover:border-[#00FF99]/50"
          }`}
        >
          <div className="flex flex-col items-center">
            <span className={`text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-0.5 md:mb-1 ${
              selectedOutcome === "YES" ? "text-[#00FF99]" : "text-gray-400"
            }`}>
              Yes
            </span>
            <AnimatedValue
              value={market?.yesPrice != null ? parseFloat(market.yesPrice) : market?.yesProbability}
              className={`text-lg md:text-2xl sm:text-3xl font-bold ${selectedOutcome === "YES" ? "text-[#00FF99]" : "text-white"}`}
              suffix="¢"
            />
          </div>
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
          className={`relative p-2 md:p-4 rounded-lg md:rounded-xl border-2 transition-all ${
            selectedOutcome === "NO"
              ? "bg-red-500/10 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
              : "bg-gray-900/50 border-gray-700 hover:border-red-500/50"
          }`}
        >
          <div className="flex flex-col items-center">
            <span className={`text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-0.5 md:mb-1 ${
              selectedOutcome === "NO" ? "text-red-400" : "text-gray-400"
            }`}>
              No
            </span>
            <AnimatedValue
              value={market?.noPrice != null ? parseFloat(market.noPrice) : market?.noProbability}
              className={`text-lg md:text-2xl sm:text-3xl font-bold ${selectedOutcome === "NO" ? "text-red-400" : "text-white"}`}
              suffix="¢"
            />
          </div>
        </motion.button>
      </div>

      {/* Market Stats Grid */}
      <div className="grid grid-cols-4 md:grid-cols-2 gap-1 md:gap-3 mb-2 md:mb-5">
        <div className="bg-black/40 rounded-lg p-1 md:p-3 border border-gray-800/50 text-center md:text-left">
          <div className="hidden md:flex items-center gap-2 text-gray-400 text-xs mb-1"><Activity className="w-3.5 h-3.5" /><span>24h Volume</span></div>
          <div className="text-gray-400 text-[7px] md:hidden mb-0.5">24h Vol</div>
          <AnimatedValue value={market?.volume24h || market?.volume} format={formatVolume} className="text-white font-bold text-[10px] md:text-lg" />
        </div>
        <div className="bg-black/40 rounded-lg p-1 md:p-3 border border-gray-800/50 text-center md:text-left">
          <div className="hidden md:flex items-center gap-2 text-gray-400 text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /><span>Total Volume</span></div>
          <div className="text-gray-400 text-[7px] md:hidden mb-0.5">Total Vol</div>
          <AnimatedValue value={market?.volume} format={formatVolume} className="text-white font-bold text-[10px] md:text-lg" />
        </div>
        <div className="bg-black/40 rounded-lg p-1 md:p-3 border border-gray-800/50 text-center md:text-left">
          <div className="hidden md:flex items-center gap-2 text-gray-400 text-xs mb-1"><Zap className="w-3.5 h-3.5" /><span>Liquidity</span></div>
          <div className="text-gray-400 text-[7px] md:hidden mb-0.5">Liquidity</div>
          <AnimatedValue value={market?.liquidity} format={formatVolume} className="text-white font-bold text-[10px] md:text-lg" />
        </div>
        <div className="bg-black/40 rounded-lg p-1 md:p-3 border border-gray-800/50 text-center md:text-left">
          <div className="hidden md:flex items-center gap-2 text-gray-400 text-xs mb-1"><Users className="w-3.5 h-3.5" /><span>Traders</span></div>
          <div className="text-gray-400 text-[7px] md:hidden mb-0.5">Traders</div>
          <AnimatedValue value={market?.traders} format={formatNumber} className="text-white font-bold text-[10px] md:text-lg" />
        </div>
      </div>

      {/* Best Bid/Ask */}
      {(market?.bestBid != null || market?.bestAsk != null) && (
        <div className="bg-black/40 rounded-lg p-1.5 md:p-3 border border-gray-800/50 mb-2 md:mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">Order book for <span className={selectedOutcome === "YES" ? "text-[#00FF99] font-medium" : "text-red-400 font-medium"}>{selectedOutcome}</span></span>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-gray-400 text-xs">Best Bid</span>
              <motion.div key={`bid-${selectedOutcome}`} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className={`font-mono font-bold ${selectedOutcome === "YES" ? "text-[#00FF99]" : "text-red-400"}`}>
                {selectedOutcome === "YES" ? (market.bestBid != null ? `${(market.bestBid * 100).toFixed(1)}¢` : '--') : (market.bestAsk != null ? `${((1 - market.bestAsk) * 100).toFixed(1)}¢` : '--')}
              </motion.div>
            </div>
            <div className="h-8 w-px bg-gray-700" />
            <div className="text-right">
              <span className="text-gray-400 text-xs">Best Ask</span>
              <motion.div key={`ask-${selectedOutcome}`} initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }} className={`font-mono font-bold ${selectedOutcome === "YES" ? "text-[#00FF99]" : "text-red-400"}`}>
                {selectedOutcome === "YES" ? (market.bestAsk != null ? `${(market.bestAsk * 100).toFixed(1)}¢` : '--') : (market.bestBid != null ? `${((1 - market.bestBid) * 100).toFixed(1)}¢` : '--')}
              </motion.div>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5">{selectedOutcome === "YES" ? "Bid = buy YES · Ask = sell YES" : "Bid = buy NO · Ask = sell NO (inverted from YES)"}</p>
        </div>
      )}

      {/* Demo: Leverage, Amount, Liquidation */}
      <div className="border border-[#00FF99]/20 rounded-lg md:rounded-xl p-2 md:p-4 bg-black/30 mb-2 md:mb-5">
        <div className="flex items-center justify-between mb-1.5 md:mb-3">
          <span className="text-gray-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider">Leverage demo</span>
          <span className="text-[9px] md:text-[10px] text-gray-500">Simulation only</span>
        </div>
        <div className="space-y-1.5 md:space-y-2 mb-2 md:mb-4">
          <div className="flex justify-between items-center">
            <label className="text-gray-400 text-xs md:text-sm">Leverage</label>
            <span className="text-[#00FF99] font-bold text-xs md:text-base">{leverage.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="0.5"
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value))}
            className="w-full h-1.5 md:h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#00FF99]"
            style={{
              background: `linear-gradient(to right, #00FF99 0%, #00FF99 ${((leverage - 1) / 4) * 100}%, #333 ${((leverage - 1) / 4) * 100}%, #333 100%)`,
            }}
          />
          <div className="flex justify-between gap-0.5 md:gap-1">
            {[1, 2, 3, 4, 5].map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setLeverage(x)}
                className={`flex-1 py-1 md:py-1.5 rounded-md text-[10px] md:text-xs font-semibold border transition-colors cursor-pointer ${
                  Math.round(leverage) === x ? "bg-[#00FF99] text-black border-[#00FF99]" : "bg-gray-900 text-gray-300 border-gray-700 hover:border-[#00FF99]/60"
                }`}
              >
                {x}x
              </button>
            ))}
          </div>
        </div>

        <div className="mb-2 md:mb-4">
          <label className="text-gray-400 text-xs md:text-sm block mb-0.5 md:mb-1">Amount (margin)</label>
          <div className="flex rounded-lg border border-gray-700 bg-black overflow-hidden">
            <span className="px-2 md:px-3 py-1.5 md:py-2.5 text-gray-400 text-xs md:text-sm border-r border-gray-700">$</span>
            <input
              type="number"
              min="0"
              step="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="flex-1 bg-transparent px-2 md:px-3 py-1.5 md:py-2.5 text-white text-xs md:text-sm focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        <div className="bg-black/50 rounded-lg p-2 md:p-3 border border-[#00FF99]/10 space-y-1 md:space-y-2 text-[10px] md:text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Entry price</span><AnimatedValue value={entryPriceCents} format={(v) => (v ?? 0).toFixed(1)} className="text-white font-mono font-semibold" suffix="¢" /></div>
          <div className="flex justify-between"><span className="text-gray-400">Position size</span><AnimatedValue value={positionSize} format={(v) => (v ?? 0).toFixed(2)} className="text-white font-medium" prefix="$" /></div>
          <div className="flex justify-between"><span className="text-gray-400">Liquidation price</span><AnimatedValue value={liquidationCents} format={(v) => (v ?? 0).toFixed(1)} className="text-red-400 font-semibold font-mono" suffix="¢" /></div>
          <div className="flex justify-between"><span className="text-gray-400">To win (max)</span><AnimatedValue value={maxWin} format={(v) => (v ?? 0).toFixed(2)} className="text-[#00FF99] font-semibold" prefix="$" /></div>
        </div>
      </div>

      </div>

      <div className="flex items-center justify-between mt-2 md:mt-3 text-[10px] md:text-xs text-gray-500 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-[#00FF99] animate-pulse" />
          <span>Real-time · every {refreshInterval / 1000}s</span>
        </div>
        {lastUpdate && (
          <span className="font-mono">{lastUpdate.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
