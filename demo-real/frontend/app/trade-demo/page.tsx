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
  <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-8 flex items-center justify-center min-h-[260px]">
    <div className="flex items-center gap-3 text-[#555] text-sm">
      <div className="spinner" />
      Loading chart...
    </div>
  </div>
);

const PolymarketLiveChart = dynamic(() => import("@/components/PolymarketLiveChart"), {
  ssr: false,
  loading: chartLoading,
});
const PolymarketLeverageBox = dynamic(() => import("@/components/PolymarketLeverageBox"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-6 min-h-[400px] flex items-center justify-center">
      <div className="flex items-center gap-3 text-[#555] text-sm">
        <div className="spinner" />
        Loading trade panel...
      </div>
    </div>
  ),
});
const PolymarketPositionVerify = dynamic(() => import("@/components/PolymarketPositionVerify"), { ssr: false });

const ZERO = "0x0000000000000000000000000000000000000000";
const addresses = getContractAddresses();
const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;

/**
 * Header market data — refreshes every 1 SECOND for live prices.
 */
function useHeaderMarket() {
  const [data, setData] = useState<{
    yesProbability: number | null;
    noProbability: number | null;
    bestBid: number | null;
    bestAsk: number | null;
    oneDayChange: number;
    spread: number | null;
    volume24hr: number | null;
  }>({ yesProbability: null, noProbability: null, bestBid: null, bestAsk: null, oneDayChange: 0, spread: null, volume24hr: null });

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/polymarket-live", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      if (!j?.success || !j?.market) return;
      const m = j.market;

      let outcomePrices: number[] = [];
      try {
        outcomePrices = Array.isArray(m.outcomePrices) ? m.outcomePrices : JSON.parse(m.outcomePrices);
      } catch {
        outcomePrices = [];
      }

      const yp = outcomePrices[0] != null ? parseFloat(String(outcomePrices[0])) : null;
      const bb = m.bestBid != null ? parseFloat(String(m.bestBid)) : null;
      const ba = m.bestAsk != null ? parseFloat(String(m.bestAsk)) : null;

      setData({
        yesProbability: yp != null ? Math.round(yp * 1000) / 10 : null,
        noProbability: yp != null ? Math.round((1 - yp) * 1000) / 10 : null,
        bestBid: bb,
        bestAsk: ba,
        oneDayChange: parseFloat(String(m.oneDayPriceChange ?? "")) || 0,
        spread: bb != null && ba != null ? Math.abs(ba - bb) : (m.spread != null ? parseFloat(String(m.spread)) : null),
        volume24hr: m.volume24hr != null ? parseFloat(String(m.volume24hr)) : null,
      });
    } catch { /* ignore */ }
  }, []);

  const ref = useRef(fetch_);
  ref.current = fetch_;
  useEffect(() => {
    ref.current();
    // *** 1-SECOND REFRESH ***
    const id = setInterval(() => ref.current(), 1000);
    return () => clearInterval(id);
  }, []);

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
        volume24hr={headerMarket.volume24hr}
      />
      <main className="mx-auto max-w-7xl px-4 py-5">
        <div className="mb-5">
          <PolymarketLiveChart />
        </div>
        <div className="grid lg:grid-cols-5 gap-5 items-start">
          <div className="lg:col-span-3">
            <PolymarketLeverageBox onVaultRefetch={handleVaultRefetch} />
          </div>
          <div className="lg:col-span-2 space-y-5">
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
