"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Activity,
  Zap,
  Coins,
  Target,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import TxButton from "@/components/TxButton";
import {
  getContractAddresses,
  MOCK_USDC_ABI,
  VAULT_ABI,
  MARGIN_ENGINE_ABI,
} from "@/lib/contracts";
import { formatUSDC, parseUSDC, formatPrice, parsePrice, bpsToPercent } from "@/lib/utils";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

const addresses = getContractAddresses();

// ─── Animated Value ──────────────────────────────────────────────────
function AnimatedValue({
  value,
  format,
  className,
  prefix = "",
  suffix = "",
}: {
  value: any;
  format?: (v: any) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
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

  if (value === null || value === undefined)
    return <span className={className}>--</span>;

  return (
    <motion.span
      className={`${className} transition-colors duration-300 ${isChanging ? "text-neon" : ""}`}
      animate={isChanging ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {prefix}
      {format ? format(displayValue) : displayValue}
      {suffix}
    </motion.span>
  );
}

// ─── Types ───────────────────────────────────────────────────────────

const POLYMARKET_BASE = "https://polymarket.com";

interface MarketData {
  title: string;
  slug: string | null;
  yesProbability: number | null;
  noProbability: number | null;
  yesPrice: string | null;
  noPrice: string | null;
  volume: number;
  volume24h: number;
  liquidity: number;
  traders: number | null;
  oneDayChange: number;
  bestBid: number | null;
  bestAsk: number | null;
}

interface PositionData {
  owner: string;
  collateral: bigint;
  borrowed: bigint;
  notional: bigint;
  entryPriceMock: bigint;
  leverage: bigint;
  direction: number;
  openTimestamp: bigint;
  isOpen: boolean;
}

// ─── Main Component ──────────────────────────────────────────────────

export default function PolymarketLeverageBox({
  refreshInterval = 2000,
  onVaultRefetch,
}: {
  refreshInterval?: number;
  onVaultRefetch?: () => void;
}) {
  const { address, isConnected } = useAccount();

  // ─── Market state ────────────────────────────────────────────────
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState(0);
  const prevProbability = useRef<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // ─── Trade state ─────────────────────────────────────────────────
  const [selectedOutcome, setSelectedOutcome] = useState<"YES" | "NO">("YES");
  const [leverage, setLeverage] = useState<number>(3);
  const [collateralInput, setCollateralInput] = useState("50");
  const [exitPrice, setExitPrice] = useState("");
  const [activePositionId, setActivePositionId] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [actionLabel, setActionLabel] = useState("");
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  // ─── Contract reads ──────────────────────────────────────────────

  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: addresses.mockUsdc,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: meAllowance, refetch: refetchMeAllowance } = useReadContract({
    address: addresses.mockUsdc,
    abi: MOCK_USDC_ABI,
    functionName: "allowance",
    args: address ? [address, addresses.marginEngine] : undefined,
  });

  const { data: openFeeBpsData } = useReadContract({
    address: addresses.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: "openFeeBps",
  });

  const { data: positionData, refetch: refetchPosition } = useReadContract({
    address: addresses.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: "getPosition",
    args: activePositionId !== null ? [BigInt(activePositionId)] : undefined,
  });

  const position = positionData as PositionData | undefined;

  // ─── Write contract ──────────────────────────────────────────────
  const { writeContract, isPending: isWritePending } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isTxSuccess) {
      refetchBalance();
      refetchMeAllowance();
      if (activePositionId !== null) refetchPosition();
      onVaultRefetch?.();
      setTxHash(undefined);
    }
  }, [isTxSuccess, refetchBalance, refetchMeAllowance, refetchPosition, activePositionId, onVaultRefetch]);

  const isLoading = isWritePending || isTxConfirming;

  // ─── Market data fetching ────────────────────────────────────────

  const parseMarketData = (m: any): MarketData => {
    let outcomePrices: number[] = [];
    try {
      if (typeof m.outcomePrices === "string") outcomePrices = JSON.parse(m.outcomePrices);
      else if (Array.isArray(m.outcomePrices)) outcomePrices = m.outcomePrices;
    } catch { outcomePrices = []; }

    const yesPrice = outcomePrices[0] ? parseFloat(outcomePrices[0] as any) : null;
    const noPrice = outcomePrices[1] ? parseFloat(outcomePrices[1] as any) : yesPrice ? 1 - yesPrice : null;
    let yesProbability: number | null = null;
    let noProbability: number | null = null;
    if (yesPrice !== null && yesPrice > 0 && yesPrice <= 1) {
      yesProbability = Math.round(yesPrice * 1000) / 10;
      noProbability = Math.round((1 - yesPrice) * 1000) / 10;
    }
    return {
      title: m.question || "Will Bitcoin reach $100,000 by December 31, 2026?",
      slug: m.slug || null,
      yesProbability, noProbability,
      yesPrice: yesPrice ? (yesPrice * 100).toFixed(1) : null,
      noPrice: noPrice ? (noPrice * 100).toFixed(1) : null,
      volume: parseFloat(m.volume) || 0,
      volume24h: parseFloat(m.volume24hr) || 0,
      liquidity: parseFloat(m.liquidity) || 0,
      traders: parseInt(m.uniqueBettors) || parseInt(m.uniqueTraders) || null,
      oneDayChange: parseFloat(m.oneDayPriceChange) || 0,
      bestBid: parseFloat(m.bestBid) || null,
      bestAsk: parseFloat(m.bestAsk) || null,
    };
  };

  const fetchMarket = useCallback(async (retryCount = 0): Promise<MarketData | null> => {
    try {
      const response = await fetch(`/api/polymarket-live?t=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!response.ok) {
        if (retryCount < 3) { await new Promise((r) => setTimeout(r, 1000)); return fetchMarket(retryCount + 1); }
        throw new Error(`Server error: ${response.status}`);
      }
      const result = await response.json();
      if (result.success && result.market) { setDataSource("live"); return parseMarketData(result.market); }
      throw new Error(result.error || "Failed to fetch");
    } catch (err: any) {
      if (retryCount < 3) { await new Promise((r) => setTimeout(r, 1000)); return fetchMarket(retryCount + 1); }
      setDataSource("fallback");
      return null;
    }
  }, []);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const marketData = await fetchMarket();
      if (marketData) {
        if (prevProbability.current !== null && marketData.yesProbability !== null)
          setPriceChange(marketData.yesProbability - prevProbability.current);
        prevProbability.current = marketData.yesProbability;
        setMarket(marketData);
        setLastUpdate(new Date());
      }
    } finally { setLoading(false); setIsRefreshing(false); }
  }, [fetchMarket]);

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;
  useEffect(() => {
    loadDataRef.current();
    const interval = setInterval(() => loadDataRef.current(false), refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // ─── Format helpers ──────────────────────────────────────────────

  const formatVolume = (v: number) => {
    if (v === null || v === undefined || isNaN(v)) return "--";
    if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${Math.round(v).toLocaleString()}`;
  };

  const formatNumber = (n: number) => {
    if (n === null || n === undefined || isNaN(n)) return "--";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // ─── Trade computations ──────────────────────────────────────────

  // Entry price from live market: YES uses bestAsk, NO uses (1 - bestBid)
  const entryPriceDecimal =
    selectedOutcome === "YES"
      ? (market?.bestAsk ?? (market?.yesProbability != null ? market.yesProbability / 100 : 0.41))
      : (market?.bestBid != null ? 1 - market.bestBid : (market?.noProbability != null ? market.noProbability / 100 : 0.59));
  const entryPriceCents = Math.round(entryPriceDecimal * 1000) / 10;

  const collateralUsdc = parseFloat(collateralInput) || 0;
  const direction = selectedOutcome === "YES" ? 0 : 1; // 0=LONG, 1=SHORT
  const notional = collateralUsdc * leverage;
  const borrowed = notional - collateralUsdc;
  const openFeeBps = openFeeBpsData ? Number(openFeeBpsData as bigint) : 15;
  const openFee = (notional * openFeeBps) / 10000;

  // Mock PnL preview: use exit price if provided, otherwise assume entry = exit (0 pnl)
  const exitPriceNum = parseFloat(exitPrice) || 0;
  const entryPriceNum = entryPriceDecimal;
  const pnlPreview = exitPriceNum > 0
    ? direction === 0
      ? notional * ((exitPriceNum - entryPriceNum) / (entryPriceNum || 1))
      : notional * ((entryPriceNum - exitPriceNum) / (entryPriceNum || 1))
    : 0;

  // Leverage box calcs
  const shares = entryPriceDecimal > 0 ? notional / entryPriceDecimal : 0;
  const liquidationDecimal = entryPriceDecimal * (1 - 1 / leverage);
  const liquidationCents = Math.max(0, Math.round(liquidationDecimal * 1000) / 10);
  const maxWin = entryPriceDecimal > 0 && entryPriceDecimal < 1 ? shares * (1 - entryPriceDecimal) : 0;

  const needsApproval =
    meAllowance !== undefined
      ? (meAllowance as bigint) < parseUSDC(collateralInput || "0")
      : true;

  // ─── Actions ─────────────────────────────────────────────────────

  const handleFaucet = useCallback(() => {
    if (!address) return;
    setActionLabel("Minting test USDC...");
    setLastEvent(null);
    writeContract(
      { address: addresses.mockUsdc, abi: MOCK_USDC_ABI, functionName: "faucet", args: [address, parseUSDC("1000")] },
      { onSuccess: (hash) => { setTxHash(hash); setLastEvent("Minted 1,000 test USDC"); }, onError: () => setActionLabel("") }
    );
  }, [address, writeContract]);

  const handleApprove = useCallback(() => {
    setActionLabel("Approving USDC for MarginEngine...");
    setLastEvent(null);
    writeContract(
      { address: addresses.mockUsdc, abi: MOCK_USDC_ABI, functionName: "approve", args: [addresses.marginEngine, parseUSDC("999999999")] },
      { onSuccess: (hash) => { setTxHash(hash); setLastEvent("USDC approved for MarginEngine"); }, onError: () => setActionLabel("") }
    );
  }, [writeContract]);

  const handleOpenPosition = useCallback(() => {
    if (collateralUsdc <= 0) return;
    setActionLabel("Opening leveraged position...");
    setLastEvent(null);

    // Convert entry price to 6-decimal mock price
    const mockPrice = parsePrice(entryPriceDecimal.toString());

    writeContract(
      {
        address: addresses.marginEngine,
        abi: MARGIN_ENGINE_ABI,
        functionName: "openPosition",
        args: [parseUSDC(collateralInput), BigInt(leverage), direction, mockPrice],
      },
      {
        onSuccess: (hash) => {
          setTxHash(hash);
          setActivePositionId((prev) => (prev !== null ? prev + 1 : 0));
          setLastEvent(
            `${selectedOutcome} position opened: $${collateralUsdc} collateral, ${leverage}x, borrowed $${borrowed.toFixed(2)} from vault @ ${entryPriceCents.toFixed(1)}¢`
          );
        },
        onError: (err) => { setActionLabel(""); console.error("Open position error:", err); },
      }
    );
  }, [collateralInput, collateralUsdc, leverage, direction, entryPriceDecimal, entryPriceCents, borrowed, selectedOutcome, writeContract]);

  const handleClosePosition = useCallback(() => {
    if (activePositionId === null) return;
    setActionLabel("Closing position...");
    setLastEvent(null);

    const mockExitPrice = exitPriceNum > 0 ? parsePrice(exitPrice) : parsePrice(entryPriceDecimal.toString());

    writeContract(
      {
        address: addresses.marginEngine,
        abi: MARGIN_ENGINE_ABI,
        functionName: "closePosition",
        args: [BigInt(activePositionId), mockExitPrice],
      },
      {
        onSuccess: (hash) => {
          setTxHash(hash);
          setLastEvent(
            `Position #${activePositionId} closed. PnL: ${pnlPreview >= 0 ? "+" : ""}$${pnlPreview.toFixed(2)}`
          );
        },
        onError: (err) => { setActionLabel(""); console.error("Close position error:", err); },
      }
    );
  }, [activePositionId, exitPrice, exitPriceNum, entryPriceDecimal, pnlPreview, writeContract]);

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-gray-950 p-4 rounded-xl border border-neon/25 shadow-[0_0_30px_rgba(57,255,20,0.06)] h-full flex flex-col justify-center items-center min-h-[300px]">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <RefreshCw className="w-6 h-6 text-neon" />
        </motion.div>
        <span className="mt-2 text-gray-400 text-sm">Loading live market data...</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 p-3 sm:p-4 rounded-xl border border-neon/25 shadow-[0_0_30px_rgba(57,255,20,0.06)] flex flex-col min-w-0">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[0.55rem] bg-neon/15 text-neon border border-neon/40 uppercase tracking-widest font-semibold flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-neon animate-pulse" />
            LIVE
          </span>
          {isConnected && (
            <span className="px-1.5 py-0.5 rounded-full text-[0.5rem] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 uppercase tracking-widest font-semibold">
              REAL ONCHAIN
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => loadData(true)} disabled={isRefreshing} className="p-1 rounded-lg hover:bg-neon/10 transition-colors disabled:opacity-50">
            <motion.div animate={isRefreshing ? { rotate: 360 } : {}} transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}>
              <RefreshCw className="w-3.5 h-3.5 text-neon" />
            </motion.div>
          </button>
          <a
            href={market?.slug ? `${POLYMARKET_BASE}/market/${market.slug}` : `${POLYMARKET_BASE}/event/what-price-will-bitcoin-hit-before-2027`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-neon transition-colors px-1.5 py-0.5 rounded hover:bg-neon/5"
          >
            Polymarket
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ── Market Question ── */}
      <h3 className="text-white font-bold text-sm sm:text-base mb-3 leading-tight">
        {market?.title || "Will Bitcoin reach $100,000 by December 31, 2026?"}
      </h3>

      {/* ── YES / NO Buttons (= Direction) ── */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <motion.button
          onClick={() => setSelectedOutcome("YES")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative p-2.5 rounded-lg border-2 transition-all ${
            selectedOutcome === "YES"
              ? "bg-neon/10 border-neon shadow-[0_0_15px_rgba(57,255,20,0.15)]"
              : "bg-gray-900/50 border-gray-700 hover:border-neon/50"
          }`}
        >
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className={`w-3 h-3 ${selectedOutcome === "YES" ? "text-neon" : "text-gray-500"}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${selectedOutcome === "YES" ? "text-neon" : "text-gray-400"}`}>
                Yes / Long
              </span>
            </div>
            <AnimatedValue value={market?.yesProbability} className={`text-xl font-bold ${selectedOutcome === "YES" ? "text-neon" : "text-white"}`} suffix="%" />
            <span className="text-[10px] text-gray-500 mt-0.5">{market?.yesPrice ? `${market.yesPrice}¢` : "--"}</span>
          </div>
          <AnimatePresence>
            {selectedOutcome === "YES" && priceChange !== 0 && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`absolute top-2 right-2 flex items-center gap-0.5 text-xs font-semibold ${priceChange > 0 ? "text-green-400" : "text-red-400"}`}>
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
          className={`relative p-2.5 rounded-lg border-2 transition-all ${
            selectedOutcome === "NO"
              ? "bg-red-500/10 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
              : "bg-gray-900/50 border-gray-700 hover:border-red-500/50"
          }`}
        >
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingDown className={`w-3 h-3 ${selectedOutcome === "NO" ? "text-red-400" : "text-gray-500"}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${selectedOutcome === "NO" ? "text-red-400" : "text-gray-400"}`}>
                No / Short
              </span>
            </div>
            <AnimatedValue value={market?.noProbability} className={`text-xl font-bold ${selectedOutcome === "NO" ? "text-red-400" : "text-white"}`} suffix="%" />
            <span className="text-[10px] text-gray-500 mt-0.5">{market?.noPrice ? `${market.noPrice}¢` : "--"}</span>
          </div>
        </motion.button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        <div className="bg-black/40 rounded p-1.5 border border-gray-800/50 text-center">
          <div className="text-gray-400 text-[7px] mb-0.5">24h Vol</div>
          <AnimatedValue value={market?.volume24h || market?.volume} format={formatVolume} className="text-white font-bold text-[10px]" />
        </div>
        <div className="bg-black/40 rounded p-1.5 border border-gray-800/50 text-center">
          <div className="text-gray-400 text-[7px] mb-0.5">Total Vol</div>
          <AnimatedValue value={market?.volume} format={formatVolume} className="text-white font-bold text-[10px]" />
        </div>
        <div className="bg-black/40 rounded p-1.5 border border-gray-800/50 text-center">
          <div className="text-gray-400 text-[7px] mb-0.5">Liquidity</div>
          <AnimatedValue value={market?.liquidity} format={formatVolume} className="text-white font-bold text-[10px]" />
        </div>
        <div className="bg-black/40 rounded p-1.5 border border-gray-800/50 text-center">
          <div className="text-gray-400 text-[7px] mb-0.5">Traders</div>
          <AnimatedValue value={market?.traders} format={formatNumber} className="text-white font-bold text-[10px]" />
        </div>
      </div>

      {/* ── Best Bid/Ask (live order book) ── */}
      <div
        key={`ob-${market?.bestBid ?? ""}-${market?.bestAsk ?? ""}-${lastUpdate?.getTime() ?? 0}`}
        className="bg-black/40 rounded-lg p-2 border border-gray-800/50 mb-3"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-400 text-[10px]">
            Order book for <span className={selectedOutcome === "YES" ? "text-neon font-medium" : "text-red-400 font-medium"}>{selectedOutcome}</span>
            <span className="ml-1 text-gray-500">· live</span>
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-gray-400 text-[10px]">Best Bid</span>
            <div className={`text-sm ${selectedOutcome === "YES" ? "text-neon font-mono font-bold" : "text-red-400 font-mono font-bold"}`}>
              <AnimatedValue
                value={
                  selectedOutcome === "YES"
                    ? market?.bestBid != null ? (market.bestBid * 100) : null
                    : market?.bestAsk != null ? (1 - market.bestAsk) * 100 : null
                }
                format={(v: number) => (v != null ? v.toFixed(1) : "--")}
                className="block"
                suffix={market?.bestBid != null || market?.bestAsk != null ? "¢" : ""}
              />
            </div>
          </div>
          <div className="h-6 w-px bg-gray-700" />
          <div className="text-right">
            <span className="text-gray-400 text-[10px]">Best Ask</span>
            <div className={`text-sm ${selectedOutcome === "YES" ? "text-neon font-mono font-bold" : "text-red-400 font-mono font-bold"}`}>
              <AnimatedValue
                value={
                  selectedOutcome === "YES"
                    ? market?.bestAsk != null ? (market.bestAsk * 100) : null
                    : market?.bestBid != null ? (1 - market.bestBid) * 100 : null
                }
                format={(v: number) => (v != null ? v.toFixed(1) : "--")}
                className="block"
                suffix={market?.bestBid != null || market?.bestAsk != null ? "¢" : ""}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TRADE SECTION - Real Onchain
          ═══════════════════════════════════════════════════════════════ */}
      <div className="border border-neon/20 rounded-lg p-3 bg-black/30 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-neon text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {isConnected ? "Open Leveraged Position" : "Leverage Preview"}
          </span>
          {isConnected && (
            <span className="text-[8px] text-yellow-400 bg-yellow-500/10 px-1 py-0.5 rounded border border-yellow-500/20">
              REAL USDC
            </span>
          )}
        </div>

        {/* Collateral */}
        <div className="mb-2">
          <label className="text-gray-400 text-[10px] block mb-0.5">Collateral (USDC)</label>
          <div className="flex rounded-md border border-gray-700 bg-black overflow-hidden">
            <span className="px-2 py-2 text-gray-400 text-sm border-r border-gray-700">
              <DollarSign className="w-3.5 h-3.5" />
            </span>
            <input
              type="number"
              min="1"
              step="10"
              value={collateralInput}
              onChange={(e) => setCollateralInput(e.target.value)}
              placeholder="50"
              className="flex-1 bg-transparent px-2 py-2 text-white text-sm focus:outline-none"
            />
            {isConnected && (
              <button
                onClick={() => setCollateralInput((Number(userBalance ?? 0n) / 1e6).toString())}
                className="px-1.5 text-neon/60 text-[10px] hover:text-neon transition"
              >
                MAX
              </button>
            )}
          </div>
          {isConnected && (
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-gray-500 text-[10px]">
                Balance: ${formatUSDC(userBalance as bigint | undefined)}
              </span>
              <button onClick={handleFaucet} className="text-blue-400/70 text-[10px] hover:text-blue-400 transition" disabled={isLoading}>
                + Faucet
              </button>
            </div>
          )}
        </div>

        {/* Leverage */}
        <div className="mb-2">
          <div className="flex justify-between items-center mb-0.5">
            <label className="text-gray-400 text-[10px]">Leverage</label>
            <span className="text-neon font-bold text-xs">{leverage}x</span>
          </div>
          <div className="flex gap-1">
            {[2, 3, 4, 5].map((x) => (
              <button
                key={x}
                onClick={() => setLeverage(x)}
                className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${
                  leverage === x
                    ? "bg-neon/20 text-neon border-neon/40"
                    : "bg-gray-900 text-gray-500 border-gray-800 hover:border-gray-600"
                }`}
              >
                {x}x
              </button>
            ))}
          </div>
        </div>

        {/* Trade Summary */}
        <div className="bg-black/50 rounded p-2 border border-neon/10 space-y-1 text-xs mb-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Entry</span>
            <AnimatedValue value={entryPriceCents} format={(v: number) => (v ?? 0).toFixed(1)} className="text-white font-mono font-semibold" suffix="¢" />
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Notional</span>
            <span className="text-white font-medium">${notional.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Borrowed</span>
            <span className="text-yellow-400 font-medium">${borrowed.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Fee ({bpsToPercent(openFeeBps)})</span>
            <span className="text-gray-300">${openFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Liq. price</span>
            <span className="text-red-400 font-semibold font-mono">{liquidationCents.toFixed(1)}¢</span>
          </div>
          <div className="border-t border-gray-800/50 pt-1 flex justify-between">
            <span className="text-gray-400">Max profit</span>
            <span className="text-neon font-semibold">${maxWin.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        {isConnected ? (
          <div className="space-y-2">
            {needsApproval ? (
              <TxButton onClick={handleApprove} loading={isLoading && actionLabel.includes("Approving")} className="w-full">
                1. Approve USDC
              </TxButton>
            ) : (
              <TxButton onClick={handleOpenPosition} loading={isLoading && actionLabel.includes("Opening")} disabled={collateralUsdc <= 0} className="w-full">
                Open {leverage}x {selectedOutcome === "YES" ? "Long" : "Short"} @ {entryPriceCents.toFixed(1)}¢
              </TxButton>
            )}
          </div>
        ) : (
          <div className="text-center py-2 text-gray-500 text-[10px] border border-dashed border-gray-700 rounded">
            Connect wallet to trade with real USDC
          </div>
        )}
      </div>

      {/* ── Active Position + Close ── */}
      {isConnected && activePositionId !== null && position && (
        <div className="border border-gray-800/50 rounded-lg p-3 bg-gray-900/30 mb-3">
          <h4 className="text-white font-semibold text-xs mb-2 flex items-center gap-1.5">
            <Target className="w-3 h-3 text-neon" />
            Position #{activePositionId}
            <span className={`text-[10px] px-1 py-0.5 rounded-full ${position.isOpen ? "bg-neon/15 text-neon" : "bg-gray-700 text-gray-400"}`}>
              {position.isOpen ? "OPEN" : "CLOSED"}
            </span>
          </h4>
          <div className="space-y-1 text-xs mb-2">
            <div className="flex justify-between"><span className="text-gray-400">Collateral</span><span className="text-white">${formatUSDC(position.collateral)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Borrowed</span><span className="text-yellow-400">${formatUSDC(position.borrowed)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Notional</span><span className="text-white">${formatUSDC(position.notional)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Leverage</span><span className="text-neon">{Number(position.leverage)}x</span></div>
            <div className="flex justify-between">
              <span className="text-gray-400">Direction</span>
              <span className={position.direction === 0 ? "text-green-400" : "text-red-400"}>
                {position.direction === 0 ? "YES / LONG" : "NO / SHORT"}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-gray-400">Entry</span><span className="text-white">{formatPrice(position.entryPriceMock)}</span></div>
          </div>

          {position.isOpen && (
            <>
              <div className="mb-2">
                <label className="text-gray-400 text-[10px] block mb-0.5">Exit Price ($)</label>
                <div className="flex rounded-md border border-gray-700 bg-black overflow-hidden">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    placeholder={entryPriceDecimal.toFixed(4)}
                    className="flex-1 bg-transparent px-2 py-1.5 text-white text-xs focus:outline-none"
                  />
                </div>
                {exitPriceNum > 0 && (
                  <div className={`text-[10px] mt-0.5 ${pnlPreview >= 0 ? "text-green-400" : "text-red-400"}`}>
                    PnL: {pnlPreview >= 0 ? "+" : ""}${pnlPreview.toFixed(2)}
                  </div>
                )}
              </div>
              <TxButton
                onClick={handleClosePosition}
                loading={isLoading && actionLabel.includes("Closing")}
                variant="danger"
                className="w-full"
              >
                Close Position
              </TxButton>
            </>
          )}
        </div>
      )}

      {/* ── Tx Status ── */}
      {(lastEvent || isLoading) && (
        <div className="mb-2">
          {isLoading && (
            <div className="rounded border border-yellow-500/30 bg-yellow-500/5 p-2 text-yellow-400 text-[10px] flex items-center gap-1.5">
              <div className="spinner" />
              {isTxConfirming ? "Confirming..." : actionLabel}
            </div>
          )}
          {lastEvent && !isLoading && (
            <div className="rounded border border-neon/30 bg-neon/5 p-2 text-neon text-[10px] flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
              {lastEvent}
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-neon animate-pulse" />
          <span>Live every 5s</span>
        </div>
        {lastUpdate && <span className="font-mono">{lastUpdate.toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
