import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import TableOfContents from "./TableOfContents";
import KeyTakeaways from "./KeyTakeaways";
import ThreeStepLadder from "./ThreeStepLadder";
import Section from "./Section";

export default function WhitepaperPage() {
  const [activeSection, setActiveSection] = useState("abstract");

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
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Whitepaper
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Institutional-grade leverage for prediction markets
          </p>
        </motion.div>

        {/* Key Takeaways */}
        <KeyTakeaways />

        {/* Main content + TOC */}
        <div className="flex flex-col lg:flex-row gap-12">
          <TableOfContents activeSection={activeSection} onNavigate={scrollToSection} />

          <article className="flex-1 min-w-0 prose prose-invert max-w-none">
            <div className="space-y-16">
              {/* Abstract */}
              <Section id="abstract" onVisible={setActiveSection}>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                  1. Abstract
                </h2>
                <p className="text-gray-300 leading-relaxed">
                  LM Protocol (Lever Market) is a decentralized leverage layer built for prediction markets. 
                  By introducing margin accounts and leverage (max 5x) on top of existing platforms like Polymarket, 
                  we enable professional traders to optimize capital and casual users to amplify returns—while 
                  providing real yield to liquidity providers through borrow interest and trading fees.
                </p>
              </Section>

              {/* Problem & Opportunity */}
              <Section id="problem" onVisible={setActiveSection}>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                  2. The Problem & Opportunity
                </h2>
                <div className="space-y-6 text-gray-300 leading-relaxed">
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Spot limitation</h3>
                    <p>Prediction markets operate almost exclusively on a spot basis. Professional traders are capped by liquidity; casual users find low returns on favorites (e.g., 80% outcomes). LM breaks this ceiling with leverage (max 5x).</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Non-binary market structure</h3>
                    <p>Prediction markets trade shares (0.80 = 80% probability)—continuous, not binary. This enables liquidation prices and maintenance margins, making institutional-grade leverage possible.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Yield gap for LPs</h3>
                    <p>Stablecoin holders lack real yield options. LM creates Leverage Vaults where LPs act as the "bank" for leverage, earning organic yield from trading fees and interest.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Betting → financial markets</h3>
                    <p>The shift from opaque sportsbooks to transparent on-chain markets is underway. LM transforms simple bets into leveraged financial positions, bridging the $400B sports betting and multi-trillion derivatives markets.</p>
                  </div>
                </div>
              </Section>

              {/* Solution */}
              <Section id="solution" onVisible={setActiveSection}>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                  3. The Solution: LM Infrastructure
                </h2>
                <div className="space-y-6 text-gray-300 leading-relaxed">
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Leverage layer (max 5x, cross-margin, liquidation price)</h3>
                    <p>LM acts as a decentralized margin engine: cross-margin accounts, flexible leverage slider (max 5x), real-time liquidation price, instant execution on L2.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Yield vaults (peer-to-pool)</h3>
                    <p>LPs deposit USDC into Vaults. Capital funds margin for traders—never at risk from bets. Dynamic interest via utilization curve increases APY as demand rises.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Dynamic interest rates (demand-based rate model)</h3>
                    <p>Utilization curve (Aave/Compound-style): higher demand → higher rates → higher LP APY.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Liquidation engine + insurance fund</h3>
                    <p>24/7 monitoring of VaR; automated liquidations when margin falls below threshold; insurance fund from fees covers rare bad debt.</p>
                  </div>
                </div>

                <ThreeStepLadder />

                {/* Definition boxes */}
                <div className="grid gap-4 mt-8">
                  <div className="p-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/10 font-mono text-sm text-white">
                    <span className="text-[#00FF99]">Utilization</span> = borrowed liquidity ÷ total vault liquidity
                  </div>
                  <div className="p-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/10 font-mono text-sm text-white">
                    <span className="text-[#00FF99]">Collateral</span> = USDC deposited as margin for leveraged positions
                  </div>
                  <div className="p-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/10 font-mono text-sm text-white">
                    <span className="text-[#00FF99]">Liquidation</span> = automatic position close when margin falls below maintenance threshold
                  </div>
                </div>
              </Section>

              {/* Business Model */}
              <Section id="business" onVisible={setActiveSection}>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                  4. Business Model & Revenue
                </h2>
                <div className="space-y-6 text-gray-300 leading-relaxed">
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Open/close fees (fees on leveraged exposure)</h3>
                    <p>0.1%–0.3% on total leveraged position size. Example: $1,000 with 5x = $5,000 exposure → fee on $5,000.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Borrow interest + protocol performance fee</h3>
                    <p>Traders pay interest to use Vault capital. Protocol takes 10–20% performance fee before distributing to LPs.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Liquidation penalties + splits (liquidators/insurance/treasury)</h3>
                    <p>2–5% liquidation fee from remaining collateral, split between liquidators, insurance fund, and treasury.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Ecosystem flywheel</h3>
                    <p>High volume → more fees → higher LP APY → more LPs → larger Vaults → higher leverage caps → market dominance.</p>
                  </div>
                </div>
              </Section>

              {/* Tokenomics */}
              <Section id="tokenomics" onVisible={setActiveSection}>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                  5. Tokenomics (LMP)
                </h2>
                <div className="space-y-4 text-gray-300 leading-relaxed">
                  <p><strong className="text-[#00FF99]">Value capture via buyback & distribute / burn:</strong> A portion of protocol revenue buys back $LMP from the market—burned or distributed to stakers.</p>
                  <p><strong className="text-[#00FF99]">Staking as security backstop:</strong> Staked $LMP acts as a backstop for the insurance fund, earning a share of revenue in exchange for securing the system.</p>
                </div>
              </Section>

              {/* Roadmap */}
              <Section id="roadmap" onVisible={setActiveSection}>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                  6. Roadmap (2026)
                </h2>
                <div className="space-y-6 text-gray-300 leading-relaxed">
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Phase 1: Token generation & core build (Q1)</h3>
                    <p>$LMP launch, smart contract suite (Vaults, Margin Engine, Liquidation Bots), early staking.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Phase 2: Selective alpha (Late Q1 – Early Q2)</h3>
                    <p>Controlled alpha with high-liquidity markets, selection algorithm for solvency, stress testing.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Phase 3: Broad beta (Q2)</h3>
                    <p>Vault expansion, market maker onboarding, advanced tools (cross-margin, trailing stop-losses).</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Phase 4: Full deployment (Q3 & beyond)</h3>
                    <p>Unrestricted scaling, cross-chain expansion, AI-agent integration.</p>
                  </div>
                </div>
              </Section>

              {/* Performance Scenarios */}
              <Section id="scenarios" onVisible={setActiveSection}>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                  7. Performance Scenarios
                </h2>
                <div className="space-y-6 text-gray-300 leading-relaxed">
                  <div className="p-6 rounded-xl bg-[#00FF99]/5 border border-[#00FF99]/20">
                    <h3 className="text-lg font-semibold text-[#00FF99] mb-2">Bull case (hyper-growth)</h3>
                    <p>Prediction markets become global standard. $250M+ monthly volume. $600k–$800k/month revenue. LP APY &gt;25%. Top 50 DeFi by revenue.</p>
                  </div>
                  <div className="p-6 rounded-xl bg-gray-900/60 border border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-400 mb-2">Bear case (slow adoption)</h3>
                    <p>Crypto sideways, lukewarm retail. $30M–$50M monthly volume. $75k–$125k/month revenue. LP APY 8–10%. Profitable niche powerhouse.</p>
                  </div>
                </div>
              </Section>

              {/* Risk Mitigation */}
              <Section id="risks" onVisible={setActiveSection}>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                  8. Risk Mitigation
                </h2>
                <div className="space-y-4 text-gray-300 leading-relaxed">
                  <p><strong className="text-[#00FF99]">Revenue in USDC:</strong> Fees collected in stables—development and operations funded regardless of $LMP price.</p>
                  <p><strong className="text-[#00FF99]">Non-cyclical markets:</strong> Sports and global events (elections, macro) occur regardless of crypto cycles. Revenue uncorrelated to general market.</p>
                </div>
              </Section>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
