"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { getContractAddresses, MOCK_USDC_ABI } from "@/lib/contracts";
import { POLYGON_CHAIN_ID, POLYMKT_USDCE_ADDRESS } from "@/lib/polymarketConfig";
import { erc20PolyAbi } from "@/lib/polymarketAbi";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

const addresses = getContractAddresses();

interface Props {
  yesProbability: number | null;
  noProbability: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  oneDayChange: number;
  spread: number | null;
}

export default function TradingHeader({ yesProbability, noProbability, bestBid, bestAsk, oneDayChange, spread }: Props) {
  const { address, isConnected } = useAccount();

  /* Base USDC */
  const { data: baseUsdc } = useReadContract({
    address: addresses.mockUsdc,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: base.id,
  });
  const baseUsdcNum = baseUsdc != null ? Number(baseUsdc as bigint) / 1e6 : 0;

  /* Polygon USDC.e */
  const { data: polyUsdc } = useReadContract({
    address: POLYMKT_USDCE_ADDRESS,
    abi: erc20PolyAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: POLYGON_CHAIN_ID,
  });
  const polyUsdcNum = polyUsdc != null ? Number(polyUsdc as bigint) / 1e6 : 0;

  const yesUp = oneDayChange >= 0;

  return (
    <div className="bg-header-gradient border-b border-emerald-900/30">
      <div className="mx-auto max-w-7xl px-4 py-2">
        {/* Single compact row: Title + Prices + Wallet */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-white font-bold text-sm leading-tight">BTC $100k by Dec 31 2026</h1>
            <Activity className="w-3 h-3 text-emerald-500 animate-pulse flex-shrink-0" />
          </div>

          {/* Price ticker + Wallet inline */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-[10px]">YES</span>
              <span className="text-emerald-400 font-bold font-mono">
                {bestAsk != null ? `$${bestAsk.toFixed(2)}` : yesProbability != null ? `${yesProbability.toFixed(1)}%` : "--"}
              </span>
              {oneDayChange !== 0 && (
                <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${yesUp ? "text-emerald-400" : "text-red-400"}`}>
                  {yesUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {yesUp ? "+" : ""}{(oneDayChange * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="w-px h-3.5 bg-gray-800" />
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-[10px]">NO</span>
              <span className="text-red-400 font-bold font-mono">
                {bestBid != null ? `$${(1 - bestBid).toFixed(2)}` : noProbability != null ? `${noProbability.toFixed(1)}%` : "--"}
              </span>
            </div>
            {spread != null && (
              <>
                <div className="w-px h-3.5 bg-gray-800" />
                <span className="text-gray-500 text-[10px]">
                  Spd <span className="text-gray-400 font-mono">${spread.toFixed(4)}</span>
                </span>
              </>
            )}
            {isConnected && (
              <>
                <div className="w-px h-3.5 bg-gray-800" />
                <span className="text-gray-500 text-[10px]">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
                <span className="text-emerald-400 font-mono text-[10px] font-semibold">{baseUsdcNum.toFixed(2)}</span>
                <span className="text-gray-600 text-[10px]">Base</span>
                <span className="text-emerald-400 font-mono text-[10px] font-semibold">{polyUsdcNum.toFixed(2)}</span>
                <span className="text-gray-600 text-[10px]">Poly</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
