import React from "react";
import { motion } from "framer-motion";
import { Zap, Shield, Database, Activity, AlertTriangle } from "lucide-react";

const CONCEPTS = [
  {
    id: "leverage",
    icon: Zap,
    title: "Leverage & Collateral",
    text: "Leverage lets you control more exposure than your deposit by borrowing liquidity from the USDC Vault. Your USDC collateral absorbs losses.",
  },
  {
    id: "liquidation",
    icon: Shield,
    title: "Liquidation",
    text: "Every position has a liquidation price. If margin falls below the maintenance requirement, the protocol automatically closes the position to protect the Vault.",
  },
  {
    id: "vault",
    icon: Database,
    title: "USDC Yield Vault",
    text: "The Vault supplies liquidity that powers leverage. Depositors earn yield from real protocol demand rather than token emissions.",
  },
  {
    id: "rates",
    icon: Activity,
    title: "Demand-Based Rates",
    text: "Borrowing rates adjust automatically based on utilization (borrowed liquidity ÷ total liquidity). Higher utilization generally increases borrow rates and LP yield.",
  },
  {
    id: "insurance",
    icon: AlertTriangle,
    title: "Insurance Reserve",
    text: "A portion of fees is routed to an insurance reserve designed to cover rare 'bad debt' events during extreme market moves.",
  },
];

export default function ConceptCards() {
  return (
    <div className="space-y-4">
      {CONCEPTS.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05 }}
          className="p-5 rounded-xl bg-gray-900/60 border border-[#00FF99]/15 hover:border-[#00FF99]/25 transition-all"
        >
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#00FF99]/10 flex items-center justify-center flex-shrink-0">
              <item.icon className="w-5 h-5 text-[#00FF99]" />
            </div>
            <div>
              <h4 className="text-white font-semibold mb-2">{item.title}</h4>
              <p className="text-gray-400 text-sm leading-relaxed">{item.text}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
