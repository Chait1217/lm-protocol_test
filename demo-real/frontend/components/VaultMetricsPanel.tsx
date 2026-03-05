"use client";

import { formatUnits } from "viem";

interface VaultMetricsPanelProps {
  totalAssets?: bigint;
  totalBorrowed?: bigint;
  utilizationBps?: bigint;
  borrowApr?: bigint;
  insuranceBal?: bigint;
  protocolBal?: bigint;
}

function fmt(val: bigint | undefined, decimals = 6, dp = 2): string {
  if (val == null) return "—";
  return parseFloat(formatUnits(val, decimals)).toFixed(dp);
}

function fmtPct(bps: bigint | undefined): string {
  if (bps == null) return "—";
  return (Number(bps) / 100).toFixed(1) + "%";
}

export default function VaultMetricsPanel({
  totalAssets,
  totalBorrowed,
  utilizationBps,
  borrowApr,
  insuranceBal,
  protocolBal,
}: VaultMetricsPanelProps) {
  const utilPct = utilizationBps != null ? Number(utilizationBps) / 100 : 0;
  const utilColor = utilPct > 80 ? "text-red-400" : utilPct > 50 ? "text-[#f59e0b]" : "text-[#00ff88]";
  const utilBarColor = utilPct > 80 ? "bg-red-400" : utilPct > 50 ? "bg-[#f59e0b]" : "bg-[#00ff88]";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden mb-4">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Vault Metrics
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-[#666] font-medium">Live</span>
      </div>

      {/* Utilization Bar */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#888]">Utilization</span>
          <span className={`text-sm font-bold mono ${utilColor}`}>{fmtPct(utilizationBps)}</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${utilBarColor}`}
            style={{ width: `${Math.min(utilPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 divide-x divide-white/5">
        <div className="px-5 py-4 border-b border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1 font-medium">TVL</div>
          <div className="text-base font-bold text-white mono">${fmt(totalAssets)}</div>
        </div>
        <div className="px-5 py-4 border-b border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1 font-medium">Borrowed</div>
          <div className="text-base font-bold text-white mono">${fmt(totalBorrowed)}</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1 font-medium">Borrow APR</div>
          <div className="text-base font-bold text-[#f59e0b] mono">{fmtPct(borrowApr)}</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1 font-medium">Insurance</div>
          <div className="text-base font-bold text-white mono">${fmt(insuranceBal)}</div>
        </div>
      </div>

      {/* Protocol Balance */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[#666] font-medium">Protocol Treasury</span>
        <span className="text-sm font-semibold text-[#888] mono">${fmt(protocolBal)}</span>
      </div>
    </div>
  );
}
