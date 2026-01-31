import React from "react";
import { motion } from "framer-motion";
import { Wallet, Zap, TrendingUp } from "lucide-react";

const steps = [
  {
    icon: Wallet,
    title: "Deposit USDC into the Vault",
    desc: "Add your USDC to the vault and start earning.",
  },
  {
    icon: Zap,
    title: "Liquidity funds leverage for traders",
    desc: "Your deposit backs leveraged positions for prediction market traders.",
  },
  {
    icon: TrendingUp,
    title: "Earn real yield from interest + trading fees",
    desc: "Receive a share of borrow interest and trading fees as yield.",
  },
];

export default function HowVaultsWorkSteps({ compact = false }) {
  return (
    <section className={`h-full flex flex-col rounded-2xl border border-[#00FF99]/25 p-6 sm:p-8 bg-gray-900/40 ${compact ? "py-6 sm:py-8" : "py-12 sm:py-16"}`}>
      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 text-center">
        How Vaults Work
      </h2>
      <p className="text-gray-400 text-sm sm:text-base mb-6 text-center">
        Three simple steps to earn yield
      </p>

      <div className={`space-y-4 ${compact ? "" : "max-w-2xl mx-auto"}`}>
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            viewport={{ once: true }}
            className="flex gap-3 sm:gap-4 items-start p-3 sm:p-4 rounded-xl bg-gray-900/50 border border-[#00FF99]/10 hover:border-[#00FF99]/20 hover:bg-gray-900/70 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-[#00FF99]/10 flex items-center justify-center flex-shrink-0">
              <step.icon className="w-6 h-6 text-[#00FF99]" />
            </div>
            <div>
              <div className="text-[#00FF99] text-xs font-semibold uppercase tracking-wider mb-1">
                Step {i + 1}
              </div>
              <h3 className="text-white font-semibold mb-1">{step.title}</h3>
              <p className="text-gray-400 text-sm">{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <p className={`mt-6 text-gray-500 text-sm ${compact ? "" : "text-center max-w-2xl mx-auto px-4"}`}>
        Risk is managed with margin + automated liquidations; an insurance reserve helps cover rare gaps.
      </p>
    </section>
  );
}
