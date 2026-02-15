"use client";

import { useCallback } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import StatCard from "@/components/StatCard";
import WalletPortfolio from "@/components/WalletPortfolio";
import {
  getContractAddresses,
  VAULT_ABI,
  MARGIN_ENGINE_ABI,
} from "@/lib/contracts";
import { formatUSDC, bpsToPercent } from "@/lib/utils";
import {
  useAccount,
  useReadContract,
  useReadContracts,
} from "wagmi";
import {
  ArrowLeftRight,
  BarChart3,
  Target,
  Clock,
  RefreshCw,
  Shield,
} from "lucide-react";

const PolymarketLiveChart = dynamic(() => import("@/components/PolymarketLiveChart"), { ssr: false });
const PolymarketLeverageBox = dynamic(() => import("@/components/PolymarketLeverageBox"), { ssr: false });

const addresses = getContractAddresses();

export default function TradeDemoPage() {
  const { isConnected } = useAccount();

  // ─── Vault stats ───────────────────────────────────────────────────
  const { data: vaultData, refetch: refetchVault } = useReadContracts({
    contracts: [
      { address: addresses.vault, abi: VAULT_ABI, functionName: "totalAssets" },
      { address: addresses.vault, abi: VAULT_ABI, functionName: "totalBorrowed" },
      { address: addresses.vault, abi: VAULT_ABI, functionName: "utilization" },
      { address: addresses.vault, abi: VAULT_ABI, functionName: "insuranceBalance" },
      { address: addresses.vault, abi: VAULT_ABI, functionName: "protocolBalance" },
    ],
  });

  const totalAssets = vaultData?.[0]?.result as bigint | undefined;
  const totalBorrowed = vaultData?.[1]?.result as bigint | undefined;
  const utilizationBps = vaultData?.[2]?.result as bigint | undefined;
  const insuranceBal = vaultData?.[3]?.result as bigint | undefined;
  const protocolBal = vaultData?.[4]?.result as bigint | undefined;

  const { data: borrowApr } = useReadContract({
    address: addresses.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: "borrowAPR",
  });

  const handleVaultRefetch = useCallback(() => {
    refetchVault();
  }, [refetchVault]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-neon/10 flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-neon" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Trade Demo</h1>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30">
                REAL ONCHAIN
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              Live Polymarket data + real USDC vault borrowing. Trade with real money flows.
            </p>
          </div>
          <button
            onClick={() => refetchVault()}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Vault Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Vault TVL" value={`$${formatUSDC(totalAssets)}`} icon={<BarChart3 className="w-3.5 h-3.5" />} highlight />
          <StatCard label="Total Borrowed" value={`$${formatUSDC(totalBorrowed)}`} icon={<ArrowLeftRight className="w-3.5 h-3.5" />} />
          <StatCard label="Utilization" value={utilizationBps !== undefined ? bpsToPercent(utilizationBps) : "0%"} icon={<Target className="w-3.5 h-3.5" />} />
          <StatCard label="Borrow APR" value={borrowApr !== undefined ? bpsToPercent(borrowApr as bigint) : "5.00%"} icon={<Clock className="w-3.5 h-3.5" />} />
        </div>

        {/* Wallet Portfolio */}
        {isConnected && (
          <div className="mb-8">
            <WalletPortfolio />
          </div>
        )}

        {/* ═══ Live Polymarket + Trade ═══ */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon animate-pulse" />
            Live Polymarket Integration
          </h2>
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {/* Left column: Chart + Fee boxes */}
            <div className="space-y-6">
              <PolymarketLiveChart />

              {/* Fee Distribution */}
              <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Fee Distribution
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm">Insurance Fund</span>
                    <span className="text-white font-medium">${formatUSDC(insuranceBal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm">Protocol Treasury</span>
                    <span className="text-white font-medium">${formatUSDC(protocolBal)}</span>
                  </div>
                  <div className="border-t border-gray-800/50 pt-3">
                    <div className="text-gray-500 text-xs mb-2">Open Fee Split</div>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-lg bg-green-500/10 border border-green-500/20 p-2 text-center"><div className="text-green-400 text-xs font-bold">30%</div><div className="text-gray-500 text-[10px]">LP</div></div>
                      <div className="flex-1 rounded-lg bg-blue-500/10 border border-blue-500/20 p-2 text-center"><div className="text-blue-400 text-xs font-bold">40%</div><div className="text-gray-500 text-[10px]">Insurance</div></div>
                      <div className="flex-1 rounded-lg bg-purple-500/10 border border-purple-500/20 p-2 text-center"><div className="text-purple-400 text-xs font-bold">30%</div><div className="text-gray-500 text-[10px]">Protocol</div></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interest Split */}
              <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  Interest Split
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm">Borrow APR (kink model)</span>
                    <span className="text-neon font-medium">{borrowApr !== undefined ? bpsToPercent(borrowApr as bigint) : "5.00%"}</span>
                  </div>
                  <div className="border-t border-gray-800/50 pt-3">
                    <div className="text-gray-500 text-xs mb-2">Interest Split on Repayment</div>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-lg bg-green-500/10 border border-green-500/20 p-2 text-center"><div className="text-green-400 text-xs font-bold">88%</div><div className="text-gray-500 text-[10px]">LP</div></div>
                      <div className="flex-1 rounded-lg bg-blue-500/10 border border-blue-500/20 p-2 text-center"><div className="text-blue-400 text-xs font-bold">7%</div><div className="text-gray-500 text-[10px]">Insurance</div></div>
                      <div className="flex-1 rounded-lg bg-purple-500/10 border border-purple-500/20 p-2 text-center"><div className="text-purple-400 text-xs font-bold">5%</div><div className="text-gray-500 text-[10px]">Protocol</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: Trade box */}
            <PolymarketLeverageBox onVaultRefetch={handleVaultRefetch} />
          </div>
        </div>

        {/* Educational Note */}
        <div className="rounded-2xl border border-gray-800/30 bg-gray-900/20 p-6">
          <h3 className="text-gray-300 font-semibold text-sm mb-3">How This Works (Real Onchain)</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-xs text-gray-500 leading-relaxed">
            <div>
              <p className="mb-2"><span className="text-neon font-medium">1. Select YES/NO:</span> Pick your direction based on the live Polymarket market. Entry price is pulled from the live best ask.</p>
              <p><span className="text-neon font-medium">2. Set Collateral + Leverage:</span> Choose how much USDC and your leverage (2-10x).</p>
            </div>
            <div>
              <p className="mb-2"><span className="text-neon font-medium">3. Open Position:</span> Your USDC transfers to MarginEngine. It borrows from the Vault to reach your notional size.</p>
              <p><span className="text-neon font-medium">4. Close Position:</span> Set an exit price, principal + interest repaid to Vault, collateral +/- PnL returned to you.</p>
            </div>
            <div>
              <p className="mb-2"><span className="text-yellow-400 font-medium">Live Prices:</span> YES/NO probabilities and bid/ask come live from Polymarket. Entry price auto-fills from the market.</p>
              <p><span className="text-yellow-400 font-medium">Real USDC:</span> All collateral, borrow, repay, and fee transfers are real onchain transactions.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
