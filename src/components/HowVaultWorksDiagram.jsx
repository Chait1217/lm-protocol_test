import React, { useRef, useState, useEffect } from "react";
import { Database, Lock, TrendingUp, DollarSign, ArrowDown, ArrowRight } from "lucide-react";

const STEPS = [
  {
    number: "01",
    title: "USDC Vault",
    subtitle: "LPs deposit",
    icon: Database,
  },
  {
    number: "02",
    title: "Collateral + Borrow",
    subtitle: "Traders borrow from vault",
    icon: Lock,
  },
  {
    number: "03",
    title: "Leveraged Position",
    subtitle: "Prediction markets",
    icon: TrendingUp,
  },
  {
    number: "04",
    title: "Yield & Revenue",
    subtitle: "LP APY, Insurance, Protocol",
    icon: DollarSign,
  },
];

const CONNECTOR_LABELS = [
  "Liquidity available for borrowing",
  "Create leveraged exposure",
  "Fees + interest paid by traders",
];

function StepCard({ step, isVisible }) {
  const Icon = step.icon;
  return (
    <article
      className={`
        relative rounded-2xl border border-[#00FF99]/20 bg-gradient-to-b from-gray-900 to-black
        p-5 sm:p-6 text-center
        shadow-[0_0_0_1px_rgba(0,255,153,0.08),0_4px_24px_rgba(0,0,0,0.4)]
        transition-all duration-500 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}
      `}
    >
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-7 h-7 rounded-lg bg-[#00FF99]/15 border border-[#00FF99]/25 flex items-center justify-center">
        <span className="text-[10px] sm:text-xs font-bold text-[#00FF99] tabular-nums">{step.number}</span>
      </div>
      <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 rounded-full bg-[#00FF99]/10 border border-[#00FF99]/25 flex items-center justify-center shadow-[0_0_24px_rgba(0,255,153,0.15)]">
        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-[#00FF99]" aria-hidden="true" />
      </div>
      <h3 className="text-white font-bold text-sm sm:text-base mb-1 leading-tight">
        {step.title}
      </h3>
      {step.subtitle && (
        <p className="text-gray-400 text-xs sm:text-sm">{step.subtitle}</p>
      )}
    </article>
  );
}

function Connector({ label, isVertical }) {
  return (
    <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 ${isVertical ? "py-3" : "px-2 py-4 sm:py-0 sm:px-3"}`}>
      {isVertical ? (
        <>
          <div className="w-px h-8 bg-gradient-to-b from-transparent via-[#00FF99]/40 to-transparent" />
          <ArrowDown className="w-4 h-4 text-[#00FF99]/50 flex-shrink-0" />
          <p className="text-[11px] sm:text-xs text-[#00FF99]/80 text-center max-w-[200px] leading-snug">
            {label}
          </p>
          <div className="w-px h-8 bg-gradient-to-b from-transparent via-[#00FF99]/40 to-transparent" />
        </>
      ) : (
        <>
          <div className="hidden sm:block h-px flex-1 min-w-[8px] max-w-[60px] bg-gradient-to-r from-transparent via-[#00FF99]/40 to-[#00FF99]/60 rounded-full" />
          <ArrowRight className="w-4 h-4 text-[#00FF99]/50 flex-shrink-0" />
          <p className="text-[10px] sm:text-xs text-[#00FF99]/80 text-center max-w-[120px] sm:max-w-[140px] leading-snug px-1">
            {label}
          </p>
          <div className="hidden sm:block h-px flex-1 min-w-[8px] max-w-[60px] bg-gradient-to-l from-transparent via-[#00FF99]/40 to-[#00FF99]/60 rounded-full" />
        </>
      )}
    </div>
  );
}

export default function HowVaultWorksDiagram() {
  const containerRef = useRef(null);
  const [visibleIndexes, setVisibleIndexes] = useState([]);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setIsInView(true);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -20px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;
    let i = 0;
    const id = setInterval(() => {
      setVisibleIndexes((prev) => (prev.includes(i) ? prev : [...prev, i]));
      i += 1;
      if (i >= STEPS.length) clearInterval(id);
    }, 150);
    return () => clearInterval(id);
  }, [isInView]);

  return (
    <section
      ref={containerRef}
      className="rounded-2xl border border-[#00FF99]/15 bg-black/40 p-5 sm:p-8"
      aria-labelledby="protocol-flow-title"
    >
      <h2 id="protocol-flow-title" className="sr-only">
        Protocol Flow
      </h2>

      {/* Mobile: vertical stack */}
      <div className="flex flex-col md:hidden">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.number}>
            <StepCard step={step} isVisible={visibleIndexes.includes(index)} />
            {index < STEPS.length - 1 && (
              <Connector label={CONNECTOR_LABELS[index]} isVertical={true} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Desktop: horizontal flow */}
      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-0">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.number}>
            <div className="min-w-0">
              <StepCard step={step} isVisible={visibleIndexes.includes(index)} />
            </div>
            {index < STEPS.length - 1 && (
              <Connector label={CONNECTOR_LABELS[index]} isVertical={false} />
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
