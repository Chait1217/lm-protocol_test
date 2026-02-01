import React, { useEffect } from "react";
import { motion } from "framer-motion";
import FAQAccordion from "./FAQAccordion";
import ContactCard from "./ContactCard";

export default function FAQPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
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
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">FAQ</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Answers to the most common questions about LM Protocol.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Left: FAQ accordion */}
          <div className="lg:col-span-2">
            <FAQAccordion />
          </div>

          {/* Right: Contact Us (sticky on desktop) */}
          <div className="lg:col-span-1">
            <ContactCard />
          </div>
        </div>
      </div>
    </div>
  );
}
