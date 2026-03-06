"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  useAccount,
  useConnect,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { polygon } from "wagmi/chains";
import { formatUnits, parseUnits } from "viem";
import {
  getContractAddresses,
  MARGIN_ENGINE_ABI,
  USDC_ABI,
} from "@/lib/contracts";
import {
  POLYMKT_USDCE_ADDRESS,
  POLYMARKET_NO_TOKEN,
  POLYMARKET_YES_TOKEN,
} from "@/lib/polymarketConfig";
import { placeSignedBuyOrder } from "@/lib/polymarketBrowserClient";

export interface RealTradeMarket {
  title: string;
  slug: string | null;
  bestBid: number | null;
  bestAsk: number | null;
  clobTokenIds: string[];
  tickSize?: string;
  negRisk?: boolean;
}

interface Props {
  market: RealTradeMarket | null;
  selectedOutcome: "YES" | "NO";
  collateral: number;
  leverage: number;
  entryPrice: number;
  onSuccess?: () => void;
}

type FlowStep = "idle" | "polymarket" | "approve" | "borrow" | "done";

type TradeResult = {
  orderId?: string;
  vaultTx?: string;
  polyWallet?: string;
  info?: string;
  error?: string;
};

const POLYGONSCAN_TX = "https://polygonscan.com/tx/";
const ZERO = "0x0000000000000000000000000000000000000000";

function StepIndicator({
  label,
  status,
}: {
  label: string;
  status: "pending" | "active" | "done";
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs ${
        status === "done"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : status === "active"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
          : "border-white/10 bg-white/[0.02] text-gray-400"
      }`}
    >
      <div className="flex items-center gap-2">
        {status === "active" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : status === "done" ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <div className="h-3.5 w-3.5 rounded-full border border-current opacity-60" />
        )}
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function RealPolymarketTrade({
  market,
  selectedOutcome,
  collateral,
  leverage,
  entryPrice,
  onSuccess,
}: Props) {
  const { address } = useAccount();
  const { connectAsync, isPending: isConnectPending } = useConnect();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: polygon.id });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [step, setStep] = useState<FlowStep>("idle");
  const [result, setResult] = useState<TradeResult | null>(null);

  const addresses = getContractAddresses();
  const hasVault =
    addresses.vault !== ZERO &&
    addresses.marginEngine !== ZERO &&
    addresses.vault.length === 42 &&
    addresses.marginEngine.length === 42;

  const isLong = selectedOutcome === "YES";
  const price = entryPrice > 0 ? entryPrice : market?.bestAsk || 0.5;
  const notional = collateral * leverage;
  const borrowed = Math.max(0, notional - collateral);

  const { data: usdcBalanceRaw } = useReadContract({
    address: POLYMKT_USDCE_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: polygon.id,
    query: {
      enabled: !!address,
    },
  });

  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: POLYMKT_USDCE_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args:
      address && hasVault
        ? [address, addresses.marginEngine]
        : undefined,
    chainId: polygon.id,
    query: {
      enabled: !!address && hasVault,
    },
  });

  const polygonUsdc = useMemo(() => {
    try {
      return Number(formatUnits((usdcBalanceRaw as bigint) || BigInt(0), 6));
    } catch {
      return 0;
    }
  }, [usdcBalanceRaw]);

  const allowance = useMemo(() => {
    try {
      return Number(formatUnits((allowanceRaw as bigint) || BigInt(0), 6));
    } catch {
      return 0;
    }
  }, [allowanceRaw]);

  const meetsPolymarketMin = notional >= 1;
  const hasEnoughCollateral = polygonUsdc >= collateral;
  const canTrade =
    !!address &&
    !!market &&
    collateral >= 0.5 &&
    leverage >= 1 &&
    meetsPolymarketMin &&
    hasEnoughCollateral &&
    !!publicClient;

  const handleConnectWallet = useCallback(async () => {
    try {
      await connectAsync({ connector: injected({ shimDisconnect: true }) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ error: `Wallet connection failed: ${msg}` });
      setStep("done");
    }
  }, [connectAsync]);

  const ensureMarginApproval = useCallback(async () => {
    if (!address || !hasVault || !publicClient) return;

    if (allowance >= collateral) return;

    setStep("approve");

    const amount = parseUnits(collateral.toFixed(6), 6);

    const approveHash = await writeContractAsync({
      address: POLYMKT_USDCE_ADDRESS,
      abi: USDC_ABI,
      functionName: "approve",
      args: [addresses.marginEngine, amount],
      chainId: polygon.id,
    });

    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveHash,
      confirmations: 1,
    });

    if (approveReceipt.status !== "success") {
      throw new Error("USDC.e approval transaction reverted");
    }

    await refetchAllowance();
  }, [
    address,
    hasVault,
    publicClient,
    allowance,
    collateral,
    writeContractAsync,
    addresses.marginEngine,
    refetchAllowance,
  ]);

  const openVaultLeg = useCallback(async () => {
    if (!address || !hasVault || !publicClient) return null;

    await ensureMarginApproval();

    setStep("borrow");

    const collateralAmount = parseUnits(collateral.toFixed(6), 6);
    const leverageInt = BigInt(Math.round(leverage));

    const openHash = await writeContractAsync({
      address: addresses.marginEngine as `0x${string}`,
      abi: MARGIN_ENGINE_ABI,
      functionName: "openPosition",
      args: [collateralAmount, leverageInt, isLong, addresses.marketId],
      chainId: polygon.id,
    });

    const openReceipt = await publicClient.waitForTransactionReceipt({
      hash: openHash,
      confirmations: 1,
    });

    if (openReceipt.status !== "success") {
      throw new Error("Vault borrow/open transaction reverted");
    }

    setResult((prev) => ({
      ...(prev || {}),
      vaultTx: openHash,
    }));

    return openHash;
  }, [
    address,
    hasVault,
    publicClient,
    ensureMarginApproval,
    collateral,
    leverage,
    isLong,
    addresses.marginEngine,
    addresses.marketId,
    writeContractAsync,
  ]);

  const handleExecute = useCallback(async () => {
    try {
      setResult(null);
      setStep("polymarket");

      const tokenID =
        selectedOutcome === "YES" ? POLYMARKET_YES_TOKEN : POLYMARKET_NO_TOKEN;

      const trade = await placeSignedBuyOrder({
        tokenID,
        amountUsd: notional,
        referencePrice: price,
      });

      setResult((prev) => ({
        ...(prev || {}),
        orderId: trade.orderId,
        polyWallet: trade.address,
        info: "Polymarket order signed by your wallet and submitted.",
      }));

      if (hasVault) {
        await openVaultLeg();
      }

      setStep("done");
      setConfirmOpen(false);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult((prev) => ({
        ...(prev || {}),
        error: msg,
      }));
      setStep("done");
    }
  }, [selectedOutcome, notional, price, hasVault, openVaultLeg, onSuccess]);

  if (!market) return null;

  const isAnyLoading = step !== "idle" && step !== "done";

  const step1Status =
    step === "polymarket"
      ? "active"
      : step === "approve" || step === "borrow" || step === "done"
      ? "done"
      : "pending";

  const step2Status =
    step === "approve" || step === "borrow"
      ? "active"
      : step === "done" && hasVault
      ? "done"
      : "pending";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">
          Leveraged Real Polymarket Trade
        </h3>
        <p className="mt-1 text-xs text-gray-400">
          This submits a wallet-signed Polymarket BUY order first, then opens the
          vault leverage leg on Polygon.
        </p>
      </div>

      {!address ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-sm text-gray-300 mb-3">Connect wallet to trade.</p>
          <button
            onClick={handleConnectWallet}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
          >
            {isConnectPending ? "Connecting wallet..." : "Connect Wallet"}
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Trade Summary · Polygon
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-gray-400 text-xs">Direction</div>
                <div className="mt-1 text-white">
                  {selectedOutcome} {isLong ? "(Long)" : "(Short)"}
                </div>
              </div>

              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-gray-400 text-xs">Entry</div>
                <div className="mt-1 text-white">{(price * 100).toFixed(1)}¢</div>
              </div>

              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-gray-400 text-xs">Collateral</div>
                <div className="mt-1 text-white">${collateral.toFixed(6)}</div>
              </div>

              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-gray-400 text-xs">Leverage</div>
                <div className="mt-1 text-white">{leverage}x</div>
              </div>

              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-gray-400 text-xs">Notional</div>
                <div className="mt-1 text-white">${notional.toFixed(6)}</div>
              </div>

              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-gray-400 text-xs">Borrowed</div>
                <div className="mt-1 text-white">${borrowed.toFixed(6)}</div>
              </div>

              <div className="rounded-lg bg-black/20 p-3 col-span-2">
                <div className="text-gray-400 text-xs">Polygon USDC.e balance</div>
                <div
                  className={`mt-1 font-mono ${
                    hasEnoughCollateral ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  ${polygonUsdc.toFixed(6)}{" "}
                  {!hasEnoughCollateral && "(below collateral)"}
                </div>
              </div>
            </div>

            {!hasEnoughCollateral && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Your USDC.e balance is below required collateral.
                </span>
              </div>
            )}

            {!meetsPolymarketMin && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Notional must be at least $1.00 for Polymarket.
              </div>
            )}

            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!canTrade || isAnyLoading}
              className="w-full rounded-lg bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/40 text-emerald-400 py-2.5 text-sm font-semibold hover:from-emerald-500/30 hover:to-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAnyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {hasVault
                ? `Sign Polymarket Trade → Borrow ${leverage}x`
                : `Sign $${notional.toFixed(6)} Polymarket trade`}
            </button>
          </div>

          {isAnyLoading && (
            <div className="grid grid-cols-1 gap-2">
              <StepIndicator label="Wallet-signed Polymarket order" status={step1Status} />
              {hasVault && (
                <StepIndicator label="Vault borrow leg" status={step2Status} />
              )}
            </div>
          )}
        </>
      )}

      {confirmOpen && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-amber-300">
              Confirm Leveraged Real Trade
            </h4>
            <p className="mt-1 text-xs text-gray-300">{market.title}</p>
          </div>

          <div className="space-y-2 text-xs text-gray-300">
            <div>
              <span className="text-white font-medium">Step 1: Polymarket</span>{" "}
              — your wallet signs a BUY order for {selectedOutcome}.
            </div>

            {hasVault && (
              <div>
                <span className="text-white font-medium">Step 2: Vault</span> —
                open position with ${collateral.toFixed(6)} collateral × {leverage}x.
              </div>
            )}

            <div
              className={`font-mono ${
                hasEnoughCollateral ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              Your Polygon USDC.e: ${polygonUsdc.toFixed(6)}{" "}
              {!hasEnoughCollateral && "(below collateral)"}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={isAnyLoading}
              className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              disabled={isAnyLoading}
              className="flex-1 py-2 rounded-lg bg-amber-500/30 border border-amber-500/50 text-amber-300 font-semibold hover:bg-amber-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAnyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Execute trade
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          {!result.error && (result.vaultTx || result.orderId) && (
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>Trade executed successfully.</span>
            </div>
          )}

          {result.orderId && (
            <div className="text-xs text-gray-300">
              Polymarket order placed:{" "}
              <span className="font-mono text-white">
                {String(result.orderId).slice(0, 40)}
              </span>
            </div>
          )}

          {result.polyWallet && (
            <div className="text-xs text-gray-400">
              Signed by wallet:{" "}
              <span className="font-mono text-gray-300">{result.polyWallet}</span>
            </div>
          )}

          {result.vaultTx && (
            <a
              href={`${POLYGONSCAN_TX}${result.vaultTx}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
            >
              Vault position opened on Polygon
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {result.info && (
            <div className="text-xs text-gray-300">{result.info}</div>
          )}

          {result.error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
