import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: "#10b981",
        "neon-dim": "#059669",
        "neon-bright": "#34d399",
        terminal: {
          bg: "#0a0a0a",
          card: "#111111",
          border: "#1a2e1a",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(16, 185, 129, 0.15), 0 0 40px rgba(16, 185, 129, 0.05)",
        "glow-lg": "0 0 30px rgba(16, 185, 129, 0.25), 0 0 60px rgba(16, 185, 129, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
