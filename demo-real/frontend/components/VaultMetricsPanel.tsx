"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { polygon } from "wagmi/chains";
import { formatUnits, parseUnits } from "viem";
import { getContractAddresses, VAULT_ABI } from "@/lib/contracts";

const addresses = getContractAddresses();
const ZERO = "0x0000000000000000000000000000000000000000";
const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;

interface VaultMetricsPanelProps {
  totalAssets?: bigint;
  totalBorrowed?: bigint;
  utilization?: bigint;
}

export default function VaultMetricsPanel({ totalAssets, totalBorrowed, utilization }: VaultMetricsPanelProps) {
  const { address, isConnected } = useAccount();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawMethod, setWithdrawMethod] = useState<"withdraw" | "redeem">("withdraw");

  const assetsNum = totalAssets ? parseFloat(formatUnits(totalAssets, 6)) : 0;
  const borrowedNum = totalBorrowed ? parseFloat(formatUnits(totalBorrowed, 6)) : 0;
  const availableNum = assetsNum - borrowedNum;
  const utilPct = utilization ? Number(utilization) / 100 : (assetsNum > 0 ? (borrowedNum / assetsNum) * 100 : 0);

  // Read user's vault shares
  const { data: userShares } = useReadContract({
    address: hasVault ? (addresses.vault as `0x${string}`) : undefined,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: polygon.id,
  });

  // Read maxWithdraw for user
  const { data: maxWithdrawRaw } = useReadContract({
    address: hasVault ? (addresses.vault as `0x${string}`) : undefined,
    abi: VAULT_ABI,
    functionName: "maxWithdraw",
    args: address ? [address] : undefined,
    chainId: polygon.id,
  });

  // Read maxRedeem for user
  const { data: maxRedeemRaw } = useReadContract({
    address: hasVault ? (addresses.vault as `0x${string}`) : undefined,
    abi: VAULT_ABI,
    functionName: "maxRedeem",
    args: address ? [address] : undefined,
    chainId: polygon.id,
  });

  const maxWithdrawNum = maxWithdrawRaw ? parseFloat(formatUnits(maxWithdrawRaw as bigint, 6)) : 0;
  const maxRedeemNum = maxRedeemRaw ? parseFloat(formatUnits(maxRedeemRaw as bigint, 6)) : 0;
  const userSharesNum = userShares ? parseFloat(formatUnits(userShares as bigint, 6)) : 0;

  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleWithdraw = useCallback(() => {
    if (!address || !hasVault) return;
    setWithdrawError(null);

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError("Enter a valid amount");
      return;
    }

    // Strategy: Try withdraw first. If maxWithdraw is too low, use redeem.
    if (amount <= maxWithdrawNum) {
      // Use withdraw(assets, receiver, owner)
      setWithdrawMethod("withdraw");
      const assets = parseUnits(amount.toFixed(6), 6);
      writeContract({
        address: addresses.vault as `0x${string}`,
        abi: VAULT_ABI,
        functionName: "withdraw",
        args: [assets, address, address],
        chainId: polygon.id,
      });
    } else if (userSharesNum > 0) {
      // Fallback: use redeem(shares, receiver, owner)
      // Convert desired amount to shares (approximate: shares = amount * totalShares / totalAssets)
      setWithdrawMethod("redeem");
      const sharesToRedeem = maxRedeemRaw || (userShares as bigint);
      writeContract({
        address: addresses.vault as `0x${string}`,
        abi: VAULT_ABI,
        functionName: "redeem",
        args: [sharesToRedeem, address, address],
        chainId: polygon.id,
      });
    } else {
      setWithdrawError(`Max withdrawable: $${maxWithdrawNum.toFixed(4)}. Vault may have insufficient idle liquidity (borrowed: $${borrowedNum.toFixed(2)}).`);
    }
  }, [address, withdrawAmount, maxWithdrawNum, maxRedeemRaw, userShares, userSharesNum, borrowedNum, writeContract]);

  if (!hasVault) return null;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Vault
        </h3>
      </div>

      <div className="p-5 space-y-4">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[9px] uppercase tracking-wider text-[#666] font-medium">Total Assets</div>
            <div className="text-sm font-bold text-white mono mt-1">${assetsNum.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[9px] uppercase tracking-wider text-[#666] font-medium">Borrowed</div>
            <div className="text-sm font-bold text-[#f59e0b] mono mt-1">${borrowedNum.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[9px] uppercase tracking-wider text-[#666] font-medium">Available</div>
            <div className="text-sm font-bold text-[#00ff88] mono mt-1">${availableNum.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[9px] uppercase tracking-wider text-[#666] font-medium">Utilization</div>
            <div className="text-sm font-bold text-white mono mt-1">{utilPct.toFixed(1)}%</div>
          </div>
        </div>

        {/* User's position */}
        {isConnected && userSharesNum > 0 && (
          <div className="rounded-lg bg-[#3b82f6]/5 border border-[#3b82f6]/20 p-3">
            <div className="flex justify-between text-xs">
              <span className="text-[#666]">Your Shares</span>
              <span className="text-white mono font-medium">{userSharesNum.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-[#666]">Max Withdraw</span>
              <span className="text-[#00ff88] mono font-medium">${maxWithdrawNum.toFixed(4)}</span>
            </div>
          </div>
        )}

        {/* Withdraw */}
        {isConnected && (
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[#666] font-medium">Withdraw USDC.e</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-xs">$</span>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full input-dark pl-7 pr-3 py-2.5 text-xs mono"
                  step="0.01"
                  min="0"
                />
              </div>
              <button
                onClick={() => setWithdrawAmount(maxWithdrawNum.toFixed(6))}
                className="text-[10px] text-[#00ff88] hover:text-[#33ffaa] font-medium px-2 transition-colors"
              >
                MAX
              </button>
              <button
                onClick={handleWithdraw}
                disabled={isPending || isTxLoading || !withdrawAmount}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 hover:bg-[#3b82f6]/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {isPending || isTxLoading ? (<><div className="spinner-sm" /> ...</>) : "Withdraw"}
              </button>
            </div>

            {/* Status messages */}
            {withdrawError && (
              <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2 text-[11px] text-red-400">{withdrawError}</div>
            )}
            {writeError && (
              <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2 text-[11px] text-red-400">
                {writeError.message?.includes("exceeds") ? "Amount exceeds available vault liquidity. Try a smaller amount or use MAX." : writeError.message?.slice(0, 120) || "Transaction failed"}
              </div>
            )}
            {isTxSuccess && (
              <div className="rounded-lg bg-[#00ff88]/5 border border-[#00ff88]/20 px-3 py-2 text-[11px] text-[#00ff88]">
                Withdrawal successful via {withdrawMethod}!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
