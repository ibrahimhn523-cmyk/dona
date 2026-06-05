/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#2b6cb0", dark: "#234e7a" },
      },
      fontFamily: {
        sans: ["Segoe UI", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};
