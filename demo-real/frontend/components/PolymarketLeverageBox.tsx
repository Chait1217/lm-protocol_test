"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import RealPolymarketTrade from "@/components/RealPolymarketTrade";
import {
  getContractAddresses,
  MOCK_USDC_ABI,
  MARGIN_ENGINE_ABI,
} from "@/lib/contracts";
import { formatUSDC, bpsToPercent } from "@/lib/utils";
import { useVaultMetrics } from "@/hooks/useVaultMetrics";
import {
  useAccount,
  useReadContract,
} from "wagmi";
import { polygon } from "wagmi/chains";

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
      className={`${className} transition-colors duration-300 ${isChanging ? "text-emerald-400" : ""}`}
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
const FALLBACK_CLOB_TOKEN_IDS = [
  "38397507750621893057346880033441136112987238933685677349709401910643842844855",
  "95949957895141858444199258452803633110472396604599808168788254125381075552218",
];
const POLYMARKET_SLUG = "will-the-iranian-regime-fall-by-june-30";

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
  /** CLOB token IDs: [yesTokenId, noTokenId] for real Polymarket orders */
  clobTokenIds: string[];
  tickSize?: string;
  negRisk?: boolean;
}

// ─── Main Component ──────────────────────────────────────────────────

export default function PolymarketLeverageBox({
  refreshInterval = 4000,
  onVaultRefetch,
}: {
  refreshInterval?: number;
  onVaultRefetch?: () => void;
}) {
  const { address, isConnected } = useAccount();
  const { poolState } = useVaultMetrics(5000);

  // ─── Market state ────────────────────────────────────────────────
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState(0);
  const prevProbability = useRef<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // ─── Trade state ─────────────────────────────────────────────────
  type TradeSide = "Buy YES" | "Buy NO";
  const [selectedSide, setSelectedSide] = useState<TradeSide>("Buy YES");
  const [leverage, setLeverage] = useState<number>(3);
  const [collateralInput, setCollateralInput] = useState("50");

  const selectedOutcome: "YES" | "NO" = selectedSide === "Buy YES" ? "YES" : "NO";
  // ─── Contract reads ──────────────────────────────────────────────

  const { data: userBalance } = useReadContract({
    address: addresses.mockUsdc,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: polygon.id,
  });

  const { data: openFeeBpsData } = useReadContract({
    address: addresses.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: "openFeeBps",
    chainId: polygon.id,
  });

  // ─── Market data fetching ────────────────────────────────────────

  const parseMarketData = (m: any): MarketData => {
    try {
      let outcomePrices: number[] = [];
      try {
        if (typeof m?.outcomePrices === "string") outcomePrices = JSON.parse(m.outcomePrices);
        else if (Array.isArray(m?.outcomePrices)) outcomePrices = m.outcomePrices;
      } catch { outcomePrices = []; }

      const yesPrice = outcomePrices[0] != null ? parseFloat(String(outcomePrices[0])) : null;
      const noPrice = outcomePrices[1] != null ? parseFloat(String(outcomePrices[1])) : yesPrice != null ? 1 - yesPrice : null;
      let yesProbability: number | null = null;
      let noProbability: number | null = null;
      if (yesPrice != null && yesPrice > 0 && yesPrice <= 1) {
        yesProbability = Math.round(yesPrice * 1000) / 10;
        noProbability = Math.round((1 - yesPrice) * 1000) / 10;
      }
      let clobTokenIds: string[] = [];
      try {
        if (typeof m?.clobTokenIds === "string") clobTokenIds = JSON.parse(m.clobTokenIds);
        else if (Array.isArray(m?.clobTokenIds)) clobTokenIds = m.clobTokenIds;
      } catch {
        clobTokenIds = [];
      }
      if (clobTokenIds.length < 2) clobTokenIds = FALLBACK_CLOB_TOKEN_IDS;
      const tickSize = typeof m?.tickSize === "string" ? m.tickSize : undefined;
      const negRisk = typeof m?.negRisk === "boolean" ? m.negRisk : undefined;

      return {
        title: m?.question || "Will the Iranian regime fall by June 30?",
        slug: m?.slug ?? null,
        yesProbability,
        noProbability,
        yesPrice: yesPrice != null ? (yesPrice * 100).toFixed(1) : null,
        noPrice: noPrice != null ? (noPrice * 100).toFixed(1) : null,
        volume: parseFloat(m?.volume) || 0,
        volume24h: parseFloat(m?.volume24hr) || 0,
        liquidity: parseFloat(m?.liquidity) || 0,
        traders: parseInt(m?.uniqueBettors, 10) || parseInt(m?.uniqueTraders, 10) || null,
        oneDayChange: parseFloat(m?.oneDayPriceChange) || 0,
        bestBid: m?.bestBid != null ? parseFloat(String(m.bestBid)) : null,
        bestAsk: m?.bestAsk != null ? parseFloat(String(m.bestAsk)) : null,
        clobTokenIds,
        tickSize,
        negRisk,
      };
    } catch {
      return {
        title: "Will the Iranian regime fall by June 30?",
        slug: null,
        yesProbability: null,
        noProbability: null,
        yesPrice: null,
        noPrice: null,
        volume: 0,
        volume24h: 0,
        liquidity: 0,
        traders: null,
        oneDayChange: 0,
        bestBid: null,
        bestAsk: null,
        clobTokenIds: FALLBACK_CLOB_TOKEN_IDS,
        tickSize: undefined,
        negRisk: true,
      };
    }
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
      if (result.success && result.market) {
        setDataSource("live");
        return parseMarketData(result.market);
      }
      const fallback = await fetch(`/api/gamma/markets/slug/${encodeURIComponent(POLYMARKET_SLUG)}?_=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (fallback.ok) {
        const data = await fallback.json();
        const first = Array.isArray(data) ? data[0] : data;
        if (first && typeof first === "object") {
          setDataSource("live");
          return parseMarketData(first);
        }
      }
      throw new Error(result?.error || "Failed to fetch");
    } catch (err: any) {
      if (retryCount < 3) { await new Promise((r) => setTimeout(r, 1000)); return fetchMarket(retryCount + 1); }
      setDataSource("fallback");
      return {
        title: "Will the Iranian regime fall by June 30?",
        slug: "will-the-iranian-regime-fall-by-june-30",
        yesProbability: 50,
        noProbability: 50,
        yesPrice: "50.0",
        noPrice: "50.0",
        volume: 0,
        volume24h: 0,
        liquidity: 0,
        traders: null,
        oneDayChange: 0,
        bestBid: 0.49,
        bestAsk: 0.51,
        clobTokenIds: FALLBACK_CLOB_TOKEN_IDS,
        tickSize: "0.01",
        negRisk: true,
      };
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

  // ─── Trade computations ──────────────────────────────────────────

  // Entry price: Buy YES = ask, Buy NO = NO ask (1 - YES bid)
  const entryPriceDisplay = selectedSide === "Buy YES"
    ? (market?.bestAsk ?? (market?.yesProbability != null ? market.yesProbability / 100 : 0.41))
    : (market?.bestBid != null ? 1 - market.bestBid : (market?.noProbability != null ? market.noProbability / 100 : 0.59));
  const entryPriceCents = Math.round(entryPriceDisplay * 1000) / 10;
  const entryPriceOutcome = entryPriceDisplay;

  const buyYesCents = market?.bestAsk != null ? market.bestAsk * 100 : (market?.yesProbability ?? null);
  const buyNoCents = market?.bestBid != null ? (1 - market.bestBid) * 100 : (market?.noProbability ?? null);

  const collateralUsdc = parseFloat(collateralInput) || 0;
  const isLong = selectedOutcome === "YES"; // true=LONG, false=SHORT
  const notional = collateralUsdc * leverage;
  const borrowed = notional - collateralUsdc;
  const openFeeBps = openFeeBpsData ? Number(openFeeBpsData as bigint) : 15;
  const openFee = (notional * openFeeBps) / 10000;

  // Leverage box calcs (use outcome price so PnL/liq match contract)
  const shares = entryPriceOutcome > 0 ? notional / entryPriceOutcome : 0;
  const liquidationDecimal = entryPriceOutcome * (1 - 1 / leverage);
  const liquidationCents = Math.max(0, Math.round(liquidationDecimal * 1000) / 10);
  const maxWin = entryPriceOutcome > 0 && entryPriceOutcome < 1 ? shares * (1 - entryPriceOutcome) : 0;

  // ─── Actions ─────────────────────────────────────────────────────

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="glass-card p-4 rounded-xl border border-emerald-500/20 shadow-glow h-full flex flex-col justify-center items-center min-h-[300px]">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <RefreshCw className="w-6 h-6 text-emerald-400" />
        </motion.div>
        <span className="mt-2 text-gray-400 text-sm">Loading live market data...</span>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="glass-card p-4 rounded-xl border border-emerald-500/20 shadow-glow h-full flex flex-col justify-center items-center min-h-[300px]">
        <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
        <span className="text-gray-300 text-sm text-center">Live market data unavailable</span>
        <span className="text-gray-500 text-xs mt-1 text-center">Polymarket API may be slow or temporarily down.</span>
        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="mt-4 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-sm font-semibold hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {isRefreshing ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card p-2.5 sm:p-3 rounded-xl shadow-glow flex flex-col min-w-0">
      <div className="grid grid-cols-3 gap-3 mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
        <div className="text-center">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Borrowed</div>
          <div className="text-lg font-bold text-amber-400">
            ${poolState.totalBorrowed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-400 uppercase tracking-wider">UTIL</div>
          <div className="text-lg font-bold text-cyan-400">
            {(poolState.utilization * 100).toFixed(1)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Borrow APR</div>
          <div className="text-lg font-bold text-purple-400">
            {(poolState.borrowRate * 100).toFixed(2)}%
          </div>
        </div>
      </div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded-full text-[0.5rem] bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 uppercase tracking-widest font-semibold flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
          {isConnected && (
            <span className="px-1 py-0.5 rounded-full text-[0.45rem] bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest font-semibold">
              REAL ONCHAIN
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => loadData(true)} disabled={isRefreshing} className="p-0.5 rounded hover:bg-emerald-500/10 transition-colors disabled:opacity-50">
            <motion.div animate={isRefreshing ? { rotate: 360 } : {}} transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}>
              <RefreshCw className="w-3 h-3 text-emerald-400" />
            </motion.div>
          </button>
          <a href={market?.slug ? `${POLYMARKET_BASE}/market/${market.slug}` : `${POLYMARKET_BASE}/event/will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568`}
            target="_blank" rel="noopener noreferrer" className="text-[9px] text-gray-400 hover:text-emerald-400 transition-colors">
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ── Buy YES / Buy NO only ── */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <motion.button
          type="button"
          onClick={() => setSelectedSide("Buy YES")}
          whileTap={{ scale: 0.97 }}
          className={`relative px-2 py-1.5 rounded-lg border transition-all text-left ${
            selectedSide === "Buy YES" ? "bg-emerald-500/10 border-emerald-500 shadow-glow" : "bg-black/40 border-gray-700 hover:border-emerald-500/50"
          }`}
        >
          <div className="text-[9px] text-gray-500 uppercase font-semibold">Buy</div>
          <div className="flex items-center justify-between gap-1">
            <span className={`text-[10px] font-semibold ${selectedSide === "Buy YES" ? "text-emerald-400" : "text-gray-400"}`}>YES</span>
            <AnimatedValue value={buyYesCents} format={(v: number) => (v != null ? v.toFixed(1) : "--")} className={`text-sm font-bold font-mono ${selectedSide === "Buy YES" ? "text-emerald-400" : "text-white"}`} suffix="¢" />
          </div>
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setSelectedSide("Buy NO")}
          whileTap={{ scale: 0.97 }}
          className={`relative px-2 py-1.5 rounded-lg border transition-all text-left ${
            selectedSide === "Buy NO" ? "bg-red-500/10 border-red-500" : "bg-black/40 border-gray-700 hover:border-red-500/50"
          }`}
        >
          <div className="text-[9px] text-gray-500 uppercase font-semibold">Buy</div>
          <div className="flex items-center justify-between gap-1">
            <span className={`text-[10px] font-semibold ${selectedSide === "Buy NO" ? "text-red-400" : "text-gray-400"}`}>NO</span>
            <AnimatedValue value={buyNoCents} format={(v: number) => (v != null ? v.toFixed(1) : "--")} className={`text-sm font-bold font-mono ${selectedSide === "Buy NO" ? "text-red-400" : "text-white"}`} suffix="¢" />
          </div>
        </motion.button>
      </div>
      {market?.bestBid != null && market?.bestAsk != null && (
        <p className="text-[10px] text-gray-500 mb-2 text-center">
          Spread <span className="font-mono text-gray-400">{(Math.abs((market.bestAsk - market.bestBid) * 100)).toFixed(1)}¢</span>
        </p>
      )}

      {/* ── Selected side summary ── */}
      <div className="flex items-center justify-between bg-black/50 rounded px-2 py-1 border border-emerald-900/20 mb-2 text-[10px]">
        <span className="text-gray-500">Selected</span>
        <span className={`font-semibold ${selectedOutcome === "YES" ? "text-emerald-400" : "text-red-400"}`}>
          {selectedSide} @ {entryPriceCents.toFixed(1)}¢
        </span>
      </div>

      {/* ═══ Leverage Controls ═══ */}
      <div className="border border-emerald-500/20 rounded-lg p-2 bg-black/40 mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-emerald-400 text-[9px] font-semibold uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" />
            {isConnected ? "Leveraged Position" : "Preview"}
          </span>
          {isConnected && (
            <span className="text-[7px] px-1 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">REAL POLYMARKET</span>
          )}
        </div>

        {/* Collateral + Leverage side-by-side */}
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <div>
            <label className="text-gray-400 text-[9px] block mb-0.5">Collateral</label>
            <div className="flex rounded border border-gray-700 bg-black overflow-hidden">
              <span className="px-1.5 py-1 text-gray-500 text-xs border-r border-gray-700"><DollarSign className="w-3 h-3" /></span>
              <input type="number" min="0.5" step="0.5" value={collateralInput}
                onChange={(e) => setCollateralInput(e.target.value)} placeholder="5"
                className="flex-1 bg-transparent px-1.5 py-1 text-white text-xs focus:outline-none w-0" />
              {isConnected && (
                <button onClick={() => setCollateralInput((Number(userBalance ?? BigInt(0)) / 1e6).toString())}
                  className="px-1 text-emerald-400/60 text-[8px] hover:text-emerald-400">MAX</button>
              )}
            </div>
            {isConnected && <span className="text-gray-500 text-[9px]">Bal: ${formatUSDC(userBalance as bigint | undefined, 6)}</span>}
          </div>
          <div>
            <label className="text-gray-400 text-[9px] block mb-0.5">Leverage</label>
            <div className="flex gap-0.5">
              {[2, 3, 4, 5].map((x) => (
                <button key={x} onClick={() => setLeverage(x)}
                  className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${
                    leverage === x ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-black/30 text-gray-500 border-emerald-900/20 hover:border-emerald-500/30"
                  }`}>{x}x</button>
              ))}
            </div>
          </div>
        </div>

        {/* Trade Summary — compact 2-col grid */}
        <div className="bg-black/50 rounded px-2 py-1.5 border border-emerald-500/10 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] mb-1.5">
          <div className="flex justify-between"><span className="text-gray-400">Entry</span><AnimatedValue value={entryPriceCents} format={(v: number) => (v ?? 0).toFixed(1)} className="text-white font-mono font-semibold" suffix="¢" /></div>
          <div className="flex justify-between"><span className="text-gray-400">Notional</span><span className="text-white font-medium">${notional.toFixed(6)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Borrowed</span><span className="text-yellow-400 font-medium">${borrowed.toFixed(6)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Fee ({bpsToPercent(openFeeBps)})</span><span className="text-gray-300">${openFee.toFixed(6)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Liq.</span><span className="text-red-400 font-semibold font-mono">{liquidationCents.toFixed(1)}¢</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Max profit</span><span className="text-emerald-400 font-semibold">${maxWin.toFixed(6)}</span></div>
        </div>

        {/* Trade action */}
        <RealPolymarketTrade
          market={market ? { title: market.title, slug: market.slug, bestBid: market.bestBid, bestAsk: market.bestAsk, clobTokenIds: market.clobTokenIds, tickSize: market.tickSize, negRisk: market.negRisk } : null}
          selectedOutcome={selectedOutcome}
          collateral={collateralUsdc}
          leverage={leverage}
          entryPrice={entryPriceOutcome}
          onSuccess={onVaultRefetch}
        />
      </div>
    </div>
  );
}
