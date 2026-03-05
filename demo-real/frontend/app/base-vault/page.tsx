"use client";

import { useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import TxButton from "@/components/TxButton";
import { useAccount, useBalance, useReadContracts, useWriteContract } from "wagmi";
import { polygon } from "wagmi/chains";
import { formatUnits, parseUnits } from "viem";
import { getContractAddresses, VAULT_ABI } from "@/lib/contracts";

const USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const USDC_E_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

// Separate ABI for the 1-arg withdraw to avoid overload confusion
const VAULT_WITHDRAW_1ARG_ABI = [
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
] as const;

// Separate ABI for the 3-arg withdraw (ERC-4626 style)
const VAULT_WITHDRAW_3ARG_ABI = [
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

// Separate ABI for redeem (fallback)
const VAULT_REDEEM_ABI = [
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

const addresses = getContractAddresses();
const ZERO = "0x0000000000000000000000000000000000000000";
const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;

function fmt(val: bigint | undefined, decimals = 6, dp = 2): string {
  if (val == null) return "—";
  return parseFloat(formatUnits(val, decimals)).toFixed(dp);
}

function fmtPct(bps: bigint | undefined): string {
  if (bps == null) return "—";
  return (Number(bps) / 100).toFixed(1) + "%";
}

export default function BaseVaultPage() {
  const { address, isConnected, chain } = useAccount();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [txStatus, setTxStatus] = useState<string>("");

  const isPolygon = chain?.id === polygon.id;

  // Balances
  const { data: usdcBalance, refetch: refetchBalance } = useBalance({
    address,
    token: USDC_E as `0x${string}`,
    chainId: polygon.id,
  });

  // Vault data
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

  // User vault shares
  const { data: userShares } = useReadContracts({
    contracts: hasVault && address
      ? [
          { address: addresses.vault, abi: VAULT_ABI, functionName: "balanceOf", args: [address], chainId: polygon.id },
          { address: addresses.vault, abi: VAULT_ABI, functionName: "maxWithdraw", args: [address], chainId: polygon.id },
          { address: addresses.vault, abi: VAULT_ABI, functionName: "maxRedeem", args: [address], chainId: polygon.id },
        ]
      : [],
    query: { refetchInterval: 5000 },
  });

  // Allowance
  const { data: allowanceData, refetch: refetchAllowance } = useReadContracts({
    contracts: address && hasVault
      ? [{ address: USDC_E as `0x${string}`, abi: USDC_E_ABI, functionName: "allowance", args: [address, addresses.vault], chainId: polygon.id }]
      : [],
    query: { refetchInterval: 5000 },
  });

  const totalAssets = vaultData?.[0]?.result as bigint | undefined;
  const totalBorrowed = vaultData?.[1]?.result as bigint | undefined;
  const utilizationBps = vaultData?.[2]?.result as bigint | undefined;
  const insuranceBal = vaultData?.[3]?.result as bigint | undefined;
  const protocolBal = vaultData?.[4]?.result as bigint | undefined;

  const shares = userShares?.[0]?.result as bigint | undefined;
  const maxWithdraw = userShares?.[1]?.result as bigint | undefined;
  const maxRedeem = userShares?.[2]?.result as bigint | undefined;
  const currentAllowance = allowanceData?.[0]?.result as bigint | undefined;

  const walletBalance = usdcBalance ? parseFloat(formatUnits(usdcBalance.value, usdcBalance.decimals)) : 0;
  const maxWithdrawNum = maxWithdraw ? parseFloat(formatUnits(maxWithdraw, 6)) : 0;

  // Write contract hooks
  const { writeContractAsync, isPending } = useWriteContract();

  const refetchAll = useCallback(() => {
    refetchBalance();
    refetchVault();
    refetchAllowance();
  }, [refetchBalance, refetchVault, refetchAllowance]);

  const handleApprove = async () => {
    if (!address || !hasVault) return;
    setTxStatus("Approving USDC.e...");
    try {
      await writeContractAsync({
        address: USDC_E as `0x${string}`,
        abi: USDC_E_ABI,
        functionName: "approve",
        args: [addresses.vault, parseUnits("1000000", 6)],
        chainId: polygon.id,
      });
      setTxStatus("Approval confirmed!");
      refetchAll();
      setTimeout(() => setTxStatus(""), 3000);
    } catch (err) {
      setTxStatus(`Approval failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  };

  const handleDeposit = async () => {
    if (!address || !hasVault || !depositAmount) return;
    const amount = parseUnits(depositAmount, 6);

    // Check allowance
    if (currentAllowance != null && currentAllowance < amount) {
      setTxStatus("Need approval first...");
      await handleApprove();
    }

    setTxStatus("Depositing...");
    try {
      await writeContractAsync({
        address: addresses.vault as `0x${string}`,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [amount],
        chainId: polygon.id,
      });
      setTxStatus("Deposit confirmed!");
      setDepositAmount("");
      refetchAll();
      setTimeout(() => setTxStatus(""), 3000);
    } catch (err) {
      setTxStatus(`Deposit failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  };

  const handleWithdraw = async () => {
    if (!address || !hasVault || !withdrawAmount) return;
    const amount = parseUnits(withdrawAmount, 6);
    setTxStatus("Withdrawing...");

    // Strategy 1: Try 1-arg withdraw(usdcAmount) — uses separate ABI to avoid overload confusion
    try {
      await writeContractAsync({
        address: addresses.vault as `0x${string}`,
        abi: VAULT_WITHDRAW_1ARG_ABI,
        functionName: "withdraw",
        args: [amount],
        chainId: polygon.id,
      });
      setTxStatus("Withdrawal confirmed!");
      setWithdrawAmount("");
      refetchAll();
      setTimeout(() => setTxStatus(""), 3000);
      return;
    } catch (err1) {
      console.warn("[vault] 1-arg withdraw failed, trying 3-arg:", err1);
    }

    // Strategy 2: Try 3-arg withdraw(assets, receiver, owner)
    try {
      setTxStatus("Trying alternative withdraw method...");
      await writeContractAsync({
        address: addresses.vault as `0x${string}`,
        abi: VAULT_WITHDRAW_3ARG_ABI,
        functionName: "withdraw",
        args: [amount, address, address],
        chainId: polygon.id,
      });
      setTxStatus("Withdrawal confirmed!");
      setWithdrawAmount("");
      refetchAll();
      setTimeout(() => setTxStatus(""), 3000);
      return;
    } catch (err2) {
      console.warn("[vault] 3-arg withdraw failed, trying redeem:", err2);
    }

    // Strategy 3: Fallback to redeem(shares, receiver, owner)
    // Convert amount to shares using convertToShares or use maxRedeem
    try {
      setTxStatus("Trying redeem fallback...");
      if (maxRedeem && maxRedeem > BigInt(0)) {
        // If user wants to withdraw all, use maxRedeem
        const redeemShares = amount >= (maxWithdraw || BigInt(0)) ? maxRedeem : amount;
        await writeContractAsync({
          address: addresses.vault as `0x${string}`,
          abi: VAULT_REDEEM_ABI,
          functionName: "redeem",
          args: [redeemShares, address, address],
          chainId: polygon.id,
        });
        setTxStatus("Withdrawal (via redeem) confirmed!");
        setWithdrawAmount("");
        refetchAll();
        setTimeout(() => setTxStatus(""), 3000);
        return;
      }
    } catch (err3) {
      console.error("[vault] redeem also failed:", err3);
    }

    setTxStatus("Withdrawal failed: All methods failed. The vault may have insufficient idle liquidity (funds are borrowed). Try a smaller amount.");
  };

  const utilPct = utilizationBps != null ? Number(utilizationBps) / 100 : 0;
  const utilColor = utilPct > 80 ? "text-red-400" : utilPct > 50 ? "text-[#f59e0b]" : "text-[#00ff88]";
  const utilBarColor = utilPct > 80 ? "bg-red-400" : utilPct > 50 ? "bg-[#f59e0b]" : "bg-[#00ff88]";

  return (
    <div className="min-h-screen bg-terminal-gradient">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Polygon Vault</h1>
          <p className="text-[#666] text-sm">Deposit USDC.e to earn yield from leveraged trading fees and borrow interest.</p>
        </div>

        {/* Network Guard */}
        {isConnected && !isPolygon && (
          <div className="mb-6 rounded-xl bg-[#f59e0b]/5 border border-[#f59e0b]/20 px-5 py-4 text-sm text-[#f59e0b]">
            Please switch to Polygon network to interact with the vault.
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Vault Stats */}
          <div className="lg:col-span-1 space-y-5">
            {/* TVL Card */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <div className="text-[10px] uppercase tracking-wider text-[#666] font-medium mb-1">Total Value Locked</div>
                <div className="text-3xl font-bold text-white mono">${fmt(totalAssets)}</div>
              </div>

              {/* Utilization */}
              <div className="px-5 py-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#888]">Utilization</span>
                  <span className={`text-sm font-bold mono ${utilColor}`}>{fmtPct(utilizationBps)}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${utilBarColor}`} style={{ width: `${Math.min(utilPct, 100)}%` }} />
                </div>
              </div>

              {/* Stats */}
              <div className="divide-y divide-white/5">
                <div className="px-5 py-3 flex justify-between">
                  <span className="text-xs text-[#666]">Borrowed</span>
                  <span className="text-xs font-semibold text-white mono">${fmt(totalBorrowed)}</span>
                </div>
                <div className="px-5 py-3 flex justify-between">
                  <span className="text-xs text-[#666]">Available</span>
                  <span className="text-xs font-semibold text-[#00ff88] mono">
                    ${totalAssets != null && totalBorrowed != null ? fmt(totalAssets - totalBorrowed) : "—"}
                  </span>
                </div>
                <div className="px-5 py-3 flex justify-between">
                  <span className="text-xs text-[#666]">Insurance</span>
                  <span className="text-xs font-semibold text-white mono">${fmt(insuranceBal)}</span>
                </div>
                <div className="px-5 py-3 flex justify-between">
                  <span className="text-xs text-[#666]">Protocol</span>
                  <span className="text-xs font-semibold text-[#888] mono">${fmt(protocolBal)}</span>
                </div>
              </div>
            </div>

            {/* User Balance Card */}
            {isConnected && (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                  <div className="text-[10px] uppercase tracking-wider text-[#666] font-medium mb-1">Your Balance</div>
                </div>
                <div className="divide-y divide-white/5">
                  <div className="px-5 py-3 flex justify-between">
                    <span className="text-xs text-[#666]">Wallet USDC.e</span>
                    <span className="text-xs font-semibold text-white mono">${walletBalance.toFixed(2)}</span>
                  </div>
                  <div className="px-5 py-3 flex justify-between">
                    <span className="text-xs text-[#666]">Vault Shares</span>
                    <span className="text-xs font-semibold text-white mono">{shares ? formatUnits(shares, 6) : "0"}</span>
                  </div>
                  <div className="px-5 py-3 flex justify-between">
                    <span className="text-xs text-[#666]">Withdrawable</span>
                    <span className="text-xs font-semibold text-[#00ff88] mono">${maxWithdrawNum.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Deposit/Withdraw */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-white/5">
                <button
                  onClick={() => setActiveTab("deposit")}
                  className={`flex-1 py-4 text-sm font-semibold transition-all ${
                    activeTab === "deposit"
                      ? "text-[#00ff88] border-b-2 border-[#00ff88] bg-[#00ff88]/[0.03]"
                      : "text-[#666] hover:text-[#999]"
                  }`}
                >
                  Deposit
                </button>
                <button
                  onClick={() => setActiveTab("withdraw")}
                  className={`flex-1 py-4 text-sm font-semibold transition-all ${
                    activeTab === "withdraw"
                      ? "text-[#00ff88] border-b-2 border-[#00ff88] bg-[#00ff88]/[0.03]"
                      : "text-[#666] hover:text-[#999]"
                  }`}
                >
                  Withdraw
                </button>
              </div>

              <div className="p-6">
                {activeTab === "deposit" ? (
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] uppercase tracking-wider text-[#666] font-medium">Amount (USDC.e)</label>
                        <button
                          onClick={() => setDepositAmount(walletBalance.toFixed(2))}
                          className="text-[10px] text-[#00ff88] hover:text-[#33ffaa] font-medium transition-colors"
                        >
                          Max: ${walletBalance.toFixed(2)}
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555] text-sm">$</span>
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full input-dark pl-8 pr-4 py-3.5 text-sm mono"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>

                    <TxButton
                      onClick={handleDeposit}
                      loading={isPending}
                      disabled={!isConnected || !isPolygon || !depositAmount || parseFloat(depositAmount) <= 0 || parseFloat(depositAmount) > walletBalance}
                      className="w-full"
                    >
                      {!isConnected ? "Connect Wallet" : !isPolygon ? "Switch to Polygon" : "Deposit USDC.e"}
                    </TxButton>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] uppercase tracking-wider text-[#666] font-medium">Amount (USDC.e)</label>
                        <button
                          onClick={() => setWithdrawAmount(maxWithdrawNum.toFixed(2))}
                          className="text-[10px] text-[#00ff88] hover:text-[#33ffaa] font-medium transition-colors"
                        >
                          Max: ${maxWithdrawNum.toFixed(2)}
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555] text-sm">$</span>
                        <input
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full input-dark pl-8 pr-4 py-3.5 text-sm mono"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>

                    <TxButton
                      onClick={handleWithdraw}
                      loading={isPending}
                      disabled={!isConnected || !isPolygon || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > maxWithdrawNum}
                      variant="secondary"
                      className="w-full"
                    >
                      {!isConnected ? "Connect Wallet" : !isPolygon ? "Switch to Polygon" : "Withdraw USDC.e"}
                    </TxButton>
                  </div>
                )}

                {/* Status Message */}
                {txStatus && (
                  <div className={`mt-4 rounded-lg px-4 py-2.5 text-xs border ${
                    txStatus.includes("confirmed")
                      ? "bg-[#00ff88]/5 border-[#00ff88]/20 text-[#00ff88]"
                      : txStatus.includes("failed")
                      ? "bg-red-500/5 border-red-500/20 text-red-400"
                      : "bg-[#3b82f6]/5 border-[#3b82f6]/20 text-[#3b82f6]"
                  }`}>
                    {txStatus}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
