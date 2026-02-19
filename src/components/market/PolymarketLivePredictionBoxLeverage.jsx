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
  slug = "will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568",
  refreshInterval = 5000, // 5s for real-time feel
  compact = false,
  valueAmount,
  valueLeverage,
  valueOutcome,
  onAmountChange,
  onLeverageChange,
  onOutcomeChange,
}) {
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const prevProbability = useRef(null);
  // Demo leverage section – controlled from parent when value* / on*Change provided
  const [internalLeverage, setInternalLeverage] = useState(2);
  const [internalAmount, setInternalAmount] = useState("100");
  const [internalOutcome, setInternalOutcome] = useState("YES");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const leverage = valueLeverage !== undefined && valueLeverage !== null ? valueLeverage : internalLeverage;
  const setLeverage = onLeverageChange || setInternalLeverage;
  const amount = valueAmount !== undefined ? valueAmount : internalAmount;
  const setAmount = onAmountChange || setInternalAmount;
  const selectedOutcome = valueOutcome !== undefined ? valueOutcome : internalOutcome;
  const setSelectedOutcome = onOutcomeChange || setInternalOutcome;

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
    // Live cents: YES = bestAsk (price to buy YES); NO = 100 - YES so they add to 100¢ (binary)
    const yesCents = bestAsk != null && bestAsk >= 0 && bestAsk <= 1
      ? Math.round(bestAsk * 1000) / 10
      : (yesPriceFromGamma != null ? Math.round(yesPriceFromGamma * 1000) / 10 : null);
    const noCents = yesCents != null
      ? Math.round((100 - yesCents) * 10) / 10
      : (noPriceFromGamma != null ? Math.round(noPriceFromGamma * 1000) / 10 : null);
    const yesProbability = yesCents != null ? yesCents : null;
    const noProbability = noCents != null ? noCents : null;

    return {
      title: m.question || "Will Gavin Newsom win the 2028 Democratic presidential nomination?",
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

  // Demo leverage calculations (entry = live best ask for selected outcome); cap collateral at 5000
  const amountNum = Math.min(5000, Math.max(0, parseFloat(amount) || 0));
  const entryPriceDecimal = selectedOutcome === "YES"
    ? (market?.bestAsk ?? (market?.yesProbability != null ? market.yesProbability / 100 : 0.04))
    : (market?.bestBid != null ? 1 - market.bestBid : (market?.noProbability != null ? market.noProbability / 100 : 0.96));
  const entryPriceCents = Math.round(entryPriceDecimal * 1000) / 10;

  // TP/SL validation (cents): YES = TP > entry, SL < entry; NO = TP < entry, SL > entry
  const tpNum = takeProfit === "" || takeProfit === "." ? null : parseFloat(takeProfit);
  const slNum = stopLoss === "" || stopLoss === "." ? null : parseFloat(stopLoss);
  const entry = entryPriceCents ?? 50;
  const isYES = selectedOutcome === "YES";
  const tpValid = tpNum == null || (typeof tpNum === "number" && !Number.isNaN(tpNum) && tpNum >= 0 && tpNum <= 100 && (isYES ? tpNum > entry : tpNum < entry));
  const slValid = slNum == null || (typeof slNum === "number" && !Number.isNaN(slNum) && slNum >= 0 && slNum <= 100 && (isYES ? slNum < entry : slNum > entry));
  const tpError = takeProfit.trim() !== "" && !tpValid
    ? (isYES ? `TP must be > ${entry.toFixed(1)}¢ (entry)` : `TP must be < ${entry.toFixed(1)}¢ (entry)`)
    : "";
  const slError = stopLoss.trim() !== "" && !slValid
    ? (isYES ? `SL must be < ${entry.toFixed(1)}¢ (entry)` : `SL must be > ${entry.toFixed(1)}¢ (entry)`)
    : "";

  const positionSize = amountNum * leverage;
  const shares = entryPriceDecimal > 0 ? positionSize / entryPriceDecimal : 0;
  // Liquidation price with 30% buffer: liquidate earlier to leave protocol cushion
  const liquidationBuffer = 0.30;
  const liquidationDecimal = entryPriceDecimal * (1 - (1 / leverage) * (1 + liquidationBuffer));
  const liquidationCents = Math.max(0, Math.round(liquidationDecimal * 1000) / 10);
  const maxWin = entryPriceDecimal > 0 && entryPriceDecimal < 1
    ? shares * (1 - entryPriceDecimal)
    : 0;

  if (loading) {
    return (
      <div className="bg-gray-950 p-2 md:p-3 rounded-lg md:rounded-xl border border-[#00FF99]/25 shadow-[0_0_30px_rgba(0,255,153,0.06)] h-full flex flex-col justify-center items-center min-h-[140px] md:min-h-[240px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-6 h-6 text-[#00FF99]" />
        </motion.div>
        <span className="mt-2 text-gray-400 text-xs">Loading live market data...</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 rounded-lg md:rounded-xl border border-[#00FF99]/25 h-full min-h-0 flex flex-col min-w-0 p-2 md:p-3 shadow-[0_0_30px_rgba(0,255,153,0.06)]">
      {/* Header – compact */}
      <div className="flex items-center justify-between mb-1 md:mb-2 flex-shrink-0">
        <div className="flex items-center gap-1 md:gap-1.5">
          <span className="px-1 md:px-1.5 py-0.5 rounded-full text-[0.5rem] md:text-[0.55rem] bg-[#00FF99]/15 text-[#00FF99] border border-[#00FF99]/40 uppercase tracking-wider font-semibold flex items-center gap-0.5">
            <span className="w-0.5 h-0.5 md:w-1 md:h-1 rounded-full bg-[#00FF99] animate-pulse" />
            LIVE
          </span>
          <span className="text-[8px] md:text-[9px] text-gray-500 hidden sm:inline">Polymarket</span>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="p-1 rounded-md hover:bg-[#00FF99]/10 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <motion.div
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
          >
            <RefreshCw className="w-3 h-3 text-[#00FF99]" />
          </motion.div>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Market Question */}
      <h3 className="text-white font-bold text-[10px] md:text-sm mb-1 md:mb-2 leading-tight">
        {market?.title || "Will Bitcoin reach $100,000 by December 31, 2026?"}
      </h3>

      {/* Outcome Buttons – compact */}
      <div className="grid grid-cols-2 gap-1 md:gap-2 mb-1 md:mb-2">
        <motion.button
          onClick={() => setSelectedOutcome("YES")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative p-1.5 md:p-2 rounded-md border-2 transition-all ${
            selectedOutcome === "YES"
              ? "bg-[#00FF99]/10 border-[#00FF99] shadow-[0_0_12px_rgba(0,255,153,0.15)]"
              : "bg-gray-900/50 border-gray-700 hover:border-[#00FF99]/50"
          }`}
        >
          <div className="flex flex-col items-center">
            <span className={`text-[8px] md:text-[9px] font-semibold uppercase tracking-wider mb-0 ${
              selectedOutcome === "YES" ? "text-[#00FF99]" : "text-gray-400"
            }`}>
              Yes
            </span>
            <AnimatedValue
              value={market?.yesPrice != null ? parseFloat(market.yesPrice) : market?.yesProbability}
              className={`text-sm md:text-lg font-bold ${selectedOutcome === "YES" ? "text-[#00FF99]" : "text-white"}`}
              suffix="¢"
            />
          </div>
          <AnimatePresence>
            {selectedOutcome === "YES" && priceChange !== 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`absolute top-0.5 right-0.5 flex items-center gap-0.5 text-[9px] font-semibold ${
                  priceChange > 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {priceChange > 0 ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
                {Math.abs(priceChange).toFixed(1)}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        <motion.button
          onClick={() => setSelectedOutcome("NO")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative p-1.5 md:p-2 rounded-md border-2 transition-all ${
            selectedOutcome === "NO"
              ? "bg-red-500/10 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
              : "bg-gray-900/50 border-gray-700 hover:border-red-500/50"
          }`}
        >
          <div className="flex flex-col items-center">
            <span className={`text-[8px] md:text-[9px] font-semibold uppercase tracking-wider mb-0 ${
              selectedOutcome === "NO" ? "text-red-400" : "text-gray-400"
            }`}>
              No
            </span>
            <AnimatedValue
              value={market?.noPrice != null ? parseFloat(market.noPrice) : market?.noProbability}
              className={`text-sm md:text-lg font-bold ${selectedOutcome === "NO" ? "text-red-400" : "text-white"}`}
              suffix="¢"
            />
          </div>
        </motion.button>
      </div>

      {/* Market Stats – compact */}
      <div className="grid grid-cols-4 gap-0.5 md:gap-1 mb-1 md:mb-2">
        <div className="bg-black/40 rounded-md p-0.5 md:p-1.5 border border-gray-800/50 text-center md:text-left">
          <div className="hidden md:flex items-center gap-1 text-gray-400 text-[9px] mb-0.5"><Activity className="w-2.5 h-2.5" /><span>24h Vol</span></div>
          <div className="text-gray-400 text-[6px] md:hidden mb-0">24h</div>
          <AnimatedValue value={market?.volume24h || market?.volume} format={formatVolume} className="text-white font-bold text-[8px] md:text-xs" />
        </div>
        <div className="bg-black/40 rounded-md p-0.5 md:p-1.5 border border-gray-800/50 text-center md:text-left">
          <div className="hidden md:flex items-center gap-1 text-gray-400 text-[9px] mb-0.5"><DollarSign className="w-2.5 h-2.5" /><span>Vol</span></div>
          <div className="text-gray-400 text-[6px] md:hidden mb-0">Vol</div>
          <AnimatedValue value={market?.volume} format={formatVolume} className="text-white font-bold text-[8px] md:text-xs" />
        </div>
        <div className="bg-black/40 rounded-md p-0.5 md:p-1.5 border border-gray-800/50 text-center md:text-left">
          <div className="hidden md:flex items-center gap-1 text-gray-400 text-[9px] mb-0.5"><Zap className="w-2.5 h-2.5" /><span>Liq</span></div>
          <div className="text-gray-400 text-[6px] md:hidden mb-0">Liq</div>
          <AnimatedValue value={market?.liquidity} format={formatVolume} className="text-white font-bold text-[8px] md:text-xs" />
        </div>
        <div className="bg-black/40 rounded-md p-0.5 md:p-1.5 border border-gray-800/50 text-center md:text-left">
          <div className="hidden md:flex items-center gap-1 text-gray-400 text-[9px] mb-0.5"><Users className="w-2.5 h-2.5" /><span>Traders</span></div>
          <div className="text-gray-400 text-[6px] md:hidden mb-0">Tr</div>
          <AnimatedValue value={market?.traders} format={formatNumber} className="text-white font-bold text-[8px] md:text-xs" />
        </div>
      </div>

      {/* Best Bid/Ask – compact */}
      {(market?.bestBid != null || market?.bestAsk != null) && (
        <div className="bg-black/40 rounded-md p-1 md:p-2 border border-gray-800/50 mb-1 md:mb-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-gray-400 text-[9px] md:text-[10px]">Order book · <span className={selectedOutcome === "YES" ? "text-[#00FF99] font-medium" : "text-red-400 font-medium"}>{selectedOutcome}</span></span>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-gray-400 text-[8px] md:text-[9px]">Bid</span>
              <motion.div key={`bid-${selectedOutcome}`} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className={`font-mono font-bold text-[10px] md:text-xs ${selectedOutcome === "YES" ? "text-[#00FF99]" : "text-red-400"}`}>
                {selectedOutcome === "YES" ? (market.bestBid != null ? `${(market.bestBid * 100).toFixed(1)}¢` : '--') : (market.bestAsk != null ? `${((1 - market.bestAsk) * 100).toFixed(1)}¢` : '--')}
              </motion.div>
            </div>
            <div className="h-5 w-px bg-gray-700" />
            <div className="text-right">
              <span className="text-gray-400 text-[8px] md:text-[9px]">Ask</span>
              <motion.div key={`ask-${selectedOutcome}`} initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }} className={`font-mono font-bold text-[10px] md:text-xs ${selectedOutcome === "YES" ? "text-[#00FF99]" : "text-red-400"}`}>
                {selectedOutcome === "YES" ? (market.bestAsk != null ? `${(market.bestAsk * 100).toFixed(1)}¢` : '--') : (market.bestBid != null ? `${((1 - market.bestBid) * 100).toFixed(1)}¢` : '--')}
              </motion.div>
            </div>
          </div>
        </div>
      )}

      {/* Leverage demo – compact */}
      <div className="border border-[#00FF99]/20 rounded-md md:rounded-lg p-1.5 md:p-2 bg-black/30 mb-1 md:mb-2">
        <div className="flex items-center justify-between mb-0.5 md:mb-1">
          <span className="text-gray-400 text-[8px] md:text-[9px] font-semibold uppercase tracking-wider">Leverage demo</span>
          <span className="text-[8px] text-gray-500">Simulation only</span>
        </div>
        <div className="space-y-0.5 md:space-y-1 mb-1 md:mb-2">
          <div className="flex justify-between items-center">
            <label className="text-gray-400 text-[9px] md:text-xs">Leverage</label>
            <span className="text-[#00FF99] font-bold text-[9px] md:text-sm">{leverage.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="0.5"
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value))}
            className="w-full h-1 md:h-1.5 bg-gray-700 rounded appearance-none cursor-pointer accent-[#00FF99]"
            style={{
              background: `linear-gradient(to right, #00FF99 0%, #00FF99 ${((leverage - 1) / 4) * 100}%, #333 ${((leverage - 1) / 4) * 100}%, #333 100%)`,
            }}
          />
          <div className="flex justify-between gap-0.5">
            {[1, 2, 3, 4, 5].map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setLeverage(x)}
                className={`flex-1 py-0.5 md:py-1 rounded text-[8px] md:text-[9px] font-semibold border transition-colors cursor-pointer ${
                  Math.round(leverage) === x ? "bg-[#00FF99] text-black border-[#00FF99]" : "bg-gray-900 text-gray-300 border-gray-700 hover:border-[#00FF99]/60"
                }`}
              >
                {x}x
              </button>
            ))}
          </div>
        </div>

        <div className="mb-1 md:mb-2">
          <label className="text-gray-400 text-[8px] md:text-[9px] block mb-0">Amount (Collateral)</label>
          <div className="flex rounded border border-gray-700 bg-black overflow-hidden">
            <span className="px-1.5 md:px-2 py-1 md:py-1.5 text-gray-400 text-[9px] md:text-xs border-r border-gray-700">$</span>
            <input
              type="number"
              min="0"
              max="5000"
              step="10"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || v === ".") {
                  setAmount(v);
                  return;
                }
                const n = parseFloat(v);
                if (!Number.isNaN(n) && n > 5000) setAmount("5000");
                else setAmount(v);
              }}
              placeholder="0"
              className="flex-1 bg-transparent px-1.5 md:px-2 py-1 md:py-1.5 text-white text-[9px] md:text-xs focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-1 md:mb-2">
          <div>
            <label className="text-gray-400 text-[8px] md:text-[9px] block mb-0">Take Profit (TP)</label>
            <div className={`flex rounded border overflow-hidden bg-black ${tpError ? "border-red-500/60" : "border-gray-700"}`}>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="¢"
                className="w-full bg-transparent px-1.5 md:px-2 py-1 md:py-1.5 text-white text-[9px] md:text-xs focus:outline-none focus:ring-0"
              />
              <span className="px-1 py-1 text-gray-500 text-[8px] flex items-center">¢</span>
            </div>
            {tpError && <p className="text-red-400 text-[8px] mt-0.5">{tpError}</p>}
          </div>
          <div>
            <label className="text-gray-400 text-[8px] md:text-[9px] block mb-0">Stop Loss (SL)</label>
            <div className={`flex rounded border overflow-hidden bg-black ${slError ? "border-red-500/60" : "border-gray-700"}`}>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="¢"
                className="w-full bg-transparent px-1.5 md:px-2 py-1 md:py-1.5 text-white text-[9px] md:text-xs focus:outline-none focus:ring-0"
              />
              <span className="px-1 py-1 text-gray-500 text-[8px] flex items-center">¢</span>
            </div>
            {slError && <p className="text-red-400 text-[8px] mt-0.5">{slError}</p>}
          </div>
        </div>

        <div className="bg-black/50 rounded p-1 md:p-1.5 border border-[#00FF99]/10 space-y-0.5 text-[8px] md:text-[9px]">
          <div className="flex justify-between"><span className="text-gray-400">Entry</span><AnimatedValue value={entryPriceCents} format={(v) => (v ?? 0).toFixed(1)} className="text-white font-mono font-semibold" suffix="¢" /></div>
          <div className="flex justify-between"><span className="text-gray-400">Position</span><AnimatedValue value={positionSize} format={(v) => (v ?? 0).toFixed(2)} className="text-white font-medium" prefix="$" /></div>
          <div className="flex justify-between"><span className="text-gray-400" title="30% liquidation buffer included">Liq. price <span className="text-gray-500 text-[10px]">(buffer incl.)</span></span><AnimatedValue value={liquidationCents} format={(v) => (v ?? 0).toFixed(1)} className="text-red-400 font-semibold font-mono" suffix="¢" /></div>
          <div className="flex justify-between"><span className="text-gray-400">To win</span><AnimatedValue value={maxWin} format={(v) => (v ?? 0).toFixed(2)} className="text-[#00FF99] font-semibold" prefix="$" /></div>
        </div>
      </div>

      </div>

      <div className="flex items-center justify-between mt-1 md:mt-2 text-[8px] md:text-[9px] text-gray-500 flex-shrink-0">
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
