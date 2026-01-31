import React from "react";
import { motion } from "framer-motion";

/**
 * Donut chart showing APY sources: Borrow Interest vs Trading Fees.
 * @param {{ interestPct: number, feesPct: number }} apyBreakdown - percentages (e.g. 70/30)
 */
export default function ApyBreakdownDonut({ apyBreakdown = { interestPct: 70, feesPct: 30 } }) {
  const { interestPct = 70, feesPct = 30 } = apyBreakdown;
  const total = interestPct + feesPct;
  const interest = total > 0 ? (interestPct / total) * 100 : 70;
  const fees = total > 0 ? (feesPct / total) * 100 : 30;

  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const interestLength = (interest / 100) * circumference;
  const feesLength = (fees / 100) * circumference;

  return (
    <div className="p-6 rounded-2xl bg-gray-900/60 border border-[#00FF99]/15 hover:border-[#00FF99]/25 transition-all">
      <h3 className="text-lg font-bold text-white mb-2">Where APY Comes From</h3>
      <p className="text-gray-500 text-xs mb-4">
        A portion of fees may support the insurance reserve.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* SVG Donut - two stroke segments */}
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            <defs>
              <linearGradient id="interestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00FF99" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#00CC7A" stopOpacity={0.9} />
              </linearGradient>
              <linearGradient id="feesGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#888888" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#666666" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={strokeWidth}
            />
            {/* Interest slice (first, larger) */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="url(#interestGrad)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${interestLength} ${circumference}`}
              strokeDashoffset={0}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${interestLength} ${circumference}` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              strokeLinecap="round"
            />
            {/* Fees slice (second, starts where interest ends) */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="url(#feesGrad)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${feesLength} ${circumference}`}
              strokeDashoffset={-interestLength}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${feesLength} ${circumference}` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xl font-bold text-white">APY</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 min-w-[140px]">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-[#00FF99] flex-shrink-0" />
            <div>
              <div className="text-white font-medium text-sm">Borrow Interest</div>
              <div className="text-[#00FF99] font-bold">{interest.toFixed(0)}%</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-[#888888] flex-shrink-0" />
            <div>
              <div className="text-white font-medium text-sm">Trading Fees</div>
              <div className="text-gray-400 font-bold">{fees.toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
