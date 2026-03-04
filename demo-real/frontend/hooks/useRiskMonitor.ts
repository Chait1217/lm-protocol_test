// hooks/useRiskMonitor.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { calculateHealthFactor, isLiquidatable } from "@/lib/lendingPool";
import { POLYMARKET_CLOB_API } from "@/lib/polymarketConfig";

export interface RiskMonitorPosition {
  id: number;
  tokenId: string;
  tokenBalance: number;
  collateral: number;
  borrowed: number;
  entryPrice: number;
  isYes: boolean;
  openedAt: number;
}

export interface RiskStatus {
  positionId: number;
  currentPrice: number;
  currentValue: number;
  healthFactor: number;
  isLiquidatable: boolean;
  pnl: number;
  pnlPercent: number;
}

export function useRiskMonitor(positions: RiskMonitorPosition[], checkInterval = 10000) {
  const [riskStatuses, setRiskStatuses] = useState<Map<number, RiskStatus>>(new Map());

  const checkRisk = useCallback(async () => {
    const newStatuses = new Map<number, RiskStatus>();

    for (const pos of positions) {
      try {
        const res = await fetch(`${POLYMARKET_CLOB_API}/midpoint?token_id=${pos.tokenId}`);
        const data = await res.json();
        const currentPrice = parseFloat(data?.midpoint ?? data?.mid ?? "0") || 0;

        const currentValue = pos.tokenBalance * currentPrice;
        const hf = calculateHealthFactor(currentValue, pos.borrowed, pos.collateral);

        const totalInvested = pos.collateral;
        const pnl = currentValue - pos.borrowed - totalInvested;
        const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

        newStatuses.set(pos.id, {
          positionId: pos.id,
          currentPrice,
          currentValue,
          healthFactor: hf,
          isLiquidatable: isLiquidatable(hf),
          pnl,
          pnlPercent,
        });
      } catch (e) {
        console.error(`Risk check failed for position ${pos.id}:`, e);
      }
    }

    setRiskStatuses(newStatuses);
  }, [positions]);

  useEffect(() => {
    if (positions.length === 0) return;
    checkRisk();
    const interval = setInterval(checkRisk, checkInterval);
    return () => clearInterval(interval);
  }, [positions, checkInterval, checkRisk]);

  return { riskStatuses };
}
