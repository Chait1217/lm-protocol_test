import React from "react";
import { motion } from "framer-motion";
import { Zap, TrendingUp, Shield } from "lucide-react";

const takeaways = [
  {
    icon: Zap,
    text: "Leverage x2–x10 on prediction markets",
  },
  {
    icon: TrendingUp,
    text: "Real yield vaults funded by trading demand",
  },
  {
    icon: Shield,
    text: "Liquidations + insurance reserve for solvency",
  },
];

export default function KeyTakeaways() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
      {takeaways.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="p-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/15 hover:border-[#00FF99]/30 transition-all"
        >
          <item.icon className="w-8 h-8 text-[#00FF99] mb-3" />
          <p className="text-white font-medium text-sm">{item.text}</p>
        </motion.div>
      ))}
    </div>
  );
}
