import React from "react";
import {
  Database,
  Layers,
  Lock,
  TrendingUp,
  Shield,
  DollarSign,
} from "lucide-react";

const STEPS = [
  {
    number: "01",
    title: "LPs Deposit into the Vault",
    text: "Liquidity providers deposit USDC into a shared vault.",
    icon: Database,
  },
  {
    number: "02",
    title: "Vault Provides Borrowable Liquidity",
    text: "The vault pool becomes available liquidity that traders can borrow for leverage.",
    icon: Layers,
  },
  {
    number: "03",
    title: "Traders Post Collateral",
    text: "Traders deposit USDC collateral to open a leveraged position.",
    icon: Lock,
  },
  {
    number: "04",
    title: "Leverage is Created (Collateral + Borrowed USDC)",
    text: "The protocol combines trader collateral with borrowed vault USDC to increase exposure.",
    icon: TrendingUp,
  },
  {
    number: "05",
    title: "Risk Control (Margin + Liquidations)",
    text: "Positions are monitored continuously. If margin is too low, the position is auto-closed to protect the vault.",
    icon: Shield,
  },
  {
    number: "06",
    title: "Yield Flows Back (APY)",
    text: "Traders pay interest + fees. These flows generate vault APY and fund an insurance reserve.",
    icon: DollarSign,
  },
];

function StepBox({ step }) {
  const Icon = step.icon;
  return (
    <article
      className="group relative rounded-lg md:rounded-xl border border-[#00FF99]/20 bg-gradient-to-b from-gray-900 to-black p-1.5 sm:p-4 md:p-6 transition-all duration-300 hover:border-[#00FF99]/35 hover:shadow-[0_0_24px_rgba(0,255,153,0.08)] min-h-[56px] sm:min-h-[88px] md:min-h-[96px]"
      aria-labelledby={`step-${step.number}-title`}
    >
      <div className="absolute top-1 right-1 sm:top-4 sm:right-4 w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-[#00FF99]/15 border border-[#00FF99]/25 flex items-center justify-center">
        <span className="text-[8px] sm:text-xs font-bold text-[#00FF99] tabular-nums" aria-hidden="true">
          {step.number}
        </span>
      </div>
      <div className="flex items-start gap-1.5 sm:gap-3 md:gap-4">
        <div className="flex-shrink-0 w-6 h-6 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-lg md:rounded-xl bg-[#00FF99]/10 border border-[#00FF99]/20 flex items-center justify-center group-hover:shadow-[0_0_16px_rgba(0,255,153,0.2)] transition-shadow">
          <Icon className="w-3 h-3 sm:w-5 sm:h-5 text-[#00FF99]" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 pt-0 pr-6 sm:pr-12 md:pr-14">
          <h3 id={`step-${step.number}-title`} className="text-white font-bold text-[9px] sm:text-sm md:text-base mb-0.5 sm:mb-2 leading-tight">
            {step.title}
          </h3>
          <p className="text-gray-400 text-[8px] sm:text-xs md:text-sm leading-snug">
            {step.text}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function HowLMWorksSixBoxes() {
  return (
    <section
      className="rounded-xl md:rounded-2xl border border-[#00FF99]/15 bg-black/40 p-2 sm:p-5 md:p-8"
      aria-labelledby="how-lm-works-heading"
    >
      <header className="text-center mb-2 sm:mb-6 md:mb-10">
        <h2 id="how-lm-works-heading" className="text-sm sm:text-xl md:text-2xl font-bold text-white mb-0.5 sm:mb-2">
          How LM Works
        </h2>
        <p className="text-gray-400 text-[10px] sm:text-sm md:text-base max-w-2xl mx-auto px-1">
          Vault liquidity powers leverage — fees and interest flow back as real yield.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-3 md:gap-6">
        {STEPS.map((step) => (
          <StepBox key={step.number} step={step} />
        ))}
      </div>
    </section>
  );
}
