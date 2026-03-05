"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { polygon } from "wagmi/chains";
import { formatUnits, decodeEventLog } from "viem";
import { getContractAddresses, MARGIN_ENGINE_ABI } from "@/lib/contracts";

const addresses = getContractAddresses();
const ZERO = "0x0000000000000000000000000000000000000000";
const hasEngine = addresses.marginEngine !== ZERO && addresses.marginEngine.length === 42;

interface Position {
  id: number;
  trader: string;
  isLong: boolean;
  leverage: number;
  collateral: bigint;
  borrowed: bigint;
  notional: bigint;
  entryPrice: bigint;
  isOpen: boolean;
  openedAt: bigint;
  // Closed data (from events)
  exitPrice?: bigint;
  pnl?: bigint;
  closedAt?: string;
}

function fmt(val: bigint | undefined, decimals = 6, dp = 2): string {
  if (val == null) return "—";
  return parseFloat(formatUnits(val, decimals)).toFixed(dp);
}

function fmtPrice(val: bigint | undefined, decimals = 8, dp = 4): string {
  if (val == null) return "—";
  return parseFloat(formatUnits(val, decimals)).toFixed(dp);
}

export default function TransactionsPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: polygon.id });
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user position IDs
  const { data: positionIds } = useReadContract({
    address: hasEngine ? (addresses.marginEngine as `0x${string}`) : undefined,
    abi: MARGIN_ENGINE_ABI,
    functionName: "getUserPositions",
    args: address ? [address] : undefined,
    chainId: polygon.id,
  });

  const fetchPositions = useCallback(async () => {
    if (!positionIds || !Array.isArray(positionIds) || positionIds.length === 0 || !publicClient) return;

    setLoading(true);
    setError(null);

    try {
      const positionsData: Position[] = [];

      for (const id of positionIds) {
        try {
          const data = await publicClient.readContract({
            address: addresses.marginEngine as `0x${string}`,
            abi: MARGIN_ENGINE_ABI,
            functionName: "getPosition",
            args: [id],
          });

          if (data && typeof data === "object") {
            const pos = data as any;
            positionsData.push({
              id: Number(id),
              trader: pos.trader || address || "",
              isLong: pos.isLong ?? true,
              leverage: Number(pos.leverage || 1),
              collateral: pos.collateral || BigInt(0),
              borrowed: pos.borrowed || BigInt(0),
              notional: pos.notional || BigInt(0),
              entryPrice: pos.entryPrice || BigInt(0),
              isOpen: pos.isOpen ?? true,
              openedAt: pos.openedAt || BigInt(0),
            });
          }
        } catch (posErr) {
          console.warn(`Failed to fetch position ${id}:`, posErr);
        }
      }

      // Fetch close events for closed positions
      try {
        const closedLogs = await publicClient.getLogs({
          address: addresses.marginEngine as `0x${string}`,
          event: {
            type: "event",
            name: "PositionClosed",
            inputs: [
              { name: "positionId", type: "uint256", indexed: true },
              { name: "trader", type: "address", indexed: true },
              { name: "exitPrice", type: "uint256", indexed: false },
              { name: "pnl", type: "int256", indexed: false },
            ],
          },
          fromBlock: "earliest",
        });

        for (const log of closedLogs) {
          const posId = Number(log.args?.positionId);
          const pos = positionsData.find((p) => p.id === posId);
          if (pos) {
            pos.exitPrice = log.args?.exitPrice as bigint;
            pos.pnl = log.args?.pnl as bigint;
          }
        }
      } catch {
        // Events may not be available
      }

      setPositions(positionsData.sort((a, b) => b.id - a.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch positions");
    } finally {
      setLoading(false);
    }
  }, [positionIds, publicClient, address]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const openPositions = positions.filter((p) => p.isOpen);
  const closedPositions = positions.filter((p) => !p.isOpen);

  return (
    <div className="min-h-screen bg-terminal-gradient">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Transaction History</h1>
            <p className="text-[#666] text-sm">View your open and closed MarginEngine positions on Polygon.</p>
          </div>
          <button
            onClick={fetchPositions}
            disabled={loading || !isConnected}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-[#00ff88] border border-[#00ff88]/20 bg-[#00ff88]/5 hover:bg-[#00ff88]/10 hover:border-[#00ff88]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <div className="spinner" /> : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </button>
        </div>

        {!isConnected ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-12 text-center">
            <p className="text-[#555] text-sm">Connect your wallet to view transaction history.</p>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-500/5 border border-red-500/20 px-5 py-4 text-sm text-red-400 mb-6">
            {error}
          </div>
        ) : (
          <>
            {/* Open Positions */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-white">Open Positions</h2>
                <span className="tag-neon text-[10px]">{openPositions.length}</span>
              </div>

              {openPositions.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-8 text-center">
                  <p className="text-[#555] text-sm">No open positions</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="table-dark">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Direction</th>
                          <th>Leverage</th>
                          <th>Collateral</th>
                          <th>Borrowed</th>
                          <th>Notional</th>
                          <th>Entry Price</th>
                          <th>Opened</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {openPositions.map((pos) => (
                          <tr key={pos.id}>
                            <td className="mono font-medium text-white">#{pos.id}</td>
                            <td>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                pos.isLong
                                  ? "bg-[#00ff88]/8 text-[#00ff88] border border-[#00ff88]/20"
                                  : "bg-red-500/8 text-red-400 border border-red-500/20"
                              }`}>
                                {pos.isLong ? "LONG" : "SHORT"}
                              </span>
                            </td>
                            <td className="mono font-medium text-[#f59e0b]">{pos.leverage}x</td>
                            <td className="mono">${fmt(pos.collateral)}</td>
                            <td className="mono">${fmt(pos.borrowed)}</td>
                            <td className="mono font-medium text-white">${fmt(pos.notional)}</td>
                            <td className="mono">${fmtPrice(pos.entryPrice)}</td>
                            <td className="text-[#666] text-xs">
                              {pos.openedAt ? new Date(Number(pos.openedAt) * 1000).toLocaleDateString() : "—"}
                            </td>
                            <td>
                              <a
                                href={`https://polygonscan.com/address/${addresses.marginEngine}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#3b82f6] hover:text-[#60a5fa] text-xs"
                              >
                                View
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Closed Positions */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-white">Closed Positions</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-[#888] border border-white/5">
                  {closedPositions.length}
                </span>
              </div>

              {closedPositions.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-8 text-center">
                  <p className="text-[#555] text-sm">No closed positions</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="table-dark">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Direction</th>
                          <th>Leverage</th>
                          <th>Collateral</th>
                          <th>Notional</th>
                          <th>Entry</th>
                          <th>Exit</th>
                          <th>PnL</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {closedPositions.map((pos) => {
                          const pnlNum = pos.pnl ? parseFloat(formatUnits(pos.pnl, 6)) : 0;
                          return (
                            <tr key={pos.id}>
                              <td className="mono font-medium text-white">#{pos.id}</td>
                              <td>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                  pos.isLong
                                    ? "bg-[#00ff88]/8 text-[#00ff88]/60 border border-[#00ff88]/10"
                                    : "bg-red-500/8 text-red-400/60 border border-red-500/10"
                                }`}>
                                  {pos.isLong ? "LONG" : "SHORT"}
                                </span>
                              </td>
                              <td className="mono text-[#888]">{pos.leverage}x</td>
                              <td className="mono text-[#888]">${fmt(pos.collateral)}</td>
                              <td className="mono text-[#888]">${fmt(pos.notional)}</td>
                              <td className="mono text-[#888]">${fmtPrice(pos.entryPrice)}</td>
                              <td className="mono text-[#888]">${fmtPrice(pos.exitPrice)}</td>
                              <td>
                                <span className={`mono font-semibold ${pnlNum >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
                                  {pnlNum >= 0 ? "+" : ""}{pnlNum.toFixed(2)}
                                </span>
                              </td>
                              <td>
                                <a
                                  href={`https://polygonscan.com/address/${addresses.marginEngine}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#3b82f6] hover:text-[#60a5fa] text-xs"
                                >
                                  View
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
