import React, { useRef, useState, useEffect } from "react";
import { Database, Lock, TrendingUp, DollarSign, ChevronDown, ChevronRight } from "lucide-react";

const STEPS = [
  {
    number: "01",
    title: "USDC Vault",
    subtitle: "LPs deposit",
    icon: Database,
  },
  {
    number: "02",
    title: "Traders deposit collateral + Borrow from Vault",
    subtitle: "Margin from vault",
    icon: Lock,
  },
  {
    number: "03",
    title: "Leveraged position on prediction markets",
    subtitle: "Exposure on markets",
    icon: TrendingUp,
  },
  {
    number: "04",
    title: "LP Yield (APY) + Insurance Reserve + Protocol Revenue",
    subtitle: "Fees and interest flow back",
    icon: DollarSign,
  },
];

const CONNECTOR_LABELS = [
  "Liquidity available for borrowing",
  "Create leveraged exposure",
  "Fees + interest paid by traders",
];

function StepCard({ step, index, isVisible }) {
  const Icon = step.icon;
  return (
    <article
      className={`
        rounded-xl border border-[#00FF99]/25 bg-black/60 p-4 sm:p-5
        shadow-[0_0_20px_rgba(0,255,153,0.06)]
        transition-all duration-500
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#00FF99]/15 text-[#00FF99] font-bold text-sm flex items-center justify-center border border-[#00FF99]/30"
          aria-hidden="true"
        >
          {step.number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-sm sm:text-base mb-0.5">
            {step.title}
          </h3>
          {step.subtitle && (
            <p className="text-gray-400 text-xs sm:text-sm">{step.subtitle}</p>
          )}
        </div>
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#00FF99]/10 flex items-center justify-center border border-[#00FF99]/20">
          <Icon className="w-5 h-5 text-[#00FF99]" aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}

function ConnectorWithLabel({ label, isVertical }) {
  return (
    <div
      className={`
        flex items-center justify-center gap-2
        ${isVertical ? "flex-col py-2" : "flex-row px-2 sm:px-4"}
      `}
    >
      {isVertical ? (
        <>
          <div className="w-0.5 h-6 bg-gradient-to-b from-[#00FF99]/50 to-[#00FF99]/20 rounded-full" />
          <span className="text-[11px] sm:text-xs text-[#00FF99]/90 text-center max-w-[180px] font-medium">
            {label}
          </span>
          <div className="w-0.5 h-6 bg-gradient-to-b from-[#00FF99]/20 to-[#00FF99]/50 rounded-full" />
          <ChevronDown className="w-4 h-4 text-[#00FF99]/60 flex-shrink-0" />
        </>
      ) : (
        <>
          <div className="h-0.5 flex-1 min-w-[12px] bg-gradient-to-r from-[#00FF99]/30 via-[#00FF99]/50 to-[#00FF99]/30 rounded-full max-w-[80px] sm:max-w-[120px]" />
          <span className="text-[10px] sm:text-xs text-[#00FF99]/90 text-center flex-shrink-0 max-w-[140px] sm:max-w-[180px] font-medium px-1">
            {label}
          </span>
          <ChevronRight className="w-4 h-4 text-[#00FF99]/60 flex-shrink-0" />
          <div className="h-0.5 flex-1 min-w-[12px] bg-gradient-to-r from-[#00FF99]/30 via-[#00FF99]/50 to-[#00FF99]/30 rounded-full max-w-[80px] sm:max-w-[120px]" />
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
          if (entry.isIntersecting) {
            setIsInView(true);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
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
      if (i > STEPS.length) clearInterval(id);
    }, 120);
    return () => clearInterval(id);
  }, [isInView]);

  return (
    <section
      ref={containerRef}
      className="rounded-2xl border border-[#00FF99]/20 bg-gray-900/40 p-4 sm:p-6"
      aria-labelledby="how-vault-works-diagram-title"
    >
      <h2 id="how-vault-works-diagram-title" className="sr-only">
        How the vault flow works
      </h2>

      {/* Mobile: vertical timeline */}
      <div className="flex flex-col md:hidden">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.number}>
            <StepCard
              step={step}
              index={index}
              isVisible={visibleIndexes.includes(index)}
            />
            {index < STEPS.length - 1 && (
              <ConnectorWithLabel
                label={CONNECTOR_LABELS[index]}
                isVertical={true}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Desktop: horizontal flow */}
      <div className="hidden md:flex md:items-stretch md:justify-between md:gap-0">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.number}>
            <div className="flex-1 min-w-0 max-w-[220px]">
              <StepCard
                step={step}
                index={index}
                isVisible={visibleIndexes.includes(index)}
              />
            </div>
            {index < STEPS.length - 1 && (
              <div className="flex-shrink-0 flex items-center self-center px-1">
                <ConnectorWithLabel
                  label={CONNECTOR_LABELS[index]}
                  isVertical={false}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
