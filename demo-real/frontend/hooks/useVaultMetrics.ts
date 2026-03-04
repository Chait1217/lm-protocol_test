// hooks/useVaultMetrics.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { useReadContract } from "wagmi";
import { polygon } from "wagmi/chains";
import { getContractAddresses, VAULT_ABI } from "@/lib/contracts";
import { computePoolState, type LendingPoolState } from "@/lib/lendingPool";

const addresses = getContractAddresses();
const ZERO = "0x0000000000000000000000000000000000000000";

export function useVaultMetrics(refreshInterval = 5000) {
  const [poolState, setPoolState] = useState<LendingPoolState>({
    totalDeposited: 0,
    totalBorrowed: 0,
    insuranceReserve: 0,
    utilization: 0,
    borrowRate: 0,
    supplyRate: 0,
  });

  const hasVault = addresses.vault !== ZERO && addresses.vault.length === 42;

  const { data: totalAssetsRaw, refetch: refetchAssets } = useReadContract({
    address: hasVault ? (addresses.vault as `0x${string}`) : undefined,
    abi: VAULT_ABI,
    functionName: "totalAssets",
    chainId: polygon.id,
    query: { refetchInterval: refreshInterval },
  });

  const { data: totalBorrowedRaw, refetch: refetchBorrowed } = useReadContract({
    address: hasVault ? (addresses.vault as `0x${string}`) : undefined,
    abi: VAULT_ABI,
    functionName: "totalBorrowed",
    chainId: polygon.id,
    query: { refetchInterval: refreshInterval },
  });

  const { data: insuranceRaw } = useReadContract({
    address: hasVault ? (addresses.vault as `0x${string}`) : undefined,
    abi: VAULT_ABI,
    functionName: "insuranceBalance",
    chainId: polygon.id,
    query: { refetchInterval: refreshInterval },
  });

  const refresh = useCallback(() => {
    refetchAssets();
    refetchBorrowed();
  }, [refetchAssets, refetchBorrowed]);

  useEffect(() => {
    if (!hasVault) return;
    const totalDeposited = totalAssetsRaw != null ? Number(totalAssetsRaw) / 1e6 : 0;
    const totalBorrowed = totalBorrowedRaw != null ? Number(totalBorrowedRaw) / 1e6 : 0;
    const insuranceReserve = insuranceRaw != null ? Number(insuranceRaw) / 1e6 : 0;
    setPoolState(computePoolState(totalDeposited, totalBorrowed, insuranceReserve));
  }, [hasVault, totalAssetsRaw, totalBorrowedRaw, insuranceRaw]);

  useEffect(() => {
    if (!hasVault) return;
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [hasVault, refresh, refreshInterval]);

  return { poolState, refresh };
}
