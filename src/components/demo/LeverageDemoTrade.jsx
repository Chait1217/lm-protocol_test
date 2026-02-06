import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Database,
  ArrowRight,
  ArrowDown,
  Zap,
  CheckCircle,
  RefreshCw,
  Info,
  AlertTriangle,
  Activity,
  Target,
} from "lucide-react";

// Fake prediction market questions
const FAKE_MARKETS = [
  { question: "Will Bitcoin reach $200K by end of 2026?", baseProb: 42 },
  { question: "Will SpaceX land humans on Mars before 2030?", baseProb: 28 },
  { question: "Will AI pass the Turing test by 2027?", baseProb: 65 },
  { question: "Will the US have a female president by 2028?", baseProb: 35 },
  { question: "Will Ethereum flip Bitcoin in market cap?", baseProb: 18 },
  { question: "Will Apple release AR glasses in 2026?", baseProb: 55 },
];

const LeverageDemoTrade = () => {
  // State
  const [collateral, setCollateral] = useState(1000);
  const [leverage, setLeverage] = useState(3);
  const [isTrading, setIsTrading] = useState(false);
  const [tradeStep, setTradeStep] = useState(0);
  const [vaultBalance, setVaultBalance] = useState(100000);
  const [userBalance, setUserBalance] = useState(5000);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Market simulation state
  const [selectedMarket, setSelectedMarket] = useState(FAKE_MARKETS[0]);
  const [currentProb, setCurrentProb] = useState(FAKE_MARKETS[0].baseProb);
  const [bid, setBid] = useState(FAKE_MARKETS[0].baseProb - 1);
  const [ask, setAsk] = useState(FAKE_MARKETS[0].baseProb + 1);
  const [chartData, setChartData] = useState([]);
  const [selectedOutcome, setSelectedOutcome] = useState("YES");
  const [openPrice, setOpenPrice] = useState(null);
  const [closePrice, setClosePrice] = useState(null);
  const chartInterval = useRef(null);
  const tradeStartPrice = useRef(null);
  const tickCount = useRef(0);

  // Initialize chart data
  useEffect(() => {
    const initialData = [];
    const baseProb = selectedMarket.baseProb;
    for (let i = 0; i < 20; i++) {
      initialData.push({
        time: i,
        price: baseProb + (Math.random() - 0.5) * 6,
      });
    }
    setChartData(initialData);
    setCurrentProb(baseProb);
    setBid(baseProb - 1 - Math.random() * 0.5);
    setAsk(baseProb + 1 + Math.random() * 0.5);
  }, [selectedMarket]);

  // Animate chart and bid/ask during trading - move towards 10% profit
  useEffect(() => {
    if (tradeStep >= 2 && tradeStep <= 4) {
      // Store starting price when trade begins
      if (tradeStep === 2 && tradeStartPrice.current === null) {
        tradeStartPrice.current = currentProb;
        tickCount.current = 0;
      }
      
      const totalTicks = 75; // ~30 seconds of trading at 400ms intervals
      
      chartInterval.current = setInterval(() => {
        tickCount.current += 1;
        const progress = Math.min(tickCount.current / totalTicks, 1);
        
        // Calculate target price for 10% profit
        // YES: price needs to go UP for profit
        // NO: price needs to go DOWN for profit
        const startPrice = tradeStartPrice.current || currentProb;
        const profitMove = startPrice * 0.10; // 10% move
        const targetPrice = selectedOutcome === "YES" 
          ? startPrice + profitMove 
          : startPrice - profitMove;
        
        // Gradually move towards target with some noise
        const basePrice = startPrice + (targetPrice - startPrice) * progress;
        const noise = (Math.random() - 0.5) * 2;
        const newPrice = Math.max(5, Math.min(95, basePrice + noise));
        
        setChartData(prev => {
          return [...prev.slice(-29), { time: prev.length, price: newPrice }];
        });
        
        // Update current prob and bid/ask to follow the profitable direction
        setCurrentProb(newPrice);
        setBid(newPrice - 1 - Math.random() * 0.5);
        setAsk(newPrice + 1 + Math.random() * 0.5);
      }, 400);
    } else {
      if (chartInterval.current) {
        clearInterval(chartInterval.current);
      }
      // Reset when trade completes
      if (tradeStep === 0 || tradeStep === 5) {
        tradeStartPrice.current = null;
        tickCount.current = 0;
      }
    }
    
    return () => {
      if (chartInterval.current) {
        clearInterval(chartInterval.current);
      }
    };
  }, [tradeStep, selectedOutcome]);

  // Calculations
  const totalExposure = collateral * leverage;
  const borrowedAmount = totalExposure - collateral;
  const tradingFee = totalExposure * 0.002;
  const borrowFee = borrowedAmount * 0.001;
  const totalFees = tradingFee + borrowFee;
  const interestRate = 0.20;
  const daysHeld = 7;
  const interest = (borrowedAmount * interestRate * daysHeld) / 365;
  
  // Liquidation price calculation based on leverage and entry price (bid/ask)
  // Entry price depends on selected outcome
  const entryPrice = selectedOutcome === "YES" ? ask : (100 - bid);
  const maintenanceMargin = 0.05; // 5% maintenance margin
  
  // For YES: liquidation when price drops - you get liquidated when losses exceed (1 - maintenance) of collateral
  // For NO: liquidation when price rises
  // Liquidation threshold = Entry Price - (Entry Price / leverage) * (1 - maintenance margin)
  const liquidationPrice = selectedOutcome === "YES"
    ? Math.max(0, entryPrice - (entryPrice / leverage) * (1 - maintenanceMargin))
    : Math.min(100, entryPrice + ((100 - entryPrice) / leverage) * (1 - maintenanceMargin));
  
  const lpShare = (totalFees + interest) * 0.85;
  const protocolShare = (totalFees + interest) * 0.15;

  const resetDemo = () => {
    setIsTrading(false);
    setTradeStep(0);
    setVaultBalance(100000);
    setUserBalance(5000);
    setShowSuccess(false);
    setOpenPrice(null);
    setClosePrice(null);
    // Pick a new random market
    const newMarket = FAKE_MARKETS[Math.floor(Math.random() * FAKE_MARKETS.length)];
    setSelectedMarket(newMarket);
  };

  const executeTrade = async () => {
    if (collateral > userBalance) return;
    
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setIsTrading(true);
    setShowSuccess(false);
    
    // Record open price
    const openPriceValue = selectedOutcome === "YES" ? ask : (100 - bid);
    setOpenPrice(openPriceValue);

    // Step 1: Take collateral from user
    setTradeStep(1);
    await new Promise(r => setTimeout(r, 10000));
    setUserBalance(prev => prev - collateral);

    // Step 2: Borrow from vault
    setTradeStep(2);
    await new Promise(r => setTimeout(r, 10000));
    setVaultBalance(prev => prev - borrowedAmount);

    // Step 3: Execute trade (position open)
    setTradeStep(3);
    await new Promise(r => setTimeout(r, 10000));

    // Step 4: Close trade, return borrowed + fees
    setTradeStep(4);
    await new Promise(r => setTimeout(r, 10000));
    
    // Record close price (10% profit from open)
    const closePriceValue = selectedOutcome === "YES" 
      ? openPriceValue * 1.10 
      : openPriceValue * 0.90;
    setClosePrice(closePriceValue);
    
    const profit = totalExposure * 0.10;
    const netProfit = profit - totalFees - interest;
    
    setVaultBalance(prev => prev + borrowedAmount + totalFees + interest);
    setUserBalance(prev => prev + collateral + netProfit);

    // Step 5: Complete
    setTradeStep(5);
    setShowSuccess(true);
    
    await new Promise(r => setTimeout(r, 10000));
    setIsTrading(false);
  };

  const stepLabels = [
    "Ready to trade",
    "Taking collateral from user...",
    "Borrowing from Vault...",
    "Position open - trading...",
    "Closing position, returning funds...",
    "Trade complete!"
  ];

  return (
    <div className="min-h-screen bg-black pt-20 md:pt-24 pb-12 md:pb-20 px-3 md:px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 md:mb-12"
        >
          <h1 className="text-2xl md:text-5xl font-bold text-white mb-2 md:mb-4">
            Demo <span className="text-[#00FF99]">Trade</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-lg max-w-2xl mx-auto">
            Watch how leveraged trading works: collateral flows from your wallet, 
            borrowed funds come from the Vault, and fees return to LPs.
          </p>
        </motion.div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-3 md:gap-6">
          {/* Left: Input Controls */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1 space-y-3 md:space-y-6"
          >
            {/* Market Question Card */}
            <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-xl md:rounded-2xl p-3 md:p-6">
              <h3 className="text-white font-semibold mb-2 md:mb-4 flex items-center gap-2 text-sm md:text-base">
                <Target className="w-4 h-4 md:w-5 md:h-5 text-[#00FF99]" />
                Market Question
              </h3>
              <p className="text-white text-sm md:text-lg font-medium mb-3 md:mb-4">{selectedMarket.question}</p>
              
              {/* Outcome buttons */}
              <div className="flex gap-2 md:gap-3 mb-3 md:mb-4">
                <button
                  onClick={() => setSelectedOutcome("YES")}
                  disabled={isTrading}
                  className={`flex-1 py-2 md:py-3 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all cursor-pointer ${
                    selectedOutcome === "YES"
                      ? "bg-[#00FF99] text-black"
                      : "bg-gray-800 text-[#00FF99] border border-[#00FF99]/30 hover:bg-[#00FF99]/10"
                  } disabled:opacity-50`}
                >
                  YES {currentProb.toFixed(1)}¢
                </button>
                <button
                  onClick={() => setSelectedOutcome("NO")}
                  disabled={isTrading}
                  className={`flex-1 py-2 md:py-3 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all cursor-pointer ${
                    selectedOutcome === "NO"
                      ? "bg-red-500 text-white"
                      : "bg-gray-800 text-red-400 border border-red-500/30 hover:bg-red-500/10"
                  } disabled:opacity-50`}
                >
                  NO {(100 - currentProb).toFixed(1)}¢
                </button>
              </div>
              
              {/* Bid/Ask Display */}
              <div className="bg-black/30 rounded-lg md:rounded-xl p-2.5 md:p-4">
                <div className="flex justify-between items-center mb-1.5 md:mb-2">
                  <span className="text-gray-400 text-xs md:text-sm">Best Bid</span>
                  <motion.span 
                    key={bid}
                    initial={{ color: "#00FF99" }}
                    animate={{ color: "#ffffff" }}
                    className="text-white font-mono font-semibold text-sm md:text-base"
                  >
                    {selectedOutcome === "YES" ? bid.toFixed(2) : (100 - ask).toFixed(2)}¢
                  </motion.span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-xs md:text-sm">Best Ask</span>
                  <motion.span 
                    key={ask}
                    initial={{ color: "#00FF99" }}
                    animate={{ color: "#ffffff" }}
                    className="text-white font-mono font-semibold text-sm md:text-base"
                  >
                    {selectedOutcome === "YES" ? ask.toFixed(2) : (100 - bid).toFixed(2)}¢
                  </motion.span>
                </div>
                <div className="flex justify-between items-center mt-1.5 md:mt-2 pt-1.5 md:pt-2 border-t border-gray-700">
                  <span className="text-gray-400 text-xs md:text-sm">Spread</span>
                  <span className="text-yellow-400 font-mono text-xs md:text-sm">
                    {(ask - bid).toFixed(2)}¢
                  </span>
                </div>
              </div>
            </div>

            {/* Collateral & Leverage */}
            <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-xl md:rounded-2xl p-3 md:p-6">
              {/* Collateral Section */}
              <h3 className="text-white font-semibold mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                <Wallet className="w-4 h-4 md:w-5 md:h-5 text-[#00FF99]" />
                Collateral
              </h3>
              <div className="relative">
                <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm md:text-base">$</span>
                <input
                  type="number"
                  value={collateral}
                  onChange={(e) => setCollateral(Math.max(0, Number(e.target.value)))}
                  disabled={isTrading}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg md:rounded-xl py-2 md:py-3 pl-7 md:pl-8 pr-3 md:pr-4 text-white text-lg md:text-xl font-mono focus:border-[#00FF99] focus:outline-none disabled:opacity-50"
                />
              </div>
              <p className="text-gray-500 text-xs md:text-sm mt-1.5 md:mt-2 mb-3 md:mb-5">
                Your balance: ${userBalance.toLocaleString()}
              </p>
              
              {/* Leverage Section */}
              <div className="border-t border-gray-700 pt-3 md:pt-5">
                <h3 className="text-white font-semibold mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                  <Zap className="w-4 h-4 md:w-5 md:h-5 text-[#00FF99]" />
                  Leverage: {leverage}x
                </h3>
                <div className="flex gap-1.5 md:gap-2">
                  {[1, 2, 3, 4, 5].map((l) => (
                    <button
                      key={l}
                      onClick={() => setLeverage(l)}
                      disabled={isTrading}
                      className={`flex-1 py-1.5 md:py-2 rounded-md md:rounded-lg font-semibold text-sm md:text-base transition-all cursor-pointer ${
                        leverage === l
                          ? "bg-[#00FF99] text-black"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      } disabled:opacity-50`}
                    >
                      {l}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Trade Details */}
            <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-xl md:rounded-2xl p-3 md:p-6">
              <h3 className="text-white font-semibold mb-2 md:mb-4 flex items-center gap-2 text-sm md:text-base">
                <Info className="w-4 h-4 md:w-5 md:h-5 text-[#00FF99]" />
                Trade Details
              </h3>
              <div className="space-y-1.5 md:space-y-3 text-xs md:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Exposure</span>
                  <span className="text-white font-mono">${totalExposure.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Borrowed Amount</span>
                  <span className="text-[#00FF99] font-mono">${borrowedAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Trading Fee (0.2%)</span>
                  <span className="text-yellow-400 font-mono">${tradingFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Borrow Fee (0.1%)</span>
                  <span className="text-yellow-400 font-mono">${borrowFee.toFixed(2)}</span>
                </div>
                <div className="hidden md:flex justify-between">
                  <span className="text-gray-400">Interest (7 days @ 20% APR)</span>
                  <span className="text-yellow-400 font-mono">${interest.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-700 pt-2 md:pt-3 flex justify-between">
                  <span className="text-gray-400">Total Fees</span>
                  <span className="text-yellow-400 font-mono font-semibold">${(totalFees + interest).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Entry Price ({selectedOutcome})</span>
                  <span className="text-white font-mono">{entryPrice.toFixed(2)}¢</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Liquidation Price</span>
                  <span className="text-red-400 font-mono">{liquidationPrice.toFixed(2)}¢</span>
                </div>
              </div>
            </div>

            {/* Execute Button */}
            <button
              onClick={isTrading ? undefined : executeTrade}
              disabled={isTrading || collateral > userBalance || collateral <= 0}
              className={`w-full py-3 md:py-4 rounded-lg md:rounded-xl font-bold text-base md:text-lg transition-all cursor-pointer ${
                isTrading
                  ? "bg-gray-700 text-gray-400"
                  : collateral > userBalance || collateral <= 0
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-[#00FF99] text-black hover:bg-[#00FF99]/90 hover:shadow-[0_0_30px_rgba(0,255,153,0.3)]"
              }`}
            >
              {isTrading ? "Trading in Progress..." : "Execute Demo Trade"}
            </button>

            {collateral > userBalance && (
              <p className="text-red-400 text-xs md:text-sm text-center flex items-center justify-center gap-1">
                <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" />
                Insufficient balance
              </p>
            )}

            {(showSuccess || tradeStep > 0) && (
              <button
                onClick={resetDemo}
                className="w-full py-2 md:py-3 rounded-lg md:rounded-xl font-semibold text-sm md:text-base text-gray-400 bg-gray-800 hover:bg-gray-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 md:w-4 md:h-4" />
                Reset Demo
              </button>
            )}
          </motion.div>

          {/* Right: Visual Flow & Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 space-y-3 md:space-y-6"
          >
            {/* Status Bar */}
            <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-xl md:rounded-2xl p-3 md:p-4">
              <div className="flex items-center justify-between text-sm md:text-base">
                <span className="text-gray-400">Status:</span>
                <span className={`font-semibold ${tradeStep === 5 ? "text-[#00FF99]" : tradeStep > 0 ? "text-yellow-400" : "text-gray-400"}`}>
                  {stepLabels[tradeStep]}
                </span>
              </div>
              <div className="mt-2 md:mt-3 h-1.5 md:h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#00FF99]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${(tradeStep / 5) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Live Chart (shows during trading) */}
            <AnimatePresence>
              {(tradeStep >= 2 && tradeStep <= 4) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-gray-900/50 border border-[#00FF99]/20 rounded-xl md:rounded-2xl p-3 md:p-6"
                >
                  <div className="flex items-center justify-between mb-2 md:mb-4">
                    <h3 className="text-white font-semibold text-sm md:text-base">Live Market Price</h3>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#00FF99] rounded-full animate-pulse" />
                      <span className="text-[#00FF99] text-xs md:text-sm">LIVE</span>
                    </div>
                  </div>
                  <div className="h-32 md:h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00FF99" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#00FF99" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="time" 
                          stroke="#444" 
                          tick={{ fill: '#666', fontSize: 8 }}
                          axisLine={false}
                          tickLine={false}
                          hide={true}
                        />
                        <YAxis 
                          domain={['auto', 'auto']}
                          stroke="#444" 
                          tick={{ fill: '#666', fontSize: 8 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v.toFixed(0)}¢`}
                          width={30}
                        />
                        <Area
                          type="monotone"
                          dataKey="price"
                          stroke="#00FF99"
                          strokeWidth={2}
                          fill="url(#chartGradient)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between mt-2 md:mt-4 text-xs md:text-sm">
                    <div>
                      <span className="text-gray-400">Price: </span>
                      <span className="text-[#00FF99] font-mono font-semibold">{currentProb.toFixed(2)}¢</span>
                    </div>
                    <div>
                      <span className={selectedOutcome === "YES" ? "text-[#00FF99]" : "text-red-400"}>
                        {selectedOutcome} @ {leverage}x
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Visual Flow Diagram */}
            <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-xl md:rounded-2xl p-3 md:p-6">
              <div className="grid grid-cols-3 gap-2 md:gap-6">
                {/* User Wallet */}
                <div className="flex flex-col items-center">
                  <motion.div
                    className={`w-full bg-black/50 border-2 rounded-xl md:rounded-2xl p-2 md:p-6 text-center transition-all ${
                      tradeStep === 1 ? "border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]" : "border-gray-700"
                    }`}
                    animate={tradeStep === 1 ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: tradeStep === 1 ? Infinity : 0, duration: 1 }}
                  >
                    <Wallet className="w-6 h-6 md:w-12 md:h-12 text-[#00FF99] mx-auto mb-1 md:mb-3" />
                    <h4 className="text-white font-semibold text-xs md:text-base mb-1 md:mb-2">Wallet</h4>
                    <motion.p
                      key={userBalance}
                      initial={{ scale: 1.2, color: "#00FF99" }}
                      animate={{ scale: 1, color: "#ffffff" }}
                      className="text-sm md:text-2xl font-mono font-bold"
                    >
                      ${userBalance >= 1000 ? `${(userBalance/1000).toFixed(1)}k` : userBalance.toLocaleString()}
                    </motion.p>
                    <p className="text-gray-500 text-[10px] md:text-sm mt-0.5 md:mt-1 hidden md:block">Available</p>
                  </motion.div>

                  <AnimatePresence>
                    {tradeStep === 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="my-2 md:my-4"
                      >
                        <motion.div
                          animate={{ y: [0, 5, 0] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                        >
                          <ArrowDown className="w-5 h-5 md:w-8 md:h-8 text-yellow-400" />
                        </motion.div>
                        <motion.div
                          className="text-yellow-400 text-[10px] md:text-sm font-semibold mt-1 md:mt-2 bg-yellow-400/10 px-2 md:px-3 py-0.5 md:py-1 rounded-full"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          -${collateral >= 1000 ? `${(collateral/1000).toFixed(1)}k` : collateral}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Center: Trade Position */}
                <div className="flex flex-col items-center justify-center">
                  <motion.div
                    className={`w-full bg-black/50 border-2 rounded-xl md:rounded-2xl p-2 md:p-6 text-center transition-all ${
                      tradeStep >= 2 && tradeStep <= 4
                        ? "border-[#00FF99] shadow-[0_0_30px_rgba(0,255,153,0.3)]"
                        : "border-gray-700"
                    }`}
                    animate={tradeStep >= 2 && tradeStep <= 4 ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: tradeStep >= 2 && tradeStep <= 4 ? Infinity : 0, duration: 1.5 }}
                  >
                    <TrendingUp className="w-6 h-6 md:w-12 md:h-12 text-[#00FF99] mx-auto mb-1 md:mb-3" />
                    <h4 className="text-white font-semibold text-xs md:text-base mb-1 md:mb-2">Position</h4>
                    <p className="text-sm md:text-3xl font-mono font-bold text-[#00FF99]">
                      ${totalExposure >= 1000 ? `${(totalExposure/1000).toFixed(1)}k` : totalExposure}
                    </p>
                    <p className="text-gray-500 text-[10px] md:text-sm mt-0.5 md:mt-1">{leverage}x</p>

                    <AnimatePresence>
                      {tradeStep === 3 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="mt-2 md:mt-4 bg-[#00FF99]/10 rounded-lg md:rounded-xl p-1.5 md:p-3"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                            className="inline-block"
                          >
                            <Activity className="w-4 h-4 md:w-6 md:h-6 text-[#00FF99]" />
                          </motion.div>
                          <p className="text-[#00FF99] text-[10px] md:text-sm mt-0.5 md:mt-1">Active</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <AnimatePresence>
                    {(tradeStep >= 3 && tradeStep <= 4) && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 md:mt-4 bg-gray-800/50 rounded-lg md:rounded-xl p-2 md:p-4 w-full text-[10px] md:text-sm hidden md:block"
                      >
                        <p className="text-gray-400 mb-1 md:mb-2">Fee Distribution:</p>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">LPs (85%)</span>
                          <span className="text-[#00FF99]">${lpShare.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Protocol (15%)</span>
                          <span className="text-gray-400">${protocolShare.toFixed(2)}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Vault */}
                <div className="flex flex-col items-center">
                  <motion.div
                    className={`w-full bg-black/50 border-2 rounded-xl md:rounded-2xl p-2 md:p-6 text-center transition-all ${
                      tradeStep === 2 || tradeStep === 4
                        ? "border-[#00FF99] shadow-[0_0_20px_rgba(0,255,153,0.3)]"
                        : "border-gray-700"
                    }`}
                    animate={tradeStep === 2 || tradeStep === 4 ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: tradeStep === 2 || tradeStep === 4 ? Infinity : 0, duration: 1 }}
                  >
                    <Database className="w-6 h-6 md:w-12 md:h-12 text-[#00FF99] mx-auto mb-1 md:mb-3" />
                    <h4 className="text-white font-semibold text-xs md:text-base mb-1 md:mb-2">Vault</h4>
                    <motion.p
                      key={vaultBalance}
                      initial={{ scale: 1.2, color: "#00FF99" }}
                      animate={{ scale: 1, color: "#ffffff" }}
                      className="text-sm md:text-2xl font-mono font-bold"
                    >
                      ${vaultBalance >= 1000 ? `${(vaultBalance/1000).toFixed(0)}k` : vaultBalance}
                    </motion.p>
                    <p className="text-gray-500 text-[10px] md:text-sm mt-0.5 md:mt-1 hidden md:block">Liquidity</p>
                  </motion.div>

                  <AnimatePresence>
                    {tradeStep === 2 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="my-2 md:my-4 text-center"
                      >
                        <motion.div
                          animate={{ x: [-5, 0, -5] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                        >
                          <ArrowRight className="w-5 h-5 md:w-8 md:h-8 text-[#00FF99] rotate-180" />
                        </motion.div>
                        <motion.div
                          className="text-[#00FF99] text-[10px] md:text-sm font-semibold mt-1 md:mt-2 bg-[#00FF99]/10 px-2 md:px-3 py-0.5 md:py-1 rounded-full"
                        >
                          ${borrowedAmount >= 1000 ? `${(borrowedAmount/1000).toFixed(1)}k` : borrowedAmount}
                        </motion.div>
                      </motion.div>
                    )}
                    {tradeStep === 4 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="my-2 md:my-4 text-center"
                      >
                        <motion.div
                          animate={{ x: [5, 0, 5] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                        >
                          <ArrowRight className="w-5 h-5 md:w-8 md:h-8 text-[#00FF99]" />
                        </motion.div>
                        <motion.div
                          className="text-[#00FF99] text-[10px] md:text-sm font-semibold mt-1 md:mt-2 bg-[#00FF99]/10 px-2 md:px-3 py-0.5 md:py-1 rounded-full"
                        >
                          +${((borrowedAmount + totalFees + interest)/1000).toFixed(1)}k
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Success Message */}
              <AnimatePresence>
                {showSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 md:mt-8 bg-[#00FF99]/10 border border-[#00FF99]/30 rounded-xl md:rounded-2xl p-3 md:p-6 text-center"
                  >
                    <CheckCircle className="w-10 h-10 md:w-16 md:h-16 text-[#00FF99] mx-auto mb-2 md:mb-4" />
                    <h3 className="text-lg md:text-2xl font-bold text-white mb-1 md:mb-2">Trade Successful!</h3>
                    <p className="text-gray-400 text-xs md:text-base mb-2 md:mb-4">
                      Fees collected and returned to the Vault.
                    </p>
                    
                    {/* Trader Summary Line */}
                    <div className="bg-black/40 rounded-lg md:rounded-xl p-2 md:p-4 mb-3 md:mb-6 border border-gray-700">
                      <p className="text-[10px] md:text-sm text-gray-300 leading-relaxed">
                        <span className="text-white font-semibold">{selectedOutcome}</span> @ <span className="text-[#00FF99] font-mono">{leverage}x</span>
                        <span className="hidden md:inline">
                          {" • "}
                          <span className="text-gray-400">Open:</span> <span className="text-white font-mono">{openPrice?.toFixed(2)}¢</span>
                          {" → "}
                          <span className="text-gray-400">Close:</span> <span className="text-[#00FF99] font-mono">{closePrice?.toFixed(2)}¢</span>
                        </span>
                        {" • "}
                        <span className="text-gray-400">Fees:</span> <span className="text-yellow-400 font-mono">${(totalFees + interest).toFixed(2)}</span>
                        {" • "}
                        <span className="text-gray-400">P&L:</span> <span className="text-[#00FF99] font-mono">+${(totalExposure * 0.10 - totalFees - interest).toFixed(2)}</span>
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                      <div className="bg-black/30 rounded-lg md:rounded-xl p-2 md:p-3">
                        <p className="text-gray-500 text-[10px] md:text-xs">Collateral</p>
                        <p className="text-white font-mono font-semibold text-xs md:text-base">${collateral.toLocaleString()}</p>
                      </div>
                      <div className="bg-black/30 rounded-lg md:rounded-xl p-2 md:p-3">
                        <p className="text-gray-500 text-[10px] md:text-xs">Borrowed</p>
                        <p className="text-[#00FF99] font-mono font-semibold text-xs md:text-base">${borrowedAmount.toLocaleString()}</p>
                      </div>
                      <div className="bg-black/30 rounded-lg md:rounded-xl p-2 md:p-3">
                        <p className="text-gray-500 text-[10px] md:text-xs">Total Fees</p>
                        <p className="text-yellow-400 font-mono font-semibold text-xs md:text-base">${(totalFees + interest).toFixed(2)}</p>
                      </div>
                      <div className="bg-black/30 rounded-lg md:rounded-xl p-2 md:p-3">
                        <p className="text-gray-500 text-[10px] md:text-xs">LP Earnings</p>
                        <p className="text-[#00FF99] font-mono font-semibold text-xs md:text-base">${lpShare.toFixed(2)}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Educational Note - Hidden on mobile */}
            <div className="hidden md:block bg-gray-900/30 border border-gray-800 rounded-2xl p-6">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-[#00FF99]" />
                How It Works
              </h4>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-[#00FF99] font-semibold mb-1">1. Open Position</p>
                  <p className="text-gray-400">
                    Your collateral + borrowed funds from the Vault create leveraged exposure.
                  </p>
                </div>
                <div>
                  <p className="text-[#00FF99] font-semibold mb-1">2. During Trade</p>
                  <p className="text-gray-400">
                    You pay interest on borrowed funds. Position is monitored for liquidation risk.
                  </p>
                </div>
                <div>
                  <p className="text-[#00FF99] font-semibold mb-1">3. Close Position</p>
                  <p className="text-gray-400">
                    Borrowed funds + fees return to Vault. LPs earn 85% of fees as real yield.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LeverageDemoTrade;
