import React from "react";
import { motion } from "framer-motion";

/**
 * Horizontal utilization gauge with Low / Healthy / High zones.
 * @param {number} utilization - 0-100
 */
export default function UtilizationGauge({ utilization = 67.5 }) {
  const clamped = Math.max(0, Math.min(100, utilization));
  const getZone = () => {
    if (clamped < 40) return { label: "Low", color: "#00FF99" };
    if (clamped < 80) return { label: "Healthy", color: "#00FF99" };
    return { label: "High", color: "#f59e0b" };
  };
  const zone = getZone();

  return (
    <div className="p-6 rounded-2xl bg-gray-900/60 border border-[#00FF99]/15 hover:border-[#00FF99]/25 transition-all">
      <h3 className="text-lg font-bold text-white mb-2">Utilization Gauge</h3>
      <p className="text-gray-500 text-xs mb-4">
        Utilization = borrowed liquidity ÷ total vault liquidity.
      </p>

      {/* Horizontal meter */}
      <div className="relative h-10 rounded-full overflow-hidden bg-gray-800 border border-gray-700/50">
        {/* Zone backgrounds */}
        <div className="absolute inset-0 flex">
          <div className="h-full bg-[#00FF99]/10" style={{ width: "40%" }} />
          <div className="h-full bg-[#00FF99]/15" style={{ width: "40%" }} />
          <div className="h-full bg-amber-500/10" style={{ width: "20%" }} />
        </div>
        {/* Zone labels */}
        <div className="absolute inset-0 flex text-[10px] font-medium text-gray-500 items-center">
          <span className="pl-2" style={{ width: "40%" }}>Low</span>
          <span className="pl-2" style={{ width: "40%" }}>Healthy</span>
          <span className="pl-2" style={{ width: "20%" }}>High</span>
        </div>
        {/* Fill bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#00FF99]/50 to-[#00FF99]/70 rounded-full z-10"
        />
        {/* Needle / marker at end of fill */}
        <motion.div
          initial={{ left: "0%" }}
          animate={{ left: `${clamped}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute top-0 bottom-0 w-1 bg-white rounded-full z-20 shadow-[0_0_8px_rgba(255,255,255,0.5)] -translate-x-1/2"
        />
      </div>

      <div className="mt-4 flex justify-between items-center">
        <span className="text-2xl font-bold text-white">{clamped.toFixed(1)}%</span>
        <span
          className="text-sm font-medium px-2 py-0.5 rounded"
          style={{ color: zone.color, backgroundColor: `${zone.color}20` }}
        >
          {zone.label}
        </span>
      </div>
    </div>
  );
}
