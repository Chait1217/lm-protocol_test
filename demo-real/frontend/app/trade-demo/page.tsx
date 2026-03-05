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
  <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-gray-900 to-black p-8 flex items-center justify-center min-h-[200px]">
    <span className="text-gray-500 text-sm">Loading chart…</span>
  </div>
);
const PolymarketLiveChart = dynamic(
  () => import("@/components/PolymarketLiveChart"),
  { ssr: false, loading: chartLoading }
);
const PolymarketLeverageBox = dynamic(
  () => import("@/components/PolymarketLeverageBox"),
  {
    ssr: false,
    loading: () => (
      <div className="glass-card p-4 rounded-xl border border-emerald-500/20 min-h-[300px] flex items-center justify-center">
        <span className="text-gray-500 text-sm">Loading…</span>
      </div>
    ),
  }
);
const PolymarketPositionVerify = dynamic(
  () => import("@/components/PolymarketPositionVerify"),
  { ssr: false }
);

const ZERO = "0x0000000000000000000000000000000000000000";
const addresses = getContractAddresses();
const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;

/**
 * Fetches live market data from /api/polymarket-live every `interval` ms.
 * This calls the CLOB API endpoints (price, midpoint, spread) — not Gamma.
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
    lastTradeSide: string | null;
  }>({
    yesProbability: null,
    noProbability: null,
    bestBid: null,
    bestAsk: null,
    oneDayChange: 0,
    spread: null,
    volume24hr: null,
    lastTradePrice: null,
    lastTradeSide: null,
  });

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/polymarket-live", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      if (!j?.success || !j?.market) return;
      const m = j.market;

      setData({
        yesProbability:
          m.yesPrice != null ? Math.round(m.yesPrice * 1000) / 10 : null,
        noProbability:
          m.noPrice != null ? Math.round(m.noPrice * 1000) / 10 : null,
        bestBid: m.bestBid ?? null,
        bestAsk: m.bestAsk ?? null,
        oneDayChange: m.oneDayPriceChange ?? 0,
        spread: m.spread ?? null,
        volume24hr: m.volume24hr ?? null,
        lastTradePrice: m.lastTradePrice ?? null,
        lastTradeSide: m.lastTradeSide ?? null,
      });
    } catch {
      /* ignore */
    }
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
  const headerMarket = useHeaderMarket(1000); // 1-second refresh

  const { data: vaultData, refetch: refetchVault } = useReadContracts({
    contracts: hasVault
      ? [
          {
            address: addresses.vault as `0x${string}`,
            abi: VAULT_ABI,
            functionName: "totalAssets",
            chainId: polygon.id,
          },
          {
            address: addresses.vault as `0x${string}`,
            abi: VAULT_ABI,
            functionName: "totalBorrowed",
            chainId: polygon.id,
          },
          {
            address: addresses.vault as `0x${string}`,
            abi: VAULT_ABI,
            functionName: "utilization",
            chainId: polygon.id,
          },
          {
            address: addresses.vault as `0x${string}`,
            abi: VAULT_ABI,
            functionName: "insuranceBalance",
            chainId: polygon.id,
          },
          {
            address: addresses.vault as `0x${string}`,
            abi: VAULT_ABI,
            functionName: "protocolBalance",
            chainId: polygon.id,
          },
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
    address: hasVault
      ? (addresses.marginEngine as `0x${string}`)
      : undefined,
    abi: MARGIN_ENGINE_ABI,
    functionName: "borrowAPR",
    chainId: polygon.id,
  });

  const handleVaultRefetch = useCallback(() => {
    refetchVault();
  }, [refetchVault]);

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
        volume24hr={headerMarket.volume24hr}
        lastTradePrice={headerMarket.lastTradePrice}
        lastTradeSide={headerMarket.lastTradeSide}
      />
      <main className="mx-auto max-w-7xl px-4 py-3">
        <div className="mb-3">
          <PolymarketLiveChart />
        </div>
        <div className="grid lg:grid-cols-5 gap-4 items-start">
          <div className="lg:col-span-3">
            <PolymarketLeverageBox onVaultRefetch={handleVaultRefetch} />
          </div>
          <div className="lg:col-span-2 space-y-4">
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
