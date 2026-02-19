import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Send } from "lucide-react";

const CATEGORIES = ["Support", "Partnerships", "Media", "Other"];

export default function ContactCard() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "Support",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const e = {};
    if (!formData.name.trim()) e.name = "Name is required";
    if (!formData.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = "Invalid email";
    if (!formData.message.trim()) e.message = "Message is required";
    else if (formData.message.trim().length < 10) e.message = "Message must be at least 10 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.ok) {
        setSuccess(true);
        setFormData({ name: "", email: "", category: "Support", message: "" });
        setErrors({});
      } else {
        setErrors({ submit: data.error || "Something went wrong. Please try again." });
      }
    } catch (err) {
      setErrors({ submit: "Failed to send. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-[#00FF99]/20 bg-gray-900/60 p-6 sm:p-8 hover:border-[#00FF99]/30 transition-all lg:sticky lg:top-24"
    >
      <h3 className="text-xl font-bold text-white mb-2">Contact Us</h3>
      <p className="text-gray-400 text-sm mb-6">Need help or want to partner? Send us a message.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full bg-black/60 border border-[#00FF99]/25 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF99]/50"
            placeholder="Your name"
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Email *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className="w-full bg-black/60 border border-[#00FF99]/25 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF99]/50"
            placeholder="you@example.com"
          />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Category</label>
          <select
            value={formData.category}
            onChange={(e) => handleChange("category", e.target.value)}
            className="w-full bg-black/60 border border-[#00FF99]/25 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00FF99]/50"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-gray-900">
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Message *</label>
          <textarea
            value={formData.message}
            onChange={(e) => handleChange("message", e.target.value)}
            rows={4}
            className="w-full bg-black/60 border border-[#00FF99]/25 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF99]/50 resize-none"
            placeholder="Your message (min 10 characters)"
          />
          {errors.message && <p className="text-red-400 text-xs mt-1">{errors.message}</p>}
        </div>

        {errors.submit && <p className="text-red-400 text-sm">{errors.submit}</p>}
        {success && <p className="text-[#00FF99] text-sm">Message sent successfully!</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-[#00FF99] text-black font-bold rounded-xl hover:bg-[#00FF99]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-pulse">Sending...</span>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send Message
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-[#00FF99]/10">
        <p className="text-xs text-gray-500 mb-3">Or reach us directly:</p>
        <div className="space-y-2 text-sm">
          <a
            href="mailto:lmprotocolcontact@gmail.com"
            className="flex items-center gap-2 text-gray-400 hover:text-[#00FF99] transition-colors"
          >
            <Mail className="w-4 h-4" />
            lmprotocolcontact@gmail.com
          </a>
          <a
            href="https://x.com/lm_protocol?s=11"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-400 hover:text-[#00FF99] transition-colors"
          >
            X / Twitter
          </a>
          <a
            href="#"
            className="flex items-center gap-2 text-gray-400 hover:text-[#00FF99] transition-colors"
          >
            Telegram
          </a>
        </div>
      </div>
    </motion.div>
  );
}
