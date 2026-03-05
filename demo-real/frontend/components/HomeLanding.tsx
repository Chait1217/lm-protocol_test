"use client";

import Link from "next/link";

export default function HomeLanding() {
  return (
    <section className="relative py-20 px-4">
      {/* Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00ff88]/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#00ff88]/20 bg-[#00ff88]/5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
          <span className="text-[11px] text-[#00ff88] font-medium tracking-wide">LIVE ON POLYGON</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
          Leveraged Trading on{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff88] to-[#00cc6a]">Polymarket</span>
        </h1>

        <p className="text-lg text-[#888] max-w-2xl mx-auto leading-relaxed">
          Deposit collateral, borrow from the vault, and trade prediction markets with up to 5x leverage. Real orders on Polymarket, real positions, real PnL.
        </p>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <Link
            href="/trade-demo"
            className="btn-primary px-8 py-3.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
          >
            Start Trading
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            href="/base-vault"
            className="px-8 py-3.5 rounded-xl text-sm font-semibold text-[#888] border border-white/10 hover:border-white/20 hover:text-white transition-all"
          >
            View Vault
          </Link>
        </div>

        {/* Active Market */}
        <div className="pt-8">
          <div className="inline-block rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-6 text-left max-w-md w-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider text-[#666] font-medium">Active Market</span>
            </div>
            <a
              href="https://polymarket.com/event/will-the-iranian-regime-fall-by-june-30"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-white hover:text-[#00ff88] transition-colors flex items-center gap-1.5"
            >
              Will the Iranian regime fall by June 30?
              <svg className="w-3.5 h-3.5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <p className="text-xs text-[#666] mt-2">Trade with leverage — up to 5x on this prediction market</p>
          </div>
        </div>
      </div>
    </section>
  );
}
