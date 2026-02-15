"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { getContractAddresses, MARGIN_ENGINE_ABI } from "@/lib/contracts";

const addresses = getContractAddresses();

/* ────────────────────────────────────────────────────────────────── */

interface PositionData {
  owner: string;
  collateral: bigint;
  borrowed: bigint;
  notional: bigint;
  entryPriceMock: bigint;
  leverage: bigint;
  isLong: boolean;
  openTimestamp: bigint;
  isOpen: boolean;
}

interface Props {
  positionId: number;
  position: PositionData;
  /** Live best bid from Polymarket (YES token price, decimal e.g. 0.40) */
  liveBestBid: number | null;
  /** Live best ask from Polymarket (YES token price, decimal e.g. 0.41) */
  liveBestAsk: number | null;
  /** YES probability from Polymarket (e.g. 41.2) */
  yesProbability: number | null;
}

/* ────────────────────────────────────────────────────────────────── */

export default function LivePositionTracker({
  positionId,
  position,
  liveBestBid,
  liveBestAsk,
  yesProbability,
}: Props) {
  /* ── On-chain interest accrued ── */
  const { data: interestRaw } = useReadContract({
    address: addresses.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: "calculateInterest",
    args: [position.borrowed, position.openTimestamp],
    chainId: base.id,
    query: { refetchInterval: 5000 },
  });
  const accruedInterest = interestRaw != null ? Number(interestRaw as bigint) / 1e6 : 0;

  /* ── Derived numeric values ── */
  const entryPrice = Number(position.entryPriceMock) / 1e6;
  const notionalUsdc = Number(position.notional) / 1e6;
  const collateralUsdc = Number(position.collateral) / 1e6;
  const borrowedUsdc = Number(position.borrowed) / 1e6;
  const leverageNum = Number(position.leverage);

  /* ── Live exit price (what you'd get if you sold now) ── */
  // For LONG (YES): you sell YES tokens → best bid
  // For SHORT (NO): you sell NO tokens → 1 - bestAsk (since bestAsk is for YES)
  const liveExitPrice = useMemo(() => {
    if (position.isLong) {
      return liveBestBid ?? (yesProbability != null ? yesProbability / 100 : null);
    } else {
      if (liveBestAsk != null) return 1 - liveBestAsk;
      return yesProbability != null ? 1 - yesProbability / 100 : null;
    }
  }, [position.isLong, liveBestBid, liveBestAsk, yesProbability]);

  /* ── PnL calculations ── */
  const calcs = useMemo(() => {
    if (liveExitPrice == null || entryPrice === 0) {
      return null;
    }

    // Raw PnL from price movement
    const pricePnl = position.isLong
      ? notionalUsdc * ((liveExitPrice - entryPrice) / entryPrice)
      : notionalUsdc * ((entryPrice - liveExitPrice) / entryPrice);

    // Net PnL after interest
    const netPnl = pricePnl - accruedInterest;

    // Current position value (what you'd get back if you closed now)
    const positionValue = Math.max(0, collateralUsdc + netPnl);

    // ROI on collateral
    const roi = collateralUsdc > 0 ? (netPnl / collateralUsdc) * 100 : 0;

    // Liquidation price
    const liqPrice = position.isLong
      ? entryPrice * (1 - 1 / leverageNum)
      : entryPrice * (1 + 1 / leverageNum);

    // Distance to liquidation (percentage)
    const distToLiq = position.isLong
      ? ((liveExitPrice - liqPrice) / liveExitPrice) * 100
      : ((liqPrice - liveExitPrice) / liveExitPrice) * 100;

    // Health: safe (>50%), warning (20-50%), danger (<20%)
    const healthPct = Math.max(0, Math.min(100, distToLiq * 2)); // scale for visual
    const healthColor =
      distToLiq > 50 ? "green" : distToLiq > 20 ? "yellow" : "red";

    // Time open
    const openTime = Number(position.openTimestamp);
    const nowSec = Math.floor(Date.now() / 1000);
    const durationSec = nowSec - openTime;

    return {
      pricePnl,
      netPnl,
      positionValue,
      roi,
      liqPrice,
      distToLiq,
      healthPct,
      healthColor,
      durationSec,
      liveExitPrice,
    };
  }, [liveExitPrice, entryPrice, notionalUsdc, collateralUsdc, accruedInterest, leverageNum, position.isLong, position.openTimestamp]);

  if (!position.isOpen || !calcs) return null;

  const {
    pricePnl,
    netPnl,
    positionValue,
    roi,
    liqPrice,
    distToLiq,
    healthColor,
    durationSec,
    liveExitPrice: exitP,
  } = calcs;

  const isProfitable = netPnl >= 0;
  const pnlColor = isProfitable ? "text-green-400" : "text-red-400";
  const pnlBg = isProfitable ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30";

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="glass-card rounded-lg shadow-glow overflow-hidden text-[10px]">
      {/* ── Header + PnL in one row ── */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-emerald-500/5 border-b border-emerald-900/20">
        <div className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse-neon" />
          <span className="text-emerald-400 text-[9px] font-bold uppercase">Live</span>
          <span className="text-gray-500">#{positionId}</span>
          <span className={`font-semibold ${position.isLong ? "text-green-400" : "text-red-400"}`}>
            {position.isLong ? "L" : "S"}{leverageNum}x
          </span>
          <span className="text-gray-600">·</span>
          <Clock className="w-2.5 h-2.5 text-gray-500" />
          <span className="text-gray-500">{formatDuration(durationSec)}</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.span key={netPnl.toFixed(2)} initial={{ scale: 1.1 }} animate={{ scale: 1 }}
            className={`text-xs font-bold font-mono ${pnlColor}`}>
            {isProfitable ? "+" : ""}${netPnl.toFixed(2)}
          </motion.span>
          <motion.span key={roi.toFixed(1)} initial={{ scale: 1.05 }} animate={{ scale: 1 }}
            className={`font-bold font-mono ${pnlColor}`}>
            ({roi >= 0 ? "+" : ""}{roi.toFixed(1)}%)
          </motion.span>
        </div>
      </div>

      {/* ── Compact details grid ── */}
      <div className="px-2 py-1.5 grid grid-cols-3 gap-x-2 gap-y-0.5">
        <div className="flex justify-between"><span className="text-gray-500">Entry</span><span className="text-white font-mono">{(entryPrice * 100).toFixed(1)}¢</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Now</span>
          <motion.span key={exitP.toFixed(3)} initial={{ color: isProfitable ? "#4ade80" : "#f87171" }} animate={{ color: "#ffffff" }} transition={{ duration: 0.5 }} className="font-mono">
            {(exitP * 100).toFixed(1)}¢ <Activity className="w-2 h-2 text-emerald-500 animate-pulse inline" />
          </motion.span>
        </div>
        <div className="flex justify-between"><span className="text-gray-500">Value</span><span className="text-white font-mono">${positionValue.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">PnL</span><span className={`font-mono ${pricePnl >= 0 ? "text-green-400" : "text-red-400"}`}>{pricePnl >= 0 ? "+" : ""}${pricePnl.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Interest</span><span className="text-amber-400 font-mono">-${accruedInterest.toFixed(4)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Liq.</span><span className="text-red-400 font-mono">{(liqPrice * 100).toFixed(1)}¢</span></div>
      </div>

      {/* ── Liquidation bar ── */}
      <div className="px-2 pb-1.5">
        <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
          <motion.div className={`h-full rounded-full ${
              healthColor === "green" ? "bg-emerald-500" : healthColor === "yellow" ? "bg-yellow-500" : "bg-red-500"
            }`} initial={false} animate={{ width: `${Math.max(5, Math.min(100, distToLiq))}%` }} transition={{ duration: 0.5 }} />
        </div>
        <div className="flex justify-between text-[8px] text-gray-600 mt-0.5">
          <span>Liq{healthColor === "red" && " ⚠"}</span>
          <span className={`font-mono ${healthColor === "green" ? "text-green-400" : healthColor === "yellow" ? "text-yellow-400" : "text-red-400"}`}>
            {distToLiq.toFixed(1)}% safe
          </span>
        </div>
      </div>
    </div>
  );
}
