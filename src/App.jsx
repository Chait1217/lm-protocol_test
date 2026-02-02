import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useEnsAvatar, useEnsName } from "wagmi";
import VaultCard from "./components/vault/VaultCard";
import HowVaultsWorkSteps from "./components/vault/HowVaultsWorkSteps";
import UtilizationGauge from "./components/vault/UtilizationGauge";
import ApyBreakdownDonut from "./components/vault/ApyBreakdownDonut";
import TvlChart from "./components/vault/TvlChart";
import WhitepaperPage from "./components/whitepaper/WhitepaperPage";
import FAQPage from "./components/faq/FAQPage";
import DocumentationPage from "./components/documentation/DocumentationPage";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
    <div className="fixed top-[80px] left-0 right-0 z-40 bg-black/95 border-b border-[#00FF99]/15 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-4 text-xs md:text-sm">
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

// Navbar Component
const Navbar = ({ currentPage, setCurrentPage }) => {
  const { address, status, chain } = useAccount();
  const navLinks = [
    { key: "protocol", label: "Protocol" },
    { key: "market", label: "Market" },
    { key: "vault", label: "Vault" },
  ];

  const btnBase =
    "px-4 py-2 rounded-lg font-medium transition-all border min-w-[100px]";
  const btnConnect =
    "bg-[#00FF99] text-black hover:bg-[#00FF99]/90 border-transparent";
  const btnConnected =
    "bg-[#00FF99]/10 text-[#00FF99] border-[#00FF99]/30 hover:bg-[#00FF99]/20";
  const btnProfile =
    "bg-transparent text-[#00FF99] border-[#00FF99]/50 hover:bg-[#00FF99]/10";

  const isConnecting = status === "connecting" || status === "reconnecting";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-[#00FF99]/10">
      <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex-shrink-0">
          <img
            src="/lm-logo.png"
            alt="LM Protocol"
            className="h-12 w-auto"
          />
        </div>
        <div className="hidden md:flex justify-center gap-8">
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
              style={{ minWidth: "84px" }}
            >
              {link.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 justify-end flex-wrap">
          {/* Visible connection status pill */}
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border
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
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF99] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FF99]" />
                </span>
                <span className="hidden sm:inline">Connected</span>
                {chain?.name && (
                  <span className="hidden sm:inline text-[#00FF99]/80">• {chain.name}</span>
                )}
                {address && (
                  <span className="truncate max-w-[80px] sm:max-w-[100px] font-mono text-xs opacity-90" title={address}>
                    {address.slice(0, 6)}…{address.slice(-4)}
                  </span>
                )}
              </>
            ) : isConnecting ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                Connecting…
              </>
            ) : (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-gray-500" />
                Disconnected
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
const fetchRealMarket = async (slug = "will-jesus-christ-return-before-2027") => {
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
      title: "Will Jesus Christ return before 2027?",
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
  { id: "politics", label: "Politique", slug: "politics", icon: Landmark, image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&h=560&fit=crop" },
  { id: "crypto", label: "Crypto", slug: "crypto", icon: Bitcoin, image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=560&fit=crop" },
  { id: "finance", label: "Finance", slug: "finance", icon: DollarSign, image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=560&fit=crop" },
  { id: "elections", label: "Élections", slug: "elections", icon: Vote, image: "https://images.unsplash.com/photo-1580128660010-fd027e1e587a?w=400&h=560&fit=crop" },
  { id: "esports", label: "Esports", slug: "esports", icon: Gamepad2, image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=560&fit=crop" },
  { id: "culture", label: "Culture", slug: "pop-culture", icon: Film, image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=560&fit=crop" },
  { id: "economy", label: "Économie", slug: "economy", icon: TrendingUp, image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=560&fit=crop" },
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
    <div className="max-w-7xl mx-auto px-6 mt-20 mb-8">
      <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
        <span className="text-[#00FF99]">Categories</span> Polymarket
      </h2>
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={() => scroll("prev")}
          className="flex-shrink-0 z-10 w-12 h-12 rounded-full bg-black/80 border border-[#00FF99]/30 text-[#00FF99] flex items-center justify-center hover:bg-[#00FF99]/10 transition-colors"
          aria-label="Previous categories"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden flex gap-5 pb-2 scroll-smooth snap-x snap-mandatory"
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
          className="flex-shrink-0 z-10 w-12 h-12 rounded-full bg-black/80 border border-[#00FF99]/30 text-[#00FF99] flex items-center justify-center hover:bg-[#00FF99]/10 transition-colors"
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
const MarketPage = () => {
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
    <div className="min-h-screen bg-black pt-28 pb-16">
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
            Powered by Base L2. Trade prediction markets with up to 5x leverage.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-[#00FF99] text-black font-bold rounded-lg text-lg shadow-[0_0_30px_rgba(0,255,153,0.3)] hover:shadow-[0_0_50px_rgba(0,255,153,0.5)] transition-all"
          >
            Apply for alpha access<ArrowUpRight className="inline ml-2" />
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

      {/* Bloc marché principal – version inspirée de l'interface Polymarket */}
      <div className="max-w-7xl mx-auto px-6 mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-bold text-white">
            {featuredMarket ? "Live Polymarket integration" : "Loading market..."}
          </h2>
          <span className="hidden md:inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-[#00FF99]/10 border border-[#00FF99]/30 text-[#00FF99] uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF99] animate-pulse" />
            Powered by LM Protocol
          </span>
        </div>

        {!featuredMarket ? (
          <div className="bg-gray-900 border border-[#00FF99]/10 rounded-xl p-6 text-gray-400 text-center">
            Fetching live market data from Polymarket...
          </div>
        ) : (
        <>
        <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* Carte marché façon Polymarket */}
            <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-[#00FF99]/25 shadow-[0_0_40px_rgba(0,255,153,0.08)] h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[0.65rem] bg-[#00FF99]/10 text-[#00FF99] border border-[#00FF99]/40 uppercase tracking-widest">
                    Polymarket Market
                  </span>
                  <span className="text-xs text-gray-500">
                    Settlement by Dec 31, 2026
                  </span>
                </div>
                {featuredMarket?.url && (
                  <a
                    href={featuredMarket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-[#00FF99] underline underline-offset-4"
                  >
                    Open on Polymarket
                  </a>
                )}
              </div>
              <h3 className="text-white font-bold text-2xl mb-3">
                {featuredMarket?.title || "Loading market..."}
              </h3>
              <div className="flex items-end justify-between mb-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-extrabold text-[#00FF99] leading-none">
                    {probability}%
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-400 text-xs uppercase tracking-widest">
                      Implied chance
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00FF99]" />
                      <span>YES outcome</span>
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400 text-xs uppercase tracking-widest">
                    24h Volume
                  </div>
                  <div className="text-white text-lg font-semibold">
                    ${Number(featuredMarket?.volume || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="h-56 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorProbExample" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00FF99" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00FF99" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#666" />
                    <YAxis stroke="#666" domain={[0, Math.max(20, Math.min(100, Math.ceil(probability * 2.5)))]} />
                    <Area
                      type="monotone"
                      dataKey="probability"
                      stroke="#00FF99"
                      strokeWidth={2}
                      fill="url(#colorProbExample)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Commentaires directement sous le graphique – occupe le reste de la hauteur */}
              <div className="mt-4 border-t border-[#00FF99]/15 pt-4 flex-1 min-h-0 flex flex-col">
                <h3 className="text-white font-semibold text-sm mb-3">
                  Recent Comments
                </h3>
                <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
                  {commentsToRender.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-black/50 p-3 rounded-lg border border-[#00FF99]/10"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-[#00FF99] font-mono">
                          {comment.author || `User ${comment.id}`}
                        </span>
                        <span className="text-xs text-gray-500">
                          {comment.timestamp || "recently"}
                        </span>
                      </div>
                      <p className="text-gray-300 text-xs">
                        {comment.text ||
                          comment.content ||
                          comment.body ||
                          "No comment text"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Ticket d'ordre inspiré de Polymarket avec levier */}
            <div className="bg-gray-950 p-6 rounded-2xl border border-[#00FF99]/25 shadow-[0_0_40px_rgba(0,255,153,0.08)] h-full flex flex-col">
              {/* En-tête type Polymarket : Buy / Sell + type d'ordre */}
              <div className="flex items-center justify-between mb-4">
                <div className="inline-flex rounded-lg bg-black/60 border border-gray-800 p-0.5">
                  <button
                    onClick={() => setOrderSide("BUY")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md ${
                      orderSide === "BUY"
                        ? "bg-[#00FF99] text-black"
                        : "text-gray-400"
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setOrderSide("SELL")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md ${
                      orderSide === "SELL"
                        ? "bg-red-500 text-white"
                        : "text-gray-400"
                    }`}
                  >
                    Sell
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-md bg-black/70 border border-gray-800 text-gray-300">
                    Limit
                  </span>
                </div>
              </div>

              {/* Choix YES / NO + carnet d'ordres compact */}
              <div className="mb-4">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setOrderBookSide("YES")}
                    className={`flex-1 h-10 rounded-md text-xs font-semibold border transition-all ${
                      orderBookSide === "YES"
                        ? "bg-[#00FF99] text-black border-[#00FF99]"
                        : "bg-gray-900 text-gray-300 border-gray-700 hover:border-[#00FF99]/60"
                    }`}
                  >
                    Yes{" "}
                    <span className="font-normal opacity-80">
                      {priceDecimal ? `${(priceDecimal * 100).toFixed(2)}¢` : "--"}
                    </span>
                  </button>
                  <button
                    onClick={() => setOrderBookSide("NO")}
                    className={`flex-1 h-10 rounded-md text-xs font-semibold border transition-all ${
                      orderBookSide === "NO"
                        ? "bg-red-500 text-white border-red-400"
                        : "bg-gray-900 text-gray-300 border-gray-700 hover:border-red-400/60"
                    }`}
                  >
                    No{" "}
                    <span className="font-normal opacity-80">
                      {priceDecimal ? `${((1 - priceDecimal) * 100).toFixed(2)}¢` : "--"}
                    </span>
                  </button>
                </div>

                <div className="border border-gray-800 rounded-lg p-2 bg-black/50">
                  {loadingOrderBook ? (
                    <div className="text-gray-400 text-xs text-center py-2">
                      Loading order book...
                    </div>
                  ) : orderBook.bids.length === 0 && orderBook.asks.length === 0 ? (
                    <div className="text-gray-500 text-xs text-center py-2">
                      No order book data available
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-[0.7rem]">
                      {/* Bids */}
                      <div>
                        <div className="flex justify-between text-gray-400 mb-1 px-1">
                          <span>Bids ({orderBookSide})</span>
                          <span>Size</span>
                        </div>
                        <div className="space-y-0.5 max-h-24 overflow-y-auto">
                          {orderBook.bids.map((level) => (
                            <div
                              key={level.id}
                              className="flex justify-between px-1.5 py-0.5 rounded bg-[#022c22]/40"
                            >
                              <span className="text-[#00FF99] font-mono">
                                {level.price.toFixed(3)}
                              </span>
                              <span className="text-white font-mono">
                                {Math.round(level.size).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Asks */}
                      <div>
                        <div className="flex justify-between text-gray-400 mb-1 px-1">
                          <span>Asks ({orderBookSide})</span>
                          <span>Size</span>
                        </div>
                        <div className="space-y-0.5 max-h-24 overflow-y-auto">
                          {orderBook.asks.map((level) => (
                            <div
                              key={level.id}
                              className="flex justify-between px-1.5 py-0.5 rounded bg-[#3f1f1f]/40"
                            >
                              <span className="text-red-400 font-mono">
                                {level.price.toFixed(3)}
                              </span>
                              <span className="text-white font-mono">
                                {Math.round(level.size).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {/* Limit Price */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-400 text-sm">Limit Price</label>
                    <span className="text-xs text-gray-300">
                      {effectiveLimitPriceCents.toFixed(2)}¢
                    </span>
                  </div>
                  <div className="flex rounded-lg border border-gray-800 bg-black overflow-hidden">
                    <button
                      onClick={() =>
                        setLimitPriceCents(
                          Math.max(0.5, Number(effectiveLimitPriceCents.toFixed(2)) - 0.5)
                        )
                      }
                      className="px-3 text-lg text-gray-300 hover:bg-gray-900"
                    >
                      –
                    </button>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={limitPriceCents}
                      onChange={(e) => setLimitPriceCents(e.target.value)}
                      className="flex-1 bg-transparent text-center text-sm text-white focus:outline-none"
                    />
                    <div className="px-3 text-xs text-gray-400 flex items-center border-l border-gray-800">
                      ¢
                    </div>
                    <button
                      onClick={() =>
                        setLimitPriceCents(
                          Number(effectiveLimitPriceCents.toFixed(2)) + 0.5
                        )
                      }
                      className="px-3 text-lg text-gray-300 hover:bg-gray-900 border-l border-gray-800"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Shares */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-400 text-sm">Shares</label>
                  </div>
                  <div className="flex rounded-lg border border-gray-800 bg-black overflow-hidden">
                    <input
                      type="number"
                      min="0"
                      value={shares}
                      onChange={(e) => setShares(e.target.value)}
                      className="flex-1 bg-transparent px-3 py-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[-100, -10, 10, 100].map((delta) => (
                      <button
                        key={delta}
                        onClick={() => {
                          const current = numericShares;
                          const next = Math.max(0, current + delta);
                          setShares(String(next || 0));
                        }}
                        className="flex-1 py-1.5 rounded-md bg-gray-900 text-xs text-gray-200 border border-gray-700 hover:border-[#00FF99]/60"
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Levier */}
                <div className="space-y-3">
                  <div className="flex justify-between mb-2">
                    <label className="text-gray-400 text-sm">Leverage</label>
                    <span className="text-[#00FF99] font-bold">{leverage.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={leverage}
                    onChange={(e) => setLeverage(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #00FF99 0%, #00FF99 ${
                        ((leverage - 1) / 4) * 100
                      }%, #333 ${((leverage - 1) / 4) * 100}%, #333 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1x</span>
                    <span>5x max</span>
                  </div>
                  <div className="flex justify-between gap-2 mt-2">
                    {[1, 2, 3, 4, 5].map((x) => (
                      <button
                        key={x}
                        onClick={() => setLeverage(x)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
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

                {/* Résumé comme sur Polymarket : Total + To win + liquidation */}
                <div className="bg-black/60 p-4 rounded-lg border border-[#00FF99]/15 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total (margin)</span>
                    <span className="text-white font-medium">
                      ${totalMargin ? totalMargin.toFixed(2) : "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">To win (max)</span>
                    <span className="text-[#00FF99] font-semibold">
                      ${maxWin ? maxWin.toFixed(2) : "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Liquidation price</span>
                    <span className="text-red-400 font-semibold">
                      {liquidationPriceCents}¢
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-xs">Mode</span>
                    <span className="text-gray-300 text-xs">Demo only · 1x–5x</span>
                  </div>
                </div>

                <button className="w-full py-3.5 bg-[#00FF99] text-black font-bold rounded-lg opacity-70 cursor-not-allowed">
                  Simulated Order (Demo Only)
                </button>
              </div>
            </div>
        </div>
        </>
        )}
      </div>

      {/* Value props */}
      <div className="max-w-7xl mx-auto px-6 mt-20">
        <div className="grid md:grid-cols-3 gap-6">
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

// Protocol page data + charts (from current repo)
const interestSplitData = [
  { name: "LPs: $29.34", value: 85, color: "#00FF99" },
  { name: "Protocol: $5.18", value: 15, color: "#888888" },
];
const exposureVsCollateralData = [
  { leverage: "1x", collateral: 1000, exposure: 1000 },
  { leverage: "2x", collateral: 1000, exposure: 2000 },
  { leverage: "3x", collateral: 1000, exposure: 3000 },
  { leverage: "5x", collateral: 1000, exposure: 5000 },
  { leverage: "10x", collateral: 1000, exposure: 10000 },
];
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
                <text x={x} y={y} fill={fill === "#00FF99" ? "#00FF99" : "#aaaaaa"} textAnchor={textAnchor} dominantBaseline="middle" fontSize={11} fontWeight={600}>
                  {name}
                </text>
              );
            }}
            labelLine={{ stroke: "#666", strokeWidth: 1, length: 12, lengthType: "straight" }}
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

// Protocol Page (from current repo – full version)
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
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 sm:mb-4">How It <span className="text-[#00FF99]">Works</span></h1>
          <p className="text-base sm:text-xl text-gray-400 max-w-2xl mx-auto px-2">Prediction markets, but with leverage</p>
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
        {/* Example Trade */}
        <div className="mb-10 sm:mb-16">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 text-center">Example Trade</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: TrendingUp, title: "Position", rows: [["Collateral:", "$1,000 USDC"], ["Side:", "YES"], ["Leverage:", "10x"], ["Entry price:", "$0.60"], ["Exposure:", "$10,000"], ["Approx. shares:", "16,666.67"]] },
              { icon: DollarSign, title: "Fees & Borrow", rows: [["Open fee (0.2% of exposure):", "$20"], ["Borrowed from Vaults:", "≈$9,000"], ["APR:", "20%"], ["Duration:", "7 days"], ["Interest paid:", "$34.52"], ["Protocol cut (15%):", "$5.18"], ["LPs receive:", "$29.34"]] },
              { icon: Lightbulb, title: "Outcomes", desc: "IF PRICE MOVED UP: $0.60 + $0.06 = $0.66. P&L (before fees/interest): +$1,000. IF MAINTENANCE MARGIN HIT: LPs risk protocol debt. Liquidation fee (e.g., 3–8%) split between liquidators, insurance, treasury." },
            ].map((box, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: (i + 1) * 0.1 }} className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-[#00FF99]/20">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <box.icon className="w-5 h-5 text-[#00FF99] flex-shrink-0" />
                  <h3 className="text-[#00FF99] font-bold">{box.title}</h3>
                </div>
                {box.rows ? (
                  <div className="space-y-2 text-gray-400 text-sm">
                    {box.rows.map(([k, v], j) => (
                      <div key={j} className="flex justify-between"><span>{k}</span><span className="text-white">{v}</span></div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">{box.desc}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-10 sm:mb-16">
          {[
            { label: "1. COLLATERAL", short: "$1,000", red: false },
            { label: "2. POSITION", short: "10x YES", red: false },
            { label: "3. FEES", short: "Open $20", red: false },
            { label: "4. INTEREST", short: "$34.52 total", red: false },
            { label: "5. OUTCOMES", short: "+$1,000", red: false },
            { label: "6. LIQUIDATION", short: "3-8% fee", red: true },
          ].map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`p-3 sm:p-4 rounded-lg border text-center min-w-0 ${step.red ? "bg-red-500/10 border-red-500/40" : "bg-black/60 border-[#00FF99]/25"}`}>
              <div className={`font-semibold text-xs sm:text-sm mb-1 ${step.red ? "text-red-400" : "text-[#00FF99]"}`}>{step.label}</div>
              <div className="text-gray-400 text-[10px] sm:text-xs break-words">{step.short}</div>
            </motion.div>
          ))}
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-16">
          {[
            { title: "Yield Vaults", bullets: ["LPs deposit USDC into vaults to earn yield from borrow interest", "Protocol takes a cut (e.g. 15%); LPs receive the majority (85%)", "Utilization drives APY—higher utilization means higher LP returns"] },
            { title: "Utilization Curve", bullets: ["Borrow APR increases with vault utilization to balance supply/demand", "Low utilization = lower APR; high utilization = higher APR", "LP APY = Borrow APR × Utilization × (1 − protocol cut)"] },
            { title: "Liquidation Engine", bullets: ["Auto-closes positions when maintenance margin is breached", "Protects vaults from bad debt; liquidation fee (2–5%) split between liquidators, insurance, treasury", "Real-time oracle monitoring ensures timely execution"] },
          ].map((box, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: (i + 1) * 0.1 }} className="bg-gray-900 p-6 rounded-xl border border-[#00FF99]/20">
              <h3 className="text-white font-bold text-lg mb-4">{box.title}</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                {box.bullets.map((b, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <Circle className="w-2 h-2 mt-1.5 text-[#00FF99] fill-current flex-shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
        <div className="bg-gradient-to-br from-gray-900 to-black p-6 sm:p-10 rounded-2xl border border-[#00FF99]/20 mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8 text-center">$LMP Tokenomics</h2>
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
      <div className="min-h-screen bg-black pt-20 pb-16 flex items-center justify-center">
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
    <div className="min-h-screen bg-black pt-20 pb-16">
      <div className="max-w-5xl mx-auto px-6 py-10">
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
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
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
    <div className="min-h-screen bg-black pt-16 sm:pt-20 pb-16 sm:pb-24">
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

        <section className="py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-4">Vault Health</h2>
          <p className="text-gray-400 text-center text-sm sm:text-base max-w-xl mx-auto mb-10">Key metrics for the USDC vault</p>
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
  const [currentPage, setCurrentPage] = useState("market");
  const { isConnected } = useAccount();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  return (
    <div className="min-h-screen bg-black">
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      {currentPage === "market" && <MarketTicker />}

      {currentPage === "market" && <MarketPage />}
      {currentPage === "protocol" && <ProtocolPage />}
      {currentPage === "vault" && <VaultPage walletConnected={isConnected} />}
      {currentPage === "profile" && <ProfilePage />}

      {currentPage === "whitepaper" && <WhitepaperPage />}
      {currentPage === "faq" && <FAQPage />}
      {currentPage === "documentation" && <DocumentationPage setCurrentPage={setCurrentPage} />}

      <Footer setCurrentPage={setCurrentPage} />
    </div>
  );
}
