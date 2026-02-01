import React from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowRight, TrendingUp } from "lucide-react";

const steps = [
  { icon: Wallet, label: "Deposit", desc: "Add USDC to the vault" },
  { icon: ArrowRight, label: "Borrow", desc: "Traders use leverage" },
  { icon: TrendingUp, label: "Earn Yield", desc: "LPs earn interest + fees" },
];

export default function ThreeStepLadder() {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 py-8">
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.15 }}
            viewport={{ once: true }}
            className="flex flex-col items-center p-6 rounded-xl bg-gray-900/60 border border-[#00FF99]/20 min-w-[140px]"
          >
            <div className="w-12 h-12 rounded-full bg-[#00FF99]/10 flex items-center justify-center mb-3">
              <step.icon className="w-6 h-6 text-[#00FF99]" />
            </div>
            <span className="text-[#00FF99] font-bold text-sm">{step.label}</span>
            <span className="text-gray-400 text-xs mt-1">{step.desc}</span>
          </motion.div>
          {i < steps.length - 1 && (
            <svg className="hidden sm:block w-6 h-6 text-[#00FF99]/50 flex-shrink-0 rotate-[-90deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7 7" />
            </svg>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

