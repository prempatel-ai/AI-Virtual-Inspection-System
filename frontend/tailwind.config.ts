import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      bg: "var(--color-bg)",
      surface: "var(--color-surface)",
      border: "var(--color-border)",
      text: {
        DEFAULT: "var(--color-text)",
        muted: "var(--color-text-muted)",
      },
      accent: {
        DEFAULT: "var(--color-accent)",
        fg: "var(--color-accent-fg)",
        subtle: "var(--color-accent-subtle)",
      },
      risk: {
        high: "var(--risk-high)",
        "high-bg": "var(--risk-high-bg)",
        medium: "var(--risk-medium)",
        "medium-bg": "var(--risk-medium-bg)",
        low: "var(--risk-low)",
        "low-bg": "var(--risk-low-bg)",
      },
    },
    borderRadius: {
      none: "0px",
      sm: "var(--radius-sm)",
      md: "var(--radius-md)",
      full: "9999px",
    },
    extend: {
      spacing: {
        "1": "var(--space-1)",
        "2": "var(--space-2)",
        "3": "var(--space-3)",
        "4": "var(--space-4)",
        "6": "var(--space-6)",
        "8": "var(--space-8)",
        "12": "var(--space-12)",
      },
      maxWidth: {
        container: "1280px",
      },
      fontFamily: {
        sans: ["var(--font-public-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        meta: ["12px", { lineHeight: "16px" }],
        body: ["14px", { lineHeight: "20px" }],
        section: ["16px", { lineHeight: "24px" }],
        page: ["22px", { lineHeight: "30px" }],
        kpi: ["28px", { lineHeight: "36px" }],
      },
    },
  },
  plugins: [],
};

export default config;
