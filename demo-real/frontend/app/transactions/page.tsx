"use client";

/**
 * /transactions – All opened and closed positions (trades) with full details.
 * Polygon PoS · MarginEngine.
 */
import { useMemo, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  usePublicClient,
} from "wagmi";
import { polygon } from "wagmi/chains";
import { parseAbiItem } from "viem";
import { MARGIN_ENGINE_ADDRESS } from "@/lib/baseAddresses";
import { marginEngineAbi } from "@/lib/abi";
import { formatUSDC } from "@/lib/utils";
import {
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown,
  Clock,
  ExternalLink,
} from "lucide-react";

const ZERO = "0x0000000000000000000000000000000000000000";
const hasEngine = MARGIN_ENGINE_ADDRESS !== ZERO && MARGIN_ENGINE_ADDRESS.length === 42;
const POLYGONSCAN = "https://polygonscan.com";

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

function entryPriceToCents(entryPriceMock: bigint): string {
  const n = Number(entryPriceMock) / 1e6;
  return (n * 100).toFixed(1);
}

function exitPriceToCents(exitPriceMock: bigint): string {
  const n = Number(exitPriceMock) / 1e6;
  return (n * 100).toFixed(1);
}

const POSITION_CLOSED_EVENT = parseAbiItem(
  "event PositionClosed(uint256 indexed positionId, address indexed owner, uint256 exitPriceMock, int256 pnl, uint256 interest, uint256 returnedToUser)"
);

export default function TransactionsPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: polygon.id });
  const [exitByPositionId, setExitByPositionId] = useState<Record<number, { exitPriceMock: bigint; pnl: bigint; returnedToUser: bigint }>>({});
  const [exitRefresh, setExitRefresh] = useState(0);
  const [exitLoading, setExitLoading] = useState(false);
  const [exitLoadError, setExitLoadError] = useState<string | null>(null);

  const { data: userPositionIdsRaw, refetch: refetchPositions } = useReadContract({
    address: hasEngine ? MARGIN_ENGINE_ADDRESS : undefined,
    abi: marginEngineAbi,
    functionName: "getUserPositions",
    args: address ? [address] : undefined,
    chainId: polygon.id,
    query: { refetchInterval: 10000 },
  });

  const positionIds = (userPositionIdsRaw as bigint[] | undefined) ?? [];
  const idsNewestFirst = useMemo(() => [...positionIds].reverse(), [positionIds]);
  const maxPositions = 50;
  const idsToFetch = idsNewestFirst.slice(0, maxPositions);

  const { data: positionsData, refetch: refetchPositionData } = useReadContracts({
    contracts: idsToFetch.map((id) => ({
      address: MARGIN_ENGINE_ADDRESS,
      abi: marginEngineAbi,
      functionName: "getPosition" as const,
      args: [id],
      chainId: polygon.id,
    })),
  });

  const positions = useMemo(() => {
    return idsToFetch.map((id, idx) => {
      const res = positionsData?.[idx]?.result as Position | undefined;
      return res ? { id: Number(id), ...res } : null;
    }).filter(Boolean) as { id: number; owner: string; collateral: bigint; borrowed: bigint; notional: bigint; entryPriceMock: bigint; leverage: bigint; isLong: boolean; openTimestamp: bigint; isOpen: boolean }[];
  }, [idsToFetch, positionsData]);

  const openCount = positions.filter((p) => p.isOpen).length;
  const closedCount = positions.filter((p) => !p.isOpen).length;
  const closedIds = useMemo(() => positions.filter((p) => !p.isOpen).map((p) => p.id), [positions]);

  useEffect(() => {
    if (!publicClient || !hasEngine || closedIds.length === 0) return;
    let cancelled = false;
    setExitLoadError(null);
    setExitLoading(true);
    const CHUNK_SIZE = 50n;
    const MAX_CHUNKS = 300;
    (async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const allLogs: { args: unknown }[] = [];
        let toBlock = currentBlock;
        let fromBlock = toBlock > CHUNK_SIZE ? toBlock - CHUNK_SIZE : 0n;
        let chunks = 0;
        while (chunks < MAX_CHUNKS && toBlock > 0n) {
          if (cancelled) return;
          try {
            const logs = await publicClient.getLogs({
              address: MARGIN_ENGINE_ADDRESS,
              event: POSITION_CLOSED_EVENT,
              fromBlock,
              toBlock,
            });
            allLogs.push(...logs);
          } catch (chunkErr) {
            if (cancelled) return;
            console.warn("Exit logs chunk failed:", chunkErr);
          }
          chunks++;
          if (fromBlock <= 0n) break;
          toBlock = fromBlock - 1n;
          fromBlock = toBlock > CHUNK_SIZE ? toBlock - CHUNK_SIZE : 0n;
        }
        if (cancelled) return;
        const map: Record<number, { exitPriceMock: bigint; pnl: bigint; returnedToUser: bigint }> = {};
        for (const log of allLogs) {
          const args = log.args as { positionId?: bigint; exitPriceMock?: bigint; pnl?: bigint; returnedToUser?: bigint };
          if (args?.positionId != null && args?.exitPriceMock != null)
            map[Number(args.positionId)] = {
              exitPriceMock: args.exitPriceMock,
              pnl: args.pnl ?? BigInt(0),
              returnedToUser: args.returnedToUser ?? BigInt(0),
            };
        }
        setExitByPositionId(map);
        setExitLoadError(null);
      } catch (e) {
        if (!cancelled) {
          setExitByPositionId({});
          setExitLoadError(e instanceof Error ? e.message : "Failed to load exit prices");
        }
      } finally {
        if (!cancelled) setExitLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [publicClient, closedIds.length, hasEngine, exitRefresh]);

  const refetchAll = () => {
    refetchPositions();
    refetchPositionData();
    setExitRefresh((n) => n + 1);
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl flex items-center gap-2">
              <FileText className="h-7 w-7 text-emerald-400" />
              Transactions
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              All opened and closed positions on Polygon PoS
            </p>
          </div>
          <button
            onClick={refetchAll}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {!isConnected ? (
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-600" />
            <h2 className="mb-2 text-lg font-semibold text-white">Connect Your Wallet</h2>
            <p className="text-sm text-gray-500">Connect to see your trade history</p>
          </div>
        ) : !hasEngine ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
            <p className="text-amber-200 text-sm">Margin engine not configured.</p>
          </div>
        ) : positions.length === 0 ? (
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 p-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-600" />
            <h2 className="mb-2 text-lg font-semibold text-white">No positions yet</h2>
            <p className="text-sm text-gray-500">Open a leveraged trade on the Trade Demo page.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-4 text-sm">
              <span className="text-gray-400">
                <span className="text-emerald-400 font-semibold">{openCount}</span> open
              </span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-400">
                <span className="text-white font-semibold">{closedCount}</span> closed
              </span>
            </div>

            <div className="rounded-2xl border border-gray-800/50 bg-gray-900/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Direction</th>
                      <th className="px-4 py-3 font-semibold">Leverage</th>
                      <th className="px-4 py-3 font-semibold">Collateral</th>
                      <th className="px-4 py-3 font-semibold">Borrowed</th>
                      <th className="px-4 py-3 font-semibold">Notional</th>
                      <th className="px-4 py-3 font-semibold">Entry</th>
                      <th className="px-4 py-3 font-semibold">Exit</th>
                      <th className="px-4 py-3 font-semibold">Exit value</th>
                      <th className="px-4 py-3 font-semibold">Opened</th>
                      <th className="px-4 py-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos) => (
                      <tr
                        key={pos.id}
                        className={`border-b border-gray-800/50 transition hover:bg-white/5 ${
                          !pos.isOpen ? "opacity-75" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-white">#{pos.id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              pos.isOpen
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : "bg-gray-700/50 text-gray-400 border border-gray-600"
                            }`}
                          >
                            {pos.isOpen ? "OPEN" : "CLOSED"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {pos.isLong ? (
                            <span className="inline-flex items-center gap-1 text-green-400 font-medium text-sm">
                              <TrendingUp className="h-3.5 w-3.5 shrink-0" /> Buy YES
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-400 font-medium text-sm">
                              <TrendingDown className="h-3.5 w-3.5 shrink-0" /> Buy NO
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-white text-sm">{Number(pos.leverage)}x</td>
                        <td className="px-4 py-3 font-mono text-white text-sm">${formatUSDC(pos.collateral, 6)}</td>
                        <td className="px-4 py-3 font-mono text-amber-400 text-sm">${formatUSDC(pos.borrowed, 6)}</td>
                        <td className="px-4 py-3 font-mono text-white text-sm">${formatUSDC(pos.notional, 6)}</td>
                        <td className="px-4 py-3 font-mono text-gray-300 text-sm">
                          {entryPriceToCents(pos.entryPriceMock)}¢
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">
                          {pos.isOpen ? (
                            <span className="text-gray-500">—</span>
                          ) : exitByPositionId[pos.id] != null ? (
                            <span className="text-emerald-400">{exitPriceToCents(exitByPositionId[pos.id].exitPriceMock)}¢</span>
                          ) : exitLoading ? (
                            <span className="text-gray-500">…</span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">
                          {pos.isOpen ? (
                            <span className="text-gray-500">—</span>
                          ) : exitByPositionId[pos.id] != null ? (
                            <span className="text-white">${formatUSDC(exitByPositionId[pos.id].returnedToUser, 6)}</span>
                          ) : exitLoading ? (
                            <span className="text-gray-500">…</span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          {new Date(Number(pos.openTimestamp) * 1000).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`${POLYGONSCAN}/address/${MARGIN_ENGINE_ADDRESS}#readContract`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-emerald-400 transition p-1 inline-block"
                            title="View on Polygonscan"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {exitLoadError && (
              <p className="mt-2 text-amber-400 text-xs flex items-center gap-2">
                Exit prices: {exitLoadError}
                <button type="button" onClick={refetchAll} className="text-emerald-400 hover:underline">Retry</button>
              </p>
            )}
          </>
        )}
      </main>
    </>
  );
}
