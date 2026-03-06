"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import TradingHeader from "@/components/TradingHeader";
import VaultMetricsPanel from "@/components/VaultMetricsPanel";
import { getContractAddresses, VAULT_ABI, MARGIN_ENGINE_ABI } from "@/lib/contracts";
import { MARKET_CONFIG } from "@/lib/polymarketConfig";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { polygon } from "wagmi/chains";

const chartLoading = () => (
  <div className="rounded-xl border border-[#00ff88]/20 bg-[#0a0a0a] p-8 flex items-center justify-center min-h-[200px]">
    <span className="text-gray-500 text-sm">Loading chart...</span>
  </div>
);
const PolymarketLiveChart = dynamic(() => import("@/components/PolymarketLiveChart"), { ssr: false, loading: chartLoading });
const PolymarketLeverageBox = dynamic(() => import("@/components/PolymarketLeverageBox"), {
  ssr: false,
  loading: () => <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-8 animate-pulse min-h-[300px]" />,
});
const PolymarketPositionVerify = dynamic(() => import("@/components/PolymarketPositionVerify"), { ssr: false });

const ZERO = "0x0000000000000000000000000000000000000000";
const addresses = getContractAddresses();
const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;

// Wallet address for portfolio link (connected wallet or trading wallet from env)

/**
 * Custom hook: fetches LIVE market data from /api/polymarket-live every 1 second.
 * This calls the CLOB API endpoints which return real-time data:
 *   /price?side=BUY  → bestBid
 *   /price?side=SELL → bestAsk
 *   /midpoint        → YES price
 *   /spread          → spread
 */
function useHeaderMarket(interval = 1000) {
  const [data, setData] = useState<{
    yesProbability: number | null;
    noProbability: number | null;
    bestBid: number | null;
    bestAsk: number | null;
    oneDayChange: number;
    spread: number | null;
    volume24hr: number | null;
    lastTradePrice: number | null;
  }>({
    yesProbability: null,
    noProbability: null,
    bestBid: null,
    bestAsk: null,
    oneDayChange: 0,
    spread: null,
    volume24hr: null,
    lastTradePrice: null,
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/polymarket-live", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.market) return;
      const m = json.market;
      setData({
        yesProbability: m.yesPrice ?? null,
        noProbability: m.noPrice ?? null,
        bestBid: m.bestBid ?? null,
        bestAsk: m.bestAsk ?? null,
        oneDayChange: m.oneDayPriceChange ?? 0,
        spread: m.spread ?? null,
        volume24hr: m.volume24hr ?? null,
        lastTradePrice: m.lastTradePrice ?? null,
      });
    } catch { /* ignore */ }
  }, []);

  const ref = useRef(fetchData);
  ref.current = fetchData;

  useEffect(() => {
    ref.current();
    const id = setInterval(() => ref.current(), interval);
    return () => clearInterval(id);
  }, [interval]);

  return data;
}

export default function TradeDemoPage() {
  const { address } = useAccount();
  const market = useHeaderMarket(1000); // 1 second refresh

  // Vault reads for VaultMetricsPanel
  const { data: vaultData, refetch: refetchVault } = useReadContracts({
    contracts: hasVault
      ? [
          { address: addresses.vault as `0x${string}`, abi: VAULT_ABI, functionName: "totalAssets", chainId: polygon.id },
          { address: addresses.vault as `0x${string}`, abi: VAULT_ABI, functionName: "totalBorrowed", chainId: polygon.id },
          { address: addresses.vault as `0x${string}`, abi: VAULT_ABI, functionName: "utilization", chainId: polygon.id },
        ]
      : [],
    query: { refetchInterval: 5000 },
  });

  return (
    <div className="min-h-screen bg-terminal-gradient">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Trading Header with live data */}
        <TradingHeader
          yesProbability={market.yesProbability}
          noProbability={market.noProbability}
          bestBid={market.bestBid}
          bestAsk={market.bestAsk}
          oneDayChange={market.oneDayChange}
          spread={market.spread}
          volume24hr={market.volume24hr}
          lastTradePrice={market.lastTradePrice}
          traderWallet={address ?? process.env.NEXT_PUBLIC_POLYMARKET_TRADING_ADDRESS ?? undefined}
        />

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          {/* Left column: Chart + Trade Box */}
          <div className="lg:col-span-2 space-y-6">
            <PolymarketLiveChart />
            <PolymarketLeverageBox onVaultRefetch={refetchVault} />
          </div>

          {/* Right column: Vault + Positions */}
          <div className="space-y-6">
            <VaultMetricsPanel
              totalAssets={vaultData?.[0]?.result as bigint | undefined}
              totalBorrowed={vaultData?.[1]?.result as bigint | undefined}
              utilizationBps={vaultData?.[2]?.result as bigint | undefined}
            />
            <PolymarketPositionVerify />
          </div>
        </div>
      </main>
    </div>
  );
}
