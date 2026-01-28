import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
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

const mockMarkets = [
  { id: 1, name: "2026 World Cup Winner - Brazil", probability: 68, volume: "2.4M", change: "+5.2%" },
  { id: 2, name: "Bitcoin EOY 2026 > $150K", probability: 42, volume: "8.1M", change: "-2.1%" },
  { id: 3, name: "US Midterms 2026 - Democratic Senate", probability: 55, volume: "5.7M", change: "+1.8%" },
  { id: 4, name: "Ethereum > $8K by Q3 2026", probability: 38, volume: "3.2M", change: "+4.3%" },
];

// Navbar Component
const Navbar = ({ currentPage, setCurrentPage, walletConnected, setWalletConnected }) => {
  // Nouvel ordre des liens
  const navLinks = [
    { key: "protocol", label: "Protocol" },
    { key: "market", label: "Market" }, // sera mis en avant
    { key: "vault", label: "Vault" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-[#00FF99]/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="text-2xl font-bold flex-shrink-0">
          <span className="text-white">LM</span>
          <span className="text-[#00FF99]">Protocol</span>
        </div>
        {/* Centrage horizontal des liens */}
        <div className="flex-1 flex justify-center">
          <div className="hidden md:flex gap-8">
            {navLinks.map((link) => (
              <button
                key={link.key}
                onClick={() => setCurrentPage(link.key)}
                className={`capitalize px-4 py-1 rounded transition-all
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
                style={{ minWidth: "84px" }} // harmonise la largeur, optionnel
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setWalletConnected(!walletConnected)}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            walletConnected
              ? "bg-[#00FF99]/10 text-[#00FF99] border border-[#00FF99]/30"
              : "bg-[#00FF99] text-black hover:bg-[#00FF99]/90"
          }`}
        >
          {walletConnected ? "0x742d...5e3A" : "Connect Wallet"}
        </button>
      </div>
    </nav>
  );
};

// Footer Component
const Footer = () => {
  return (
    <footer className="bg-black border-t border-[#00FF99]/10 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
              <div>Twitter</div>
              <div>Discord</div>
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
    <div className="min-h-screen bg-black pt-20 pb-16">
      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 py-16 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="text-white">Institutional-Grade</span>
            <br />
            <span className="text-[#00FF99]">Leverage Trading</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Powered by AI & Base L2. Trade prediction markets with up to 10x leverage.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-[#00FF99] text-black font-bold rounded-lg text-lg shadow-[0_0_30px_rgba(0,255,153,0.3)] hover:shadow-[0_0_50px_rgba(0,255,153,0.5)] transition-all"
          >
            Launch App <ArrowUpRight className="inline ml-2" />
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
      <div className="max-w-7xl mx-auto px-6 mt-12">
        <h2 className="text-3xl font-bold text-white mb-6">Live Markets</h2>
        <div className="grid gap-4">
          {mockMarkets.map((market) => (
            <motion.div
              key={market.id}
              whileHover={{ scale: 1.01 }}
              onClick={() => setSelectedMarket(market)}
              className="bg-gradient-to-r from-gray-900 to-black p-6 rounded-xl border border-[#00FF99]/20 cursor-pointer hover:border-[#00FF99]/50 transition-all"
            >
              <div className="flex items-center justify-between gap-6">
                <div className="flex-1">
                  <h3 className="text-white font-medium mb-2">{market.name}</h3>
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-400">
                      24h Vol: <span className="text-white">${market.volume}</span>
                    </span>
                    <span className={market.change.startsWith("+") ? "text-[#00FF99]" : "text-red-400"}>
                      {market.change}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-[#00FF99]">{market.probability}%</div>
                  <button className="mt-2 px-4 py-2 bg-[#00FF99]/10 text-[#00FF99] rounded-lg border border-[#00FF99]/30 hover:bg-[#00FF99]/20 transition-all">
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
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 overflow-y-auto"
          >
            <div className="max-w-6xl mx-auto px-6 py-20">
              <button
                onClick={() => setSelectedMarket(null)}
                className="mb-6 text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Markets
              </button>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-gray-900 p-6 rounded-xl border border-[#00FF99]/20">
                  <h3 className="text-white font-bold text-xl mb-4">{selectedMarket.name}</h3>
                  <ResponsiveContainer width="100%" height={300}>
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

                <div className="bg-gray-900 p-6 rounded-xl border border-[#00FF99]/20">
                  <h3 className="text-white font-bold text-xl mb-6">Open Position</h3>

                  <div className="space-y-6">
                    <div>
                      <label className="text-gray-400 text-sm mb-2 block">Position Size (USDC)</label>
                      <input
                        type="text"
                        value={positionSize}
                        onChange={(e) => setPositionSize(e.target.value)}
                        className="w-full bg-black border border-[#00FF99]/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00FF99]"
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

                    <button className="w-full py-4 bg-[#00FF99] text-black font-bold rounded-lg hover:bg-[#00FF99]/90 transition-all shadow-[0_0_20px_rgba(0,255,153,0.3)]">
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
      <div className="max-w-7xl mx-auto px-6 mt-20">
        <div className="grid md:grid-cols-3 gap-6">
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
              className="bg-gray-900 p-6 rounded-xl border border-[#00FF99]/20"
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

// Protocol Page
const ProtocolPage = () => {
  const roadmapItems = [
    { quarter: "Q1 2026", title: "Alpha Launch", items: ["Platform Alpha", "$LMP Token Launch", "Virtuals Protocol Integration"] },
    { quarter: "Q2 2026", title: "Beta & Scaling", items: ["Public Beta", "10+ Markets", "Mobile App"] },
    { quarter: "Q3 2026", title: "World Cup Dominance", items: ["World Cup Markets", "100M+ Volume", "Institutional Access"] },
    { quarter: "Q4 2026", title: "AI Agents", items: ["AI Trading Agents", "Cross-chain Bridge", "DAO Governance"] },
  ];

  return (
    <div className="min-h-screen bg-black pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            How It <span className="text-[#00FF99]">Works</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            A decentralized leverage layer built for the future of prediction markets
          </p>
        </motion.div>

        <div className="bg-gradient-to-br from-gray-900 to-black p-12 rounded-2xl border border-[#00FF99]/20 mb-16">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">Protocol Architecture</h2>

          <div className="grid md:grid-cols-4 gap-8 relative">
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
                  <ChevronRight className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-[#00FF99]" />
                )}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: Shield, title: "Audited Contracts", desc: "Multiple security audits by leading firms" },
            { icon: Lock, title: "Insurance Fund", desc: "Protocol-owned reserve for black swan events" },
            { icon: Zap, title: "Bad Debt Protection", desc: "Real-time monitoring prevents cascading liquidations" },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-gray-900 p-6 rounded-xl border border-[#00FF99]/20"
            >
              <item.icon className="w-10 h-10 text-[#00FF99] mb-4" />
              <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
              <p className="text-gray-400">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-black p-10 rounded-2xl border border-[#00FF99]/20 mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">$LMP Tokenomics</h2>
          <div className="grid md:grid-cols-2 gap-8">
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
          <h2 className="text-3xl font-bold text-white mb-12 text-center">Roadmap</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {roadmapItems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div className="bg-gray-900 p-6 rounded-xl border border-[#00FF99]/20 h-full">
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
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-[#00FF99]/30" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Vault Page
const VaultPage = ({ walletConnected }) => {
  const [depositAmount, setDepositAmount] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);

  return (
    <div className="min-h-screen bg-black pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Liquidity <span className="text-[#00FF99]">Vaults</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Provide USDC liquidity and earn real yield from trading fees
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { label: "Total Value Locked", value: "$24.7M", change: "+12.3%" },
            { label: "Current APY", value: "15.2%", change: "+2.1%" },
            { label: "Total Fees Generated", value: "$1.8M", change: "+8.7%" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-xl border border-[#00FF99]/20 text-center"
            >
              <div className="text-gray-400 mb-2">{stat.label}</div>
              <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
              <div className="text-[#00FF99] text-sm">{stat.change} 24h</div>
            </motion.div>
          ))}
        </div>

        {walletConnected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 p-8 rounded-xl border border-[#00FF99]/20 mb-12"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Your Position</h2>
            <div className="grid md:grid-cols-3 gap-8 mb-6">
              <div>
                <div className="text-gray-400 text-sm mb-2">Your Deposit</div>
                <div className="text-3xl font-bold text-white">$12,500</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm mb-2">Earned Fees</div>
                <div className="text-3xl font-bold text-[#00FF99]">$247.30</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm mb-2">Your APY</div>
                <div className="text-3xl font-bold text-white">16.8%</div>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeposit(true)}
                className="flex-1 py-3 bg-[#00FF99] text-black font-bold rounded-lg hover:bg-[#00FF99]/90 transition-all"
              >
                Deposit USDC
              </button>
              <button className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-all border border-gray-700">
                Withdraw
              </button>
            </div>
          </motion.div>
        )}

        {!walletConnected && (
          <div className="bg-gray-900 p-8 rounded-xl border border-[#00FF99]/20 text-center text-gray-300">
            Connect your wallet to view your vault position.
          </div>
        )}
      </div>

      {/* Deposit modal (simple) */}
      <AnimatePresence>
        {showDeposit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="w-full max-w-md bg-gray-900 rounded-2xl border border-[#00FF99]/20 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-xl">Deposit USDC</h3>
                <button
                  onClick={() => setShowDeposit(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <label className="text-gray-400 text-sm block mb-2">Amount</label>
              <input
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-black border border-[#00FF99]/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00FF99]"
              />

              <button
                onClick={() => setShowDeposit(false)}
                className="mt-5 w-full py-3 bg-[#00FF99] text-black font-bold rounded-lg hover:bg-[#00FF99]/90 transition-all"
              >
                Confirm Deposit
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// App (pages)
export default function App() {
  const [currentPage, setCurrentPage] = useState("market");
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
