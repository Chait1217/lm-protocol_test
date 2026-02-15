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
          ? "border-emerald-500/30 bg-emerald-500/5 shadow-glow"
          : "border-emerald-900/20 bg-black/40"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={`text-xl font-bold font-mono ${
          highlight ? "text-emerald-400" : "text-white"
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
