/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f0f0f",
        surface: "#1a1d24",
        border: "#2a2d35",
        accent: "#f59e0b",
        "text-primary": "#f0f0ef",
        "text-secondary": "#8a8d96",
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', '"Space Mono"', "monospace"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
