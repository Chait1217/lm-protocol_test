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

              {/* Business Model & Revenue */}
              <Section id="business" onVisible={setActiveSection}>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                  4. Business Model &amp; Revenue
                </h2>

                {/* 4.1 Trader Fee Structure */}
                <h3 className="text-lg font-semibold text-[#00FF99] mb-3">Trader Fee Structure</h3>
                <p className="text-gray-300 leading-relaxed mb-4">Premium leverage service on prediction markets:</p>
                <div className="grid gap-3 mb-8">
                  <div className="p-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/10">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Open / Close Fee</span>
                      <span className="text-[#00FF99] font-bold text-lg">0.4%</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">Of total leveraged notional</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/10">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Borrowing Interest</span>
                      <span className="text-[#00FF99] font-bold text-lg">Dynamic Kink Model</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">5–78% APR depending on utilization</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/10">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Liquidation Penalty</span>
                      <span className="text-[#00FF99] font-bold text-lg">5%</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">Of remaining collateral on insufficient margin</p>
                  </div>
                </div>

                {/* 4.2 Dynamic Borrowing Interest (Kink Model) */}
                <h3 className="text-lg font-semibold text-[#00FF99] mb-3">Dynamic Borrowing Interest (Kink Model)</h3>
                <div className="p-5 rounded-xl bg-gray-900/60 border border-[#00FF99]/10 font-mono text-sm mb-6">
                  <div className="text-gray-400 mb-3">BASE: 5% &nbsp;|&nbsp; KINK: 70% &nbsp;|&nbsp; SLOPE1: 15% &nbsp;|&nbsp; SLOPE2: 60%</div>
                  <div className="h-px bg-gray-700 mb-3" />
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-gray-400">Util 30%</span><span className="text-white">7.9% APR</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Util 50%</span><span className="text-white">11.4% APR</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Util 70%</span><span className="text-[#00FF99]">20.0% APR (kink)</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Util 85%</span><span className="text-yellow-400">35.0% APR</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Util 95%</span><span className="text-red-400">78.0% APR</span></div>
                  </div>
                </div>

                <h4 className="text-base font-semibold text-white mb-3">Interest Split</h4>
                <p className="text-gray-400 text-sm mb-3">Distribution of interest paid by traders:</p>
                <div className="grid gap-3 mb-8">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#00FF99]/5 border border-[#00FF99]/20">
                    <span className="text-[#00FF99] font-semibold">88% → LP Yield</span>
                    <span className="text-gray-400 text-sm">Vault auto-compounds</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <span className="text-yellow-400 font-semibold">7% → Insurance</span>
                    <span className="text-gray-400 text-sm">Bad debt coverage</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <span className="text-red-400 font-semibold">5% → Protocol</span>
                    <span className="text-gray-400 text-sm">Treasury</span>
                  </div>
                </div>

                {/* 4.3 Revenue Distribution */}
                <h3 className="text-lg font-semibold text-[#00FF99] mb-3">Revenue Distribution (Real Yield + $LMP Flywheel)</h3>
                <p className="text-gray-300 leading-relaxed mb-4">Every net profit dollar:</p>
                <div className="grid gap-3 mb-8">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#00FF99]/5 border border-[#00FF99]/20">
                    <span className="text-[#00FF99] font-bold text-lg">50% → Vault (LPs)</span>
                    <span className="text-gray-400 text-sm">USDC yield</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                    <span className="text-cyan-400 font-bold text-lg">30% → $LMP Buyback</span>
                    <span className="text-gray-400 text-sm">Constant demand</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <span className="text-amber-400 font-bold text-lg">20% → Treasury</span>
                    <span className="text-gray-400 text-sm">Growth capital</span>
                  </div>
                </div>

                {/* 4.4 Fee Structure Summary Table */}
                <h3 className="text-lg font-semibold text-white mb-4">Fee Structure Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-3 text-gray-400 font-medium">Fee Source</th>
                        <th className="text-left py-3 px-3 text-gray-400 font-medium">Rate</th>
                        <th className="text-right py-3 px-3 text-[#00FF99] font-medium">LP 50%</th>
                        <th className="text-right py-3 px-3 text-cyan-400 font-medium">$LMP 30%</th>
                        <th className="text-right py-3 px-3 text-amber-400 font-medium">Treasury 20%</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      <tr className="border-b border-gray-800">
                        <td className="py-3 px-3 font-medium text-white">Open / Close</td>
                        <td className="py-3 px-3">0.4% notional</td>
                        <td className="py-3 px-3 text-right text-[#00FF99]">0.2%</td>
                        <td className="py-3 px-3 text-right text-cyan-400">0.12%</td>
                        <td className="py-3 px-3 text-right text-amber-400">0.08%</td>
                      </tr>
                      <tr className="border-b border-gray-800">
                        <td className="py-3 px-3 font-medium text-white">Borrow APR</td>
                        <td className="py-3 px-3">5–78% (kink)</td>
                        <td className="py-3 px-3 text-right text-[#00FF99]">2.5–39%</td>
                        <td className="py-3 px-3 text-right text-cyan-400">1.5–23.4%</td>
                        <td className="py-3 px-3 text-right text-amber-400">1–15.6%</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-medium text-white">Liquidation</td>
                        <td className="py-3 px-3">5% collateral</td>
                        <td className="py-3 px-3 text-right text-[#00FF99]">2.5%</td>
                        <td className="py-3 px-3 text-right text-cyan-400">1.5%</td>
                        <td className="py-3 px-3 text-right text-amber-400">1%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* Tokenomics */}
              <Section id="tokenomics" onVisible={setActiveSection}>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 pb-2 border-b border-[#00FF99]/20">
                  5. Tokenomics (LMP)
                </h2>
                <div className="space-y-4 text-gray-300 leading-relaxed mb-8">
                  <p><strong className="text-[#00FF99]">Value capture via buyback & distribute / burn:</strong> A portion of protocol revenue buys back $LMP from the market—burned or distributed to stakers.</p>
                  <p><strong className="text-[#00FF99]">Staking as security backstop:</strong> Staked $LMP acts as a backstop for the insurance fund, earning a share of revenue in exchange for securing the system.</p>
                </div>

                <h3 className="text-lg font-semibold text-[#00FF99] mb-4">$LMP Staker Advantages</h3>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/10">
                    <span className="text-white font-semibold">7.5x Max Leverage</span>
                    <span className="text-gray-400 text-sm">vs 5x regular</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/10">
                    <span className="text-white font-semibold">Up to 50% Fee Discounts</span>
                    <span className="text-gray-400 text-sm">Borrow + mirroring costs</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/10">
                    <span className="text-white font-semibold">Priority Execution Queue</span>
                    <span className="text-gray-400 text-sm">Faster fills, less slippage</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/60 border border-[#00FF99]/10">
                    <span className="text-white font-semibold">30% Extra Liquidation Buffer</span>
                    <span className="text-gray-400 text-sm">45% total protection</span>
                  </div>
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
