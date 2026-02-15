"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";
import {
  Vault,
  ArrowLeftRight,
  Shield,
  Zap,
  TrendingUp,
  Lock,
} from "lucide-react";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neon/30 bg-neon/10 text-neon text-xs font-medium mb-6">
            <div className="w-2 h-2 rounded-full bg-neon animate-pulse-neon" />
            REAL ONCHAIN PROTOTYPE
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            LM Protocol{" "}
            <span className="neon-text">Demo</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            A real, minimal onchain prototype. Deposit USDC into the vault, borrow
            against it for leveraged positions, and see real money flows on Polygon.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <Link
            href="/vault"
            className="group rounded-2xl border border-gray-800/50 bg-gray-900/30 p-8 hover:border-neon/30 hover:bg-neon/5 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-neon/10 flex items-center justify-center group-hover:bg-neon/20 transition">
                <Vault className="w-6 h-6 text-neon" />
              </div>
              <h2 className="text-xl font-bold text-white">Vault</h2>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Deposit USDC into the lending vault. Earn yield from borrow interest
              and trading fees. Withdraw anytime (subject to liquidity).
            </p>
            <div className="flex items-center gap-2 text-neon text-sm font-medium">
              Go to Vault <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </div>
          </Link>

          <Link
            href="/trade-demo"
            className="group rounded-2xl border border-gray-800/50 bg-gray-900/30 p-8 hover:border-neon/30 hover:bg-neon/5 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-neon/10 flex items-center justify-center group-hover:bg-neon/20 transition">
                <ArrowLeftRight className="w-6 h-6 text-neon" />
              </div>
              <h2 className="text-xl font-bold text-white">Trade Demo</h2>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Open leveraged positions with real USDC collateral. Borrow from the
              vault. PnL simulated with mock prices, but all transfers are real.
            </p>
            <div className="flex items-center gap-2 text-neon text-sm font-medium">
              Go to Trade <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </div>
          </Link>
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: <Zap className="w-5 h-5" />,
              title: "Real USDC Transfers",
              desc: "All deposits, borrows, and repayments happen onchain with real tokens.",
            },
            {
              icon: <TrendingUp className="w-5 h-5" />,
              title: "2-10x Leverage",
              desc: "Borrow from the vault to amplify your position. Kink-based interest rates.",
            },
            {
              icon: <Shield className="w-5 h-5" />,
              title: "Insurance Fund",
              desc: "Fees split between LPs, insurance, and protocol treasury automatically.",
            },
            {
              icon: <Lock className="w-5 h-5" />,
              title: "Utilization Caps",
              desc: "80% max utilization. Per-position and per-wallet borrow limits.",
            },
            {
              icon: <ArrowLeftRight className="w-5 h-5" />,
              title: "Mock Prices",
              desc: "PnL calculated with user-provided mock prices. Real Polymarket integration next.",
            },
            {
              icon: <Vault className="w-5 h-5" />,
              title: "ERC4626 Vault",
              desc: "Shares track proportional ownership. Value increases as interest accrues.",
            },
          ].map((feat, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-800/50 bg-gray-900/30 p-5"
            >
              <div className="text-neon mb-2">{feat.icon}</div>
              <h3 className="text-white font-semibold text-sm mb-1">
                {feat.title}
              </h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-gray-600 text-xs">
          <p>LM Protocol Prototype &middot; Polygon Amoy Testnet &middot; Not for production use</p>
        </div>
      </main>
    </>
  );
}
