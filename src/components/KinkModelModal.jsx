import React from "react";
import { X } from "lucide-react";

// Same content as whitepaper §4.2 Dynamic Kink Model
export default function KinkModelModal({ onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" aria-hidden="true" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[#00FF99]/30 bg-gray-900 shadow-2xl p-5 sm:p-6">
        <div className="flex justify-between items-start gap-2 mb-4">
          <h3 className="text-lg font-semibold text-[#00FF99]">Dynamic Kink Model</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-gray-300 leading-relaxed mb-4 text-sm">
          Instead of using one fixed borrow rate, our Dynamic Kink Model automatically adjusts interest based on how much of the pool is being used. When utilization is low, rates stay gentle to encourage trading; as utilization rises past a &quot;kink&quot; point, rates ramp up more quickly to protect liquidity providers and keep the market in balance.
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse border border-gray-700 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-900/80">
                <th className="text-left py-3 px-4 text-gray-400 font-medium border-b border-gray-700">Utilization</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium border-b border-gray-700">Borrow APR</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-gray-800"><td className="py-3 px-4">0–60% (Low)</td><td className="py-3 px-4 text-[#00FF99]">5–10%</td></tr>
              <tr className="border-b border-gray-800"><td className="py-3 px-4">60–85% (Kink)</td><td className="py-3 px-4 text-yellow-400">15–25%</td></tr>
              <tr><td className="py-3 px-4">85%+ (High)</td><td className="py-3 px-4 text-red-400">40–75%</td></tr>
            </tbody>
          </table>
        </div>
        <h4 className="text-base font-semibold text-white mb-2">How it works</h4>
        <p className="text-gray-400 text-sm mb-2">
          Rates stay low to attract volume → gradually rise past 60% utilization → spike sharply above 85% to protect LPs and prevent exhaustion.
        </p>
        <p className="text-gray-300 text-sm font-medium">
          Result: Fair pricing + stable liquidity for everyone.
        </p>
      </div>
    </>
  );
}
