"use client";

import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  subValue?: string;
  highlight?: boolean;
}

export default function StatCard({
  label,
  value,
  icon,
  subValue,
  highlight = false,
}: StatCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-neon/30 bg-neon/5 neon-glow"
          : "border-gray-800/50 bg-gray-900/50"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={`text-xl font-bold ${
          highlight ? "text-neon" : "text-white"
        }`}
      >
        {value}
      </div>
      {subValue && (
        <div className="text-xs text-gray-500 mt-0.5">{subValue}</div>
      )}
    </div>
  );
}
