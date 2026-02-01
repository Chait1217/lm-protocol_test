import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

export default function FAQItem({ id, question, answer, isOpen, onToggle }) {
  return (
    <div
      className="rounded-xl border border-[#00FF99]/15 hover:border-[#00FF99]/25 transition-all overflow-hidden"
      role="region"
      aria-labelledby={`faq-heading-${id}`}
    >
      <button
        id={`faq-heading-${id}`}
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        aria-controls={`faq-content-${id}`}
        className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 text-left bg-gray-900/40 hover:bg-gray-900/60 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00FF99]/50 focus:ring-inset"
      >
        <span className={`font-medium text-sm sm:text-base ${isOpen ? "text-[#00FF99]" : "text-white"}`}>
          {question}
        </span>
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#00FF99]/10 flex items-center justify-center">
          {isOpen ? (
            <Minus className="w-4 h-4 text-[#00FF99]" />
          ) : (
            <Plus className="w-4 h-4 text-[#00FF99]" />
          )}
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={`faq-content-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 text-gray-400 text-sm sm:text-base leading-relaxed">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
