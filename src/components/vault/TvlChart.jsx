import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

/**
 * TVL chart showing vault TVL over time.
 * Uses mock data - replace with real API data when available.
 * @param {number} currentTvl - Current TVL value for reference
 * @param {Array} data - Optional pre-generated data; if not provided, generates mock data
 */
export default function TvlChart({ currentTvl = 1234567, data: propData }) {
  const data = useMemo(() => {
    if (propData && propData.length > 0) return propData;
    // Generate mock TVL data (last 24 points, ~hourly over 24h)
    const points = [];
    const now = Date.now();
    const baseTvl = currentTvl * 0.85;
    for (let i = 23; i >= 0; i--) {
      const t = new Date(now - i * 60 * 60 * 1000);
      const variation = Math.sin(i * 0.3) * 0.08 + Math.random() * 0.04;
      const tvl = Math.round(baseTvl * (1 + variation));
      points.push({
        time: t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        tvl,
        fullDate: t.toISOString(),
      });
    }
    // Ensure last point is current TVL
    if (points.length > 0) points[points.length - 1].tvl = currentTvl;
    return points;
  }, [currentTvl, propData]);

  const formatTvl = (val) => {
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return `$${val}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="p-6 rounded-2xl bg-gray-900/60 border border-[#00FF99]/15 hover:border-[#00FF99]/25 transition-all"
    >
      <h3 className="text-lg font-bold text-white mb-2">Vault TVL Over Time</h3>
      <p className="text-gray-500 text-xs mb-4">
        Real-time total value locked in the USDC vault
      </p>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00FF99" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#00FF99" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              stroke="#666"
              tick={{ fill: "#999", fontSize: 10 }}
              axisLine={{ stroke: "#333" }}
              tickLine={{ stroke: "#333" }}
            />
            <YAxis
              stroke="#666"
              tick={{ fill: "#999", fontSize: 10 }}
              axisLine={{ stroke: "#333" }}
              tickLine={{ stroke: "#333" }}
              tickFormatter={formatTvl}
              domain={["dataMin", "dataMax"]}
            />
            <Area
              type="monotone"
              dataKey="tvl"
              stroke="#00FF99"
              strokeWidth={2}
              fill="url(#tvlGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex justify-between items-center text-sm">
        <span className="text-gray-400">Current TVL</span>
        <span className="text-[#00FF99] font-bold">{formatTvl(currentTvl)}</span>
      </div>
    </motion.div>
  );
}
