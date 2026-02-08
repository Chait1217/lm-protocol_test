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
    <section className={`h-full flex flex-col rounded-xl md:rounded-2xl border border-[#00FF99]/25 p-2 sm:p-5 md:p-8 bg-gray-900/40 ${compact ? "py-2 sm:py-5 md:py-8" : "py-4 sm:py-10 md:py-16"}`}>
      <h2 className="text-sm sm:text-2xl md:text-3xl font-bold text-white mb-1 md:mb-4 text-center">
        How Vaults Work
      </h2>
      <p className="text-gray-400 text-[10px] sm:text-base mb-2 md:mb-6 text-center">
        Three simple steps to earn yield
      </p>

      <div className={`space-y-1.5 md:space-y-4 ${compact ? "" : "max-w-2xl mx-auto"}`}>
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            viewport={{ once: true }}
            className="flex gap-2 md:gap-4 items-start p-1.5 md:p-4 rounded-lg md:rounded-xl bg-gray-900/50 border border-[#00FF99]/10 hover:border-[#00FF99]/20 hover:bg-gray-900/70 transition-all"
          >
            <div className="w-6 h-6 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-[#00FF99]/10 flex items-center justify-center flex-shrink-0">
              <step.icon className="w-3 h-3 md:w-6 md:h-6 text-[#00FF99]" />
            </div>
            <div>
              <div className="text-[#00FF99] text-[8px] md:text-xs font-semibold uppercase tracking-wider mb-0 md:mb-1">
                Step {i + 1}
              </div>
              <h3 className="text-white font-semibold text-[10px] md:text-base mb-0 md:mb-1">{step.title}</h3>
              <p className="text-gray-400 text-[9px] md:text-sm">{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <p className={`mt-2 md:mt-6 text-gray-500 text-[9px] md:text-sm ${compact ? "" : "text-center max-w-2xl mx-auto px-4"}`}>
        Risk is managed with margin + automated liquidations; an insurance reserve helps cover rare gaps.
      </p>
    </section>
  );
}
