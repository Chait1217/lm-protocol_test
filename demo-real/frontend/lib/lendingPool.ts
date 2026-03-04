// lib/lendingPool.ts
// Lending pool fee structure and interest rate model for Polymarket leverage trading.

// ==============================================================
// FEE STRUCTURE
// ==============================================================
//
// Distribution split (applies to ALL fee sources):
//   LP (Vault depositors) ........... 50%
//   Insurance Fund .................. 30%
//   Treasury ........................ 20%
//
// Fee sources:
//   Open / Close fee ................ 0.4% of notional
//   Borrow APR (kink model) ......... 5% -> 78% (kink at 80% util)
//   Liquidation penalty ............. 5% of collateral
// ==============================================================

// -- Distribution shares (must sum to 10000 bps = 100%) --
const LP_SHARE_BPS = 5000;          // 50%
const INSURANCE_SHARE_BPS = 3000;   // 30%
const TREASURY_SHARE_BPS = 2000;    // 20%

// -- Open / Close fee --
const OPEN_CLOSE_FEE_BPS = 40;      // 0.4% of notional

// -- Borrow APR: Kink interest-rate model --
// Below kink:  rate = BASE_RATE + (utilization / kink) * SLOPE1
// Above kink:  rate = BASE_RATE + SLOPE1 + ((util - kink) / (1 - kink)) * SLOPE2
// Targets: 5% APR at 0% util -> ~40% at kink (80%) -> 78% at 100% util
const BASE_RATE_BPS = 500;          // 5% floor
const SLOPE1_BPS = 3500;            // +35% across 0-80% util
const SLOPE2_BPS = 3800;            // +38% across 80-100% util (steep)
const OPTIMAL_UTIL_BPS = 8000;      // 80% kink

// -- Liquidation penalty --
const LIQUIDATION_PENALTY_BPS = 500; // 5% of collateral

export function calculateBorrowRate(utilization: number): number {
  // utilization is 0-1
  // Returns annualized borrow rate as a decimal (e.g. 0.05 = 5%)
  const kink = OPTIMAL_UTIL_BPS / 10000; // 0.80
  if (utilization <= kink) {
    return (BASE_RATE_BPS + (SLOPE1_BPS * utilization) / kink) / 10000;
  }
  const excessUtil = (utilization - kink) / (1 - kink);
  return (BASE_RATE_BPS + SLOPE1_BPS + SLOPE2_BPS * excessUtil) / 10000;
}

export function calculateSupplyRate(utilization: number): number {
  // Supply APY = borrowRate * utilization * LP share
  // (only the LP portion of interest goes to depositors)
  const borrowRate = calculateBorrowRate(utilization);
  return borrowRate * utilization * (LP_SHARE_BPS / 10000);
}

export function calculateHealthFactor(
  positionValueUSDC: number,
  borrowedAmount: number,
  collateral: number
): number {
  if (borrowedAmount === 0) return Infinity;
  return (positionValueUSDC + collateral) / borrowedAmount;
}

export function isLiquidatable(healthFactor: number): boolean {
  return healthFactor < 1.1;
}

export function calculateLiquidationPrice(
  entryPrice: number,
  collateral: number,
  borrowed: number,
  tokenAmount: number,
  isYes: boolean
): number {
  // Price at which healthFactor = 1.1
  // (tokenAmount * liqPrice + collateral) / borrowed = 1.1
  // liqPrice = (1.1 * borrowed - collateral) / tokenAmount
  const liqPrice = (1.1 * borrowed - collateral) / tokenAmount;
  return Math.max(0, Math.min(1, liqPrice));
}

// -- Open / Close fee: 0.4% of notional --
export function calculateOpenCloseFee(notional: number): number {
  return notional * (OPEN_CLOSE_FEE_BPS / 10000);
}

// -- Liquidation penalty: 5% of collateral --
export function calculateLiquidationPenalty(collateral: number): number {
  return collateral * (LIQUIDATION_PENALTY_BPS / 10000);
}

// -- Split any fee amount into LP / Insurance / Treasury --
export interface FeeSplit {
  total: number;
  lp: number;          // 50%
  insurance: number;   // 30%
  treasury: number;    // 20%
}

export function splitFee(amount: number): FeeSplit {
  return {
    total: amount,
    lp: amount * (LP_SHARE_BPS / 10000),
    insurance: amount * (INSURANCE_SHARE_BPS / 10000),
    treasury: amount * (TREASURY_SHARE_BPS / 10000),
  };
}

export function calculateInterestOwed(
  borrowed: number,
  borrowRateAnnual: number,
  durationSeconds: number
): number {
  const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
  return borrowed * borrowRateAnnual * (durationSeconds / SECONDS_PER_YEAR);
}

export interface LendingPoolState {
  totalDeposited: number;   // Total USDC deposited by LPs
  totalBorrowed: number;    // Total USDC borrowed by traders
  insuranceReserve: number; // Insurance fund
  utilization: number;      // totalBorrowed / totalDeposited
  borrowRate: number;       // Current annualized borrow rate
  supplyRate: number;       // Current annualized supply rate (APY for depositors)
}

export function computePoolState(totalDeposited: number, totalBorrowed: number, insuranceReserve: number): LendingPoolState {
  const utilization = totalDeposited > 0 ? totalBorrowed / totalDeposited : 0;
  const borrowRate = calculateBorrowRate(utilization);
  const supplyRate = calculateSupplyRate(utilization);
  return { totalDeposited, totalBorrowed, insuranceReserve, utilization, borrowRate, supplyRate };
}

// -- Export constants so UI can display the fee table --
export const FEE_CONFIG = {
  openClosePct: OPEN_CLOSE_FEE_BPS / 100,         // 0.4
  borrowAprRange: {
    min: BASE_RATE_BPS / 100,                      // 5
    max: (BASE_RATE_BPS + SLOPE1_BPS + SLOPE2_BPS) / 100  // 78
  },
  liquidationPenaltyPct: LIQUIDATION_PENALTY_BPS / 100, // 5
  lpSharePct: LP_SHARE_BPS / 100,                  // 50
  insuranceSharePct: INSURANCE_SHARE_BPS / 100,    // 30
  treasurySharePct: TREASURY_SHARE_BPS / 100,     // 20
} as const;
