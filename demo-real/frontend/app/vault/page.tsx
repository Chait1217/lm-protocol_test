"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import StatCard from "@/components/StatCard";
import TxButton from "@/components/TxButton";
import WalletPortfolio from "@/components/WalletPortfolio";
import {
  getContractAddresses,
  MOCK_USDC_ABI,
  VAULT_ABI,
} from "@/lib/contracts";
import { formatUSDC, parseUSDC, bpsToPercent } from "@/lib/utils";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  Vault,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldCheck,
  Building2,
  BarChart3,
  Droplets,
  RefreshCw,
  Coins,
} from "lucide-react";

const addresses = getContractAddresses();

export default function VaultPage() {
  const { address, isConnected } = useAccount();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [actionLabel, setActionLabel] = useState("");

  // ─── Contract reads ────────────────────────────────────────────────
  const { data: vaultData, refetch: refetchVault } = useReadContracts({
    contracts: [
      {
        address: addresses.vault,
        abi: VAULT_ABI,
        functionName: "totalAssets",
      },
      {
        address: addresses.vault,
        abi: VAULT_ABI,
        functionName: "totalBorrowed",
      },
      {
        address: addresses.vault,
        abi: VAULT_ABI,
        functionName: "utilization",
      },
      {
        address: addresses.vault,
        abi: VAULT_ABI,
        functionName: "insuranceBalance",
      },
      {
        address: addresses.vault,
        abi: VAULT_ABI,
        functionName: "protocolBalance",
      },
    ],
  });

  const totalAssets = vaultData?.[0]?.result as bigint | undefined;
  const totalBorrowed = vaultData?.[1]?.result as bigint | undefined;
  const utilizationBps = vaultData?.[2]?.result as bigint | undefined;
  const insuranceBal = vaultData?.[3]?.result as bigint | undefined;
  const protocolBal = vaultData?.[4]?.result as bigint | undefined;

  // User balances
  const { data: userUsdcBalance, refetch: refetchUsdc } = useReadContract({
    address: addresses.mockUsdc,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: addresses.vault,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: shareValue } = useReadContract({
    address: addresses.vault,
    abi: VAULT_ABI,
    functionName: "convertToAssets",
    args: userShares ? [userShares as bigint] : undefined,
  });

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: addresses.mockUsdc,
    abi: MOCK_USDC_ABI,
    functionName: "allowance",
    args: address ? [address, addresses.vault] : undefined,
  });

  // ─── Write contract ────────────────────────────────────────────────
  const { writeContract, isPending: isWritePending } = useWriteContract();

  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Refetch on tx success
  useEffect(() => {
    if (isTxSuccess) {
      refetchVault();
      refetchUsdc();
      refetchShares();
      refetchAllowance();
      setTxHash(undefined);
    }
  }, [isTxSuccess, refetchVault, refetchUsdc, refetchShares, refetchAllowance]);

  const isLoading = isWritePending || isTxConfirming;

  // ─── Actions ───────────────────────────────────────────────────────
  const handleFaucet = useCallback(() => {
    if (!address) return;
    setActionLabel("Minting test USDC...");
    writeContract(
      {
        address: addresses.mockUsdc,
        abi: MOCK_USDC_ABI,
        functionName: "faucet",
        args: [address, parseUSDC("1000")],
      },
      {
        onSuccess: (hash) => setTxHash(hash),
        onError: () => setActionLabel(""),
      }
    );
  }, [address, writeContract]);

  const handleApprove = useCallback(() => {
    setActionLabel("Approving USDC...");
    writeContract(
      {
        address: addresses.mockUsdc,
        abi: MOCK_USDC_ABI,
        functionName: "approve",
        args: [addresses.vault, parseUSDC("999999999")],
      },
      {
        onSuccess: (hash) => setTxHash(hash),
        onError: () => setActionLabel(""),
      }
    );
  }, [writeContract]);

  const handleDeposit = useCallback(() => {
    const amount = parseUSDC(depositAmount);
    if (amount === 0n) return;
    setActionLabel("Depositing USDC...");
    writeContract(
      {
        address: addresses.vault,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [amount],
      },
      {
        onSuccess: (hash) => {
          setTxHash(hash);
          setDepositAmount("");
        },
        onError: () => setActionLabel(""),
      }
    );
  }, [depositAmount, writeContract]);

  const handleWithdraw = useCallback(() => {
    const amount = parseUSDC(withdrawAmount);
    if (amount === 0n) return;
    setActionLabel("Withdrawing USDC...");
    writeContract(
      {
        address: addresses.vault,
        abi: VAULT_ABI,
        functionName: "withdraw",
        args: [amount],
      },
      {
        onSuccess: (hash) => {
          setTxHash(hash);
          setWithdrawAmount("");
        },
        onError: () => setActionLabel(""),
      }
    );
  }, [withdrawAmount, writeContract]);

  const needsApproval =
    usdcAllowance !== undefined && depositAmount
      ? (usdcAllowance as bigint) < parseUSDC(depositAmount)
      : false;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-neon/10 flex items-center justify-center">
                <Vault className="w-5 h-5 text-neon" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                USDC Vault
              </h1>
            </div>
            <p className="text-gray-400 text-sm">
              Deposit USDC to earn yield from borrow interest and trading fees
            </p>
          </div>
          <button
            onClick={() => {
              refetchVault();
              refetchUsdc();
              refetchShares();
            }}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total TVL"
            value={`$${formatUSDC(totalAssets)}`}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            highlight
          />
          <StatCard
            label="Total Borrowed"
            value={`$${formatUSDC(totalBorrowed)}`}
            icon={<ArrowUpFromLine className="w-3.5 h-3.5" />}
          />
          <StatCard
            label="Utilization"
            value={utilizationBps !== undefined ? bpsToPercent(utilizationBps) : "0%"}
            icon={<Droplets className="w-3.5 h-3.5" />}
          />
          <StatCard
            label="Available Liquidity"
            value={`$${formatUSDC(
              totalAssets !== undefined && totalBorrowed !== undefined
                ? totalAssets - totalBorrowed
                : undefined
            )}`}
            icon={<Coins className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Insurance + Protocol */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatCard
            label="Insurance Fund"
            value={`$${formatUSDC(insuranceBal)}`}
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
          />
          <StatCard
            label="Protocol Treasury"
            value={`$${formatUSDC(protocolBal)}`}
            icon={<Building2 className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Wallet Portfolio */}
        {isConnected && (
          <div className="mb-8">
            <WalletPortfolio />
          </div>
        )}

        {!isConnected ? (
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-12 text-center">
            <Vault className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-white font-semibold text-lg mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-gray-500 text-sm">
              Connect your wallet to deposit, withdraw, and view your positions
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: User Balances + Faucet */}
            <div className="space-y-4">
              {/* User Info */}
              <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-neon" />
                  Your Balances
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">USDC Balance</span>
                    <span className="text-white font-medium">
                      ${formatUSDC(userUsdcBalance as bigint | undefined)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Vault Shares</span>
                    <span className="text-white font-medium">
                      {formatUSDC(userShares as bigint | undefined)} lmUSDC
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Share Value</span>
                    <span className="text-neon font-medium">
                      ${formatUSDC(shareValue as bigint | undefined)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Faucet */}
              <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-6">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-400" />
                  Testnet Faucet
                </h3>
                <p className="text-gray-500 text-xs mb-4">
                  Mint 1,000 test USDC to your wallet
                </p>
                <TxButton
                  onClick={handleFaucet}
                  loading={isLoading && actionLabel.includes("Minting")}
                  variant="secondary"
                  className="w-full"
                >
                  Mint 1,000 USDC
                </TxButton>
              </div>
            </div>

            {/* Right: Deposit / Withdraw */}
            <div className="space-y-4">
              {/* Deposit */}
              <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <ArrowDownToLine className="w-4 h-4 text-neon" />
                  Deposit USDC
                </h3>
                <div className="mb-4">
                  <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-black/40 px-4 py-3">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="flex-1 bg-transparent text-white text-lg font-medium outline-none placeholder-gray-600"
                    />
                    <span className="text-gray-400 text-sm font-medium">
                      USDC
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setDepositAmount(
                        (Number(userUsdcBalance ?? 0n) / 1e6).toString()
                      )
                    }
                    className="text-neon/70 text-xs mt-1 hover:text-neon transition"
                  >
                    MAX
                  </button>
                </div>

                {needsApproval ? (
                  <TxButton
                    onClick={handleApprove}
                    loading={isLoading && actionLabel.includes("Approving")}
                    className="w-full"
                  >
                    Approve USDC
                  </TxButton>
                ) : (
                  <TxButton
                    onClick={handleDeposit}
                    loading={isLoading && actionLabel.includes("Depositing")}
                    disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                    className="w-full"
                  >
                    Deposit
                  </TxButton>
                )}
              </div>

              {/* Withdraw */}
              <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <ArrowUpFromLine className="w-4 h-4 text-orange-400" />
                  Withdraw USDC
                </h3>
                <div className="mb-4">
                  <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-black/40 px-4 py-3">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="flex-1 bg-transparent text-white text-lg font-medium outline-none placeholder-gray-600"
                    />
                    <span className="text-gray-400 text-sm font-medium">
                      USDC
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setWithdrawAmount(
                        (Number(shareValue ?? 0n) / 1e6).toString()
                      )
                    }
                    className="text-orange-400/70 text-xs mt-1 hover:text-orange-400 transition"
                  >
                    MAX
                  </button>
                </div>
                <TxButton
                  onClick={handleWithdraw}
                  loading={isLoading && actionLabel.includes("Withdrawing")}
                  disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0}
                  variant="secondary"
                  className="w-full"
                >
                  Withdraw
                </TxButton>
              </div>
            </div>
          </div>
        )}

        {/* Tx Status */}
        {(isLoading || isTxSuccess) && (
          <div
            className={`mt-6 rounded-xl border p-4 text-sm ${
              isTxSuccess
                ? "border-neon/30 bg-neon/5 text-neon"
                : "border-yellow-500/30 bg-yellow-500/5 text-yellow-400"
            }`}
          >
            {isTxConfirming
              ? `Confirming: ${actionLabel}`
              : isTxSuccess
              ? "Transaction confirmed!"
              : actionLabel}
          </div>
        )}
      </main>
    </>
  );
}
