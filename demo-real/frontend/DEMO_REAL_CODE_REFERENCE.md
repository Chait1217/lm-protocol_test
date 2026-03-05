# demo-real app — code reference (Home, Trade Demo, Vault, Transactions)

All code for the main pages and their components. Paths are relative to `demo-real/frontend/`.

---

## File index

| Route | Page file | Key components |
|-------|-----------|-----------------|
| `/` | `app/page.tsx` | `HomeLanding` |
| `/trade-demo` | `app/trade-demo/page.tsx` | `Navbar`, `TradingHeader`, `PolymarketLiveChart`, `PolymarketLeverageBox`, `VaultMetricsPanel`, `PolymarketPositionVerify` |
| `/base-vault` | `app/base-vault/page.tsx` | `Navbar`, `TxButton` |
| `/transactions` | `app/transactions/page.tsx` | `Navbar` |

Shared: `app/layout.tsx`, `app/providers.tsx`, `app/globals.css`, `components/Navbar.tsx`.

---

## app/layout.tsx

```tsx
import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "LM Protocol - Real Demo",
  description: "Real onchain leveraged prediction market prototype",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0a] text-gray-100 antialiased font-mono">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## app/providers.tsx

```tsx
"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#39FF14",
            accentColorForeground: "#000",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

---

## app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
  --neon: #10b981;
  --neon-dim: #059669;
  --neon-bright: #34d399;
}

body {
  font-family: 'JetBrains Mono', monospace;
  background: #0a0a0a;
  color: #e5e5e5;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #0a0a0a; }
::-webkit-scrollbar-thumb { background: #1a2e1a; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #2a4a2a; }

/* Glassmorphism card */
.glass-card {
  background: rgba(17, 17, 17, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(16, 185, 129, 0.15);
}
.glass-card:hover {
  border-color: rgba(16, 185, 129, 0.3);
}

/* Neon glow */
.neon-glow {
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.15), 0 0 40px rgba(16, 185, 129, 0.05);
}
.neon-glow-lg {
  box-shadow: 0 0 30px rgba(16, 185, 129, 0.25), 0 0 60px rgba(16, 185, 129, 0.1);
}
.neon-border {
  border: 1px solid rgba(16, 185, 129, 0.3);
}
.neon-text {
  color: #10b981;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
}

/* Health colors */
.health-safe { color: #10b981; }
.health-warning { color: #f59e0b; }
.health-danger { color: #ef4444; }

/* Pulse animation for live indicators */
@keyframes pulse-neon {
  0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(16, 185, 129, 0.6); }
  50% { opacity: 0.5; box-shadow: 0 0 8px rgba(16, 185, 129, 0.3); }
}
.animate-pulse-neon {
  animation: pulse-neon 2s ease-in-out infinite;
}

/* Ticker flash */
@keyframes ticker-flash {
  0% { background-color: rgba(16, 185, 129, 0.2); }
  100% { background-color: transparent; }
}
.ticker-flash {
  animation: ticker-flash 0.5s ease-out;
}

/* Spinner */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spinner {
  animation: spin 1s linear infinite;
  border: 2px solid #1a2e1a;
  border-top-color: #10b981;
  border-radius: 50%;
  width: 20px;
  height: 20px;
}

/* Terminal gradient backgrounds */
.bg-terminal-gradient {
  background: linear-gradient(135deg, #0a0a0a 0%, #0d1a0d 50%, #0a0f0a 100%);
}
.bg-header-gradient {
  background: linear-gradient(180deg, #0a0a0a 0%, #091409 100%);
}
```

---

## Home page

### app/page.tsx

```tsx
"use client";

import HomeLanding from "@/components/HomeLanding";

export default function Home() {
  return <HomeLanding />;
}
```

### components/HomeLanding.tsx

```tsx
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

export default function HomeLanding() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neon/30 bg-neon/10 text-neon text-xs font-medium mb-6">
            <div className="w-2 h-2 rounded-full bg-neon animate-pulse-neon" />
            POLYGON PoS · REAL USDC.e
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            LM Protocol <span className="neon-text">Demo</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            A real, minimal onchain prototype on Polygon. Deposit USDC.e into the
            vault, borrow against it for leveraged positions, and trade on
            Polymarket — all on one chain.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
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
              Live Polymarket data + real USDC.e vault borrowing on Polygon. Open
              leveraged positions (2-5x) and trade — no bridging needed.
            </p>
            <div className="flex items-center gap-2 text-neon text-sm font-medium">
              Go to Trade Demo{" "}
              <span className="group-hover:translate-x-1 transition-transform">
                &rarr;
              </span>
            </div>
          </Link>

          <Link
            href="/base-vault"
            className="group rounded-2xl border border-gray-800/50 bg-gray-900/30 p-8 hover:border-neon/30 hover:bg-neon/5 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-neon/10 flex items-center justify-center group-hover:bg-neon/20 transition">
                <Vault className="w-6 h-6 text-neon" />
              </div>
              <h2 className="text-xl font-bold text-white">Polygon Vault</h2>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Deposit USDC.e on Polygon into the lending vault. Earn yield from
              borrow interest and trading fees. Withdraw anytime.
            </p>
            <div className="flex items-center gap-2 text-neon text-sm font-medium">
              Go to Vault{" "}
              <span className="group-hover:translate-x-1 transition-transform">
                &rarr;
              </span>
            </div>
          </Link>

          <Link
            href="/margin-trade"
            className="group rounded-2xl border border-gray-800/50 bg-gray-900/30 p-8 hover:border-neon/30 hover:bg-neon/5 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-neon/10 flex items-center justify-center group-hover:bg-neon/20 transition">
                <TrendingUp className="w-6 h-6 text-neon" />
              </div>
              <h2 className="text-xl font-bold text-white">Margin Trade</h2>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Open leveraged positions (2-5x) with real USDC.e collateral on
              Polygon. Borrow from the vault. PnL uses mock prices, but all
              transfers are real.
            </p>
            <div className="flex items-center gap-2 text-neon text-sm font-medium">
              Go to Trade{" "}
              <span className="group-hover:translate-x-1 transition-transform">
                &rarr;
              </span>
            </div>
          </Link>
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: <Zap className="w-5 h-5" />, title: "Real USDC Transfers", desc: "All deposits, borrows, and repayments happen onchain with real USDC.e on Polygon." },
            { icon: <TrendingUp className="w-5 h-5" />, title: "2-5x Leverage", desc: "Borrow from the vault to amplify your position. Kink-based interest rates." },
            { icon: <Shield className="w-5 h-5" />, title: "Insurance Fund", desc: "Interest and fees split between LPs, insurance, and protocol treasury." },
            { icon: <Lock className="w-5 h-5" />, title: "Security", desc: "ReentrancyGuard, Pausable, and Ownable. Configurable lending caps." },
            { icon: <ArrowLeftRight className="w-5 h-5" />, title: "Mock Prices", desc: "PnL calculated with user-provided mock prices. Real oracle integration next." },
            { icon: <Vault className="w-5 h-5" />, title: "ERC4626 Vault", desc: "Shares track proportional ownership. Value increases as interest accrues." },
          ].map((feat, i) => (
            <div key={i} className="rounded-xl border border-gray-800/50 bg-gray-900/30 p-5">
              <div className="text-neon mb-2">{feat.icon}</div>
              <h3 className="text-white font-semibold text-sm mb-1">{feat.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16 text-gray-600 text-xs">
          <p>LM Protocol Prototype &middot; Polygon PoS &middot; Use small amounts for testing</p>
        </div>
      </main>
    </>
  );
}
```

---

## Shared: components/Navbar.tsx

```tsx
"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { hasRealWalletConnectProjectId } from "@/lib/wagmi";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Trade Demo", href: "/trade-demo" },
  { label: "Polygon Vault", href: "/base-vault" },
  { label: "Transactions", href: "/transactions" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connectAsync, isPending: isConnectPending } = useConnect();
  const { disconnectAsync, isPending: isDisconnectPending } = useDisconnect();
  const [connectError, setConnectError] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const shortAddress = useMemo(() => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  const handleInjectedButton = async () => {
    setConnectError("");
    try {
      if (isConnected) {
        await disconnectAsync();
        return;
      }
      await connectAsync({ connector: injected({ shimDisconnect: true }) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setConnectError(message);
    }
  };
  const isPending = isConnectPending || isDisconnectPending;

  if (!mounted) {
    return (
      <nav className="sticky top-0 z-50 border-b border-emerald-900/30 bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shadow-glow">
                <span className="text-emerald-400 font-bold text-sm">LM</span>
              </div>
              <span className="hidden sm:block text-white font-semibold text-lg">Protocol</span>
            </Link>
            <div className="flex items-center gap-2">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href ? "text-emerald-400 bg-emerald-500/10" : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}>
                  {item.label}
                </Link>
              ))}
            </div>
            <button disabled className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 opacity-60 cursor-not-allowed">
              Connect Wallet
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-emerald-900/30 bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shadow-glow">
              <span className="text-emerald-400 font-bold text-sm">LM</span>
            </div>
            <span className="hidden sm:block text-white font-semibold text-lg">Protocol</span>
          </Link>
          <div className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href ? "text-emerald-400 bg-emerald-500/10" : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}>
                {item.label}
              </Link>
            ))}
          </div>
          {hasRealWalletConnectProjectId ? (
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
          ) : (
            <div className="relative">
              <button onClick={handleInjectedButton} disabled={isPending}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60">
                {isPending ? (isConnected ? "Disconnecting..." : "Connecting...") : isConnected && shortAddress ? shortAddress : "Connect Wallet"}
              </button>
              {connectError && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{connectError}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
```

---

## Trade Demo page

### app/trade-demo/page.tsx

```tsx
"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import TradingHeader from "@/components/TradingHeader";
import VaultMetricsPanel from "@/components/VaultMetricsPanel";
import { getContractAddresses, VAULT_ABI, MARGIN_ENGINE_ABI } from "@/lib/contracts";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { polygon } from "wagmi/chains";

const chartLoading = () => (
  <div className="rounded-xl border border-neon/20 bg-gradient-to-br from-gray-900 to-black p-8 flex items-center justify-center min-h-[200px]">
    <span className="text-gray-500 text-sm">Loading chart…</span>
  </div>
);
const PolymarketLiveChart = dynamic(() => import("@/components/PolymarketLiveChart"), { ssr: false, loading: chartLoading });
const PolymarketLeverageBox = dynamic(() => import("@/components/PolymarketLeverageBox"), {
  ssr: false,
  loading: () => (
    <div className="glass-card p-4 rounded-xl border border-emerald-500/20 min-h-[300px] flex items-center justify-center">
      <span className="text-gray-500 text-sm">Loading…</span>
    </div>
  ),
});
const PolymarketPositionVerify = dynamic(() => import("@/components/PolymarketPositionVerify"), { ssr: false });

const ZERO = "0x0000000000000000000000000000000000000000";
const addresses = getContractAddresses();
const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;

function useHeaderMarket(interval = 2500) {
  const [data, setData] = useState<{
    yesProbability: number | null;
    noProbability: number | null;
    bestBid: number | null;
    bestAsk: number | null;
    oneDayChange: number;
    spread: number | null;
  }>({ yesProbability: null, noProbability: null, bestBid: null, bestAsk: null, oneDayChange: 0, spread: null });

  const SLUG = "will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568";
  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/polymarket-live", { cache: "no-store" });
      let m: Record<string, unknown> | null = null;
      if (res.ok) {
        const j = await res.json();
        m = j?.success && j?.market ? j.market : null;
      }
      if (!m) {
        const fallback = await fetch(`/api/gamma/markets/slug/${encodeURIComponent(SLUG)}`, { cache: "no-store", headers: { Accept: "application/json" } });
        if (!fallback.ok) return;
        const data = await fallback.json();
        m = Array.isArray(data) ? data[0] : data;
        if (!m || typeof m !== "object") return;
      }
      let outcomePrices: number[] = [];
      try { outcomePrices = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices ?? []; } catch { outcomePrices = []; }
      const yp = outcomePrices[0] != null ? parseFloat(String(outcomePrices[0])) : null;
      const bb = m.bestBid != null ? parseFloat(String(m.bestBid)) : null;
      const ba = m.bestAsk != null ? parseFloat(String(m.bestAsk)) : null;
      setData({
        yesProbability: yp != null ? Math.round(yp * 1000) / 10 : null,
        noProbability: yp != null ? Math.round((1 - yp) * 1000) / 10 : null,
        bestBid: bb,
        bestAsk: ba,
        oneDayChange: parseFloat(String(m.oneDayPriceChange ?? "")) || 0,
        spread: bb != null && ba != null ? Math.abs(ba - bb) : null,
      });
    } catch { /* ignore */ }
  }, []);

  const ref = useRef(fetch_);
  ref.current = fetch_;
  useEffect(() => {
    ref.current();
    const id = setInterval(() => ref.current(), interval);
    return () => clearInterval(id);
  }, [interval]);

  return data;
}

export default function TradeDemoPage() {
  const { isConnected } = useAccount();
  const headerMarket = useHeaderMarket();

  const { data: vaultData, refetch: refetchVault } = useReadContracts({
    contracts: hasVault
      ? [
          { address: addresses.vault, abi: VAULT_ABI, functionName: "totalAssets", chainId: polygon.id },
          { address: addresses.vault, abi: VAULT_ABI, functionName: "totalBorrowed", chainId: polygon.id },
          { address: addresses.vault, abi: VAULT_ABI, functionName: "utilization", chainId: polygon.id },
          { address: addresses.vault, abi: VAULT_ABI, functionName: "insuranceBalance", chainId: polygon.id },
          { address: addresses.vault, abi: VAULT_ABI, functionName: "protocolBalance", chainId: polygon.id },
        ]
      : [],
    query: { refetchInterval: 5000 },
  });

  const totalAssets = vaultData?.[0]?.result as bigint | undefined;
  const totalBorrowed = vaultData?.[1]?.result as bigint | undefined;
  const utilizationBps = vaultData?.[2]?.result as bigint | undefined;
  const insuranceBal = vaultData?.[3]?.result as bigint | undefined;
  const protocolBal = vaultData?.[4]?.result as bigint | undefined;

  const { data: borrowApr } = useReadContract({
    address: hasVault ? addresses.marginEngine : undefined,
    abi: MARGIN_ENGINE_ABI,
    functionName: "borrowAPR",
    chainId: polygon.id,
  });

  const handleVaultRefetch = useCallback(() => { refetchVault(); }, [refetchVault]);

  return (
    <div className="min-h-screen bg-terminal-gradient">
      <Navbar />
      <TradingHeader
        yesProbability={headerMarket.yesProbability}
        noProbability={headerMarket.noProbability}
        bestBid={headerMarket.bestBid}
        bestAsk={headerMarket.bestAsk}
        oneDayChange={headerMarket.oneDayChange}
        spread={headerMarket.spread}
      />
      <main className="mx-auto max-w-7xl px-4 py-3">
        <div className="mb-3">
          <PolymarketLiveChart />
        </div>
        <div className="grid lg:grid-cols-5 gap-4 items-start">
          <div className="lg:col-span-3">
            <PolymarketLeverageBox onVaultRefetch={handleVaultRefetch} />
          </div>
          <div className="lg:col-span-2">
            <VaultMetricsPanel
              totalAssets={totalAssets}
              totalBorrowed={totalBorrowed}
              utilizationBps={utilizationBps}
              borrowApr={borrowApr as bigint | undefined}
              insuranceBal={insuranceBal}
              protocolBal={protocolBal}
            />
            <PolymarketPositionVerify />
          </div>
        </div>
      </main>
    </div>
  );
}
```

Trade-demo also uses: `TradingHeader`, `VaultMetricsPanel`, `PolymarketLiveChart`, `PolymarketLeverageBox`, `PolymarketPositionVerify`.  
Full source for these is in the repo at:
- `components/TradingHeader.tsx`
- `components/VaultMetricsPanel.tsx`
- `components/PolymarketLiveChart.tsx`
- `components/PolymarketLeverageBox.tsx`
- `components/PolymarketPositionVerify.tsx`

`PolymarketLeverageBox` uses `RealPolymarketTrade` and `useVaultMetrics`; see `components/RealPolymarketTrade.tsx` and `hooks/useVaultMetrics.ts`.

---

## Vault page (base-vault)

### app/base-vault/page.tsx

Polygon USDC.e vault: deposit/withdraw, TVL/totalBorrowed/utilization/insurance/protocol, network guard, user balances, approve/deposit/withdraw with `TxButton`. Full source is in the repo at `app/base-vault/page.tsx` (353 lines).

### components/TxButton.tsx

```tsx
"use client";

import { ReactNode } from "react";

interface TxButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  children: ReactNode;
  className?: string;
}

export default function TxButton({
  onClick,
  loading = false,
  disabled = false,
  variant = "primary",
  children,
  className = "",
}: TxButtonProps) {
  const base =
    "relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:from-emerald-500/30 hover:to-emerald-600/30 hover:border-emerald-500/50 active:scale-[0.98] shadow-glow",
    secondary:
      "bg-white/5 text-gray-300 border border-gray-700 hover:bg-white/10 hover:border-gray-600 active:scale-[0.98]",
    danger:
      "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 active:scale-[0.98]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading && <div className="spinner" />}
      {children}
    </button>
  );
}
```

---

## Transactions page

### app/transactions/page.tsx

Lists open/closed MarginEngine positions (Polygon), fetches `getUserPositions` + `getPosition`, parses `PositionClosed` logs for exit price/PnL, table with status/direction/leverage/collateral/borrowed/notional/entry/exit/opened and Polygonscan link. Full source is in the repo at `app/transactions/page.tsx` (334 lines).

---

## Summary

- **Home:** `app/page.tsx` → `HomeLanding` (hero, 3 cards: Trade Demo, Polygon Vault, Margin Trade, feature grid).
- **Trade Demo:** `app/trade-demo/page.tsx` → header market hook, vault reads, `TradingHeader` + `PolymarketLiveChart` + `PolymarketLeverageBox` (left) and `VaultMetricsPanel` + `PolymarketPositionVerify` (right).
- **Vault:** `app/base-vault/page.tsx` → Polygon vault stats, deposit/withdraw, approve flow, `TxButton`.
- **Transactions:** `app/transactions/page.tsx` → MarginEngine positions table and exit data from events.

All of the above files exist under `demo-real/frontend/`; this doc is a reference. For the three long files (base-vault page, transactions page, and the trade-demo components), open the paths above in the repo to see the full source.
