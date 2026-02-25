"use client";

/**
 * /base-vault – Deposit/withdraw USDC.e on Polygon PoS mainnet (real funds).
 * Shows vault TVL, totalBorrowed, utilization, insurance, protocol balances.
 * Chain: Polygon PoS mainnet (137). Network guard prompts user to switch if on wrong chain.
 */
import { useState, useEffect, useCallback } from "react";
import { formatUnits, parseUnits } from "viem";
import Navbar from "@/components/Navbar";
import TxButton from "@/components/TxButton";
import { BASE_USDC_ADDRESS, BASE_VAULT_ADDRESS } from "@/lib/baseAddresses";
import { baseVaultAbi, erc20Abi } from "@/lib/abi";
import {
  useAccount,
  useBlockNumber,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import {
  Vault,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Droplets,
  ShieldCheck,
  Building2,
} from "lucide-react";

const POLYGON_CHAIN_ID = 137;
const USDC_DECIMALS = 6;
const LEGACY_BASE_VAULT_ADDRESS = "0xea6d70e05bf1b36eeb5b9c8d46048b2220fc976a";
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const VAULT_ASSET_ABI = [
  {
    name: "asset",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

function fmtUSDC(value: bigint | undefined): string {
  if (value === undefined) return "0.000000";
  const n = Number(formatUnits(value, USDC_DECIMALS));
  return n.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

function parseUSDC(amount: string): bigint {
  const num = parseFloat(amount);
  if (isNaN(num) || num < 0) return BigInt(0);
  try {
    return parseUnits(num.toFixed(USDC_DECIMALS), USDC_DECIMALS);
  } catch {
    return BigInt(0);
  }
}

function bpsToPercent(bps: bigint | undefined): string {
  if (bps === undefined) return "0.00%";
  return (Number(bps) / 100).toFixed(2) + "%";
}

export default function BaseVaultPage() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [actionLabel, setActionLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingApprovalFor, setPendingApprovalFor] = useState<bigint>(BigInt(0));
  const [approvedAmountLocal, setApprovedAmountLocal] = useState<bigint>(BigInt(0));

  const isWrongNetwork = isConnected && chain?.id !== POLYGON_CHAIN_ID;
  const { data: latestBlock } = useBlockNumber({ chainId: POLYGON_CHAIN_ID, watch: true });
  const isLegacyBaseVaultConfigured =
    BASE_VAULT_ADDRESS.toLowerCase() === LEGACY_BASE_VAULT_ADDRESS;
  const isVaultAddressInvalid = !ADDRESS_REGEX.test(BASE_VAULT_ADDRESS);

  // ─── Vault reads (TVL, borrowed, util, insurance, protocol) ──────
  const { data: vaultData, refetch: refetchVault } = useReadContracts({
    contracts: [
      { address: BASE_VAULT_ADDRESS, abi: baseVaultAbi, functionName: "totalAssets", chainId: POLYGON_CHAIN_ID },
      { address: BASE_VAULT_ADDRESS, abi: baseVaultAbi, functionName: "totalBorrowed", chainId: POLYGON_CHAIN_ID },
      { address: BASE_VAULT_ADDRESS, abi: baseVaultAbi, functionName: "utilization", chainId: POLYGON_CHAIN_ID },
      { address: BASE_VAULT_ADDRESS, abi: baseVaultAbi, functionName: "insuranceBalance", chainId: POLYGON_CHAIN_ID },
      { address: BASE_VAULT_ADDRESS, abi: baseVaultAbi, functionName: "protocolBalance", chainId: POLYGON_CHAIN_ID },
    ],
    query: { refetchInterval: 5000 },
  });

  const totalAssets    = vaultData?.[0]?.result as bigint | undefined;
  const totalBorrowed  = vaultData?.[1]?.result as bigint | undefined;
  const utilizationBps = vaultData?.[2]?.result as bigint | undefined;
  const insuranceBal   = vaultData?.[3]?.result as bigint | undefined;
  const protocolBal    = vaultData?.[4]?.result as bigint | undefined;

  // Read the actual token accepted by the vault to avoid env mismatches.
  const { data: vaultAssetAddress } = useReadContract({
    address: BASE_VAULT_ADDRESS,
    abi: VAULT_ASSET_ABI,
    functionName: "asset",
    chainId: POLYGON_CHAIN_ID,
  });
  const depositTokenAddress = (vaultAssetAddress as `0x${string}` | undefined) ?? BASE_USDC_ADDRESS;
  const isDepositTokenMismatch =
    (vaultAssetAddress as string | undefined)?.toLowerCase() !== undefined &&
    (vaultAssetAddress as string).toLowerCase() !== BASE_USDC_ADDRESS.toLowerCase();

  // ─── User reads ──────────────────────────────────────────────────
  const { data: userUsdcBalance, refetch: refetchUsdc } = useReadContract({
    address: depositTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: POLYGON_CHAIN_ID,
    query: { refetchInterval: 5000 },
  });

  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: BASE_VAULT_ADDRESS,
    abi: baseVaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: POLYGON_CHAIN_ID,
    query: { refetchInterval: 5000 },
  });

  const { data: shareValue } = useReadContract({
    address: BASE_VAULT_ADDRESS,
    abi: baseVaultAbi,
    functionName: "convertToAssets",
    args: userShares !== undefined ? [userShares as bigint] : undefined,
    chainId: POLYGON_CHAIN_ID,
  });

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: depositTokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, BASE_VAULT_ADDRESS] : undefined,
    chainId: POLYGON_CHAIN_ID,
  });

  // ─── Write ───────────────────────────────────────────────────────
  const { writeContract, isPending: isWritePending } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess, isError: isTxError, error: txError } =
    useWaitForTransactionReceipt({ hash: txHash, chainId: POLYGON_CHAIN_ID });

  const refetchAll = useCallback(() => {
    refetchVault();
    refetchUsdc();
    refetchShares();
    refetchAllowance();
  }, [refetchVault, refetchUsdc, refetchShares, refetchAllowance]);

  useEffect(() => {
    if (isTxSuccess) {
      // If approve tx confirmed, allow deposit flow immediately even if allowance read lags.
      if (actionLabel.includes("Approving") && pendingApprovalFor > BigInt(0)) {
        setApprovedAmountLocal((prev) => (prev > pendingApprovalFor ? prev : pendingApprovalFor));
        setPendingApprovalFor(BigInt(0));
      }
      refetchAll();
      setTxHash(undefined);
      setActionLabel("");
      setErrorMessage("");
    }
  }, [isTxSuccess, refetchAll, actionLabel, pendingApprovalFor]);

  // Keep wallet-sensitive reads fresh on each new block.
  useEffect(() => {
    if (!isConnected || !address || isWrongNetwork) return;
    refetchVault();
    refetchUsdc();
    refetchAllowance();
    refetchShares();
  }, [latestBlock, isConnected, address, isWrongNetwork, refetchVault, refetchUsdc, refetchAllowance, refetchShares]);

  // Refresh when user returns to the tab/window (common after funding from wallet app).
  useEffect(() => {
    const onFocus = () => refetchAll();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refetchAll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refetchAll]);

  useEffect(() => {
    if (isTxError && txHash) {
      setErrorMessage(txError?.message ?? "Transaction failed or reverted");
      setActionLabel("");
      setPendingApprovalFor(BigInt(0));
      setTxHash(undefined);
    }
  }, [isTxError, txError, txHash]);

  const isLoading = isWritePending || isTxConfirming;

  // ─── Handlers ────────────────────────────────────────────────────
  const handleApprove = useCallback(() => {
    setErrorMessage("");
    const amount = parseUSDC(depositAmount);
    if (amount === BigInt(0)) return;
    if (userUsdcBalance !== undefined && amount > (userUsdcBalance as bigint)) {
      setErrorMessage("Insufficient USDC balance for this amount.");
      return;
    }
    setActionLabel("Approving USDC...");
    setPendingApprovalFor(amount);
    writeContract(
      { address: depositTokenAddress, abi: erc20Abi, functionName: "approve", args: [BASE_VAULT_ADDRESS, amount], chainId: POLYGON_CHAIN_ID },
      {
        onSuccess: (hash) => setTxHash(hash),
        onError: (e) => {
          setPendingApprovalFor(BigInt(0));
          setActionLabel("");
          setErrorMessage(e?.message ?? "Approval failed");
        },
      }
    );
  }, [depositAmount, writeContract, userUsdcBalance, depositTokenAddress]);

  const handleDeposit = useCallback(() => {
    setErrorMessage("");
    const amount = parseUSDC(depositAmount);
    if (amount === BigInt(0)) return;
    if (userUsdcBalance !== undefined && amount > (userUsdcBalance as bigint)) {
      setErrorMessage("Insufficient USDC balance for this amount.");
      return;
    }
    setActionLabel("Depositing USDC...");
    writeContract(
      { address: BASE_VAULT_ADDRESS, abi: baseVaultAbi, functionName: "deposit", args: [amount], chainId: POLYGON_CHAIN_ID },
      { onSuccess: (hash) => { setTxHash(hash); setDepositAmount(""); }, onError: (e) => { setActionLabel(""); setErrorMessage(e?.message ?? "Deposit failed"); } }
    );
  }, [depositAmount, writeContract, userUsdcBalance]);

  const handleWithdraw = useCallback(() => {
    setErrorMessage("");
    const amount = parseUSDC(withdrawAmount);
    if (amount === BigInt(0)) return;
    setActionLabel("Withdrawing USDC...");
    writeContract(
      { address: BASE_VAULT_ADDRESS, abi: baseVaultAbi, functionName: "withdraw", args: [amount], chainId: POLYGON_CHAIN_ID },
      { onSuccess: (hash) => { setTxHash(hash); setWithdrawAmount(""); }, onError: (e) => { setActionLabel(""); setErrorMessage(e?.message ?? "Withdraw failed"); } }
    );
  }, [withdrawAmount, writeContract]);

  const depositParsed = depositAmount !== "" ? parseUSDC(depositAmount) : BigInt(0);
  const allowanceOnchain = (usdcAllowance as bigint | undefined) ?? BigInt(0);
  const effectiveAllowance = allowanceOnchain > approvedAmountLocal ? allowanceOnchain : approvedAmountLocal;
  const needsApproval = depositAmount !== "" && effectiveAllowance < depositParsed;
  const hasInsufficientUsdc =
    depositAmount !== "" && userUsdcBalance !== undefined && depositParsed > (userUsdcBalance as bigint);
  const maxDepositExact =
    userUsdcBalance != null ? formatUnits(userUsdcBalance as bigint, USDC_DECIMALS) : "";

  const clampDepositInput = useCallback(
    (raw: string) => {
      if (raw === "") return "";
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return "";
      const parsed = parseUSDC(String(n));
      if (userUsdcBalance != null && parsed > (userUsdcBalance as bigint)) {
        return maxDepositExact;
      }
      return raw;
    },
    [userUsdcBalance, maxDepositExact]
  );

  const availableLiquidity =
    totalAssets !== undefined && totalBorrowed !== undefined ? totalAssets - totalBorrowed : undefined;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Warning */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm">
            This vault is on <strong>Polygon PoS</strong> and uses <strong>real USDC.e</strong>. Use only small amounts for testing.
          </p>
        </div>

        {isLegacyBaseVaultConfigured && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <p className="text-sm">
              Misconfiguration detected: <code>NEXT_PUBLIC_VAULT_ADDRESS</code> is set to the legacy Base vault.
              Update it to your Polygon vault address in <code>frontend/.env.local</code> and restart the app.
            </p>
          </div>
        )}
        {isVaultAddressInvalid && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <p className="text-sm">
              Invalid <code>NEXT_PUBLIC_VAULT_ADDRESS</code> in <code>frontend/.env.local</code>. Make sure it is a
              valid Polygon vault address (0x + 40 hex chars), then restart the app.
            </p>
          </div>
        )}
        {isDepositTokenMismatch && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 p-4 text-orange-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
            <p className="text-sm">
              Token config mismatch: vault accepts <code>{String(vaultAssetAddress)}</code>, while env USDC is{" "}
              <code>{BASE_USDC_ADDRESS}</code>. Using vault token automatically for balance/approve/deposit.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon/10">
                <Vault className="h-5 w-5 text-neon" />
              </div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Polygon USDC.e Vault</h1>
            </div>
            <p className="text-sm text-gray-400">Deposit USDC.e on Polygon to earn yield from leveraged trading</p>
          </div>
          <button onClick={refetchAll} className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Vault Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400"><BarChart3 className="h-3.5 w-3.5" /> TVL</div>
            <p className="text-lg font-bold text-white">${fmtUSDC(totalAssets)}</p>
          </div>
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400"><ArrowUpFromLine className="h-3.5 w-3.5" /> Borrowed</div>
            <p className="text-lg font-bold text-white">${fmtUSDC(totalBorrowed)}</p>
          </div>
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400"><Droplets className="h-3.5 w-3.5" /> Utilization</div>
            <p className="text-lg font-bold text-white">{bpsToPercent(utilizationBps)}</p>
          </div>
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400"><Droplets className="h-3.5 w-3.5" /> Available</div>
            <p className="text-lg font-bold text-white">${fmtUSDC(availableLiquidity)}</p>
          </div>
        </div>

        {/* Insurance + Protocol */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400"><ShieldCheck className="h-3.5 w-3.5" /> Insurance</div>
            <p className="text-lg font-bold text-white">${fmtUSDC(insuranceBal)}</p>
          </div>
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400"><Building2 className="h-3.5 w-3.5" /> Protocol</div>
            <p className="text-lg font-bold text-white">${fmtUSDC(protocolBal)}</p>
          </div>
        </div>

        {/* Network guard */}
        {isWrongNetwork && (
          <div className="mb-8 rounded-2xl border border-orange-500/40 bg-orange-500/10 p-6 text-center">
            <p className="mb-4 text-orange-200">Please switch your wallet to Polygon PoS.</p>
            <TxButton onClick={() => switchChain?.({ chainId: POLYGON_CHAIN_ID })} variant="primary">Switch to Polygon</TxButton>
          </div>
        )}

        {!isConnected ? (
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-12 text-center">
            <Vault className="mx-auto mb-4 h-12 w-12 text-gray-600" />
            <h2 className="mb-2 text-lg font-semibold text-white">Connect Your Wallet</h2>
            <p className="text-sm text-gray-500">Connect to deposit or withdraw USDC.e on Polygon</p>
          </div>
        ) : !isWrongNetwork ? (
          <div className="space-y-6">
            {/* User balances */}
            <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
                <RefreshCw className="h-4 w-4 text-neon" /> Your Balances
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">USDC.e Balance</span>
                  <span className="font-medium text-white">${fmtUSDC(userUsdcBalance as bigint | undefined)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Vault shares (bUSDC)</span>
                  <span className="font-medium text-white">{fmtUSDC(userShares as bigint | undefined)} bUSDC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Share value</span>
                  <span className="font-medium text-neon">${fmtUSDC(shareValue as bigint | undefined)}</span>
                </div>
              </div>
            </div>

            {/* Deposit */}
            <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
                <ArrowDownToLine className="h-4 w-4 text-neon" /> Deposit USDC
              </h3>
              <div className="mb-4">
                <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-black/40 px-4 py-3">
                  <input type="number" placeholder="0.00" value={depositAmount} onChange={(e) => setDepositAmount(clampDepositInput(e.target.value))}
                    className="flex-1 bg-transparent text-lg font-medium text-white outline-none placeholder:text-gray-600" />
                  <span className="text-sm font-medium text-gray-400">USDC</span>
                </div>
                <button type="button" onClick={() => setDepositAmount(maxDepositExact)}
                  className="mt-1 text-xs text-neon/70 transition hover:text-neon">Use Max Available</button>
                <p className="mt-1 text-xs text-gray-500">Available in wallet: ${fmtUSDC(userUsdcBalance as bigint | undefined)}</p>
              </div>
              {needsApproval ? (
                <TxButton onClick={handleApprove} loading={isLoading && actionLabel.includes("Approving")} disabled={isLegacyBaseVaultConfigured || isVaultAddressInvalid || hasInsufficientUsdc} className="w-full">Approve USDC</TxButton>
              ) : (
                <TxButton onClick={handleDeposit} loading={isLoading && actionLabel.includes("Depositing")}
                  disabled={isLegacyBaseVaultConfigured || isVaultAddressInvalid || hasInsufficientUsdc || !depositAmount || parseFloat(depositAmount) <= 0} className="w-full">Deposit</TxButton>
              )}
              {hasInsufficientUsdc && (
                <p className="mt-2 text-xs text-red-300">Insufficient USDC balance for this deposit amount.</p>
              )}
            </div>

            {/* Withdraw */}
            <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
                <ArrowUpFromLine className="h-4 w-4 text-orange-400" /> Withdraw USDC
              </h3>
              <div className="mb-4">
                <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-black/40 px-4 py-3">
                  <input type="number" placeholder="0.00" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="flex-1 bg-transparent text-lg font-medium text-white outline-none placeholder:text-gray-600" />
                  <span className="text-sm font-medium text-gray-400">USDC</span>
                </div>
                <button type="button" onClick={() => setWithdrawAmount(shareValue != null ? formatUnits(shareValue as bigint, USDC_DECIMALS) : "")}
                  className="mt-1 text-xs text-orange-400/70 transition hover:text-orange-400">MAX</button>
              </div>
              <TxButton onClick={handleWithdraw} loading={isLoading && actionLabel.includes("Withdrawing")}
                disabled={isLegacyBaseVaultConfigured || isVaultAddressInvalid || !withdrawAmount || parseFloat(withdrawAmount) <= 0} variant="secondary" className="w-full">Withdraw</TxButton>
            </div>
          </div>
        ) : null}

        {/* Tx status */}
        {(isLoading || isTxSuccess) && (
          <div className={`mt-6 rounded-xl border p-4 text-sm ${isTxSuccess ? "border-neon/30 bg-neon/5 text-neon" : "border-yellow-500/30 bg-yellow-500/5 text-yellow-400"}`}>
            {isTxConfirming ? `Confirming: ${actionLabel}` : isTxSuccess ? "Transaction confirmed!" : actionLabel}
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{errorMessage}</div>
        )}
      </main>
    </>
  );
}
