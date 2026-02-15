"use client";

import { useCallback, useState, useEffect, useRef, useReducer } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import TradingHeader from "@/components/TradingHeader";
import VaultMetricsPanel from "@/components/VaultMetricsPanel";
import {
  getContractAddresses,
  VAULT_ABI,
  MARGIN_ENGINE_ABI,
} from "@/lib/contracts";
import {
  useAccount,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { base } from "wagmi/chains";

const PolymarketLiveChart = dynamic(() => import("@/components/PolymarketLiveChart"), { ssr: false });
const PolymarketLeverageBox = dynamic(() => import("@/components/PolymarketLeverageBox"), { ssr: false });
const PositionsPanel = dynamic(() => import("@/components/PositionsPanel"), { ssr: false });

const ZERO = "0x0000000000000000000000000000000000000000";
const addresses = getContractAddresses();
const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;

/* ─── Lightweight market data fetcher for the header ─── */
function useHeaderMarket(interval = 3000) {
  const [data, setData] = useState<{
    yesProbability: number | null;
    noProbability: number | null;
    bestBid: number | null;
    bestAsk: number | null;
    oneDayChange: number;
    spread: number | null;
  }>({ yesProbability: null, noProbability: null, bestBid: null, bestAsk: null, oneDayChange: 0, spread: null });

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`/api/polymarket-live?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      if (!j.success || !j.market) return;
      const m = j.market;
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
        oneDayChange: parseFloat(m.oneDayPriceChange) || 0,
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

/* ─── Page ─── */

export default function TradeDemoPage() {
  const { isConnected } = useAccount();
  const headerMarket = useHeaderMarket();

  // ─── Vault stats ───
  const { data: vaultData, refetch: refetchVault } = useReadContracts({
    contracts: hasVault
      ? [
          { address: addresses.vault, abi: VAULT_ABI, functionName: "totalAssets", chainId: base.id },
          { address: addresses.vault, abi: VAULT_ABI, functionName: "totalBorrowed", chainId: base.id },
          { address: addresses.vault, abi: VAULT_ABI, functionName: "utilization", chainId: base.id },
          { address: addresses.vault, abi: VAULT_ABI, functionName: "insuranceBalance", chainId: base.id },
          { address: addresses.vault, abi: VAULT_ABI, functionName: "protocolBalance", chainId: base.id },
        ]
      : [],
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
    chainId: base.id,
  });

  const [positionRefreshTrigger, bumpPositionRefresh] = useReducer((x: number) => x + 1, 0);

  const handleVaultRefetch = useCallback(() => {
    refetchVault();
    bumpPositionRefresh();
  }, [refetchVault]);

  return (
    <div className="min-h-screen bg-terminal-gradient">
      <Navbar />

      {/* ════ 1. Trading Header ════ */}
      <TradingHeader
        yesProbability={headerMarket.yesProbability}
        noProbability={headerMarket.noProbability}
        bestBid={headerMarket.bestBid}
        bestAsk={headerMarket.bestAsk}
        oneDayChange={headerMarket.oneDayChange}
        spread={headerMarket.spread}
      />

      <main className="mx-auto max-w-7xl px-4 py-3">
        {/* ════ 2. Chart ════ */}
        <div className="mb-3">
          <PolymarketLiveChart />
        </div>

        {/* ════ 3. Dual Panel: Trade (left) + Vault Metrics (right) ════ */}
        <div className="grid lg:grid-cols-5 gap-4 items-start">
          {/* Left: Trade box (takes 3/5 on lg) */}
          <div className="lg:col-span-3">
            <PolymarketLeverageBox onVaultRefetch={handleVaultRefetch} />
          </div>

          {/* Right: Vault metrics + Positions (takes 2/5 on lg) */}
          <div className="lg:col-span-2">
            <VaultMetricsPanel
              totalAssets={totalAssets}
              totalBorrowed={totalBorrowed}
              utilizationBps={utilizationBps}
              borrowApr={borrowApr as bigint | undefined}
              insuranceBal={insuranceBal}
              protocolBal={protocolBal}
            />
            <PositionsPanel
              refreshTrigger={positionRefreshTrigger}
              onVaultRefetch={handleVaultRefetch}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
