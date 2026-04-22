/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e6f0ff',
          100: '#b3d0ff',
          200: '#80b0ff',
          300: '#4d90ff',
          400: '#1a70ff',
          500: '#0055e6',
          600: '#0042b3',
          700: '#002f80',
          800: '#001c4d',
          900: '#00091a',
        },
        hydro: {
          dark:  '#0a0f1e',
          card:  '#111827',
          border:'#1f2a40',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        pulse2: 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
        fadeIn: 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
