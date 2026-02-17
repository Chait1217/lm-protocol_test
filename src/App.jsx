import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useEnsAvatar, useEnsName } from "wagmi";
import VaultCard from "./components/vault/VaultCard";
import HowVaultsWorkSteps from "./components/vault/HowVaultsWorkSteps";
import UtilizationGauge from "./components/vault/UtilizationGauge";
import ApyBreakdownDonut from "./components/vault/ApyBreakdownDonut";
import WhitepaperPage from "./components/whitepaper/WhitepaperPage";
import FAQPage from "./components/faq/FAQPage";
import DocumentationPage from "./components/documentation/DocumentationPage";
import HowLMWorksSixBoxes from "./components/HowLMWorksSixBoxes";
import AlphaAccessPage from "./components/alpha/AlphaAccessPage";
import PolymarketLivePrediction from "./components/market/PolymarketLivePrediction";
import PolymarketLivePredictionBoxLeverage from "./components/market/PolymarketLivePredictionBoxLeverage";
import LeverageDemoTrade from "./components/demo/LeverageDemoTrade";
import {
  Area,
  AreaChart,
  Cell,
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
  Trophy,
  Landmark,
  Bitcoin,
  Vote,
  Gamepad2,
  Film,
  ChevronLeft,
  UserCircle,
  Menu,
  X,
} from "lucide-react";

// Chart data centered on the market's actual probability (so graph matches displayed odds)
const generateChartData = (centerProbability = 50) => {
  const data = [];
  const spread = Math.max(5, Math.min(15, centerProbability * 0.4, (100 - centerProbability) * 0.4));
  for (let i = 0; i < 50; i++) {
    const variation = Math.sin(i / 5) * spread * 0.5 + (Math.random() - 0.5) * spread;
    const value = Math.max(0, Math.min(100, centerProbability + variation));
    data.push({
      time: i,
      probability: Math.round(value * 10) / 10,
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

// Trending Polymarket-style markets for the ticker
const trendingPolymarketMarkets = [
  { id: 1, title: "Trump to win 2028 US Election", odds: "62%" },
  { id: 2, title: "Bitcoin above $150k on 31 Dec 2026", odds: "41%" },
  { id: 3, title: "ETH above $10k before 2027", odds: "33%" },
  { id: 4, title: "Base to flip Arbitrum in TVL 2026", odds: "24%" },
  { id: 5, title: "Solana above $500 before 2027", odds: "38%" },
  { id: 6, title: "AI token index to outperform ETH 2026", odds: "57%" },
  { id: 7, title: "Oil above $120/barrel in 2026", odds: "29%" },
];

// Market ticker just under the navbar, only for Market page
const MarketTicker = () => {
  const [liveMarkets, setLiveMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const controls = useAnimation();

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        // Utilise Gamma API pour récupérer les marchés
        const res = await fetch(`${POLYMARKET_APIS.GAMMA}/markets?active=true&limit=20`);
        const data = await res.json();

        // Parse la réponse (peut être array ou objet avec propriété markets/data)
        const markets = Array.isArray(data) ? data : data.markets || data.data || [];

        // Filtrer les marchés actifs et avec du volume
        const filtered = markets
          .filter((m) => m.active && !m.closed && !m.archived && (m.volumeNum || 0) > 0)
          .sort((a, b) => (b.volumeNum || 0) - (a.volumeNum || 0))
          .slice(0, 10);

        const mapped = filtered.map((m) => {
          // Probabilité / odds en % basée sur le dernier prix négocié (ou premier outcome)
          const price =
            m.lastTradePrice ??
            (m.outcomes && m.outcomes.length > 0 ? m.outcomes[0].price : null);

          const pct = price != null ? Math.round(price * 100) + "%" : "–";

          const url = m.slug
            ? `https://polymarket.com/market/${m.slug}`
            : undefined;

          return {
            id: m.conditionId || m.id,
            title: m.question || m.slug || "Polymarket Market",
            odds: pct,
            url,
          };
        });

        setLiveMarkets(mapped);
      } catch (e) {
        console.error("Failed to fetch Polymarket markets from Gamma API:", e);
        // Fallback vers données mock
        setLiveMarkets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, []);

  // Animation automatique de la banderole
  useEffect(() => {
    controls.start({
      x: ["0%", "-100%"],
      transition: {
        duration: 60,
        repeat: Infinity,
        ease: "linear",
      },
    });
  }, [controls]);

  const baseItems =
    !loading && liveMarkets.length > 0 ? liveMarkets : trendingPolymarketMarkets;

  const items = [...baseItems, ...baseItems, ...baseItems];

  return (
    <div className="fixed top-[72px] sm:top-[80px] left-0 right-0 z-40 bg-black/95 border-b border-[#00FF99]/15 overflow-hidden safe-area-inset-top">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-4 text-xs md:text-sm">
        <span className="text-[#00FF99] font-semibold uppercase tracking-wider text-[0.6rem] md:text-[0.7rem]">
          Trending on Polymarket
        </span>
        <div className="relative flex-1 overflow-hidden select-none">
          <motion.div
            className="flex gap-6 whitespace-nowrap"
            drag="x"
            dragConstraints={{ left: -1000, right: 0 }}
            onDragStart={() => controls.stop()}
            onDragEnd={() =>
              controls.start({
                x: ["0%", "-100%"],
                transition: {
                  duration: 60,
                  repeat: Infinity,
                  ease: "linear",
                },
              })
            }
            initial={{ x: 0 }}
            animate={controls}
          >
            {items.map((m, idx) => {
              const content = (
                <div
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#020617] border border-[#00FF99]/20 text-gray-200 hover:border-[#00FF99]/60 hover:bg-[#020617]/80 transition-colors cursor-pointer select-none"
                >
                  <div className="w-5 h-5 rounded-full bg-[#020617] border border-[#00FF99]/40 flex items-center justify-center text-[0.55rem] font-semibold text-[#00FF99]">
                    PM
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00FF99]" />
                  <span className="max-w-[220px] truncate">{m.title}</span>
                  <span className="text-[#00FF99] font-semibold">{m.odds}</span>
                </div>
              );

              const href =
                m.url ||
                (m.title
                  ? `https://polymarket.com/search?term=${encodeURIComponent(
                      m.title
                    )}`
                  : "https://polymarket.com");

              return (
                <a
                  key={`${m.id}-${idx}`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  {content}
                </a>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// Navbar Component (mobile-friendly with hamburger menu)
const Navbar = ({ currentPage, setCurrentPage }) => {
  const { address, status, chain } = useAccount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navLinks = [
    { key: "protocol", label: "Protocol" },
    { key: "market", label: "Market" },
    { key: "vault", label: "Vault" },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const handleNavClick = (key) => {
    setCurrentPage(key);
    closeMobileMenu();
  };

  const btnBase =
    "px-4 py-2 rounded-lg font-medium transition-all border min-w-[100px] min-h-[44px] flex items-center justify-center";
  const btnConnect =
    "bg-[#00FF99] text-black hover:bg-[#00FF99]/90 border-transparent";
  const btnConnected =
    "bg-[#00FF99]/10 text-[#00FF99] border-[#00FF99]/30 hover:bg-[#00FF99]/20";
  const btnProfile =
    "bg-transparent text-[#00FF99] border-[#00FF99]/50 hover:bg-[#00FF99]/10";

  const isConnecting = status === "connecting" || status === "reconnecting";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b-2 border-[#00FF99]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)] md:bg-black/90 md:backdrop-blur-xl md:border-b md:border-[#00FF99]/10 safe-area-inset-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3 min-h-[72px] sm:min-h-[80px]">
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden p-2.5 -ml-1 rounded-xl bg-[#00FF99]/10 border border-[#00FF99]/30 text-[#00FF99] hover:bg-[#00FF99]/20 hover:border-[#00FF99]/50 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <img
            src="/lm-logo.png"
            alt="LM Protocol"
            className="h-10 sm:h-12 w-auto"
          />
        </div>
        <div className="hidden md:flex justify-center gap-8 flex-1">
          {navLinks.map((link) => (
            <button
              key={link.key}
              onClick={() => setCurrentPage(link.key)}
              className={`capitalize px-4 py-2 rounded transition-all min-h-[44px]
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
              style={{ minWidth: "84px" }}
            >
              {link.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 justify-end flex-shrink-0 min-w-0">
          {/* Visible connection status pill - compact on small screens */}
          <span
            className={`inline-flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border
              ${status === "connected"
                ? "bg-[#00FF99]/10 text-[#00FF99] border-[#00FF99]/30"
                : isConnecting
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                  : "bg-gray-500/10 text-gray-400 border-gray-500/30"
              }`}
            aria-live="polite"
          >
            {status === "connected" ? (
              <>
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF99] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FF99]" />
                </span>
                <span className="hidden sm:inline">Connected</span>
                {chain?.name && (
                  <span className="hidden lg:inline text-[#00FF99]/80">• {chain.name}</span>
                )}
                {address && (
                  <span className="truncate max-w-[60px] sm:max-w-[100px] font-mono text-xs opacity-90" title={address}>
                    {address.slice(0, 6)}…{address.slice(-4)}
                  </span>
                )}
              </>
            ) : isConnecting ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
                <span className="hidden sm:inline">Connecting…</span>
              </>
            ) : (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-gray-500 flex-shrink-0" />
                <span className="hidden sm:inline">Disconnected</span>
              </>
            )}
          </span>
          <ConnectButton.Custom>
            {({
              account,
              chain: chainFromButton,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chainFromButton;
              if (!ready) {
                return (
                  <button
                    type="button"
                    disabled
                    className={`${btnBase} ${btnConnect} opacity-70 cursor-not-allowed`}
                    title="Loading wallet..."
                  >
                    Connect Wallet
                  </button>
                );
              }
              if (isConnecting) {
                return (
                  <button
                    type="button"
                    disabled
                    className={`${btnBase} ${btnConnect} opacity-90 cursor-wait flex items-center gap-2`}
                    title="Waiting for wallet…"
                  >
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    Connecting…
                  </button>
                );
              }
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className={`${btnBase} ${btnConnect}`}
                  >
                    Connect Wallet
                  </button>
                );
              }
              if (chainFromButton?.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className={`${btnBase} ${btnConnected}`}
                  >
                    Wrong network
                  </button>
                );
              }
              return (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentPage("profile")}
                    className={`${btnBase} ${btnProfile} flex items-center gap-2`}
                  >
                    <UserCircle className="w-5 h-5 flex-shrink-0" />
                    <span>Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={openAccountModal}
                    className={`${btnBase} ${btnConnected} flex items-center gap-2`}
                  >
                    {account.ensAvatar ? (
                      <img
                        src={account.ensAvatar}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-[#00FF99]/30 flex items-center justify-center text-xs font-bold">
                        {account.displayName?.slice(0, 2).toUpperCase() ?? "?"}
                      </span>
                    )}
                    <span className="hidden sm:inline truncate max-w-[120px]">
                      {account.displayName}
                    </span>
                  </button>
                </>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/80 z-40 md:hidden"
              onClick={closeMobileMenu}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, x: "100%" }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed top-0 right-0 bottom-0 w-[min(280px,85vw)] bg-[#0c0c0c] border-l-2 border-[#00FF99]/30 shadow-[-8px_0_32px_rgba(0,0,0,0.6)] z-50 md:hidden flex flex-col pt-[72px] sm:pt-[80px] pb-8 px-4 safe-area-inset"
            >
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <button
                    key={link.key}
                    onClick={() => handleNavClick(link.key)}
                    className={`text-left capitalize px-4 py-3.5 rounded-xl font-semibold transition-all min-h-[48px] border ${
                      link.key === "market"
                        ? currentPage === "market"
                          ? "bg-[#00FF99] text-black border-[#00FF99]"
                          : "text-[#00FF99] border-[#00FF99]/30 hover:bg-[#00FF99]/10 hover:border-[#00FF99]/50"
                        : currentPage === link.key
                          ? "text-[#00FF99] bg-[#00FF99]/10 border-[#00FF99]/30"
                          : "text-gray-300 border-transparent hover:bg-white/5 hover:text-white hover:border-gray-600"
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-[#00FF99]/20 text-xs text-gray-500 bg-black/40 rounded-lg px-3 py-3">
                {status === "connected" && address && (
                  <p className="font-mono truncate mb-2 text-gray-400" title={address}>
                    {address.slice(0, 10)}…{address.slice(-8)}
                  </p>
                )}
                <p className="font-medium">{status === "connected" ? "Connected" : status === "connecting" || status === "reconnecting" ? "Connecting…" : "Disconnected"}</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
};

// Footer Component (from current repo – clickable links)
const Footer = ({ setCurrentPage }) => {
  return (
    <footer className="bg-black border-t border-[#00FF99]/10 py-8 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          <div>
            <img
              src="/lm-logo.png"
              alt="LM Protocol"
              className="h-10 sm:h-12 w-auto mb-3"
            />
            <p className="text-gray-500 text-sm">
              Institutional-grade leverage for prediction markets
            </p>
          </div>
          <div>
            <h4 className="text-white font-medium mb-3">Product</h4>
            <div className="space-y-2 text-sm text-gray-400">
              <button onClick={() => setCurrentPage?.("market")} className="block text-left hover:text-[#00FF99] transition-colors">Markets</button>
              <button onClick={() => setCurrentPage?.("vault")} className="block text-left hover:text-[#00FF99] transition-colors">Vaults</button>
              <button onClick={() => setCurrentPage?.("documentation")} className="block text-left hover:text-[#00FF99] transition-colors">Documentation</button>
            </div>
          </div>
          <div>
            <h4 className="text-white font-medium mb-3">Resources</h4>
            <div className="space-y-2 text-sm text-gray-400">
              <button onClick={() => setCurrentPage?.("whitepaper")} className="block text-left hover:text-[#00FF99] transition-colors">Whitepaper</button>
              <div>Audit Reports</div>
              <div>GitHub</div>
            </div>
          </div>
          <div>
            <h4 className="text-white font-medium mb-3">Community</h4>
            <div className="space-y-2 text-sm text-gray-400">
              <a href="https://x.com/lm_protocole?s=21" target="_blank" rel="noopener noreferrer" className="block hover:text-[#00FF99] transition-colors">X</a>
              <a href="#" className="block hover:text-[#00FF99] transition-colors">Telegram</a>
              <button onClick={() => setCurrentPage?.("faq")} className="block text-left hover:text-[#00FF99] transition-colors">FAQ</button>
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

// Utilitaires pour les APIs Polymarket
const POLYMARKET_APIS = {
  GAMMA: "https://gamma-api.polymarket.com",
  DATA: "https://data-api.polymarket.com",
  CLOB: "https://clob.polymarket.com",
};

// Récupère un marché réel depuis Gamma API avec son vrai conditionId
// Par défaut on pointe sur "Will Jesus Christ return before 2027?"
const fetchRealMarket = async (slug = "will-bitcoin-reach-100000-by-december-31-2026-571") => {
  try {
    // Gamma API pour les marchés
    const res = await fetch(`${POLYMARKET_APIS.GAMMA}/markets?slug=${slug}`);
    const data = await res.json();
    
    // La réponse peut être un array ou un objet avec une propriété markets/data
    const markets = Array.isArray(data) ? data : data.markets || data.data || [];
    
    if (markets.length === 0) {
      throw new Error("No market found");
    }
    
    const market = markets[0];
    
    // Récupère le conditionId (ID numérique requis pour les autres APIs)
    const conditionId = market.conditionId || market.id;
    
    // Calcule la probabilité depuis le dernier prix
    const lastPrice = market.lastTradePrice || 
                      (market.outcomes && market.outcomes[0]?.price) || 
                      0;
    const probability = Math.round(lastPrice * 100);
    
    return {
      conditionId: conditionId,
      id: String(conditionId), // Pour compatibilité
      slug: market.slug || slug,
      title: market.question || market.title || "Polymarket Market",
      probability: probability,
      volume: market.volumeNum || market.volume || 0,
      url: `https://polymarket.com/market/${market.slug || slug}`,
      lastPrice: lastPrice,
    };
  } catch (error) {
    console.error("Failed to fetch real market from Gamma API:", error);
    // Fallback avec un marché mock mais avec un vrai conditionId si possible
    return {
      conditionId: null,
      id: "fallback",
      slug: slug,
      title: "Will Bitcoin reach $100,000 by December 31, 2026?",
      probability: 3,
      volume: 439674,
      url: `https://polymarket.com/market/${slug}`,
      lastPrice: 0.03,
    };
  }
};

// Catégories Polymarket pour le carrousel (label FR → URL predictions + images)
const POLYMARKET_CATEGORIES = [
  { id: "sports", label: "Sport", slug: "sports", icon: Trophy, image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=560&fit=crop" },
  { id: "politics", label: "Politics", slug: "politics", icon: Landmark, image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&h=560&fit=crop" },
  { id: "crypto", label: "Crypto", slug: "crypto", icon: Bitcoin, image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=560&fit=crop" },
  { id: "finance", label: "Finance", slug: "finance", icon: DollarSign, image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=560&fit=crop" },
  { id: "elections", label: "Elections", slug: "elections", icon: Vote, image: "https://images.unsplash.com/photo-1580128660010-fd027e1e587a?w=400&h=560&fit=crop" },
  { id: "esports", label: "Esports", slug: "esports", icon: Gamepad2, image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=560&fit=crop" },
  { id: "culture", label: "Culture", slug: "pop-culture", icon: Film, image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=560&fit=crop" },
  { id: "economy", label: "Economy", slug: "economy", icon: TrendingUp, image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=560&fit=crop" },
];

// Carrousel des catégories Polymarket sur la page Market
const CategoriesCarousel = () => {
  const scrollRef = React.useRef(null);
  const cardWidthPx = 240;
  const cardHeightPx = 340;
  const gap = 20;

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const step = (cardWidthPx + gap) * (dir === "next" ? 1 : -1);
    scrollRef.current.scrollBy({ left: step, behavior: "smooth" });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 sm:mt-20 mb-8">
      <h2 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center gap-2">
        <span className="text-[#00FF99]">Categories</span> Polymarket
      </h2>
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={() => scroll("prev")}
          className="flex-shrink-0 z-10 min-w-[44px] min-h-[44px] w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/80 border border-[#00FF99]/30 text-[#00FF99] flex items-center justify-center hover:bg-[#00FF99]/10 active:scale-95 transition-transform touch-manipulation"
          aria-label="Previous categories"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden flex gap-4 sm:gap-5 pb-2 scroll-smooth snap-x snap-mandatory -webkit-overflow-scrolling-touch"
          style={{ scrollbarWidth: "thin" }}
        >
          {POLYMARKET_CATEGORIES.map((cat) => {
            const url = `https://polymarket.com/predictions/${cat.slug}`;
            return (
              <a
                key={cat.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 snap-center w-[220px] sm:w-[240px]"
              >
                <motion.div
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl border border-[#00FF99]/25 overflow-hidden bg-gray-900 hover:border-[#00FF99]/50 hover:shadow-[0_0_30px_rgba(0,255,153,0.2)] transition-all flex flex-col"
                  style={{ height: cardHeightPx }}
                >
                  <div className="relative w-full flex-1 min-h-0">
                    <img
                      src={cat.image}
                      alt={cat.label}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col gap-1">
                      <span className="text-white font-bold text-lg">{cat.label}</span>
                      <span className="text-[#00FF99] text-sm flex items-center gap-1">
                        View on Polymarket <ArrowUpRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </motion.div>
              </a>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => scroll("next")}
          className="flex-shrink-0 z-10 min-w-[44px] min-h-[44px] w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/80 border border-[#00FF99]/30 text-[#00FF99] flex items-center justify-center hover:bg-[#00FF99]/10 active:scale-95 transition-transform touch-manipulation"
          aria-label="Next categories"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

// État global pour le marché réel (sera initialisé dans MarketPage)
let realMarketCache = null;

// Market Page
const MarketPage = ({ setCurrentPage, onAccessAlphaClick }) => {
  const [featuredMarket, setFeaturedMarket] = useState(null);
  const [leverage, setLeverage] = useState(2.5);
  const [positionSize, setPositionSize] = useState("1000"); // legacy, now used as collateral helper
  const [orderSide, setOrderSide] = useState("BUY"); // BUY / SELL tab
  const [limitPriceCents, setLimitPriceCents] = useState(2.5); // prix limite en centimes
  const [shares, setShares] = useState("100");
  const [comments, setComments] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [orderBookSide, setOrderBookSide] = useState("YES"); // YES ou NO
  const [loadingOrderBook, setLoadingOrderBook] = useState(true);
  const [priceHistoryChart, setPriceHistoryChart] = useState(null); // Polymarket CLOB prices-history

  const probability = featuredMarket?.probability ?? 62;
  const chartData = useMemo(() => {
    if (priceHistoryChart && priceHistoryChart.length > 0) {
      return priceHistoryChart;
    }
    return generateChartData(probability);
  }, [priceHistoryChart, probability]);

  // Récupère le marché réel au montage
  useEffect(() => {
    const loadMarket = async () => {
      const market = await fetchRealMarket();
      setFeaturedMarket(market);
      realMarketCache = market;
    };
    loadMarket();
  }, []);

  // Récupère l'historique des prix Polymarket (graphique comme sur Polymarket)
  useEffect(() => {
    if (!featuredMarket?.conditionId) {
      setPriceHistoryChart(null);
      return;
    }
    const tokenIdYes = `${featuredMarket.conditionId}-0`;
    const fetchPriceHistory = async () => {
      try {
        const res = await fetch(
          `${POLYMARKET_APIS.CLOB}/prices-history?market=${tokenIdYes}&interval=1d`
        );
        if (!res.ok) throw new Error(`prices-history ${res.status}`);
        const data = await res.json();
        const raw = data.history || data.data || [];
        if (!Array.isArray(raw) || raw.length === 0) {
          setPriceHistoryChart(null);
          return;
        }
        const sorted = [...raw].sort((a, b) => (a.t || 0) - (b.t || 0));
        const mapped = sorted.map((point, i) => {
          const p = point.p != null ? point.p : point.price;
          const prob = typeof p === "number" ? (p <= 1 ? p * 100 : p) : 0;
          return { time: i, probability: Math.round(prob * 10) / 10 };
        });
        setPriceHistoryChart(mapped);
      } catch (e) {
        console.warn("Polymarket price history failed, using fallback chart:", e.message);
        setPriceHistoryChart(null);
      }
    };
    fetchPriceHistory();
  }, [featuredMarket?.conditionId]);

  const effectiveLimitPriceCents =
    Number.isFinite(Number(limitPriceCents)) && Number(limitPriceCents) > 0
      ? Number(limitPriceCents)
      : featuredMarket?.lastPrice
      ? Number((featuredMarket.lastPrice * 100).toFixed(2))
      : 2.5;
  // Limit price en décimal entre 0 et 1 (ex: 0.025 pour 2.5¢)
  const priceDecimal = effectiveLimitPriceCents / 100;
  const numericShares = parseFloat(shares || "0") || 0;

  // --- Trade preview logic (dérivée des formules fournies) ---
  // totalMargin: coût réel en USDC pour l'utilisateur
  const totalMargin =
    leverage > 0 ? (numericShares * priceDecimal) / leverage : 0;

  // maxWin: profit net potentiel sur la marge si le contrat va à 1.00$
  // Base PnL sans levier : YES => (1 - price), NO => price
  const baseMaxWin =
    orderBookSide === "YES"
      ? numericShares * (1 - priceDecimal)
      : numericShares * priceDecimal;
  const maxWin = baseMaxWin * (leverage || 1);

  // liquidationPrice: niveau de prix où la position serait liquidée
  // Si levier = 1x, liquidation = 0. On applique une marge de sécurité de 5%.
  // Pour YES on applique la formule directement, pour NO on la symétrise autour de 1.
  let rawLiquidationPrice = 0;
  if (leverage > 1) {
    if (orderBookSide === "YES") {
      rawLiquidationPrice = priceDecimal * (1 - 1 / leverage);
    } else {
      // côté NO : on applique la même formule sur (1 - price) puis on re-projette dans l'espace du prix
      const q = 1 - priceDecimal;
      const qLiq = q * (1 - 1 / leverage);
      rawLiquidationPrice = 1 - qLiq;
    }
  }
  const liquidationPriceDecimal = Math.max(
    0,
    Math.min(1, rawLiquidationPrice * 1.05)
  );
  const liquidationPriceCents = (liquidationPriceDecimal * 100).toFixed(2);

  // Commentaires fallback si l'API ne renvoie rien
  const commentsToRender =
    comments && comments.length > 0
      ? comments
      : [
          {
            id: "fallback-1",
            author: "0x1234...5678",
            timestamp: "2h ago",
            text: "Wild market with tiny odds but huge upside if it hits.",
          },
          {
            id: "fallback-2",
            author: "0xabcd...ef90",
            timestamp: "5h ago",
            text: "Sizing this like a long-shot lottery ticket, not a core position.",
          },
          {
            id: "fallback-3",
            author: "0x7777...9999",
            timestamp: "1d ago",
            text: "Fun tail-risk hedge, but don’t overexpose here.",
          },
        ];

  // Récupère les commentaires et trades depuis Polymarket
  useEffect(() => {
    if (!featuredMarket?.conditionId) {
      setLoadingData(false);
      return;
    }

    const fetchMarketData = async () => {
      try {
        // Récupère les commentaires depuis Data API avec conditionId numérique
        try {
          const commentsRes = await fetch(
            `${POLYMARKET_APIS.DATA}/comments?conditionId=${featuredMarket.conditionId}&limit=5`
          );
          
          if (!commentsRes.ok) {
            throw new Error(`Comments API returned ${commentsRes.status}`);
          }
          
          const commentsData = await commentsRes.json();
          
          // Parse la réponse (peut être array ou objet)
          const commentsArray = Array.isArray(commentsData) 
            ? commentsData 
            : commentsData.comments || commentsData.data || [];
          
          if (commentsArray.length > 0) {
            setComments(commentsArray.slice(0, 5).map((c, i) => ({
              id: c.id || i,
              text: c.text || c.content || c.body || "",
              author: c.author || c.userAddress || `User ${i}`,
              timestamp: c.createdAt || c.timestamp || "recently",
            })));
          } else {
            throw new Error("Empty comments array");
          }
        } catch (e) {
          console.warn("Comments API failed, using fallback:", e.message);
          // Fallback: données mock pour les commentaires
          setComments([
            { id: 1, text: "Strong bullish sentiment here. Market moving up!", author: "0x1234...5678", timestamp: "2h ago" },
            { id: 2, text: "I'm seeing some resistance at 65%. Waiting for a pullback.", author: "0xabcd...efgh", timestamp: "5h ago" },
            { id: 3, text: "This is a solid bet. Volume is increasing steadily.", author: "0x9876...5432", timestamp: "1d ago" },
          ]);
        }

        // Récupère les trades récents depuis Data API avec conditionId numérique
        try {
          const tradesRes = await fetch(
            `${POLYMARKET_APIS.DATA}/trades?conditionId=${featuredMarket.conditionId}&limit=10`
          );
          
          if (!tradesRes.ok) {
            throw new Error(`Trades API returned ${tradesRes.status}`);
          }
          
          const tradesData = await tradesRes.json();
          
          // Parse la réponse (peut être array ou objet)
          const tradesArray = Array.isArray(tradesData)
            ? tradesData
            : tradesData.trades || tradesData.data || [];
          
          if (tradesArray.length > 0) {
            setTrades(tradesArray.slice(0, 10).map((t, i) => ({
              id: t.id || t.tradeId || i,
              side: t.side || (t.outcome === 0 ? "YES" : "NO"),
              size: t.size || t.amount || "0",
              price: t.price || t.outcomePrice || "0",
              time: t.timestamp || t.createdAt || "recently",
            })));
          } else {
            throw new Error("Empty trades array");
          }
        } catch (e) {
          console.warn("Trades API failed, using fallback:", e.message);
          // Fallback: données mock pour les trades
          setTrades([
            { id: 1, side: "YES", size: "1,250", price: "0.62", time: "2m ago" },
            { id: 2, side: "YES", size: "850", price: "0.61", time: "5m ago" },
            { id: 3, side: "NO", size: "500", price: "0.39", time: "8m ago" },
            { id: 4, side: "YES", size: "2,100", price: "0.63", time: "12m ago" },
            { id: 5, side: "YES", size: "600", price: "0.62", time: "15m ago" },
          ]);
        }
      } catch (e) {
        console.error("Failed to fetch market data:", e);
      } finally {
        setLoadingData(false);
      }
    };

    fetchMarketData();
  }, [featuredMarket?.conditionId]);

  // Récupère le carnet d'ordres réel depuis CLOB API
  useEffect(() => {
    if (!featuredMarket?.conditionId) {
      setLoadingOrderBook(false);
      return;
    }

    const fetchOrderBook = async () => {
      try {
        // CLOB API pour le carnet d'ordres - utilise conditionId
        // Format: /book?token_id={conditionId}-{outcome}
        // Outcome 0 = YES, 1 = NO
        const outcome = orderBookSide === "YES" ? 0 : 1;
        const tokenId = `${featuredMarket.conditionId}-${outcome}`;
        
        const res = await fetch(
          `${POLYMARKET_APIS.CLOB}/book?token_id=${tokenId}`
        );
        
        if (!res.ok) {
          throw new Error(`Order book API returned ${res.status}`);
        }
        
        const data = await res.json();

        if (data) {
          // Parse la réponse CLOB (format: { bids: [[price, size], ...], asks: [[price, size], ...] })
          const bids = data.bids || [];
          const asks = data.asks || [];

          setOrderBook({
            bids: bids.slice(0, 10).map((b, i) => ({
              id: `bid-${i}`,
              price: Array.isArray(b) ? parseFloat(b[0]) : parseFloat(b.price || 0),
              size: Array.isArray(b) ? parseFloat(b[1]) : parseFloat(b.size || 0),
            })),
            asks: asks.slice(0, 10).map((a, i) => ({
              id: `ask-${i}`,
              price: Array.isArray(a) ? parseFloat(a[0]) : parseFloat(a.price || 0),
              size: Array.isArray(a) ? parseFloat(a[1]) : parseFloat(a.size || 0),
            })),
          });
        } else {
          throw new Error("Empty order book response");
        }
      } catch (e) {
        console.warn("Failed to fetch order book from CLOB API:", e.message);
        // En cas d'erreur, on laisse le carnet vide plutôt que d'inventer des données
        setOrderBook({ bids: [], asks: [] });
      } finally {
        setLoadingOrderBook(false);
      }
    };

    fetchOrderBook();
    // Rafraîchit toutes les 5 secondes
    const interval = setInterval(fetchOrderBook, 5000);
    return () => clearInterval(interval);
  }, [featuredMarket?.conditionId, orderBookSide]);

  return (
    <div className="min-h-screen bg-black pt-32 sm:pt-36 pb-12 sm:pb-16 overflow-x-hidden">
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
          <p className="text-base sm:text-xl text-gray-400 mb-6 sm:mb-8 max-w-2xl mx-auto px-1">
            Powered by Base L2. Trade prediction markets with up to 5x leverage.
          </p>
          <motion.button
            type="button"
            onClick={() => (onAccessAlphaClick ? onAccessAlphaClick() : setCurrentPage?.("alpha"))}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="min-h-[48px] px-6 sm:px-8 py-3 sm:py-4 bg-[#00FF99] text-black font-bold rounded-lg text-base sm:text-lg shadow-[0_0_30px_rgba(0,255,153,0.3)] hover:shadow-[0_0_50px_rgba(0,255,153,0.5)] transition-all inline-flex items-center justify-center gap-2"
          >
            Apply for alpha access
            <ArrowUpRight className="w-5 h-5" />
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

      {/* Bloc marché principal – Live Polymarket Integration (compact) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 sm:mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h2 className="text-lg sm:text-2xl font-bold text-white">
            Live Polymarket Integration
          </h2>
          <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full bg-[#00FF99]/10 border border-[#00FF99]/30 text-[#00FF99] uppercase tracking-widest">
            <span className="w-1 h-1 rounded-full bg-[#00FF99] animate-pulse" />
            Powered by LM Protocol
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-3 md:gap-5 items-stretch">
            <PolymarketLivePrediction
              slug="will-bitcoin-reach-100000-by-december-31-2026-571"
              settlementDate="Dec 31, 2026"
              refreshInterval={2000}
              compact
            />
            <PolymarketLivePredictionBoxLeverage
              slug="will-bitcoin-reach-100000-by-december-31-2026-571"
              refreshInterval={2000}
              compact
            />
        </div>
      </div>

      {/* Demo Trade – content from Demo page */}
      <div className="mt-12 sm:mt-16">
        <LeverageDemoTrade embedded />
      </div>

      {/* Value props */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 sm:mt-20">
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {[
            { icon: Activity, title: "Mark-Based Liquidation", desc: "Liquidation follows mark price (probability move). Your liquidation level is shown before you trade. No hidden triggers." },
            { icon: Lock, title: "Isolated Margin", desc: "Margin is per position. One liquidated position does not pull collateral from your other positions; no cross-margin contagion." },
            { icon: Database, title: "Fees & Mark Transparency", desc: "Borrow cost and fees disclosed upfront. Mark from Polymarket CLOB mid (or TWAP) for fair, on-chain valuation." },
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

      {/* Carrousel catégories Polymarket (sous les trois cases) */}
      <CategoriesCarousel />
    </div>
  );
};

// Protocol page data + charts (5x example trade)
const interestSplitData = [
  { name: "LPs: $13.04", value: 85, color: "#00FF99" },
  { name: "Protocol: $2.30", value: 15, color: "#888888" },
];
const InterestSplitChart = () => (
  <div className="relative min-w-0">
    <div className="h-[240px] sm:h-[280px] min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
          <Pie
            data={interestSplitData}
            cx="50%"
            cy="50%"
            innerRadius="38%"
            outerRadius="88%"
            paddingAngle={0}
            dataKey="value"
            stroke="none"
            label={({ name, cx, cy, midAngle, outerRadius, fill }) => {
              const RADIAN = Math.PI / 180;
              const r = typeof outerRadius === "number" ? outerRadius : 80;
              const labelRadius = r + 14;
              const x = cx + labelRadius * Math.cos(-midAngle * RADIAN);
              const y = cy + labelRadius * Math.sin(-midAngle * RADIAN);
              const textAnchor = x >= cx ? "start" : "end";
              return (
                <text x={x} y={y} fill={fill === "#00FF99" ? "#00FF99" : "#aaaaaa"} textAnchor={textAnchor} dominantBaseline="middle" fontSize={12} fontWeight={600}>
                  {name}
                </text>
              );
            }}
            labelLine={{ stroke: "#666", strokeWidth: 1, length: 10, lengthType: "straight" }}
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
        <span className="text-[#00FF99] font-medium">$13.04</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-sm bg-[#888888]" />
        <span className="text-gray-400">Protocol:</span>
        <span className="text-gray-400 font-medium">$2.30</span>
      </div>
    </div>
  </div>
);

// Protocol Page (from current repo – full version)
const ProtocolPage = () => {
  const roadmapItems = [
    { quarter: "Q1 2026", title: "Alpha Launch", items: ["Platform Alpha", "$LMP Token Launch", "Virtuals Protocol Integration"] },
    { quarter: "Q2 2026", title: "Beta & Scaling", items: ["Public Beta", "10+ Markets", "Mobile App"] },
    { quarter: "Q3 2026", title: "World Cup Dominance", items: ["World Cup Markets", "100M+ Volume", "Institutional Access"] },
    { quarter: "Q4 2026", title: "AI Agents", items: ["AI Trading Agents", "Cross-chain Bridge", "DAO Governance"] },
  ];
  return (
    <div className="min-h-screen bg-black pt-16 sm:pt-20 pb-12 sm:pb-16 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 min-w-0">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-10 sm:py-16">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 sm:mb-4">How It <span className="text-[#00FF99]">Works</span></h1>
          <p className="text-base sm:text-xl text-gray-400 max-w-2xl mx-auto px-2">Prediction markets, but with leverage</p>
        </motion.div>
        <div className="bg-gradient-to-br from-gray-900 to-black p-4 sm:p-6 md:p-12 rounded-2xl border border-[#00FF99]/20 mb-8 sm:mb-16">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-6 sm:mb-8 md:mb-12 text-center">Protocol Architecture</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 relative">
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-[#00FF99]/0 via-[#00FF99]/50 to-[#00FF99]/0" />
            {[
              { icon: Database, title: "LP Deposits", desc: "USDC into Vaults" },
              { icon: TrendingUp, title: "Margin Engine", desc: "Traders borrow with leverage" },
              { icon: Activity, title: "Oracle Monitor", desc: "Real-time price tracking" },
              { icon: Shield, title: "Liquidation", desc: "Position secured on market" },
            ].map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.2 }} className="relative z-10 bg-black p-6 rounded-xl border border-[#00FF99]/30 text-center">
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
        <div className="mb-10 sm:mb-16">
          <HowLMWorksSixBoxes />
        </div>
        {/* Example Trade (5x leverage) */}
        <div className="mb-8 sm:mb-16">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 text-center px-2">Example Trade</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {[
              { icon: TrendingUp, title: "Position", rows: [["Collateral:", "$1,000 USDC"], ["Side:", "YES"], ["Leverage:", "5x"], ["Entry price:", "$0.60"], ["Exposure:", "$5,000"], ["Approx. shares:", "8,333.33"]] },
              { icon: DollarSign, title: "Fees & Borrow", rows: [["Open fee (0.2% of exposure):", "$10"], ["Borrowed from Vaults:", "~$4,000"], ["APR:", "20%"], ["Duration:", "7 days"], ["Interest paid:", "$15.34"], ["Protocol cut (15%):", "$2.30"], ["LPs receive:", "$13.04"]] },
              {
                icon: Lightbulb,
                title: "Outcomes",
                rows: [
                  ["If price moves up:", "$0.60 → $0.66"],
                  ["P&L (before fees/interest):", "+$500"],
                  ["If maintenance margin hit:", "Position liquidated"],
                  ["Liquidation fee (3–8%):", "Liquidators, insurance, treasury"],
                ],
              },
            ].map((box, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: (i + 1) * 0.1 }} className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20 min-w-0">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <box.icon className="w-5 h-5 text-[#00FF99] flex-shrink-0" />
                  <h3 className="text-[#00FF99] font-bold">{box.title}</h3>
                </div>
                <div className="space-y-2 text-gray-400 text-sm">
                  {box.rows.map(([k, v], j) => (
                    <div key={j} className="flex justify-between gap-2"><span>{k}</span><span className="text-white text-right">{v}</span></div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="space-y-4 sm:space-y-6 mb-10 sm:mb-16">
          <div className="bg-gray-900/60 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20 min-w-0 overflow-hidden">
            <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Interest Split ($15.34 total)</h3>
            <InterestSplitChart />
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-900 to-black p-4 sm:p-6 md:p-10 rounded-2xl border border-[#00FF99]/20 mb-10 sm:mb-16 overflow-x-hidden">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 sm:mb-6 md:mb-8 text-center">$LMP Tokenomics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div>
              <h3 className="text-[#00FF99] font-bold text-xl mb-4">Utility</h3>
              <ul className="space-y-3">
                {["Governance voting rights", "Trading fee discounts up to 50%", "Staking for yield boost", "Access to exclusive markets"].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-300">
                    <Circle className="w-2 h-2 mt-2 text-[#00FF99] fill-current" />
                    {item}
                  </li>
                ))}
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
            <p className="text-gray-300">Launching on <span className="text-[#00FF99] font-bold">Virtuals Protocol</span></p>
          </div>
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8 sm:mb-12 text-center">Roadmap</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {roadmapItems.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="relative">
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

// Demo: stats à zéro (à remplacer par des données réelles plus tard)
const mockProfileStats = {
  pnlTotal: 0,
  pnl24h: 0,
  pnl7d: 0,
  winRate: 0,
  totalVolume: 0,
  tradesCount: 0,
};

const mockOpenPositions = [];

// Profile Page (dashboard utilisateur)
const ProfilePage = () => {
  const { address, isConnected, chain } = useAccount();
  const { data: ensName } = useEnsName({ address });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName ?? undefined });
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen bg-black pt-20 pb-16 flex items-center justify-center overflow-x-hidden px-4">
        <div className="text-center text-gray-400">
          <p className="mb-4">Connect your wallet to view your profile.</p>
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                type="button"
                onClick={openConnectModal}
                className="px-6 py-2 rounded-lg bg-[#00FF99] text-black font-medium hover:bg-[#00FF99]/90"
              >
                Connect Wallet
              </button>
            )}
          </ConnectButton.Custom>
        </div>
      </div>
    );
  }

  const shortAddress = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const displayName = ensName ?? shortAddress;

  return (
    <div className="min-h-screen bg-black pt-20 pb-12 sm:pb-16 overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header: photo + pseudo + infos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-gray-900 to-black p-8 md:p-10 rounded-2xl border border-[#00FF99]/20 mb-8"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-shrink-0">
              {ensAvatar ? (
                <img
                  src={ensAvatar}
                  alt=""
                  className="w-24 h-24 rounded-2xl border-2 border-[#00FF99]/30 object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl border-2 border-[#00FF99]/30 bg-[#00FF99]/10 flex items-center justify-center text-3xl font-bold text-[#00FF99]">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 truncate">
                {ensName ? ensName : "Trader"}
              </h1>
              <p className="text-gray-400 text-sm mb-3 font-mono">{shortAddress}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copyAddress}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    copied
                      ? "bg-[#00FF99]/20 text-[#00FF99]"
                      : "bg-[#00FF99]/10 text-[#00FF99] border border-[#00FF99]/30 hover:bg-[#00FF99]/20"
                  }`}
                >
                  {copied ? "Copied!" : "Copy address"}
                </button>
                {chain && (
                  <span className="px-3 py-1.5 rounded-lg text-sm bg-black/50 text-gray-300 border border-[#00FF99]/20">
                    {chain.name}
                  </span>
                )}
              </div>
            </div>
            <ConnectButton.Custom>
              {({ openAccountModal }) => (
                <button
                  type="button"
                  onClick={openAccountModal}
                  className="flex-shrink-0 px-4 py-2 rounded-lg bg-transparent text-gray-400 border border-gray-600 hover:text-white hover:border-[#00FF99]/50 transition-all text-sm"
                >
                  Disconnect
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        </motion.div>

        {/* Stats PnL & volume */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-8"
        >
          {[
            { label: "PnL Total", value: `$${mockProfileStats.pnlTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, change: null, positive: null },
            { label: "PnL 24h", value: `$${mockProfileStats.pnl24h.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, change: null, positive: null },
            { label: "PnL 7d", value: `$${mockProfileStats.pnl7d.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, change: null, positive: null },
            { label: "Win rate", value: `${mockProfileStats.winRate}%`, change: null, positive: null },
            { label: "Volume", value: mockProfileStats.totalVolume > 0 ? `$${(mockProfileStats.totalVolume / 1000).toFixed(1)}k` : "$0", change: null, positive: null },
            { label: "Trades", value: String(mockProfileStats.tradesCount), change: null, positive: null },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="bg-gray-900 p-5 rounded-xl border border-[#00FF99]/20"
            >
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">{stat.label}</div>
              <div className="text-xl font-bold text-white">{stat.value}</div>
              {stat.change && (
                <div className={`text-sm ${stat.positive ? "text-[#00FF99]" : "text-red-400"}`}>
                  {stat.change}
                </div>
              )}
            </div>
          ))}
        </motion.div>

        {/* Positions ouvertes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-gray-900 to-black p-6 md:p-8 rounded-2xl border border-[#00FF99]/20"
        >
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00FF99]" />
            Positions ouvertes
          </h2>
          {mockOpenPositions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune position ouverte.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 text-sm border-b border-[#00FF99]/20">
                    <th className="pb-3 pr-4 font-medium">Marché</th>
                    <th className="pb-3 pr-4 font-medium">Side</th>
                    <th className="pb-3 pr-4 font-medium">Size</th>
                    <th className="pb-3 pr-4 font-medium">Entry</th>
                    <th className="pb-3 pr-4 font-medium">Current</th>
                    <th className="pb-3 font-medium text-right">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {mockOpenPositions.map((pos) => (
                    <tr key={pos.id} className="border-b border-gray-800/80 hover:bg-[#00FF99]/5 transition-colors">
                      <td className="py-4 pr-4 text-white font-medium max-w-[200px] truncate">{pos.market}</td>
                      <td className="py-4 pr-4">
                        <span className={pos.side === "Yes" ? "text-[#00FF99]" : "text-orange-400"}>{pos.side}</span>
                      </td>
                      <td className="py-4 pr-4 text-gray-300">${pos.size}</td>
                      <td className="py-4 pr-4 text-gray-300">{pos.entry}</td>
                      <td className="py-4 pr-4 text-gray-300">{pos.current}</td>
                      <td className="py-4 text-right">
                        <span className={pos.pnl >= 0 ? "text-[#00FF99]" : "text-red-400"}>
                          {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

// USDC Vault data (from current repo)
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

// Vault Page (from current repo – premium with VaultCard, HowVaultsWorkSteps, Vault Health)
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
    <div className="min-h-screen bg-black pt-16 sm:pt-20 pb-16 sm:pb-24 overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center py-10 sm:py-14">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 sm:mb-4">
            Liquidity <span className="text-[#00FF99]">Vault</span>
          </h1>
          <p className="text-base sm:text-xl text-gray-400 max-w-2xl mx-auto px-2">
            Provide USDC liquidity and earn real yield from interest and trading fees
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch mb-12 sm:mb-16">
          <div>
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
            <p className="mt-3 text-center sm:text-left text-xs text-gray-500">
              Numbers shown are for demonstration only (fictional).
            </p>
          </div>
          <HowVaultsWorkSteps compact />
        </div>

        <section className="py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-4">Vault Health</h2>
          <p className="text-gray-400 text-center text-sm sm:text-base max-w-xl mx-auto mb-10">Key metrics for the USDC vault</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UtilizationGauge utilization={usdcVault.utilization} />
            <ApyBreakdownDonut apyBreakdown={usdcVault.apyBreakdown} />
          </div>
        </section>
      </div>
    </div>
  );
};

// App (pages)
export default function App() {
  const [currentPage, setCurrentPage] = useState("market");
  const [alphaInitialEmail, setAlphaInitialEmail] = useState(null);
  const prevPageRef = useRef("market");
  const { isConnected } = useAccount();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  useEffect(() => {
    // Only clear email when leaving alpha page, not when entering it
    if (prevPageRef.current === "alpha" && currentPage !== "alpha") {
      setAlphaInitialEmail(null);
    }
    prevPageRef.current = currentPage;
  }, [currentPage]);

  const goToAlphaFromMarket = () => {
    setAlphaInitialEmail("lmprotcol@gmail.com");
    setCurrentPage("alpha");
  };

  return (
    <div className="min-h-screen bg-black overflow-x-hidden">
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      {currentPage === "market" && <MarketTicker />}

      {currentPage === "market" && <MarketPage setCurrentPage={setCurrentPage} onAccessAlphaClick={goToAlphaFromMarket} />}
      {currentPage === "alpha" && <AlphaAccessPage setCurrentPage={setCurrentPage} initialEmail={alphaInitialEmail} />}
      {currentPage === "protocol" && <ProtocolPage />}
      {currentPage === "vault" && <VaultPage walletConnected={isConnected} />}
      {currentPage === "profile" && <ProfilePage />}

      {currentPage === "whitepaper" && <WhitepaperPage />}
      {currentPage === "faq" && <FAQPage />}
      {currentPage === "documentation" && <DocumentationPage setCurrentPage={setCurrentPage} />}
      {currentPage === "demo" && <LeverageDemoTrade />}

      <Footer setCurrentPage={setCurrentPage} />
    </div>
  );
}
