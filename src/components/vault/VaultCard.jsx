import React from "react";
import { motion } from "framer-motion";

const formatTvl = (n) => "$" + n.toLocaleString();
const formatApy = (n) => n.toFixed(2) + "%";
const formatUtil = (n) => Math.max(0, Math.min(100, n)).toFixed(1) + "%";

/**
 * Small donut chart showing user's share vs others in the vault.
 */
function YourShareDonut({ yourShare = 0, size = 80 }) {
  const r = (size - 12) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const yourLength = (yourShare / 100) * circumference;
  const othersLength = circumference - yourLength;

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={10}
        />
        {yourShare > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#00FF99"
            strokeWidth={10}
            strokeDasharray={`${yourLength} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
        )}
        {yourShare < 100 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#444"
            strokeWidth={10}
            strokeDasharray={`${othersLength} ${circumference}`}
            strokeDashoffset={-yourLength}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 uppercase tracking-wider">Your share</div>
        <div className="text-lg font-bold text-[#00FF99]">{yourShare.toFixed(2)}%</div>
      </div>
    </div>
  );
}

export default function VaultCard({
  vault,
  amount,
  error,
  onAmountChange,
  onDeposit,
  onWithdraw,
  walletConnected,
  userBalance = 0,
}) {
  const yourShare = vault.tvl > 0 ? (userBalance / vault.tvl) * 100 : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0 h-full flex flex-col bg-gradient-to-br from-gray-900/95 to-black p-6 sm:p-8 rounded-2xl border border-[#00FF99]/25 shadow-[0_0_40px_rgba(0,255,153,0.08)] hover:shadow-[0_0_60px_rgba(0,255,153,0.12)] hover:border-[#00FF99]/30 transition-all duration-300"
    >
      {/* Header with logo */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-gray-800/80 flex items-center justify-center ring-2 ring-[#00FF99]/20 flex-shrink-0 overflow-hidden">
          <img
            src={vault.logo}
            alt={vault.symbol}
            className="w-10 h-10 object-contain"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-white">{vault.name}</h2>
          <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-medium bg-[#00FF99]/15 text-[#00FF99] rounded-full">
            {vault.symbol}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-black/40 border border-[#00FF99]/10">
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">TVL</div>
          <div className="text-lg font-bold text-white">{formatTvl(vault.tvl)}</div>
        </div>
        <div className="text-center border-x border-[#00FF99]/10">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">APY</div>
          <div className="text-lg font-bold text-[#00FF99]">{formatApy(vault.apy)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Utilization</div>
          <div className="text-lg font-bold text-white">{formatUtil(vault.utilization)}%</div>
        </div>
      </div>

      {/* Your balance */}
      <div className="text-sm text-gray-400 mb-4">
        Your balance in vault:{" "}
        <span className="text-white font-medium">{userBalance.toLocaleString()} {vault.symbol}</span>
      </div>

      {/* Amount input */}
      <input
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        placeholder="0.00"
        className="w-full bg-black/60 border border-[#00FF99]/25 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF99]/50 focus:ring-1 focus:ring-[#00FF99]/20 transition-all min-h-[52px] text-base"
      />
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

      {/* Actions */}
      <div className="flex gap-3 mt-5">
        <button
          onClick={onDeposit}
          disabled={!walletConnected}
          className="flex-1 py-3.5 bg-[#00FF99] text-black font-bold rounded-xl hover:bg-[#00FF99]/90 hover:shadow-[0_0_20px_rgba(0,255,153,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all min-h-[52px]"
        >
          Deposit
        </button>
        <button
          onClick={onWithdraw}
          disabled={!walletConnected}
          className="flex-1 py-3.5 bg-gray-800/80 text-white font-bold rounded-xl hover:bg-gray-700/80 border border-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[52px]"
        >
          Withdraw
        </button>
      </div>

      {/* Your share in vault - small donut chart */}
      <div className="mt-12 pt-6 border-t border-[#00FF99]/10">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Your share in vault</div>
        <YourShareDonut yourShare={yourShare} size={72} />
      </div>
    </motion.div>
  );
}
