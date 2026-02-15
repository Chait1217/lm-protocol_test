"use client";

import { ReactNode } from "react";

interface TxButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  children: ReactNode;
  className?: string;
}

export default function TxButton({
  onClick,
  loading = false,
  disabled = false,
  variant = "primary",
  children,
  className = "",
}: TxButtonProps) {
  const base =
    "relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-neon/20 text-neon border border-neon/30 hover:bg-neon/30 hover:border-neon/50 active:scale-[0.98]",
    secondary:
      "bg-white/5 text-gray-300 border border-gray-700 hover:bg-white/10 hover:border-gray-600 active:scale-[0.98]",
    danger:
      "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 active:scale-[0.98]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading && <div className="spinner" />}
      {children}
    </button>
  );
}
