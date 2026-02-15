"use client";

/**
 * /margin-trade – Open and close leveraged positions on Base mainnet.
 * Uses BaseMarginEngine + BaseVault with real USDC. Mock prices for PnL.
 * Chain: Base mainnet (8453).
 */
import { useState, useEffect, useCallback } from "react";
import { formatUnits, parseUnits, encodeFunctionData, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import Navbar from "@/components/Navbar";
import TxButton from "@/components/TxButton";
import {
  BASE_USDC_ADDRESS,
  BASE_VAULT_ADDRESS,
  BASE_MARGIN_ENGINE_ADDRESS,
} from "@/lib/baseAddresses";
import { baseVaultAbi, baseMarginEngineAbi, erc20Abi } from "@/lib/abi";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  ArrowUpFromLine,
  Droplets,
} from "lucide-react";

const BASE_CHAIN_ID = 8453;
const USDC_DECIMALS = 6;
const PRICE_DECIMALS = 6; // 1_000_000 = $1.00

function fmtUSDC(value: bigint | undefined): string {
  if (value === undefined) return "0.00";
  const n = Number(formatUnits(value, USDC_DECIMALS));
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseUSDC(amount: string): bigint {
  const num = parseFloat(amount);
  if (isNaN(num) || num < 0) return BigInt(0);
  try { return parseUnits(num.toFixed(USDC_DECIMALS), USDC_DECIMALS); } catch { return BigInt(0); }
}

function parsePrice(price: string): bigint {
  const num = parseFloat(price);
  if (isNaN(num) || num <= 0) return BigInt(0);
  try { return parseUnits(num.toFixed(PRICE_DECIMALS), PRICE_DECIMALS); } catch { return BigInt(0); }
}

function fmtPrice(value: bigint): string {
  return "$" + Number(formatUnits(value, PRICE_DECIMALS)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function bpsToPercent(bps: bigint | undefined): string {
  if (bps === undefined) return "0.00%";
  return (Number(bps) / 100).toFixed(2) + "%";
}

// Position type matching the ABI tuple
interface Position {
  owner: string;
  collateral: bigint;
  borrowed: bigint;
  notional: bigint;
  entryPriceMock: bigint;
  leverage: bigint;
  isLong: boolean;
  openTimestamp: bigint;
  isOpen: boolean;
}

export default function MarginTradePage() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();

  // ─── Open position form ─────────────────────────────────────────
  const [collateral, setCollateral] = useState("");
  const [leverage, setLeverage] = useState("2");
  const [isLong, setIsLong] = useState(true);
  const [entryPrice, setEntryPrice] = useState("100000");

  // ─── Close position form ────────────────────────────────────────
  const [closePositionId, setClosePositionId] = useState("");
  const [exitPrice, setExitPrice] = useState("");

  // ─── Tx state ───────────────────────────────────────────────────
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [actionLabel, setActionLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isWrongNetwork = isConnected && chain?.id !== BASE_CHAIN_ID;

  // ─── Vault reads ────────────────────────────────────────────────
  const { data: vaultData, refetch: refetchVault } = useReadContracts({
    contracts: [
      { address: BASE_VAULT_ADDRESS, abi: baseVaultAbi, functionName: "totalAssets" },
      { address: BASE_VAULT_ADDRESS, abi: baseVaultAbi, functionName: "totalBorrowed" },
      { address: BASE_VAULT_ADDRESS, abi: baseVaultAbi, functionName: "utilization" },
    ],
  });
  const totalAssets    = vaultData?.[0]?.result as bigint | undefined;
  const totalBorrowed  = vaultData?.[1]?.result as bigint | undefined;
  const utilizationBps = vaultData?.[2]?.result as bigint | undefined;

  // ─── User USDC balance + allowance to MarginEngine ──────────────
  const { data: userUsdcBalance, refetch: refetchUsdc } = useReadContract({
    address: BASE_USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: BASE_USDC_ADDRESS, abi: erc20Abi, functionName: "allowance",
    args: address ? [address, BASE_MARGIN_ENGINE_ADDRESS] : undefined,
  });

  // ─── User wallet borrowed ──────────────────────────────────────
  const { data: walletBorrowedRaw, refetch: refetchWalletBorrowed } = useReadContract({
    address: BASE_MARGIN_ENGINE_ADDRESS, abi: baseMarginEngineAbi, functionName: "walletBorrowed",
    args: address ? [address] : undefined,
  });

  // ─── Borrow APR ────────────────────────────────────────────────
  const { data: borrowAPR } = useReadContract({
    address: BASE_MARGIN_ENGINE_ADDRESS, abi: baseMarginEngineAbi, functionName: "borrowAPR",
  });

  // ─── User positions ────────────────────────────────────────────
  const { data: userPositionIds, refetch: refetchPositions } = useReadContract({
    address: BASE_MARGIN_ENGINE_ADDRESS, abi: baseMarginEngineAbi, functionName: "getUserPositions",
    args: address ? [address] : undefined,
  });

  // Read the last 5 positions for display
  const posIds = (userPositionIds as bigint[] | undefined) ?? [];
  const recentIds = posIds.slice(-5).reverse();

  const { data: positionDataArr, refetch: refetchPositionData } = useReadContracts({
    contracts: recentIds.map((id) => ({
      address: BASE_MARGIN_ENGINE_ADDRESS,
      abi: baseMarginEngineAbi,
      functionName: "getPosition" as const,
      args: [id],
    })),
  });

  // ─── Write ─────────────────────────────────────────────────────
  const { writeContract, isPending: isWritePending } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const refetchAll = useCallback(() => {
    refetchVault();
    refetchUsdc();
    refetchAllowance();
    refetchWalletBorrowed();
    refetchPositions();
    refetchPositionData();
  }, [refetchVault, refetchUsdc, refetchAllowance, refetchWalletBorrowed, refetchPositions, refetchPositionData]);

  useEffect(() => {
    if (isTxSuccess) {
      refetchAll();
      setTxHash(undefined);
      setErrorMessage("");
    }
  }, [isTxSuccess, refetchAll]);

  const isLoading = isWritePending || isTxConfirming;

  // ─── Handlers ──────────────────────────────────────────────────

  const handleApprove = useCallback(async () => {
    setErrorMessage("");
    const amount = parseUSDC(collateral);
    if (amount === BigInt(0)) return;
    if (!address) return;
    setActionLabel("Approving USDC to MarginEngine...");

    // Pre-estimate gas using our RPC
    let gasEstimate: bigint | undefined;
    try {
      const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://base-mainnet.public.blastapi.io";
      const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
      const data = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [BASE_MARGIN_ENGINE_ADDRESS, amount] });
      gasEstimate = await publicClient.estimateGas({ account: address, to: BASE_USDC_ADDRESS, data });
      gasEstimate = (gasEstimate * BigInt(130)) / BigInt(100);
    } catch { /* fallback to wallet estimation */ }

    writeContract(
      { address: BASE_USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [BASE_MARGIN_ENGINE_ADDRESS, amount], ...(gasEstimate ? { gas: gasEstimate } : {}) },
      { onSuccess: (h) => setTxHash(h), onError: (e) => { setActionLabel(""); setErrorMessage(e?.message ?? "Approve failed"); } }
    );
  }, [collateral, address, writeContract]);

  const handleOpenPosition = useCallback(async () => {
    setErrorMessage("");
    const col = parseUSDC(collateral);
    const lev = BigInt(leverage);
    const ep = parsePrice(entryPrice);
    if (col === BigInt(0)) { setErrorMessage("Enter a collateral amount"); return; }
    if (ep === BigInt(0)) { setErrorMessage("Enter an entry price"); return; }
    if (!address) { setErrorMessage("Wallet not connected"); return; }
    setActionLabel("Simulating & opening position...");
    console.log("[openPosition] args:", { col: col.toString(), lev: lev.toString(), isLong, ep: ep.toString(), engine: BASE_MARGIN_ENGINE_ADDRESS });

    // Pre-estimate gas using OUR RPC (not MetaMask's) to avoid "Requested resource not available"
    let gasEstimate: bigint | undefined;
    try {
      const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://base-mainnet.public.blastapi.io";
      const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
      const data = encodeFunctionData({
        abi: baseMarginEngineAbi,
        functionName: "openPosition",
        args: [col, lev, isLong, ep],
      });
      gasEstimate = await publicClient.estimateGas({
        account: address,
        to: BASE_MARGIN_ENGINE_ADDRESS,
        data,
      });
      // Add 30% buffer
      gasEstimate = (gasEstimate * BigInt(130)) / BigInt(100);
      console.log("[openPosition] gas estimate:", gasEstimate.toString());
    } catch (simErr: any) {
      console.error("[openPosition] simulation error:", simErr);
      setActionLabel("");
      const msg = simErr?.shortMessage ?? simErr?.message ?? "Simulation failed";
      const revertMatch = msg.match(/reason:\s*(.+?)(?:\n|$)/i) ?? msg.match(/reverted[^:]*:\s*(.+?)(?:\n|$)/i);
      setErrorMessage(revertMatch ? `Contract reverted: ${revertMatch[1]}` : msg.length > 300 ? msg.slice(0, 300) + "..." : msg);
      return;
    }

    writeContract(
      {
        address: BASE_MARGIN_ENGINE_ADDRESS,
        abi: baseMarginEngineAbi,
        functionName: "openPosition",
        args: [col, lev, isLong, ep],
        gas: gasEstimate,
      },
      {
        onSuccess: (h) => { console.log("[openPosition] tx hash:", h); setTxHash(h); setCollateral(""); setEntryPrice(""); },
        onError: (e) => {
          console.error("[openPosition] error:", e);
          setActionLabel("");
          const msg = e?.message ?? "Open position failed";
          // User rejected in wallet
          if (msg.includes("User rejected") || msg.includes("user rejected") || msg.includes("denied")) {
            setErrorMessage("Transaction rejected by user");
            return;
          }
          const revertMatch = msg.match(/reason:\s*(.+?)(?:\n|$)/i) ?? msg.match(/reverted[^:]*:\s*(.+?)(?:\n|$)/i);
          setErrorMessage(revertMatch ? `Contract reverted: ${revertMatch[1]}` : msg.length > 300 ? msg.slice(0, 300) + "..." : msg);
        },
      }
    );
  }, [collateral, leverage, isLong, entryPrice, address, writeContract]);

  const handleClosePosition = useCallback(async () => {
    setErrorMessage("");
    const posId = BigInt(closePositionId || "0");
    const ep = parsePrice(exitPrice);
    if (ep === BigInt(0)) return;
    if (!address) return;
    setActionLabel("Closing position...");

    // Pre-estimate gas using our RPC
    let gasEstimate: bigint | undefined;
    try {
      const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://base-mainnet.public.blastapi.io";
      const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
      const data = encodeFunctionData({ abi: baseMarginEngineAbi, functionName: "closePosition", args: [posId, ep] });
      gasEstimate = await publicClient.estimateGas({ account: address, to: BASE_MARGIN_ENGINE_ADDRESS, data });
      gasEstimate = (gasEstimate * BigInt(130)) / BigInt(100);
    } catch { /* fallback */ }

    writeContract(
      {
        address: BASE_MARGIN_ENGINE_ADDRESS,
        abi: baseMarginEngineAbi,
        functionName: "closePosition",
        args: [posId, ep],
        ...(gasEstimate ? { gas: gasEstimate } : {}),
      },
      {
        onSuccess: (h) => { setTxHash(h); setClosePositionId(""); setExitPrice(""); },
        onError: (e) => { setActionLabel(""); setErrorMessage(e?.message ?? "Close position failed"); },
      }
    );
  }, [closePositionId, exitPrice, address, writeContract]);

  const needsApproval =
    usdcAllowance !== undefined && collateral !== "" && (usdcAllowance as bigint) < parseUSDC(collateral);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        {/* Warning */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm">
            <strong>Base mainnet — real USDC.</strong> Prices are mock (user-provided). Only USDC transfers are real. Use small amounts.
          </p>
        </div>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Margin Trade</h1>
            <p className="text-sm text-gray-400">Leveraged positions (2-5x) · Base mainnet · Real USDC</p>
          </div>
          <button onClick={refetchAll} className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Vault Stats Row */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400"><BarChart3 className="h-3.5 w-3.5" /> Vault TVL</div>
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
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400"><Droplets className="h-3.5 w-3.5" /> Borrow APR</div>
            <p className="text-lg font-bold text-white">{bpsToPercent(borrowAPR as bigint | undefined)}</p>
          </div>
        </div>

        {/* Error (prominent, above cards) */}
        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 break-words">
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        {/* Tx status (prominent) */}
        {(isLoading || isTxSuccess) && (
          <div className={`mb-6 rounded-xl border p-4 text-sm ${isTxSuccess ? "border-neon/30 bg-neon/5 text-neon" : "border-yellow-500/30 bg-yellow-500/5 text-yellow-400"}`}>
            {isTxConfirming ? `Confirming: ${actionLabel}` : isTxSuccess ? "Transaction confirmed!" : actionLabel}
          </div>
        )}

        {/* Network guard */}
        {isWrongNetwork && (
          <div className="mb-8 rounded-2xl border border-orange-500/40 bg-orange-500/10 p-6 text-center">
            <p className="mb-4 text-orange-200">Please switch your wallet to Base mainnet.</p>
            <TxButton onClick={() => switchChain?.({ chainId: BASE_CHAIN_ID })} variant="primary">Switch to Base</TxButton>
          </div>
        )}

        {!isConnected ? (
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-12 text-center">
            <TrendingUp className="mx-auto mb-4 h-12 w-12 text-gray-600" />
            <h2 className="mb-2 text-lg font-semibold text-white">Connect Your Wallet</h2>
            <p className="text-sm text-gray-500">Connect to open leveraged positions on Base</p>
          </div>
        ) : !isWrongNetwork ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ─── Left: Open Position ──────────────────────────── */}
            <div className="space-y-6">
              {/* User info */}
              <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-5">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">USDC Balance</span><span className="text-white font-medium">${fmtUSDC(userUsdcBalance as bigint | undefined)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Your Borrowed</span><span className="text-white font-medium">${fmtUSDC(walletBorrowedRaw as bigint | undefined)}</span></div>
                </div>
              </div>

              {/* Open position card */}
              <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">Open Position</h3>

                {/* Direction */}
                <div className="mb-4 flex gap-2">
                  <button onClick={() => setIsLong(true)}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${isLong ? "bg-green-500/20 text-green-400 border border-green-500/50" : "bg-white/5 text-gray-400 border border-gray-700 hover:bg-white/10"}`}>
                    <TrendingUp className="inline h-4 w-4 mr-1" /> Long
                  </button>
                  <button onClick={() => setIsLong(false)}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${!isLong ? "bg-red-500/20 text-red-400 border border-red-500/50" : "bg-white/5 text-gray-400 border border-gray-700 hover:bg-white/10"}`}>
                    <TrendingDown className="inline h-4 w-4 mr-1" /> Short
                  </button>
                </div>

                {/* Collateral */}
                <label className="mb-1 block text-xs text-gray-400">Collateral (USDC)</label>
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-gray-700 bg-black/40 px-4 py-2.5">
                  <input type="number" placeholder="0.00" value={collateral} onChange={(e) => setCollateral(e.target.value)}
                    className="flex-1 bg-transparent text-white outline-none placeholder:text-gray-600" />
                  <span className="text-xs text-gray-500">USDC</span>
                </div>

                {/* Leverage */}
                <label className="mb-1 block text-xs text-gray-400">Leverage</label>
                <div className="mb-3 flex gap-2">
                  {["2", "3", "4", "5"].map((l) => (
                    <button key={l} onClick={() => setLeverage(l)}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${leverage === l ? "bg-neon/20 text-neon border border-neon/50" : "bg-white/5 text-gray-400 border border-gray-700 hover:bg-white/10"}`}>
                      {l}x
                    </button>
                  ))}
                </div>

                {/* Entry price */}
                <label className="mb-1 block text-xs text-gray-400">Mock Entry Price ($)</label>
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-700 bg-black/40 px-4 py-2.5">
                  <input type="number" placeholder="100000" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)}
                    className="flex-1 bg-transparent text-white outline-none placeholder:text-gray-600" />
                  <span className="text-xs text-gray-500">USD</span>
                </div>

                {/* Summary */}
                {collateral && parseFloat(collateral) > 0 && (
                  <div className="mb-4 rounded-xl bg-white/5 p-3 text-xs text-gray-300 space-y-1">
                    <div className="flex justify-between"><span>Notional</span><span>${(parseFloat(collateral) * parseInt(leverage)).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Borrowed from vault</span><span>${(parseFloat(collateral) * (parseInt(leverage) - 1)).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Open fee (0.15%)</span><span>${(parseFloat(collateral) * parseInt(leverage) * 0.0015).toFixed(4)}</span></div>
                  </div>
                )}

                {/* Buttons: Approve or Open */}
                {needsApproval ? (
                  <TxButton onClick={handleApprove} loading={isLoading && actionLabel.includes("Approving")} className="w-full">
                    Approve USDC
                  </TxButton>
                ) : (
                  <TxButton onClick={handleOpenPosition} loading={isLoading && actionLabel.includes("Opening")}
                    disabled={!collateral || parseFloat(collateral) <= 0 || !entryPrice || parseFloat(entryPrice) <= 0}
                    className="w-full">
                    Open {isLong ? "Long" : "Short"} {leverage}x
                  </TxButton>
                )}
              </div>
            </div>

            {/* ─── Right: Close Position + Positions ──────────── */}
            <div className="space-y-6">
              {/* Close position */}
              <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">Close Position</h3>

                <label className="mb-1 block text-xs text-gray-400">Position ID</label>
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-gray-700 bg-black/40 px-4 py-2.5">
                  <input type="number" placeholder="0" value={closePositionId} onChange={(e) => setClosePositionId(e.target.value)}
                    className="flex-1 bg-transparent text-white outline-none placeholder:text-gray-600" />
                </div>

                <label className="mb-1 block text-xs text-gray-400">Mock Exit Price ($)</label>
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-700 bg-black/40 px-4 py-2.5">
                  <input type="number" placeholder="105000" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)}
                    className="flex-1 bg-transparent text-white outline-none placeholder:text-gray-600" />
                  <span className="text-xs text-gray-500">USD</span>
                </div>

                <TxButton onClick={handleClosePosition} loading={isLoading && actionLabel.includes("Closing")}
                  disabled={closePositionId === "" || !exitPrice || parseFloat(exitPrice) <= 0}
                  variant="secondary" className="w-full">
                  Close Position
                </TxButton>
              </div>

              {/* Recent positions */}
              <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">Your Positions</h3>
                {recentIds.length === 0 ? (
                  <p className="text-sm text-gray-500">No positions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {recentIds.map((id, idx) => {
                      const pos = positionDataArr?.[idx]?.result as Position | undefined;
                      if (!pos) return null;
                      return (
                        <div key={id.toString()} className={`rounded-xl border p-3 text-xs ${pos.isOpen ? "border-gray-700 bg-white/5" : "border-gray-800 bg-white/[0.02] opacity-60"}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-white">
                              #{id.toString()} · {pos.isLong ? <span className="text-green-400">LONG</span> : <span className="text-red-400">SHORT</span>} {pos.leverage.toString()}x
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${pos.isOpen ? "bg-neon/20 text-neon" : "bg-gray-700 text-gray-400"}`}>
                              {pos.isOpen ? "OPEN" : "CLOSED"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-gray-400">
                            <span>Collateral: <span className="text-white">${fmtUSDC(pos.collateral)}</span></span>
                            <span>Borrowed: <span className="text-white">${fmtUSDC(pos.borrowed)}</span></span>
                            <span>Notional: <span className="text-white">${fmtUSDC(pos.notional)}</span></span>
                            <span>Entry: <span className="text-white">{fmtPrice(pos.entryPriceMock)}</span></span>
                          </div>
                          {pos.isOpen && (
                            <button onClick={() => setClosePositionId(id.toString())}
                              className="mt-2 w-full rounded-lg bg-orange-500/10 py-1.5 text-[11px] font-semibold text-orange-400 hover:bg-orange-500/20 transition">
                              Select to Close
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* (status + error shown above the cards) */}
      </main>
    </>
  );
}
