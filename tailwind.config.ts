import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "#0c0d10",
        sidebar: "#101114",
        panel: "#17181d",
        raised: "#1e1f26",
        line: "rgba(255,255,255,0.08)",
        ink: {
          DEFAULT: "#f3f4f6",
          muted: "#9b9ea8",
          faint: "#6d717a",
        },
        accent: {
          DEFAULT: "#5e6ad2",
          hover: "#717ce3",
        },
      },
      boxShadow: {
        pop: "0 18px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)",
        card: "0 1px 0 rgba(255,255,255,0.04)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
