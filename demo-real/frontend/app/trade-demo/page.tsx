"use client";

import Navbar from "@/components/Navbar";
import TradingHeader from "@/components/TradingHeader";
import PolymarketLiveChart from "@/components/PolymarketLiveChart";
import PolymarketLeverageBox from "@/components/PolymarketLeverageBox";
import PolymarketPositionVerify from "@/components/PolymarketPositionVerify";
import VaultMetricsPanel from "@/components/VaultMetricsPanel";

export default function TradeDemoPage() {
  return (
    <div className="min-h-screen bg-terminal-gradient">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Market Header — refreshes every 1s */}
        <TradingHeader />

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column: Chart + Positions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Chart — refreshes every 5s (chart data doesn't change as fast) */}
            <PolymarketLiveChart />

            {/* Open Positions */}
            <PolymarketPositionVerify />
          </div>

          {/* Right column: Trade Box + Vault */}
          <div className="space-y-6">
            {/* Leverage Trade Box */}
            <PolymarketLeverageBox />

            {/* Vault Metrics */}
            <VaultMetricsPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
