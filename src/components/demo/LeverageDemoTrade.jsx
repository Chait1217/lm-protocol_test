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
  CheckCircle,
  RefreshCw,
  Info,
  Activity,
} from "lucide-react";
import KinkModelModal from "../KinkModelModal";

// Fake prediction market questions
const FAKE_MARKETS = [
  { question: "Will Bitcoin reach $200K by end of 2026?", baseProb: 42 },
  { question: "Will SpaceX land humans on Mars before 2030?", baseProb: 28 },
  { question: "Will AI pass the Turing test by 2027?", baseProb: 65 },
  { question: "Will the US have a female president by 2028?", baseProb: 35 },
  { question: "Will Ethereum flip Bitcoin in market cap?", baseProb: 18 },
  { question: "Will Apple release AR glasses in 2026?", baseProb: 55 },
];

const LeverageDemoTrade = ({
  embedded,
  initialCollateral,
  initialLeverage,
  initialOutcome,
  triggerExecuteKey = 0,
}) => {
  // State – use initial values from Live Polymarket Integration when provided
  const [collateral, setCollateral] = useState(initialCollateral ?? 1000);
  const [leverage, setLeverage] = useState(initialLeverage ?? 3);
  const [isTrading, setIsTrading] = useState(false);
  const [tradeStep, setTradeStep] = useState(0);
  const [vaultBalance, setVaultBalance] = useState(100000);
  const [userBalance, setUserBalance] = useState(5000);
  const [showSuccess, setShowSuccess] = useState(false);
  const [kinkModalOpen, setKinkModalOpen] = useState(false);

  // Market simulation state
  const [selectedMarket, setSelectedMarket] = useState(FAKE_MARKETS[0]);
  const [currentProb, setCurrentProb] = useState(FAKE_MARKETS[0].baseProb);
  const [bid, setBid] = useState(FAKE_MARKETS[0].baseProb - 1);
  const [ask, setAsk] = useState(FAKE_MARKETS[0].baseProb + 1);
  const [chartData, setChartData] = useState([]);
  const [selectedOutcome, setSelectedOutcome] = useState(initialOutcome ?? "YES");
  const [openPrice, setOpenPrice] = useState(null);
  const [closePrice, setClosePrice] = useState(null);
  const chartInterval = useRef(null);
  const tradeStartPrice = useRef(null);
  const tickCount = useRef(0);
  const hasTriggeredExecute = useRef(false);
  const executeTradeRef = useRef(null);
  const [startTradeFromTrigger, setStartTradeFromTrigger] = useState(false);

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

  // When opened from Market page "Execute Demo Trade" (triggerExecuteKey > 0), sync from leverage box and run simulation
  useEffect(() => {
    if (triggerExecuteKey == null || triggerExecuteKey <= 0 || hasTriggeredExecute.current) return;
    hasTriggeredExecute.current = true;
    const c = initialCollateral ?? 1000;
    const l = initialLeverage ?? 3;
    const o = initialOutcome ?? "YES";
    setCollateral(c);
    setLeverage(l);
    setSelectedOutcome(o);
    setUserBalance((prev) => Math.max(prev, c + 1000));
    setStartTradeFromTrigger(true);
  }, [triggerExecuteKey, initialCollateral, initialLeverage, initialOutcome]);

  // Run executeTrade after state has committed (when startTradeFromTrigger becomes true)
  useEffect(() => {
    if (!startTradeFromTrigger || !executeTradeRef.current) return;
    setStartTradeFromTrigger(false);
    const fn = executeTradeRef.current;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fn();
      });
    });
  }, [startTradeFromTrigger]);

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

  // Calculations – open fee 0.4% of notional; interest 20% APR, 7 days
  const totalExposure = collateral * leverage;
  const borrowedAmount = totalExposure - collateral;
  const openFeeRate = 0.004; // 0.4% open/close on total leveraged notional
  const openFee = totalExposure * openFeeRate;
  const interestApr = 0.20; // 20% APR
  const daysHeld = 7;
  const interest = (borrowedAmount * interestApr * daysHeld) / 365;
  const totalFees = openFee + interest;
  
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
  
  // Protocol fee distribution: Open 0.4% → 50% LP, 30% $LMP, 20% Treasury; Interest → 88% LP, 7% Insurance, 5% Protocol
  const lpFromOpen = openFee * 0.50;
  const lmpFromOpen = openFee * 0.30;
  const treasuryFromOpen = openFee * 0.20;
  const lpFromInterest = interest * 0.88;
  const insuranceFromInterest = interest * 0.07;
  const protocolFromInterest = interest * 0.05;
  const lpShare = lpFromOpen + lpFromInterest;
  const lmpInsuranceShare = lmpFromOpen + insuranceFromInterest;
  const treasuryProtocolShare = treasuryFromOpen + protocolFromInterest;

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
    if (!embedded && window.innerWidth >= 768) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setIsTrading(true);
    setShowSuccess(false);
    
    // Record open price
    const openPriceValue = selectedOutcome === "YES" ? ask : (100 - bid);
    setOpenPrice(openPriceValue);

    // Step 1: Take collateral from user
    setTradeStep(1);
    await new Promise(r => setTimeout(r, 1800));
    setUserBalance(prev => prev - collateral);

    // Step 2: Borrow from vault
    setTradeStep(2);
    await new Promise(r => setTimeout(r, 1800));
    setVaultBalance(prev => prev - borrowedAmount);

    // Step 3: Execute trade (position open)
    setTradeStep(3);
    await new Promise(r => setTimeout(r, 1800));

    // Step 4: Close trade, return borrowed + fees
    setTradeStep(4);
    await new Promise(r => setTimeout(r, 1800));
    
    // Record close price (10% profit from open)
    const closePriceValue = selectedOutcome === "YES" 
      ? openPriceValue * 1.10 
      : openPriceValue * 0.90;
    setClosePrice(closePriceValue);
    
    const profit = totalExposure * 0.10;
    const netProfit = profit - totalFees;
    
    setVaultBalance(prev => prev + borrowedAmount + totalFees);
    setUserBalance(prev => prev + collateral + netProfit);

    // Step 5: Complete
    setTradeStep(5);
    setShowSuccess(true);
    
    await new Promise(r => setTimeout(r, 2200));
    setIsTrading(false);
  };

  useEffect(() => {
    executeTradeRef.current = executeTrade;
  });

  const stepLabels = [
    "Ready to trade",
    "Taking collateral from user...",
    "Borrowing from Vault...",
    "Position open - trading...",
    "Closing position, returning funds...",
    "Trade complete!"
  ];

  return (
    <>
    <div className={`min-w-0 max-w-full overflow-x-hidden ${embedded ? "bg-black pt-4 md:pt-6 pb-8 md:pb-10" : "min-h-screen bg-black pt-20 md:pt-24 pb-12 md:pb-20 px-3 md:px-4"}`}>
      <div className={`min-w-0 ${embedded ? "w-full" : "max-w-6xl mx-auto"}`}>
        {/* Header – compact when embedded */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-center ${embedded ? "mb-2 md:mb-4" : "mb-6 md:mb-12"}`}
        >
          <h1 className={`font-bold text-white ${embedded ? "mb-1 md:mb-2 text-lg md:text-2xl" : "mb-2 md:mb-4 text-2xl md:text-5xl"}`}>
            Demo <span className="text-[#00FF99]">Trade</span>
          </h1>
          <p className="text-gray-400 text-xs md:text-base max-w-2xl mx-auto">
            Watch how leveraged trading works: collateral flows from your wallet, 
            borrowed funds come from the Vault, and fees return to LPs.
          </p>
        </motion.div>

        {/* Main content – full width when embedded */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`space-y-2 md:space-y-3 ${embedded ? "w-full" : "max-w-5xl mx-auto"}`}
        >
            {/* Top row: Status Bar + Trade Details side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 items-stretch">
              {/* Left: one card so no blank below Status when Trade Details is taller */}
              <div className="flex flex-col bg-gray-900/50 border border-[#00FF99]/20 rounded-lg md:rounded-xl overflow-hidden">
                <div className="p-2 md:p-3 flex-shrink-0">
                  <div className="flex items-center justify-between text-sm md:text-base">
                    <span className="text-gray-400">Status:</span>
                    <span className={`font-semibold ${tradeStep === 5 ? "text-[#00FF99]" : tradeStep > 0 ? "text-yellow-400" : "text-gray-400"}`}>
                      {stepLabels[tradeStep]}
                    </span>
                  </div>
                  <div className="mt-1.5 md:mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#00FF99]"
                      initial={{ width: "0%" }}
                      animate={{ width: `${(tradeStep / 5) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
                <div className="p-2 md:p-3 pt-0 flex-1 flex flex-col min-h-0">
                  {(showSuccess || tradeStep > 0) ? (
                    <button
                      onClick={resetDemo}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 md:py-3 px-5 md:px-6 rounded-xl font-semibold text-sm md:text-base text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-all cursor-pointer flex-shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reset Demo
                    </button>
                  ) : (
                    <p className="text-gray-500 text-xs md:text-sm flex-1">Click &quot;Execute Demo Trade&quot; above to run the simulation.</p>
                  )}
                </div>
              </div>
              {/* Trade Details - beside Status */}
              <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-lg md:rounded-xl p-2 md:p-3">
                <h3 className="text-white font-semibold mb-1 md:mb-2 flex items-center gap-1.5 text-xs md:text-sm">
                  <Info className="w-4 h-4 md:w-5 md:h-5 text-[#00FF99]" />
                  Trade Details
                </h3>
                <div className="space-y-0.5 md:space-y-1 text-[10px] md:text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Exposure</span>
                    <span className="text-white font-mono">${totalExposure.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Borrowed</span>
                    <span className="text-[#00FF99] font-mono">${borrowedAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Open fee (0.4%)</span>
                    <span className="text-yellow-400 font-mono">${openFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      Interest (20% APR, 7d)
                      <button
                        type="button"
                        onClick={() => setKinkModalOpen(true)}
                        className="p-0.5 rounded-full text-[#00FF99]/80 hover:text-[#00FF99] hover:bg-[#00FF99]/10 transition-colors"
                        aria-label="Explain Dynamic Kink Model"
                      >
                        <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      </button>
                    </span>
                    <span className="text-yellow-400 font-mono">${interest.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Fees</span>
                    <span className="text-yellow-400 font-mono font-semibold">${totalFees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Entry ({selectedOutcome})</span>
                    <span className="text-white font-mono">{entryPrice.toFixed(2)}¢</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Liquidation</span>
                    <span className="text-red-400 font-mono">{liquidationPrice.toFixed(2)}¢</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Chart (shows during trading) */}
            <AnimatePresence>
              {(tradeStep >= 2 && tradeStep <= 4) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-gray-900/50 border border-[#00FF99]/20 rounded-lg md:rounded-xl p-2 md:p-3"
                >
                  <div className="flex items-center justify-between mb-1 md:mb-2">
                    <h3 className="text-white font-semibold text-xs md:text-sm">Live Market Price</h3>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#00FF99] rounded-full animate-pulse" />
                      <span className="text-[#00FF99] text-xs md:text-sm">LIVE</span>
                    </div>
                  </div>
                  <div className="h-20 md:h-28">
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

            {/* Visual Flow Diagram – compact */}
            <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-lg md:rounded-xl p-2 md:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
                {/* User Wallet */}
                <div className="flex flex-col items-center">
                  <motion.div
                    className={`w-full bg-black/50 border-2 rounded-lg md:rounded-xl p-1.5 md:p-3 text-center transition-all ${
                      tradeStep === 1 ? "border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]" : "border-gray-700"
                    }`}
                    animate={tradeStep === 1 ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: tradeStep === 1 ? Infinity : 0, duration: 1 }}
                  >
                    <Wallet className="w-5 h-5 md:w-8 md:h-8 text-[#00FF99] mx-auto mb-0.5 md:mb-1" />
                    <h4 className="text-white font-semibold text-[10px] md:text-xs mb-0.5 md:mb-1">Wallet</h4>
                    <motion.p
                      key={userBalance}
                      initial={{ scale: 1.2, color: "#00FF99" }}
                      animate={{ scale: 1, color: "#ffffff" }}
                      className="text-xs md:text-lg font-mono font-bold"
                    >
                      ${userBalance.toLocaleString()}
                    </motion.p>
                    <p className="text-gray-500 text-[9px] md:text-[10px] mt-0.5 hidden md:block">Available</p>
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
                          -${collateral.toLocaleString()}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Center: Trade Position */}
                <div className="flex flex-col items-center justify-center">
                  <motion.div
                    className={`w-full bg-black/50 border-2 rounded-lg md:rounded-xl p-1.5 md:p-3 text-center transition-all ${
                      tradeStep >= 2 && tradeStep <= 4
                        ? "border-[#00FF99] shadow-[0_0_20px_rgba(0,255,153,0.25)]"
                        : "border-gray-700"
                    }`}
                    animate={tradeStep >= 2 && tradeStep <= 4 ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: tradeStep >= 2 && tradeStep <= 4 ? Infinity : 0, duration: 1.5 }}
                  >
                    <TrendingUp className="w-5 h-5 md:w-8 md:h-8 text-[#00FF99] mx-auto mb-0.5 md:mb-1" />
                    <h4 className="text-white font-semibold text-[10px] md:text-xs mb-0.5 md:mb-1">Position</h4>
                    <p className="text-xs md:text-xl font-mono font-bold text-[#00FF99]">
                      ${totalExposure.toLocaleString()}
                    </p>
                    <p className="text-gray-500 text-[9px] md:text-[10px] mt-0.5">{leverage}x</p>

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
                        className="mt-1 md:mt-2 bg-gray-800/50 rounded-md md:rounded-lg p-1.5 md:p-2 w-full text-[9px] md:text-[10px] hidden md:block"
                      >
                        <p className="text-gray-400 mb-0.5 md:mb-1">Fee Distribution (protocol):</p>
                        <div className="flex justify-between">
                          <span className="text-gray-500">LPs (open 50% + interest 88%)</span>
                          <span className="text-[#00FF99]">${lpShare.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">$LMP / Insurance (30% + 7%)</span>
                          <span className="text-cyan-400">${lmpInsuranceShare.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Treasury / Protocol (20% + 5%)</span>
                          <span className="text-amber-400">${treasuryProtocolShare.toFixed(2)}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Vault */}
                <div className="flex flex-col items-center">
                  <motion.div
                    className={`w-full bg-black/50 border-2 rounded-lg md:rounded-xl p-1.5 md:p-3 text-center transition-all ${
                      tradeStep === 2 || tradeStep === 4
                        ? "border-[#00FF99] shadow-[0_0_20px_rgba(0,255,153,0.25)]"
                        : "border-gray-700"
                    }`}
                    animate={tradeStep === 2 || tradeStep === 4 ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: tradeStep === 2 || tradeStep === 4 ? Infinity : 0, duration: 1 }}
                  >
                    <Database className="w-5 h-5 md:w-8 md:h-8 text-[#00FF99] mx-auto mb-0.5 md:mb-1" />
                    <h4 className="text-white font-semibold text-[10px] md:text-xs mb-0.5 md:mb-1">Vault</h4>
                    <motion.p
                      key={vaultBalance}
                      initial={{ scale: 1.2, color: "#00FF99" }}
                      animate={{ scale: 1, color: "#ffffff" }}
                      className="text-xs md:text-lg font-mono font-bold"
                    >
                      ${vaultBalance.toLocaleString()}
                    </motion.p>
                    <p className="text-gray-500 text-[9px] md:text-[10px] mt-0.5 hidden md:block">Liquidity</p>
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
                          ${borrowedAmount.toLocaleString()}
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
                          +${(borrowedAmount + totalFees).toLocaleString(undefined, {maximumFractionDigits: 0})}
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
                    className="mt-2 md:mt-4 bg-[#00FF99]/10 border border-[#00FF99]/30 rounded-lg md:rounded-xl p-2 md:p-4 text-center"
                  >
                    <CheckCircle className="w-8 h-8 md:w-12 md:h-12 text-[#00FF99] mx-auto mb-1 md:mb-2" />
                    <h3 className="text-base md:text-xl font-bold text-white mb-0.5 md:mb-1">Trade Successful!</h3>
                    <p className="text-gray-400 text-[10px] md:text-sm mb-1.5 md:mb-2">
                      Fees collected and returned to the Vault.
                    </p>
                    
                    {/* Trader Summary Line */}
                    <div className="bg-black/40 rounded-md md:rounded-lg p-1.5 md:p-3 mb-2 md:mb-3 border border-gray-700">
                      <p className="text-[10px] md:text-sm text-gray-300 leading-relaxed">
                        <span className="text-white font-semibold">{selectedOutcome}</span> @ <span className="text-[#00FF99] font-mono">{leverage}x</span>
                        {" • "}
                        <span className="text-white font-mono">{openPrice?.toFixed(1)}¢</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-[#00FF99] font-mono">{closePrice?.toFixed(1)}¢</span>
                        {" • "}
                        <span className="text-yellow-400 font-mono">${totalFees.toFixed(0)}</span>
                        <span className="text-gray-500 text-[8px] md:text-xs"> fees</span>
                        {" • "}
                        <span className="text-[#00FF99] font-mono">+${(totalExposure * 0.10 - totalFees).toFixed(0)}</span>
                        <span className="text-gray-500 text-[8px] md:text-xs"> profit</span>
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2">
                      <div className="bg-black/30 rounded-md md:rounded-lg p-1.5 md:p-2">
                        <p className="text-gray-500 text-[9px] md:text-[10px]">Collateral</p>
                        <p className="text-white font-mono font-semibold text-[10px] md:text-sm">${collateral.toLocaleString()}</p>
                      </div>
                      <div className="bg-black/30 rounded-md md:rounded-lg p-1.5 md:p-2">
                        <p className="text-gray-500 text-[9px] md:text-[10px]">Borrowed</p>
                        <p className="text-[#00FF99] font-mono font-semibold text-[10px] md:text-sm">${borrowedAmount.toLocaleString()}</p>
                      </div>
                      <div className="bg-black/30 rounded-md md:rounded-lg p-1.5 md:p-2">
                        <p className="text-gray-500 text-[9px] md:text-[10px]">Total Fees</p>
                        <p className="text-yellow-400 font-mono font-semibold text-[10px] md:text-sm">${totalFees.toFixed(2)}</p>
                      </div>
                      <div className="bg-black/30 rounded-md md:rounded-lg p-1.5 md:p-2">
                        <p className="text-gray-500 text-[9px] md:text-[10px]">LP Earnings</p>
                        <p className="text-[#00FF99] font-mono font-semibold text-[10px] md:text-sm">${lpShare.toFixed(2)}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* How It Works – larger */}
            <div className="bg-gray-900/40 border border-[#00FF99]/15 rounded-xl md:rounded-2xl p-4 md:p-6">
              <h4 className="text-white font-bold mb-3 md:mb-4 flex items-center gap-2 text-base md:text-lg">
                <Info className="w-5 h-5 md:w-6 md:h-6 text-[#00FF99]" />
                How It Works
              </h4>
              {/* Mobile */}
              <div className="md:hidden text-xs text-gray-400 leading-relaxed space-y-1">
                <p><span className="text-[#00FF99] font-semibold">1.</span> Collateral + borrowed = leverage</p>
                <p><span className="text-[#00FF99] font-semibold">2.</span> Pay interest, monitor risk</p>
                <p><span className="text-[#00FF99] font-semibold">3.</span> Close & return funds + fees (50/30/20 open, 88/7/5 interest)</p>
              </div>
              {/* Desktop: 3 columns, larger text */}
              <div className="hidden md:grid md:grid-cols-3 gap-4 md:gap-6 text-sm">
                <div className="p-3 rounded-lg bg-black/20">
                  <p className="text-[#00FF99] font-semibold mb-1 text-sm">1. Open Position</p>
                  <p className="text-gray-400 text-sm leading-snug">
                    Collateral + borrowed from Vault = leveraged exposure.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-black/20">
                  <p className="text-[#00FF99] font-semibold mb-1 text-sm">2. During Trade</p>
                  <p className="text-gray-400 text-sm leading-snug">
                    Pay interest; position monitored for liquidation.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-black/20">
                  <p className="text-[#00FF99] font-semibold mb-1 text-sm">3. Close Position</p>
                  <p className="text-gray-400 text-sm leading-snug">
                    Funds + fees return to Vault; fees split per protocol.
                  </p>
                </div>
              </div>
            </div>
        </motion.div>
      </div>
    </div>
    {kinkModalOpen && <KinkModelModal onClose={() => setKinkModalOpen(false)} />}
    </>
  );
};

export default LeverageDemoTrade;
