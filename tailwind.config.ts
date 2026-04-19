import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#051530",
          900: "#0A2540",
          800: "#0F2D4E",
          700: "#1E4D8C",
        },
        yellow: {
          500: "#FFB800",
          400: "#FFC933",
          300: "#FFDA66",
          200: "#FFE999",
          100: "#FFF3CC",
        },
        green: "#16A34A",
        red: "#DC2626",
        amber: "#F59E0B",
        paper: "#F5F2EA",
        offwhite: "#FAFAF7",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-general-sans)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
