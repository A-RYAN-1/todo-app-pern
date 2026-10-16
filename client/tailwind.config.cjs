/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: { sans: ["ui-sans-serif", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
