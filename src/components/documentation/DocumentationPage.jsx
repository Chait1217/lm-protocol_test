import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, HelpCircle } from "lucide-react";
import TableOfContents from "./TableOfContents";
import DocSection from "./DocSection";
import QuickStartCards from "./QuickStartCards";
import ConceptCards from "./ConceptCards";

export default function DocumentationPage({ setCurrentPage }) {
  const [activeSection, setActiveSection] = useState("quick-start");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="min-h-screen bg-black pt-16 sm:pt-20 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 sm:py-16"
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Documentation</h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Everything you need to understand LM Protocol and start using it.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setCurrentPage?.("whitepaper")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#00FF99] text-black font-bold rounded-xl hover:bg-[#00FF99]/90 transition-all"
            >
              <FileText className="w-5 h-5" />
              Read the Whitepaper
            </button>
            <button
              onClick={() => setCurrentPage?.("faq")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white font-bold rounded-xl border border-gray-700 hover:border-[#00FF99]/50 transition-all"
            >
              <HelpCircle className="w-5 h-5" />
              View FAQ
            </button>
          </div>
        </motion.div>

        {/* Intro */}
        <p className="text-gray-400 leading-relaxed mb-16 max-w-3xl mx-auto text-center">
          Welcome to the LM Protocol docs. LM is a leverage and margin layer built on top of prediction
          markets—designed to make outcome markets trade like real financial instruments, with
          transparent risk controls and real yield for liquidity providers.
        </p>

        {/* Main content + TOC */}
        <div className="flex flex-col lg:flex-row gap-12">
          <TableOfContents activeSection={activeSection} onNavigate={scrollToSection} />

          <article className="flex-1 min-w-0 space-y-16">
            {/* Quick Start */}
            <DocSection id="quick-start" onVisible={setActiveSection}>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                Quick Start
              </h2>
              <QuickStartCards />
            </DocSection>

            {/* Core Concepts */}
            <DocSection id="core-concepts" onVisible={setActiveSection}>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 pb-2 border-b border-[#00FF99]/20">
                Core Concepts
              </h2>
              <ConceptCards />
            </DocSection>

            {/* Fees */}
            <DocSection id="fees" onVisible={setActiveSection}>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                Fees (High-Level)
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                LM generates real yield through trading fees on open/close (on leveraged exposure),
                borrowing interest, and liquidation penalties.
              </p>
              <ul className="space-y-2 text-gray-400 list-disc list-inside">
                <li>Open/Close fees on leveraged exposure</li>
                <li>Borrow interest while the trade is open</li>
                <li>Liquidation penalties if liquidated</li>
              </ul>
              <p className="text-gray-500 text-sm mt-4 italic">
                Exact parameters may change during alpha.
              </p>
            </DocSection>

            {/* Protocol Status */}
            <DocSection id="protocol-status" onVisible={setActiveSection}>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                Protocol Status
              </h2>
              <p className="text-gray-400 leading-relaxed">
                LM launches in phases with curated markets and risk limits to ensure clean execution
                and stable risk management.
              </p>
            </DocSection>

            {/* Need Help */}
            <DocSection id="need-help" onVisible={setActiveSection}>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 pb-2 border-b border-[#00FF99]/20">
                Need Help?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setCurrentPage?.("faq")}
                  className="p-6 rounded-xl bg-gray-900/60 border border-[#00FF99]/15 hover:border-[#00FF99]/30 hover:shadow-[0_0_30px_rgba(0,255,153,0.08)] transition-all text-left"
                >
                  <HelpCircle className="w-8 h-8 text-[#00FF99] mb-3" />
                  <h3 className="text-white font-semibold mb-2">FAQ</h3>
                  <p className="text-gray-400 text-sm">Find answers to common questions.</p>
                </button>
                <button
                  onClick={() => setCurrentPage?.("faq")}
                  className="p-6 rounded-xl bg-gray-900/60 border border-[#00FF99]/15 hover:border-[#00FF99]/30 hover:shadow-[0_0_30px_rgba(0,255,153,0.08)] transition-all text-left"
                >
                  <FileText className="w-8 h-8 text-[#00FF99] mb-3" />
                  <h3 className="text-white font-semibold mb-2">Contact</h3>
                  <p className="text-gray-400 text-sm">Reach us via the FAQ page contact form.</p>
                </button>
              </div>
            </DocSection>
          </article>
        </div>
      </div>
    </div>
  );
}
