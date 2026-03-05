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
    "relative flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-gradient-to-r from-[#00ff88]/15 to-[#00cc6a]/10 text-[#00ff88] border border-[#00ff88]/25 hover:from-[#00ff88]/25 hover:to-[#00cc6a]/20 hover:border-[#00ff88]/40 hover:shadow-[0_0_25px_rgba(0,255,136,0.12)] active:scale-[0.98]",
    secondary:
      "bg-white/[0.03] text-[#999] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12] hover:text-white active:scale-[0.98]",
    danger:
      "bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 hover:border-red-500/40 hover:shadow-[0_0_25px_rgba(239,68,68,0.12)] active:scale-[0.98]",
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
