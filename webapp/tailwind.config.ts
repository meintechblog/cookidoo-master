import type { Config } from "tailwindcss";

// HelloFresh-inspired palette: hero green for primary actions, warm cream for
// recipe cards, charcoal for typography. Heavy use of generous whitespace
// and large hero imagery is what makes the HF feel.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        hero: {
          50: "#f0fdf5",
          100: "#dcfce8",
          200: "#bbf7d1",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",     // HF action green
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        cream: {
          50: "#fefdf9",
          100: "#fdfaf0",
          200: "#fbf3df",
          300: "#f7e9c7",
          400: "#f1daa3",
          500: "#e9c578",
        },
        charcoal: {
          50: "#f6f7f8",
          100: "#e5e7ea",
          200: "#cbd0d5",
          300: "#9ba3ab",
          400: "#6b757f",
          500: "#4a525b",
          600: "#363c44",
          700: "#262c33",
          800: "#1a1f24",
          900: "#0f1318",
        },
        accent: {
          orange: "#f97316",
          coral: "#fb7185",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
        display: ['"Playfair Display"', "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)",
        cardHover: "0 4px 12px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
