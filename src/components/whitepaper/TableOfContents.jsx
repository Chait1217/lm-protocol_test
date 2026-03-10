import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const SECTIONS = [
  { id: "abstract", label: "Abstract" },
  { id: "problem", label: "The Problem & Opportunity" },
  { id: "solution", label: "The Solution: LM Infrastructure" },
  { id: "business", label: "Business Model & Revenue" },
  { id: "roadmap", label: "Roadmap (2026)" },
  { id: "scenarios", label: "Performance Scenarios" },
  { id: "risks", label: "Risk Mitigation" },
];

export default function TableOfContents({ activeSection, onNavigate }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleClick = (id) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop: sticky TOC */}
      <nav className="hidden lg:block w-56 flex-shrink-0">
        <div className="sticky top-24">
          <h3 className="text-xs font-semibold text-[#00FF99] uppercase tracking-wider mb-4">
            Contents
          </h3>
          <ul className="space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => handleClick(s.id)}
                  className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all ${
                    activeSection === s.id
                      ? "text-[#00FF99] bg-[#00FF99]/10 border-l-2 border-[#00FF99] -ml-px pl-4"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Mobile: collapsible TOC */}
      <div className="lg:hidden mb-8">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/20 text-white font-medium"
        >
          Table of Contents
          <ChevronDown className={`w-5 h-5 transition-transform ${mobileOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ul className="py-3 space-y-1 border border-t-0 border-[#00FF99]/20 rounded-b-xl bg-gray-900/40 px-4">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => handleClick(s.id)}
                      className={`w-full text-left py-2 text-sm transition-all ${
                        activeSection === s.id ? "text-[#00FF99]" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
