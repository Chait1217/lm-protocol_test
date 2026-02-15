"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Vault, Shield, Percent, Activity } from "lucide-react";
import { formatUSDC, bpsToPercent } from "@/lib/utils";

interface Props {
  totalAssets?: bigint;
  totalBorrowed?: bigint;
  utilizationBps?: bigint;
  borrowApr?: bigint;
  insuranceBal?: bigint;
  protocolBal?: bigint;
}

function SplitBar({ items }: { items: { label: string; pct: string; color: string }[] }) {
  return (
    <div className="flex gap-1">
      {items.map((it) => (
        <div key={it.label} className={`flex-1 rounded ${it.color} px-1 py-0.5 text-center`}>
          <div className="text-[10px] font-bold">{it.pct}</div>
          <div className="text-[8px] text-gray-500">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function VaultMetricsPanel({ totalAssets, totalBorrowed, utilizationBps, borrowApr, insuranceBal, protocolBal }: Props) {
  const [feeOpen, setFeeOpen] = useState(false);
  const [interestOpen, setInterestOpen] = useState(false);

  const utilPct = utilizationBps !== undefined ? Number(utilizationBps) / 100 : 0;
  const utilColor = utilPct > 80 ? "text-red-400" : utilPct > 50 ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="glass-card rounded-xl p-3 space-y-2">
      {/* ── Vault Stats ── */}
      <h3 className="text-emerald-400 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
        <Vault className="w-3 h-3" /> Vault
      </h3>
      <div className="grid grid-cols-4 gap-1">
        <div className="bg-black/40 rounded p-1.5 border border-emerald-900/20 text-center">
          <div className="text-gray-500 text-[8px]">TVL</div>
          <div className="text-white font-bold font-mono text-[11px]">${formatUSDC(totalAssets, 2)}</div>
        </div>
        <div className="bg-black/40 rounded p-1.5 border border-emerald-900/20 text-center">
          <div className="text-gray-500 text-[8px]">Borrowed</div>
          <div className="text-amber-400 font-bold font-mono text-[11px]">${formatUSDC(totalBorrowed, 2)}</div>
        </div>
        <div className="bg-black/40 rounded p-1.5 border border-emerald-900/20 text-center">
          <div className="text-gray-500 text-[8px]">Util</div>
          <div className={`font-bold font-mono text-[11px] ${utilColor}`}>
            {utilizationBps !== undefined ? bpsToPercent(utilizationBps) : "0%"}
          </div>
        </div>
        <div className="bg-black/40 rounded p-1.5 border border-emerald-900/20 text-center">
          <div className="text-gray-500 text-[8px]">APR</div>
          <div className="text-emerald-400 font-bold font-mono text-[11px]">
            {borrowApr !== undefined ? bpsToPercent(borrowApr) : "5.00%"}
          </div>
        </div>
      </div>

      {/* ── Utilization bar ── */}
      <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${
            utilPct > 80 ? "bg-red-500" : utilPct > 50 ? "bg-amber-500" : "bg-emerald-500"
          }`} style={{ width: `${Math.min(100, utilPct)}%` }} />
      </div>

      {/* ── Fund balances ── */}
      <div className="flex gap-1.5">
        <div className="flex-1 bg-black/40 rounded p-1.5 border border-emerald-900/20">
          <div className="text-gray-500 text-[8px] flex items-center gap-0.5"><Shield className="w-2 h-2" /> Insurance</div>
          <div className="text-white font-mono text-[11px] font-semibold">${formatUSDC(insuranceBal, 2)}</div>
        </div>
        <div className="flex-1 bg-black/40 rounded p-1.5 border border-emerald-900/20">
          <div className="text-gray-500 text-[8px] flex items-center gap-0.5"><Activity className="w-2 h-2" /> Protocol</div>
          <div className="text-white font-mono text-[11px] font-semibold">${formatUSDC(protocolBal, 2)}</div>
        </div>
      </div>

      {/* ── Fee Distribution (collapsible) ── */}
      <div className="border border-emerald-900/20 rounded overflow-hidden">
        <button type="button" onClick={() => setFeeOpen(!feeOpen)}
          className="w-full flex items-center justify-between px-2 py-1.5 bg-black/30 hover:bg-black/50 transition text-[10px]">
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <Percent className="w-2.5 h-2.5" /> Fee Distribution
          </span>
          {feeOpen ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
        </button>
        {feeOpen && (
          <div className="p-2 space-y-2 border-t border-emerald-900/10">
            <div>
              <div className="text-gray-500 text-[9px] mb-1">Open Fee (0.15%)</div>
              <SplitBar items={[
                { label: "LP", pct: "30%", color: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" },
                { label: "Ins", pct: "40%", color: "bg-amber-500/15 text-amber-400 border border-amber-500/20" },
                { label: "Proto", pct: "30%", color: "bg-red-500/15 text-red-400 border border-red-500/20" },
              ]} />
            </div>
            <div>
              <div className="text-gray-500 text-[9px] mb-1">Liq Penalty</div>
              <SplitBar items={[
                { label: "Keeper", pct: "50%", color: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" },
                { label: "Ins", pct: "40%", color: "bg-amber-500/15 text-amber-400 border border-amber-500/20" },
                { label: "Proto", pct: "10%", color: "bg-red-500/15 text-red-400 border border-red-500/20" },
              ]} />
            </div>
          </div>
        )}
      </div>

      {/* ── Interest Split (collapsible) ── */}
      <div className="border border-emerald-900/20 rounded overflow-hidden">
        <button type="button" onClick={() => setInterestOpen(!interestOpen)}
          className="w-full flex items-center justify-between px-2 py-1.5 bg-black/30 hover:bg-black/50 transition text-[10px]">
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" /> Interest Split
          </span>
          {interestOpen ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
        </button>
        {interestOpen && (
          <div className="p-2 space-y-1.5 border-t border-emerald-900/10">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Borrow APR</span>
              <span className="text-emerald-400 font-mono font-semibold">
                {borrowApr !== undefined ? bpsToPercent(borrowApr) : "5.00%"}
              </span>
            </div>
            <div className="text-gray-500 text-[9px] mb-1">Repayment Split</div>
            <SplitBar items={[
              { label: "LP", pct: "88%", color: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" },
              { label: "Ins", pct: "7%", color: "bg-amber-500/15 text-amber-400 border border-amber-500/20" },
              { label: "Proto", pct: "5%", color: "bg-red-500/15 text-red-400 border border-red-500/20" },
            ]} />
          </div>
        )}
      </div>
    </div>
  );
}
