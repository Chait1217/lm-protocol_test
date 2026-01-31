import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import VaultCard from "./components/vault/VaultCard";
import HowVaultsWorkSteps from "./components/vault/HowVaultsWorkSteps";
import UtilizationGauge from "./components/vault/UtilizationGauge";
import ApyBreakdownDonut from "./components/vault/ApyBreakdownDonut";
import TvlChart from "./components/vault/TvlChart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  TrendingUp,
  Shield,
  Zap,
  Lock,
  Database,
  Activity,
  ArrowUpRight,
  ChevronRight,
  Circle,
  DollarSign,
  Lightbulb,
  Menu,
  X,
} from "lucide-react";

// Mock chart data
const generateChartData = () => {
  const data = [];
  for (let i = 0; i < 50; i++) {
    data.push({
      time: i,
      probability: 45 + Math.sin(i / 5) * 10 + Math.random() * 5,
    });
  }
  return data;
};

const generateUtilizationData = () => {
  const data = [];
  for (let u = 0; u <= 100; u += 5) {
    const borrowApr = 2 + (u / 100) * 25;
    const lpApy = borrowApr * (u / 100) * 0.85;
    data.push({ utilization: u, borrowApr: Math.round(borrowApr * 10) / 10, lpApy: Math.round(lpApy * 10) / 10 });
  }
  return data;
};

// Interest split from example: $34.52 total → LPs $29.34 (85%), Protocol $5.18 (15%)
const interestSplitData = [
  { name: "LPs: $29.34", value: 85, color: "#00FF99" },
  { name: "Protocol: $5.18", value: 15, color: "#888888" },
];

// Exposure vs Collateral (collateral fixed at 1000, exposure = collateral * leverage)
const exposureVsCollateralData = [
  { leverage: "1x", collateral: 1000, exposure: 1000 },
  { leverage: "2x", collateral: 1000, exposure: 2000 },
  { leverage: "3x", collateral: 1000, exposure: 3000 },
  { leverage: "5x", collateral: 1000, exposure: 5000 },
  { leverage: "10x", collateral: 1000, exposure: 10000 },
];

const mockMarkets = [
  { id: 1, name: "2026 World Cup Winner - Brazil", probability: 68, volume: "2.4M", change: "+5.2%" },
  { id: 2, name: "Bitcoin EOY 2026 > $150K", probability: 42, volume: "8.1M", change: "-2.1%" },
  { id: 3, name: "US Midterms 2026 - Democratic Senate", probability: 55, volume: "5.7M", change: "+1.8%" },
  { id: 4, name: "Ethereum > $8K by Q3 2026", probability: 38, volume: "3.2M", change: "+4.3%" },
];

// Navbar Component
const Navbar = ({ currentPage, setCurrentPage, walletConnected, setWalletConnected }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navLinks = [
    { key: "protocol", label: "Protocol" },
    { key: "market", label: "Market" },
    { key: "vault", label: "Vault" },
  ];

  const handleNavClick = (key) => {
    setCurrentPage(key);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-[#00FF99]/10 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="text-xl sm:text-2xl font-bold flex-shrink-0">
          <span className="text-white">LM</span>
          <span className="text-[#00FF99]">Protocol</span>
        </div>
        {/* Desktop nav */}
        <div className="flex-1 hidden md:flex justify-center">
          <div className="flex gap-6 lg:gap-8">
            {navLinks.map((link) => (
              <button
                key={link.key}
                onClick={() => setCurrentPage(link.key)}
                className={`capitalize px-4 py-2 rounded transition-all min-h-[44px] min-w-[44px]
                  ${
                    link.key === "market"
                      ? currentPage === "market"
                        ? "bg-[#00FF99] text-black shadow-lg font-extrabold scale-110"
                        : "bg-[#00FF99]/20 text-[#00FF99] border border-[#00FF99]/50 font-semibold shadow hover:bg-[#00FF99]/40"
                      : currentPage === link.key
                        ? "text-[#00FF99] border-b-2 border-[#00FF99] font-bold"
                        : "text-gray-400 hover:text-white"
                  }
                `}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWalletConnected(!walletConnected)}
            className={`px-4 sm:px-6 py-2 rounded-lg font-medium transition-all min-h-[44px] text-sm sm:text-base ${
              walletConnected
                ? "bg-[#00FF99]/10 text-[#00FF99] border border-[#00FF99]/30"
                : "bg-[#00FF99] text-black hover:bg-[#00FF99]/90"
            }`}
          >
            {walletConnected ? "0x742d...5e3A" : "Connect"}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#00FF99]/10 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-[#00FF99]/10 bg-black/98"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.key}
                  onClick={() => handleNavClick(link.key)}
                  className={`w-full text-left px-4 py-3 rounded-lg min-h-[48px] font-medium transition-all ${
                    currentPage === link.key
                      ? "bg-[#00FF99]/20 text-[#00FF99] border border-[#00FF99]/40"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// Footer Component
const Footer = () => {
  return (
    <footer className="bg-black border-t border-[#00FF99]/10 py-8 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          <div>
            <div className="text-xl font-bold mb-3">
              <span className="text-white">LM</span>
              <span className="text-[#00FF99]">Protocol</span>
            </div>
            <p className="text-gray-500 text-sm">
              Institutional-grade leverage for prediction markets
            </p>
          </div>
          <div>
            <h4 className="text-white font-medium mb-3">Product</h4>
            <div className="space-y-2 text-sm text-gray-400">
              <div>Markets</div>
              <div>Vaults</div>
              <div>Documentation</div>
            </div>
          </div>
          <div>
            <h4 className="text-white font-medium mb-3">Resources</h4>
            <div className="space-y-2 text-sm text-gray-400">
              <div>Whitepaper</div>
              <div>Audit Reports</div>
              <div>GitHub</div>
            </div>
          </div>
          <div>
            <h4 className="text-white font-medium mb-3">Community</h4>
            <div className="space-y-2 text-sm text-gray-400">
              <div>X</div>
              <div>Telegram</div>
              <div>Blog</div>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-[#00FF99]/10 text-center text-gray-500 text-sm">
          © 2026 LM Protocol. Built on Base L2.
        </div>
      </div>
    </footer>
  );
};

// Market Page
const MarketPage = () => {
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [leverage, setLeverage] = useState(5);
  const [positionSize, setPositionSize] = useState("1000");

  const chartData = useMemo(() => generateChartData(), []);

  const liquidationPrice = selectedMarket
    ? (selectedMarket.probability - 10 / leverage).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-black pt-16 sm:pt-20 pb-12 sm:pb-16">
      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6">
            <span className="text-white">Institutional-Grade</span>
            <br />
            <span className="text-[#00FF99]">Leverage Trading</span>
          </h1>
          <p className="text-base sm:text-xl text-gray-400 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
            Powered by AI & Base L2. Trade prediction markets with up to 10x leverage.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 sm:px-8 py-3 sm:py-4 bg-[#00FF99] text-black font-bold rounded-lg text-base sm:text-lg shadow-[0_0_30px_rgba(0,255,153,0.3)] hover:shadow-[0_0_50px_rgba(0,255,153,0.5)] transition-all min-h-[48px]"
          >
            Launch App <ArrowUpRight className="inline ml-2 w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>
        </motion.div>

        {/* Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-[#00FF99] rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{ y: [0, -100, 0], opacity: [0, 1, 0] }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Markets */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 sm:mt-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">Live Markets</h2>
        <div className="grid gap-3 sm:gap-4">
          {mockMarkets.map((market) => (
            <motion.div
              key={market.id}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelectedMarket(market)}
              className="bg-gradient-to-r from-gray-900 to-black p-4 sm:p-6 rounded-xl border border-[#00FF99]/20 cursor-pointer hover:border-[#00FF99]/50 active:border-[#00FF99]/50 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium mb-2 text-sm sm:text-base line-clamp-2">{market.name}</h3>
                  <div className="flex flex-wrap gap-3 sm:gap-4 text-sm">
                    <span className="text-gray-400">
                      24h Vol: <span className="text-white">${market.volume}</span>
                    </span>
                    <span className={market.change.startsWith("+") ? "text-[#00FF99]" : "text-red-400"}>
                      {market.change}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                  <div className="text-2xl sm:text-3xl font-bold text-[#00FF99]">{market.probability}%</div>
                  <button className="px-4 py-2 bg-[#00FF99]/10 text-[#00FF99] rounded-lg border border-[#00FF99]/30 hover:bg-[#00FF99]/20 transition-all text-sm min-h-[44px]">
                    Trade with Leverage
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Trading modal */}
      <AnimatePresence>
        {selectedMarket && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 overflow-y-auto overscroll-contain"
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => setSelectedMarket(null)}
                className="mb-6 text-gray-400 hover:text-white transition-colors min-h-[44px] flex items-center"
              >
                ← Back to Markets
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20">
                  <h3 className="text-white font-bold text-lg sm:text-xl mb-4 line-clamp-2">{selectedMarket.name}</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00FF99" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00FF99" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="#666" />
                      <YAxis stroke="#666" domain={[0, 100]} />
                      <Area
                        type="monotone"
                        dataKey="probability"
                        stroke="#00FF99"
                        strokeWidth={2}
                        fill="url(#colorProb)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20">
                  <h3 className="text-white font-bold text-lg sm:text-xl mb-4 sm:mb-6">Open Position</h3>

                  <div className="space-y-4 sm:space-y-6">
                    <div>
                      <label className="text-gray-400 text-sm mb-2 block">Position Size (USDC)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={positionSize}
                        onChange={(e) => setPositionSize(e.target.value)}
                        className="w-full bg-black border border-[#00FF99]/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF99] min-h-[48px] text-base"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-gray-400 text-sm">Leverage</label>
                        <span className="text-[#00FF99] font-bold">{leverage}x</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="10"
                        step="0.5"
                        value={leverage}
                        onChange={(e) => setLeverage(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #00FF99 0%, #00FF99 ${((leverage - 2) / 8) * 100}%, #333 ${((leverage - 2) / 8) * 100}%, #333 100%)`,
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>2x</span>
                        <span>10x</span>
                      </div>
                    </div>

                    <div className="bg-black/50 p-4 rounded-lg border border-[#00FF99]/10">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Total Exposure</span>
                        <span className="text-white font-medium">
                          ${((parseFloat(positionSize || "0") || 0) * leverage).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Est. Liquidation Price</span>
                        <span className="text-red-400 font-medium">{liquidationPrice}%</span>
                      </div>
                    </div>

                    <button className="w-full py-3 sm:py-4 bg-[#00FF99] text-black font-bold rounded-lg hover:bg-[#00FF99]/90 transition-all shadow-[0_0_20px_rgba(0,255,153,0.3)] min-h-[48px]">
                      Open Long Position
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Value props */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 sm:mt-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {[
            { icon: TrendingUp, title: "Non-Binary Structure", desc: "Trade continuous probability curves, not simple yes/no outcomes" },
            { icon: Zap, title: "Real-time Liquidation", desc: "AI-powered engine monitors positions 24/7 to protect protocol health" },
            { icon: Database, title: "Curated Liquidity", desc: "High-liquidity markets selected for optimal trading conditions" },
          ].map((prop, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20"
            >
              <prop.icon className="w-12 h-12 text-[#00FF99] mb-4" />
              <h3 className="text-white font-bold text-lg mb-2">{prop.title}</h3>
              <p className="text-gray-400">{prop.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Interest Split chart for Protocol page - donut with external labels + leader lines
const InterestSplitChart = () => (
  <div className="relative">
    <div className="h-[180px] sm:h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
          <Pie
            data={interestSplitData}
            cx="50%"
            cy="50%"
            innerRadius="45%"
            outerRadius="70%"
            paddingAngle={0}
            dataKey="value"
            stroke="none"
            label={({ name, cx, cy, midAngle, outerRadius, fill }) => {
              const RADIAN = Math.PI / 180;
              const r = typeof outerRadius === "number" ? outerRadius : 60;
              const labelRadius = r + 18;
              const x = cx + labelRadius * Math.cos(-midAngle * RADIAN);
              const y = cy + labelRadius * Math.sin(-midAngle * RADIAN);
              const textAnchor = x >= cx ? "start" : "end";
              return (
                <text
                  x={x}
                  y={y}
                  fill={fill === "#00FF99" ? "#00FF99" : "#aaaaaa"}
                  textAnchor={textAnchor}
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={600}
                >
                  {name}
                </text>
              );
            }}
            labelLine={{
              stroke: "#666",
              strokeWidth: 1,
              length: 12,
              lengthType: "straight",
            }}
          >
            {interestSplitData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
    <div className="mt-3 sm:mt-4 flex flex-wrap justify-center gap-4 sm:gap-8 text-xs sm:text-sm">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-sm bg-[#00FF99]" />
        <span className="text-gray-400">LPs:</span>
        <span className="text-[#00FF99] font-medium">$29.34</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-sm bg-[#888888]" />
        <span className="text-gray-400">Protocol:</span>
        <span className="text-gray-400 font-medium">$5.18</span>
      </div>
    </div>
  </div>
);

// Exposure vs Collateral chart for Protocol page
const ExposureVsCollateralChart = () => (
  <div className="relative h-[200px] sm:h-[220px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={exposureVsCollateralData} margin={{ top: 5, right: 20, left: 0, bottom: 25 }}>
        <XAxis dataKey="leverage" stroke="#666" tick={{ fill: "#999", fontSize: 10 }} />
        <YAxis stroke="#666" tick={{ fill: "#999", fontSize: 10 }} />
        <Bar dataKey="exposure" fill="#00FF99" radius={[4, 4, 0, 0]} name="Exposure ($)" />
        <Bar dataKey="collateral" fill="#888888" radius={[4, 4, 0, 0]} name="Collateral ($)" />
      </BarChart>
    </ResponsiveContainer>
    <div className="flex gap-4 mt-2 justify-center text-xs">
      <span className="text-[#00FF99]">— Exposure</span>
      <span className="text-gray-400">— Collateral</span>
    </div>
  </div>
);

// Protocol Page
const ProtocolPage = () => {
  const roadmapItems = [
    { quarter: "Q1 2026", title: "Alpha Launch", items: ["Platform Alpha", "$LMP Token Launch", "Virtuals Protocol Integration"] },
    { quarter: "Q2 2026", title: "Beta & Scaling", items: ["Public Beta", "10+ Markets", "Mobile App"] },
    { quarter: "Q3 2026", title: "World Cup Dominance", items: ["World Cup Markets", "100M+ Volume", "Institutional Access"] },
    { quarter: "Q4 2026", title: "AI Agents", items: ["AI Trading Agents", "Cross-chain Bridge", "DAO Governance"] },
  ];

  return (
    <div className="min-h-screen bg-black pt-16 sm:pt-20 pb-12 sm:pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-10 sm:py-16">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 sm:mb-4">
            How It <span className="text-[#00FF99]">Works</span>
          </h1>
          <p className="text-base sm:text-xl text-gray-400 max-w-2xl mx-auto px-2">
            A decentralized leverage layer built for the future of prediction markets
          </p>
        </motion.div>

        <div className="bg-gradient-to-br from-gray-900 to-black p-6 sm:p-12 rounded-2xl border border-[#00FF99]/20 mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8 sm:mb-12 text-center">Protocol Architecture</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 relative">
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-[#00FF99]/0 via-[#00FF99]/50 to-[#00FF99]/0" />

            {[
              { icon: Database, title: "LP Deposits", desc: "USDC into Vaults" },
              { icon: TrendingUp, title: "Margin Engine", desc: "Traders borrow with leverage" },
              { icon: Activity, title: "Oracle Monitor", desc: "Real-time price tracking" },
              { icon: Shield, title: "Liquidation", desc: "Position secured on market" },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.2 }}
                className="relative z-10 bg-black p-6 rounded-xl border border-[#00FF99]/30 text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-[#00FF99]/10 rounded-full flex items-center justify-center">
                  <step.icon className="w-8 h-8 text-[#00FF99]" />
                </div>
                <h3 className="text-white font-bold mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm">{step.desc}</p>
                {i < 3 && (
                  <>
                    <ChevronRight className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-[#00FF99]" />
                    <ChevronRight className="md:hidden absolute -bottom-4 left-1/2 -translate-x-1/2 rotate-90 text-[#00FF99]" />
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Example Trade - 3 main boxes */}
        <div className="mb-10 sm:mb-16">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 text-center">Example Trade</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20 min-w-0"
            >
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <TrendingUp className="w-5 h-5 text-[#00FF99] flex-shrink-0" />
                <h3 className="text-[#00FF99] font-bold">Position</h3>
              </div>
              <div className="space-y-2 text-gray-400 text-sm">
                <div className="flex justify-between"><span>Collateral:</span><span className="text-white">$1,000 USDC</span></div>
                <div className="flex justify-between"><span>Side:</span><span className="text-white">YES</span></div>
                <div className="flex justify-between"><span>Leverage:</span><span className="text-white">10x</span></div>
                <div className="flex justify-between"><span>Entry price:</span><span className="text-white">$0.60</span></div>
                <div className="flex justify-between"><span>Exposure:</span><span className="text-white">$10,000</span></div>
                <div className="flex justify-between"><span>Approx. shares:</span><span className="text-white">16,666.67</span></div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20"
            >
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-[#00FF99]" />
                <h3 className="text-[#00FF99] font-bold">Fees &amp; Borrow</h3>
              </div>
              <div className="space-y-2 text-gray-400 text-sm mb-4">
                <div className="flex justify-between"><span>Open fee (0.2% of exposure):</span><span className="text-white">$20</span></div>
                <div className="flex justify-between"><span>Borrowed from Vaults:</span><span className="text-white">≈$9,000</span></div>
              </div>
              <div className="pt-3 border-t border-gray-700">
                <div className="text-[#00FF99] font-semibold text-xs mb-2">INTEREST EXAMPLE</div>
                <div className="space-y-2 text-gray-400 text-sm">
                  <div className="flex justify-between"><span>APR:</span><span className="text-white">20%</span></div>
                  <div className="flex justify-between"><span>Duration:</span><span className="text-white">7 days</span></div>
                  <div className="flex justify-between"><span>Interest paid:</span><span className="text-white">$34.52</span></div>
                  <div className="flex justify-between"><span>Protocol cut (15%):</span><span className="text-white">$5.18</span></div>
                  <div className="flex justify-between"><span>LPs receive:</span><span className="text-[#00FF99]">$29.34</span></div>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20"
            >
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-[#00FF99]" />
                <h3 className="text-[#00FF99] font-bold">Outcomes</h3>
              </div>
              <div className="space-y-4 text-gray-400 text-sm">
                <div>
                  <div className="text-[#00FF99] font-semibold text-xs mb-2">IF PRICE MOVED UP</div>
                  <div className="space-y-1">
                    <div>Calculations: $0.60 + $0.06 = $0.66</div>
                    <div>P&amp;L (before fees/interest): <span className="text-[#00FF99]">+$1,000</span></div>
                  </div>
                </div>
                <div>
                  <div className="text-[#00FF99] font-semibold text-xs mb-2">IF MAINTENANCE MARGIN HIT</div>
                  <div>LPs risk protocol debt. A liquidation fee (e.g., 3–8% of remaining collateral) is paid and split between liquidators, the insurance fund, and the treasury.</div>
                </div>
              </div>
              <p className="mt-4 text-gray-500 text-xs italic">Numbers are illustrative for presentation and may vary with utilization, market conditions, and risk parameters.</p>
            </motion.div>
          </div>
        </div>

        {/* 6 boxes summarizing Example Trade (one in red = Liquidation) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-10 sm:mb-16">
          {[
            { label: "1. COLLATERAL", short: "$1,000", red: false },
            { label: "2. POSITION", short: "10x YES", red: false },
            { label: "3. FEES", short: "Open $20 (0.2% of exp.)", red: false },
            { label: "4. INTEREST", short: "$34.52 total (20% APR, 7 days)", red: false },
            { label: "5. OUTCOMES", short: "+$1,000 ($0.60 → $0.66)", red: false },
            { label: "6. LIQUIDATION", short: "3-8% fee", red: true },
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-3 sm:p-4 rounded-lg border text-center min-w-0 ${
                step.red
                  ? "bg-red-500/10 border-red-500/40"
                  : "bg-black/60 border-[#00FF99]/25"
              }`}
            >
              <div className={`font-semibold text-xs sm:text-sm mb-1 ${step.red ? "text-red-400" : "text-[#00FF99]"}`}>
                {step.label}
              </div>
              <div className="text-gray-400 text-[10px] sm:text-xs break-words">{step.short}</div>
            </motion.div>
          ))}
        </div>

        {/* Interest Split (left) + Exposure vs Collateral (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-10 sm:mb-16">
          <div className="bg-gray-900/60 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20 min-w-0 overflow-hidden">
            <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Interest Split ($34.52 total)</h3>
            <InterestSplitChart />
          </div>

          <div className="bg-gray-900/60 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20 min-w-0 overflow-hidden">
            <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Exposure vs Collateral</h3>
            <ExposureVsCollateralChart />
          </div>
        </div>

        {/* Yield Vaults, Utilization curve, Liquidation engine */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900 p-6 rounded-xl border border-[#00FF99]/20"
          >
            <h3 className="text-white font-bold text-lg mb-4">Yield Vaults</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li className="flex items-start gap-2">
                <Circle className="w-2 h-2 mt-1.5 text-[#00FF99] fill-current flex-shrink-0" />
                LPs deposit USDC into vaults to earn yield from borrow interest
              </li>
              <li className="flex items-start gap-2">
                <Circle className="w-2 h-2 mt-1.5 text-[#00FF99] fill-current flex-shrink-0" />
                Protocol takes a cut (e.g. 15%); LPs receive the majority (85%)
              </li>
              <li className="flex items-start gap-2">
                <Circle className="w-2 h-2 mt-1.5 text-[#00FF99] fill-current flex-shrink-0" />
                Utilization drives APY—higher utilization means higher LP returns
              </li>
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900 p-6 rounded-xl border border-[#00FF99]/20"
          >
            <h3 className="text-white font-bold text-lg mb-4">Utilization Curve</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li className="flex items-start gap-2">
                <Circle className="w-2 h-2 mt-1.5 text-[#00FF99] fill-current flex-shrink-0" />
                Borrow APR increases with vault utilization to balance supply/demand
              </li>
              <li className="flex items-start gap-2">
                <Circle className="w-2 h-2 mt-1.5 text-[#00FF99] fill-current flex-shrink-0" />
                Low utilization = lower APR; high utilization = higher APR
              </li>
              <li className="flex items-start gap-2">
                <Circle className="w-2 h-2 mt-1.5 text-[#00FF99] fill-current flex-shrink-0" />
                LP APY = Borrow APR × Utilization × (1 − protocol cut)
              </li>
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-900 p-6 rounded-xl border border-[#00FF99]/20"
          >
            <h3 className="text-white font-bold text-lg mb-4">Liquidation Engine</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li className="flex items-start gap-2">
                <Circle className="w-2 h-2 mt-1.5 text-[#00FF99] fill-current flex-shrink-0" />
                Auto-closes positions when maintenance margin is breached
              </li>
              <li className="flex items-start gap-2">
                <Circle className="w-2 h-2 mt-1.5 text-[#00FF99] fill-current flex-shrink-0" />
                Protects vaults from bad debt; liquidation fee (2–5%) split between liquidators, insurance, treasury
              </li>
              <li className="flex items-start gap-2">
                <Circle className="w-2 h-2 mt-1.5 text-[#00FF99] fill-current flex-shrink-0" />
                Real-time oracle monitoring ensures timely execution
              </li>
            </ul>
          </motion.div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-black p-6 sm:p-10 rounded-2xl border border-[#00FF99]/20 mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8 text-center">$LMP Tokenomics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div>
              <h3 className="text-[#00FF99] font-bold text-xl mb-4">Utility</h3>
              <ul className="space-y-3">
                {["Governance voting rights", "Trading fee discounts up to 50%", "Staking for yield boost", "Access to exclusive markets"].map(
                  (item, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-300">
                      <Circle className="w-2 h-2 mt-2 text-[#00FF99] fill-current" />
                      {item}
                    </li>
                  )
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-[#00FF99] font-bold text-xl mb-4">Distribution</h3>
              <div className="space-y-4">
                {[
                  { label: "Community & Rewards", pct: 40, cls: "bg-[#00FF99]" },
                  { label: "Team & Advisors", pct: 25, cls: "bg-[#00FF99]/70" },
                  { label: "Treasury & Development", pct: 20, cls: "bg-[#00FF99]/50" },
                  { label: "Liquidity Provision", pct: 15, cls: "bg-[#00FF99]/30" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">{row.label}</span>
                      <span className="text-white font-bold">{row.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mt-2">
                      <div className={`h-full ${row.cls}`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 p-4 bg-[#00FF99]/5 border border-[#00FF99]/20 rounded-lg text-center">
            <p className="text-gray-300">
              Launching on <span className="text-[#00FF99] font-bold">Virtuals Protocol</span>
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8 sm:mb-12 text-center">Roadmap</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {roadmapItems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20 h-full">
                  <div className="text-[#00FF99] font-bold mb-2">{item.quarter}</div>
                  <h3 className="text-white font-bold text-lg mb-4">{item.title}</h3>
                  <ul className="space-y-2">
                    {item.items.map((subItem, j) => (
                      <li key={j} className="flex items-start gap-2 text-gray-400 text-sm">
                        <Circle className="w-1.5 h-1.5 mt-1.5 text-[#00FF99] fill-current flex-shrink-0" />
                        {subItem}
                      </li>
                    ))}
                  </ul>
                </div>
                {i < roadmapItems.length - 1 && (
                  <>
                    <div className="hidden md:block absolute top-1/2 -translate-y-1/2 left-full w-6 h-0.5 bg-[#00FF99]/30 z-10" />
                    <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-full w-0.5 h-6 bg-[#00FF99]/30 z-10" />
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// USDC Vault data (extend with apyBreakdown when /api/vaults ready)
const usdcVault = {
  id: "usdc",
  name: "USDC Vault",
  symbol: "USDC",
  tvl: 1234567,
  apy: 12.34,
  utilization: 67.5,
  logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  apyBreakdown: { interestPct: 70, feesPct: 30 },
};

// Vault Page - premium redesign with educational sections
const VaultPage = ({ walletConnected }) => {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const handleAmountChange = (val) => {
    setAmount(val);
    const num = parseFloat(val);
    if (val && (isNaN(num) || num <= 0)) {
      setError("Amount must be greater than 0");
    } else {
      setError("");
    }
  };

  const isValid = (val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  };

  const handleDeposit = () => {
    if (!isValid(amount)) return;
    console.log("depositVault", "usdc", amount);
  };

  const handleWithdraw = () => {
    if (!isValid(amount)) return;
    console.log("withdrawVault", "usdc", amount);
  };

  return (
    <div className="min-h-screen bg-black pt-16 sm:pt-20 pb-16 sm:pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* A) Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center py-10 sm:py-14"
        >
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 sm:mb-4">
            Liquidity <span className="text-[#00FF99]">Vault</span>
          </h1>
          <p className="text-base sm:text-xl text-gray-400 max-w-2xl mx-auto px-2">
            Provide USDC liquidity and earn real yield from interest and trading fees
          </p>
        </motion.div>

        {/* B) USDC Vault + How Vaults Work side by side (equal height) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch mb-12 sm:mb-16">
          <VaultCard
            vault={usdcVault}
            amount={amount}
            error={error}
            onAmountChange={handleAmountChange}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdraw}
            walletConnected={walletConnected}
            userBalance={0}
          />
          <HowVaultsWorkSteps compact />
        </div>

        {/* C) Vault Health - Utilization Gauge + APY Donut */}
        <section className="py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-4">
            Vault Health
          </h2>
          <p className="text-gray-400 text-center text-sm sm:text-base max-w-xl mx-auto mb-10">
            Key metrics for the USDC vault
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UtilizationGauge utilization={usdcVault.utilization} />
            <ApyBreakdownDonut apyBreakdown={usdcVault.apyBreakdown} />
          </div>

          <div className="mt-6">
            <TvlChart currentTvl={usdcVault.tvl} />
          </div>
        </section>
      </div>
    </div>
  );
};

// App (pages)
export default function App() {
  const [currentPage, setCurrentPage] = useState("protocol");
  const [walletConnected, setWalletConnected] = useState(false);

  return (
    <div className="min-h-screen bg-black">
      <Navbar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        walletConnected={walletConnected}
        setWalletConnected={setWalletConnected}
      />

      {currentPage === "market" && <MarketPage />}
      {currentPage === "protocol" && <ProtocolPage />}
      {currentPage === "vault" && <VaultPage walletConnected={walletConnected} />}

      <Footer />
    </div>
  );
}
