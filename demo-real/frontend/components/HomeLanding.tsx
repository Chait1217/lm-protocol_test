"use client";

import Link from "next/link";
import { useAccount } from "wagmi";

const FEATURES = [
  {
    num: "01",
    title: "LPs Deposit into the Vault",
    desc: "Liquidity providers deposit USDC.e into a shared vault on Polygon.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Vault Provides Borrowable Liquidity",
    desc: "The vault pool becomes available liquidity that traders can borrow for leverage.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Traders Post Collateral",
    desc: "Traders deposit USDC.e collateral to open a leveraged position on Polymarket.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Leverage is Created",
    desc: "The protocol combines trader collateral with borrowed vault USDC.e to increase exposure.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    num: "05",
    title: "Risk Control (Margin + Liquidations)",
    desc: "Positions are monitored continuously. If margin is too low, the position is auto-closed.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    num: "06",
    title: "Yield Flows Back (APY)",
    desc: "Traders pay interest + fees. These flows generate vault APY and fund an insurance reserve.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function HomeLanding() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-terminal-gradient">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,255,136,0.05),transparent_60%)]" />
        <div className="mx-auto max-w-5xl px-4 pt-32 pb-20 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00ff88]/5 border border-[#00ff88]/15 text-[#00ff88] text-xs font-medium mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse-neon" />
            Live on Polygon
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-white tracking-tight mb-6 leading-[1.1]">
            Leveraged Trading
            <br />
            <span className="text-[#00ff88]">on Polymarket</span>
          </h1>
          <p className="text-lg text-[#888] max-w-2xl mx-auto mb-10 leading-relaxed">
            Trade prediction markets with up to 5x leverage. Vault liquidity powers leverage — fees and interest flow back as real yield.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/trade-demo"
              className="btn-primary px-8 py-3.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Trade Now
            </Link>
            <Link
              href="/base-vault"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold border border-white/10 text-[#ccc] hover:bg-white/[0.03] hover:border-white/20 transition-all inline-flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
              Deposit to Vault
            </Link>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="mx-auto max-w-6xl px-4 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">How LM Works</h2>
          <p className="text-[#888] text-sm">
            Vault liquidity powers leverage — fees and interest flow back as real yield.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.num}
              className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-5 hover:border-[#00ff88]/15 transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#00ff88]/8 border border-[#00ff88]/15 flex items-center justify-center text-[#00ff88]">
                  {f.icon}
                </div>
                <span className="text-[10px] font-bold text-[#00ff88]/60 mono">{f.num}</span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-xs text-[#888] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
