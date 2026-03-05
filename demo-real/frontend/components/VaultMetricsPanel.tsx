"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { polygon } from "wagmi/chains";
import { formatUnits, parseUnits } from "viem";
import { getContractAddresses, VAULT_ABI } from "@/lib/contracts";

const addresses = getContractAddresses();
const ZERO = "0x0000000000000000000000000000000000000000";
const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;

// Separate ABIs to avoid viem overload confusion
const VAULT_WITHDRAW_1ARG = [
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
] as const;

const VAULT_WITHDRAW_3ARG = [
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
] as const;

const VAULT_REDEEM = [
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
] as const;

interface VaultMetricsPanelProps {
  totalAssets?: bigint;
  totalBorrowed?: bigint;
  utilizationBps?: bigint;
  borrowApr?: bigint;
  insuranceBal?: bigint;
  protocolBal?: bigint;
}

export default function VaultMetricsPanel(props: VaultMetricsPanelProps) {
  const { address, isConnected } = useAccount();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  // Self-fetch vault data if not passed as props
  const { data: selfVaultData } = useReadContracts({
    contracts:
      hasVault && !props.totalAssets
        ? [
            { address: addresses.vault as `0x${string}`, abi: VAULT_ABI, functionName: "totalAssets", chainId: polygon.id },
            { address: addresses.vault as `0x${string}`, abi: VAULT_ABI, functionName: "totalBorrowed", chainId: polygon.id },
            { address: addresses.vault as `0x${string}`, abi: VAULT_ABI, functionName: "utilization", chainId: polygon.id },
            { address: addresses.vault as `0x${string}`, abi: VAULT_ABI, functionName: "insuranceBalance", chainId: polygon.id },
            { address: addresses.vault as `0x${string}`, abi: VAULT_ABI, functionName: "protocolBalance", chainId: polygon.id },
          ]
        : [],
    query: { refetchInterval: 5000 },
  });

  // Use props if provided, else use self-fetched data
  const totalAssets = props.totalAssets ?? (selfVaultData?.[0]?.result as bigint | undefined);
  const totalBorrowed = props.totalBorrowed ?? (selfVaultData?.[1]?.result as bigint | undefined);
  const utilizationBps = props.utilizationBps ?? (selfVaultData?.[2]?.result as bigint | undefined);
  const insuranceBal = props.insuranceBal ?? (selfVaultData?.[3]?.result as bigint | undefined);
  const protocolBal = props.protocolBal ?? (selfVaultData?.[4]?.result as bigint | undefined);

  const assetsNum = totalAssets ? parseFloat(formatUnits(totalAssets, 6)) : 0;
  const borrowedNum = totalBorrowed ? parseFloat(formatUnits(totalBorrowed, 6)) : 0;
  const availableNum = assetsNum - borrowedNum;
  const utilPct = utilizationBps ? Number(utilizationBps) / 100 : 0;
  const insuranceNum = insuranceBal ? parseFloat(formatUnits(insuranceBal, 6)) : 0;
  const protocolNum = protocolBal ? parseFloat(formatUnits(protocolBal, 6)) : 0;

  // Read user's maxWithdraw
  const { data: maxWithdrawRaw, refetch: refetchMaxW } = useReadContract({
    address: hasVault ? (addresses.vault as `0x${string}`) : undefined,
    abi: VAULT_ABI,
    functionName: "maxWithdraw",
    args: address ? [address] : undefined,
    chainId: polygon.id,
    query: { refetchInterval: 5000 },
  });

  // Read user's maxRedeem
  const { data: maxRedeemRaw } = useReadContract({
    address: hasVault ? (addresses.vault as `0x${string}`) : undefined,
    abi: VAULT_ABI,
    functionName: "maxRedeem",
    args: address ? [address] : undefined,
    chainId: polygon.id,
    query: { refetchInterval: 5000 },
  });

  // Read user's vault shares
  const { data: userSharesRaw } = useReadContract({
    address: hasVault ? (addresses.vault as `0x${string}`) : undefined,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: polygon.id,
    query: { refetchInterval: 5000 },
  });

  const maxWithdrawNum = maxWithdrawRaw ? parseFloat(formatUnits(maxWithdrawRaw as bigint, 6)) : 0;
  const userSharesNum = userSharesRaw ? parseFloat(formatUnits(userSharesRaw as bigint, 6)) : 0;

  const { writeContractAsync, isPending } = useWriteContract();

  const handleWithdraw = useCallback(async () => {
    if (!address || !hasVault) return;
    setWithdrawError(null);
    setWithdrawSuccess(false);

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError("Enter a valid amount");
      return;
    }

    if (amount > maxWithdrawNum) {
      setWithdrawError(`Max withdrawable: $${maxWithdrawNum.toFixed(4)}. Vault may have insufficient idle liquidity.`);
      return;
    }

    const assets = parseUnits(amount.toFixed(6), 6);

    // Strategy 1: Try 1-arg withdraw(usdcAmount) with separate ABI
    try {
      await writeContractAsync({
        address: addresses.vault as `0x${string}`,
        abi: VAULT_WITHDRAW_1ARG,
        functionName: "withdraw",
        args: [assets],
        chainId: polygon.id,
      });
      setWithdrawSuccess(true);
      setWithdrawAmount("");
      refetchMaxW();
      setTimeout(() => setWithdrawSuccess(false), 5000);
      return;
    } catch (err1) {
      console.warn("[VaultMetrics] 1-arg withdraw failed:", err1);
    }

    // Strategy 2: Try 3-arg withdraw(assets, receiver, owner)
    try {
      await writeContractAsync({
        address: addresses.vault as `0x${string}`,
        abi: VAULT_WITHDRAW_3ARG,
        functionName: "withdraw",
        args: [assets, address, address],
        chainId: polygon.id,
      });
      setWithdrawSuccess(true);
      setWithdrawAmount("");
      refetchMaxW();
      setTimeout(() => setWithdrawSuccess(false), 5000);
      return;
    } catch (err2) {
      console.warn("[VaultMetrics] 3-arg withdraw failed:", err2);
    }

    // Strategy 3: Fallback to redeem
    try {
      if (maxRedeemRaw && (maxRedeemRaw as bigint) > BigInt(0)) {
        await writeContractAsync({
          address: addresses.vault as `0x${string}`,
          abi: VAULT_REDEEM,
          functionName: "redeem",
          args: [maxRedeemRaw as bigint, address, address],
          chainId: polygon.id,
        });
        setWithdrawSuccess(true);
        setWithdrawAmount("");
        refetchMaxW();
        setTimeout(() => setWithdrawSuccess(false), 5000);
        return;
      }
    } catch (err3) {
      console.error("[VaultMetrics] redeem failed:", err3);
    }

    setWithdrawError("All withdraw methods failed. The vault may have insufficient idle liquidity.");
  }, [address, withdrawAmount, maxWithdrawNum, maxRedeemRaw, writeContractAsync, refetchMaxW]);

  if (!hasVault) return null;

  return (
    <div className="rounded-2xl border border-emerald-900/30 bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-emerald-900/20">
        <h3 className="text-sm font-semibold text-white">Vault</h3>
      </div>

      <div className="p-5 space-y-4">
        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[9px] uppercase tracking-wider text-gray-600 font-medium">Total Assets</div>
            <div className="text-sm font-bold text-white font-mono mt-1">${assetsNum.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[9px] uppercase tracking-wider text-gray-600 font-medium">Borrowed</div>
            <div className="text-sm font-bold text-yellow-400 font-mono mt-1">${borrowedNum.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[9px] uppercase tracking-wider text-gray-600 font-medium">Available</div>
            <div className="text-sm font-bold text-emerald-400 font-mono mt-1">${availableNum.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[9px] uppercase tracking-wider text-gray-600 font-medium">Utilization</div>
            <div className="text-sm font-bold text-white font-mono mt-1">{utilPct.toFixed(1)}%</div>
          </div>
        </div>

        {/* Additional metrics */}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <div className="text-gray-600">Insurance</div>
            <div className="text-white font-mono">${insuranceNum.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-600">Protocol</div>
            <div className="text-white font-mono">${protocolNum.toFixed(2)}</div>
          </div>
        </div>

        {/* User's position */}
        {isConnected && userSharesNum > 0 && (
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Your Shares</span>
              <span className="text-white font-mono font-medium">{userSharesNum.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Max Withdraw</span>
              <span className="text-emerald-400 font-mono font-medium">${maxWithdrawNum.toFixed(4)}</span>
            </div>
          </div>
        )}

        {/* Withdraw */}
        {isConnected && (
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">
              Withdraw USDC.e
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-7 pr-3 py-2.5 text-xs font-mono text-white placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none transition"
                  step="0.01"
                  min="0"
                />
              </div>
              <button
                onClick={() => setWithdrawAmount(maxWithdrawNum.toFixed(6))}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium px-2 transition-colors"
              >
                MAX
              </button>
              <button
                onClick={handleWithdraw}
                disabled={isPending || !withdrawAmount}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isPending ? (
                  <>
                    <div className="spinner" style={{ width: 14, height: 14 }} />
                    ...
                  </>
                ) : (
                  "Withdraw"
                )}
              </button>
            </div>

            {/* Status messages */}
            {withdrawError && (
              <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2 text-[11px] text-red-400">
                {withdrawError}
              </div>
            )}
            {withdrawSuccess && (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 text-[11px] text-emerald-400">
                Withdrawal successful!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
