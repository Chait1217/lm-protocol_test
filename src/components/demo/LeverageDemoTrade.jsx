import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";

const LeverageDemoTrade = () => {
  // State
  const [collateral, setCollateral] = useState(1000);
  const [leverage, setLeverage] = useState(3);
  const [isTrading, setIsTrading] = useState(false);
  const [tradeStep, setTradeStep] = useState(0); // 0: idle, 1: taking collateral, 2: borrowing, 3: trading, 4: returning, 5: complete
  const [vaultBalance, setVaultBalance] = useState(100000);
  const [userBalance, setUserBalance] = useState(5000);
  const [showSuccess, setShowSuccess] = useState(false);

  // Calculations
  const totalExposure = collateral * leverage;
  const borrowedAmount = totalExposure - collateral;
  const tradingFee = totalExposure * 0.002; // 0.2% trading fee
  const borrowFee = borrowedAmount * 0.001; // 0.1% borrow fee
  const totalFees = tradingFee + borrowFee;
  const interestRate = 0.20; // 20% APR
  const daysHeld = 7;
  const interest = (borrowedAmount * interestRate * daysHeld) / 365;
  const liquidationPrice = collateral > 0 ? (collateral * 0.1) / (totalExposure / 100) : 0; // Simplified liquidation calc
  
  // Fee split (85% to LPs, 15% to protocol)
  const lpShare = (totalFees + interest) * 0.85;
  const protocolShare = (totalFees + interest) * 0.15;

  const resetDemo = () => {
    setIsTrading(false);
    setTradeStep(0);
    setVaultBalance(100000);
    setUserBalance(5000);
    setShowSuccess(false);
  };

  const executeTrade = async () => {
    if (collateral > userBalance) return;
    
    setIsTrading(true);
    setShowSuccess(false);

    // Step 1: Take collateral from user
    setTradeStep(1);
    await new Promise(r => setTimeout(r, 2500));
    setUserBalance(prev => prev - collateral);

    // Step 2: Borrow from vault
    setTradeStep(2);
    await new Promise(r => setTimeout(r, 2500));
    setVaultBalance(prev => prev - borrowedAmount);

    // Step 3: Execute trade (position open)
    setTradeStep(3);
    await new Promise(r => setTimeout(r, 3500));

    // Step 4: Close trade, return borrowed + fees
    setTradeStep(4);
    await new Promise(r => setTimeout(r, 2500));
    
    // Simulate profitable trade (10% gain)
    const profit = totalExposure * 0.10;
    const netProfit = profit - totalFees - interest;
    
    setVaultBalance(prev => prev + borrowedAmount + totalFees + interest);
    setUserBalance(prev => prev + collateral + netProfit);

    // Step 5: Complete
    setTradeStep(5);
    setShowSuccess(true);
    
    await new Promise(r => setTimeout(r, 3000));
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
    <div className="min-h-screen bg-black pt-24 pb-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Demo <span className="text-[#00FF99]">Trade</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Watch how leveraged trading works: collateral flows from your wallet, 
            borrowed funds come from the Vault, and fees return to LPs.
          </p>
        </motion.div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Input Controls */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1 space-y-6"
          >
            {/* Collateral Input */}
            <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#00FF99]" />
                Collateral
              </h3>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={collateral}
                  onChange={(e) => setCollateral(Math.max(0, Number(e.target.value)))}
                  disabled={isTrading}
                  className="w-full bg-black/50 border border-gray-700 rounded-xl py-3 pl-8 pr-4 text-white text-xl font-mono focus:border-[#00FF99] focus:outline-none disabled:opacity-50"
                />
              </div>
              <p className="text-gray-500 text-sm mt-2">
                Your balance: ${userBalance.toLocaleString()}
              </p>
            </div>

            {/* Leverage Selector */}
            <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#00FF99]" />
                Leverage: {leverage}x
              </h3>
              <input
                type="range"
                min="1"
                max="5"
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                disabled={isTrading}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#00FF99] disabled:opacity-50"
              />
              <div className="flex justify-between text-gray-500 text-sm mt-2">
                <span>1x</span>
                <span>3x</span>
                <span>5x</span>
              </div>
              {/* Preset buttons */}
              <div className="flex gap-2 mt-4">
                {[1, 2, 3, 4, 5].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLeverage(l)}
                    disabled={isTrading}
                    className={`flex-1 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
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

            {/* Trade Details */}
            <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-[#00FF99]" />
                Trade Details
              </h3>
              <div className="space-y-3 text-sm">
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
                <div className="flex justify-between">
                  <span className="text-gray-400">Interest (7 days @ 20% APR)</span>
                  <span className="text-yellow-400 font-mono">${interest.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-700 pt-3 flex justify-between">
                  <span className="text-gray-400">Total Fees</span>
                  <span className="text-yellow-400 font-mono font-semibold">${(totalFees + interest).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Liquidation Price</span>
                  <span className="text-red-400 font-mono">${liquidationPrice.toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* Execute Button */}
            <button
              onClick={isTrading ? undefined : executeTrade}
              disabled={isTrading || collateral > userBalance || collateral <= 0}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all cursor-pointer ${
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
              <p className="text-red-400 text-sm text-center flex items-center justify-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Insufficient balance
              </p>
            )}

            {/* Reset Button */}
            {(showSuccess || tradeStep > 0) && (
              <button
                onClick={resetDemo}
                className="w-full py-3 rounded-xl font-semibold text-gray-400 bg-gray-800 hover:bg-gray-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Demo
              </button>
            )}
          </motion.div>

          {/* Right: Visual Flow */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            {/* Status Bar */}
            <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={`font-semibold ${tradeStep === 5 ? "text-[#00FF99]" : tradeStep > 0 ? "text-yellow-400" : "text-gray-400"}`}>
                  {stepLabels[tradeStep]}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#00FF99]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${(tradeStep / 5) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Visual Flow Diagram */}
            <div className="bg-gray-900/50 border border-[#00FF99]/20 rounded-2xl p-6 min-h-[500px]">
              <div className="grid md:grid-cols-3 gap-6 h-full">
                {/* User Wallet */}
                <div className="flex flex-col items-center">
                  <motion.div
                    className={`w-full bg-black/50 border-2 rounded-2xl p-6 text-center transition-all ${
                      tradeStep === 1 ? "border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]" : "border-gray-700"
                    }`}
                    animate={tradeStep === 1 ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: tradeStep === 1 ? Infinity : 0, duration: 1 }}
                  >
                    <Wallet className="w-12 h-12 text-[#00FF99] mx-auto mb-3" />
                    <h4 className="text-white font-semibold mb-2">Your Wallet</h4>
                    <motion.p
                      key={userBalance}
                      initial={{ scale: 1.2, color: "#00FF99" }}
                      animate={{ scale: 1, color: "#ffffff" }}
                      className="text-2xl font-mono font-bold"
                    >
                      ${userBalance.toLocaleString()}
                    </motion.p>
                    <p className="text-gray-500 text-sm mt-1">Available Balance</p>
                  </motion.div>

                  {/* Arrow down to trade */}
                  <AnimatePresence>
                    {tradeStep === 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="my-4"
                      >
                        <motion.div
                          animate={{ y: [0, 10, 0] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                        >
                          <ArrowDown className="w-8 h-8 text-yellow-400" />
                        </motion.div>
                        <motion.div
                          className="text-yellow-400 text-sm font-semibold mt-2 bg-yellow-400/10 px-3 py-1 rounded-full"
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
                    className={`w-full bg-black/50 border-2 rounded-2xl p-6 text-center transition-all ${
                      tradeStep >= 2 && tradeStep <= 4
                        ? "border-[#00FF99] shadow-[0_0_30px_rgba(0,255,153,0.3)]"
                        : "border-gray-700"
                    }`}
                    animate={tradeStep >= 2 && tradeStep <= 4 ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: tradeStep >= 2 && tradeStep <= 4 ? Infinity : 0, duration: 1.5 }}
                  >
                    <TrendingUp className="w-12 h-12 text-[#00FF99] mx-auto mb-3" />
                    <h4 className="text-white font-semibold mb-2">Leveraged Position</h4>
                    <p className="text-3xl font-mono font-bold text-[#00FF99]">
                      ${totalExposure.toLocaleString()}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">{leverage}x Leverage</p>

                    {/* Trade animation */}
                    <AnimatePresence>
                      {tradeStep === 3 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="mt-4 bg-[#00FF99]/10 rounded-xl p-3"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                            className="inline-block"
                          >
                            <Activity className="w-6 h-6 text-[#00FF99]" />
                          </motion.div>
                          <p className="text-[#00FF99] text-sm mt-1">Position Active</p>
                          <p className="text-gray-400 text-xs">Simulating 10% profit...</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Fee breakdown during trade */}
                  <AnimatePresence>
                    {(tradeStep >= 3 && tradeStep <= 4) && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-4 bg-gray-800/50 rounded-xl p-4 w-full text-sm"
                      >
                        <p className="text-gray-400 mb-2">Fee Distribution:</p>
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
                    className={`w-full bg-black/50 border-2 rounded-2xl p-6 text-center transition-all ${
                      tradeStep === 2 || tradeStep === 4
                        ? "border-[#00FF99] shadow-[0_0_20px_rgba(0,255,153,0.3)]"
                        : "border-gray-700"
                    }`}
                    animate={tradeStep === 2 || tradeStep === 4 ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: tradeStep === 2 || tradeStep === 4 ? Infinity : 0, duration: 1 }}
                  >
                    <Database className="w-12 h-12 text-[#00FF99] mx-auto mb-3" />
                    <h4 className="text-white font-semibold mb-2">USDC Vault</h4>
                    <motion.p
                      key={vaultBalance}
                      initial={{ scale: 1.2, color: "#00FF99" }}
                      animate={{ scale: 1, color: "#ffffff" }}
                      className="text-2xl font-mono font-bold"
                    >
                      ${vaultBalance.toLocaleString()}
                    </motion.p>
                    <p className="text-gray-500 text-sm mt-1">Total Liquidity</p>
                  </motion.div>

                  {/* Arrow indicators */}
                  <AnimatePresence>
                    {tradeStep === 2 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="my-4 text-center"
                      >
                        <motion.div
                          animate={{ x: [-10, 0, -10] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                        >
                          <ArrowRight className="w-8 h-8 text-[#00FF99] rotate-180" />
                        </motion.div>
                        <motion.div
                          className="text-[#00FF99] text-sm font-semibold mt-2 bg-[#00FF99]/10 px-3 py-1 rounded-full"
                        >
                          Lending ${borrowedAmount.toLocaleString()}
                        </motion.div>
                      </motion.div>
                    )}
                    {tradeStep === 4 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="my-4 text-center"
                      >
                        <motion.div
                          animate={{ x: [10, 0, 10] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                        >
                          <ArrowRight className="w-8 h-8 text-[#00FF99]" />
                        </motion.div>
                        <motion.div
                          className="text-[#00FF99] text-sm font-semibold mt-2 bg-[#00FF99]/10 px-3 py-1 rounded-full"
                        >
                          +${(borrowedAmount + totalFees + interest).toFixed(2)}
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
                    className="mt-8 bg-[#00FF99]/10 border border-[#00FF99]/30 rounded-2xl p-6 text-center"
                  >
                    <CheckCircle className="w-16 h-16 text-[#00FF99] mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white mb-2">Trade Executed Successfully!</h3>
                    <p className="text-gray-400 mb-4">
                      Fees collected and returned to the Vault. LPs earned real yield!
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                      <div className="bg-black/30 rounded-xl p-3">
                        <p className="text-gray-500 text-xs">Collateral Used</p>
                        <p className="text-white font-mono font-semibold">${collateral.toLocaleString()}</p>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3">
                        <p className="text-gray-500 text-xs">Borrowed</p>
                        <p className="text-[#00FF99] font-mono font-semibold">${borrowedAmount.toLocaleString()}</p>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3">
                        <p className="text-gray-500 text-xs">Total Fees</p>
                        <p className="text-yellow-400 font-mono font-semibold">${(totalFees + interest).toFixed(2)}</p>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3">
                        <p className="text-gray-500 text-xs">LP Earnings</p>
                        <p className="text-[#00FF99] font-mono font-semibold">${lpShare.toFixed(2)}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Educational Note */}
            <div className="mt-6 bg-gray-900/30 border border-gray-800 rounded-2xl p-6">
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
