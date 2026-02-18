import React, { useState } from "react";
import { motion } from "framer-motion";
import { Unlock, ArrowUpRight } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "", label: "Select role…" },
  { value: "trader", label: "Trader" },
  { value: "lp", label: "LP" },
  { value: "investor", label: "Investor" },
  { value: "other", label: "Other" },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AlphaAccessPage({ setCurrentPage }) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    message: "",
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!EMAIL_REGEX.test(form.email)) next.email = "Please enter a valid email";
    if (!form.role) next.role = "Please select a role";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/alpha-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (data.ok) {
        setSubmitted(true);
      } else {
        setErrors({ submit: data.error || "Something went wrong. Please try again." });
      }
    } catch (err) {
      setErrors({ submit: "Failed to submit. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById("alpha-form-section")?.scrollIntoView({ behavior: "smooth" });
  };

  if (submitted) {
    return (
      <div className="min-h-screen min-w-0 max-w-full bg-black pt-20 sm:pt-24 pb-16 overflow-x-hidden">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-[#00FF99]/25 bg-gradient-to-b from-gray-900 to-black p-8 sm:p-12 shadow-[0_0_40px_rgba(0,255,153,0.08)]"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#00FF99]/15 border border-[#00FF99]/30 flex items-center justify-center">
              <Unlock className="w-8 h-8 text-[#00FF99]" aria-hidden="true" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Thank you for applying
            </h2>
            <p className="text-gray-400 text-base sm:text-lg mb-8">
              Thanks! We’ll notify you when the alpha access is available.
            </p>
            {setCurrentPage && (
              <button
                type="button"
                onClick={() => setCurrentPage("market")}
                className="min-h-[48px] px-6 py-3 rounded-lg bg-[#00FF99] text-black font-semibold hover:bg-[#00FF99]/90 hover:shadow-[0_0_24px_rgba(0,255,153,0.4)] transition-all"
              >
                Back to Home
              </button>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-0 max-w-full bg-black pt-16 sm:pt-20 pb-16 overflow-x-hidden">
      {/* Hero */}
      <section className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10 sm:pb-14 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-6 rounded-full bg-[#00FF99]/10 border border-[#00FF99]/25 flex items-center justify-center">
            <Unlock className="w-7 h-7 sm:w-8 sm:h-8 text-[#00FF99]" aria-hidden="true" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Apply for Alpha Access
          </h1>
          <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            Get early access to the LM Protocol for institutional-grade leverage trading on prediction markets.
          </p>
          <motion.button
            type="button"
            onClick={scrollToForm}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="min-h-[48px] px-6 sm:px-8 py-3 sm:py-4 bg-[#00FF99] text-black font-bold rounded-lg text-base sm:text-lg shadow-[0_0_30px_rgba(0,255,153,0.3)] hover:shadow-[0_0_50px_rgba(0,255,153,0.5)] transition-all inline-flex items-center justify-center gap-2"
          >
            Apply for alpha access
            <ArrowUpRight className="w-5 h-5" aria-hidden="true" />
          </motion.button>
        </motion.div>
      </section>

      {/* Form */}
      <section
        id="alpha-form-section"
        className="max-w-lg mx-auto px-4 sm:px-6 pb-20"
      >
        <motion.form
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#00FF99]/20 bg-gradient-to-b from-gray-900/80 to-black p-6 sm:p-8 shadow-[0_0_40px_rgba(0,255,153,0.06)]"
        >
          <h2 className="text-xl font-bold text-white mb-6 sr-only">
            Application form
          </h2>

          <div className="space-y-5">
            <div>
              <label htmlFor="alpha-name" className="block text-sm font-medium text-gray-300 mb-2">
                Name <span className="text-[#00FF99]">*</span>
              </label>
              <input
                id="alpha-name"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "alpha-name-error" : undefined}
                placeholder="Your name"
                className="w-full min-h-[48px] px-4 py-3 rounded-lg bg-black/60 border border-[#00FF99]/25 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF99]/50 focus:ring-1 focus:ring-[#00FF99]/20 transition-all"
              />
              {errors.name && (
                <p id="alpha-name-error" className="mt-1 text-sm text-red-400" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="alpha-email" className="block text-sm font-medium text-gray-300 mb-2">
                Email <span className="text-[#00FF99]">*</span>
              </label>
              <input
                id="alpha-email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "alpha-email-error" : undefined}
                placeholder="you@example.com"
                className="w-full min-h-[48px] px-4 py-3 rounded-lg bg-black/60 border border-[#00FF99]/25 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF99]/50 focus:ring-1 focus:ring-[#00FF99]/20 transition-all"
              />
              {errors.email && (
                <p id="alpha-email-error" className="mt-1 text-sm text-red-400" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="alpha-role" className="block text-sm font-medium text-gray-300 mb-2">
                Role <span className="text-[#00FF99]">*</span>
              </label>
              <select
                id="alpha-role"
                name="role"
                value={form.role}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={!!errors.role}
                aria-describedby={errors.role ? "alpha-role-error" : undefined}
                className="w-full min-h-[48px] px-4 py-3 rounded-lg bg-black/60 border border-[#00FF99]/25 text-white focus:outline-none focus:border-[#00FF99]/50 focus:ring-1 focus:ring-[#00FF99]/20 transition-all appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2300FF99'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center", backgroundSize: "1.25rem", paddingRight: "2.5rem" }}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value || "placeholder"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.role && (
                <p id="alpha-role-error" className="mt-1 text-sm text-red-400" role="alert">
                  {errors.role}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="alpha-message" className="block text-sm font-medium text-gray-300 mb-2">
                Short message <span className="text-gray-500">(optional)</span>
              </label>
              <textarea
                id="alpha-message"
                name="message"
                value={form.message}
                onChange={handleChange}
                placeholder="Why do you want access?"
                rows={4}
                aria-describedby="alpha-message-hint"
                className="w-full min-h-[100px] px-4 py-3 rounded-lg bg-black/60 border border-[#00FF99]/25 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF99]/50 focus:ring-1 focus:ring-[#00FF99]/20 transition-all resize-y"
              />
              <p id="alpha-message-hint" className="mt-1 text-xs text-gray-500">
                Why do you want access?
              </p>
            </div>
          </div>

          {errors.submit && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-red-400 text-sm">{errors.submit}</p>
            </div>
          )}

          <div className="mt-8">
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] py-3 rounded-lg bg-[#00FF99] text-black font-bold shadow-[0_0_24px_rgba(0,255,153,0.25)] hover:bg-[#00FF99]/90 hover:shadow-[0_0_32px_rgba(0,255,153,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </motion.form>
      </section>
    </div>
  );
}
