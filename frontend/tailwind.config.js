/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'copilot': {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#b8dbff',
          300: '#7abfff',
          400: '#339dff',
          500: '#0a7eff',
          600: '#005fdb',
          700: '#004bb1',
          800: '#004092',
          900: '#003778',
          950: '#002350',
        },
      },
    },
  },
  plugins: [],
}
