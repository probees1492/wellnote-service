import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary: "var(--bg-tertiary)",
        },
        edge: {
          blue: "var(--edge-blue)",
          "blue-hover": "var(--edge-blue-hover)",
          "blue-soft": "var(--edge-blue-soft)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          "on-blue": "var(--text-on-blue)",
        },
        border: {
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          hover: "var(--danger-hover)",
        },
        grid: {
          empty: "var(--grid-empty)",
          l1: "var(--grid-l1)",
          l2: "var(--grid-l2)",
          l3: "var(--grid-l3)",
          l4: "var(--grid-l4)",
        },
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(15, 23, 42, 0.04)",
        sm: "0 2px 8px rgba(15, 23, 42, 0.06)",
        md: "0 4px 16px rgba(15, 23, 42, 0.08)",
        focus: "0 0 0 3px rgba(37, 99, 235, 0.25)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Pretendard Variable",
          "Pretendard",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
