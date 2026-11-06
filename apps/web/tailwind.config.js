/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: 'rgb(var(--c-brand-50) / <alpha-value>)', 100: 'rgb(var(--c-brand-100) / <alpha-value>)', 200: 'rgb(var(--c-brand-200) / <alpha-value>)', 300: 'rgb(var(--c-brand-300) / <alpha-value>)', 400: 'rgb(var(--c-brand-400) / <alpha-value>)', 500: 'rgb(var(--c-brand-500) / <alpha-value>)', 600: 'rgb(var(--c-brand-600) / <alpha-value>)', 700: 'rgb(var(--c-brand-700) / <alpha-value>)', 800: 'rgb(var(--c-brand-800) / <alpha-value>)', 900: 'rgb(var(--c-brand-900) / <alpha-value>)', 950: 'rgb(var(--c-brand-950) / <alpha-value>)' },
        ink: { 50: 'rgb(var(--c-ink-50) / <alpha-value>)', 100: 'rgb(var(--c-ink-100) / <alpha-value>)', 200: 'rgb(var(--c-ink-200) / <alpha-value>)', 300: 'rgb(var(--c-ink-300) / <alpha-value>)', 400: 'rgb(var(--c-ink-400) / <alpha-value>)', 500: 'rgb(var(--c-ink-500) / <alpha-value>)', 600: 'rgb(var(--c-ink-600) / <alpha-value>)', 700: 'rgb(var(--c-ink-700) / <alpha-value>)', 800: 'rgb(var(--c-ink-800) / <alpha-value>)', 900: 'rgb(var(--c-ink-900) / <alpha-value>)' },
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        amber: { 50: 'rgb(var(--c-amber-50) / <alpha-value>)', 100: 'rgb(var(--c-amber-100) / <alpha-value>)', 200: 'rgb(var(--c-amber-200) / <alpha-value>)', 300: 'rgb(var(--c-amber-300) / <alpha-value>)', 400: 'rgb(var(--c-amber-400) / <alpha-value>)', 500: 'rgb(var(--c-amber-500) / <alpha-value>)', 600: 'rgb(var(--c-amber-600) / <alpha-value>)', 700: 'rgb(var(--c-amber-700) / <alpha-value>)', 800: 'rgb(var(--c-amber-800) / <alpha-value>)', 900: 'rgb(var(--c-amber-900) / <alpha-value>)' },
        red: { 50: 'rgb(var(--c-red-50) / <alpha-value>)', 100: 'rgb(var(--c-red-100) / <alpha-value>)', 200: 'rgb(var(--c-red-200) / <alpha-value>)', 300: 'rgb(var(--c-red-300) / <alpha-value>)', 400: 'rgb(var(--c-red-400) / <alpha-value>)', 500: 'rgb(var(--c-red-500) / <alpha-value>)', 600: 'rgb(var(--c-red-600) / <alpha-value>)', 700: 'rgb(var(--c-red-700) / <alpha-value>)', 800: 'rgb(var(--c-red-800) / <alpha-value>)', 900: 'rgb(var(--c-red-900) / <alpha-value>)' },
        sky: { 50: 'rgb(var(--c-sky-50) / <alpha-value>)', 100: 'rgb(var(--c-sky-100) / <alpha-value>)', 200: 'rgb(var(--c-sky-200) / <alpha-value>)', 300: 'rgb(var(--c-sky-300) / <alpha-value>)', 400: 'rgb(var(--c-sky-400) / <alpha-value>)', 500: 'rgb(var(--c-sky-500) / <alpha-value>)', 600: 'rgb(var(--c-sky-600) / <alpha-value>)', 700: 'rgb(var(--c-sky-700) / <alpha-value>)', 800: 'rgb(var(--c-sky-800) / <alpha-value>)', 900: 'rgb(var(--c-sky-900) / <alpha-value>)' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)', pop: '0 12px 32px -8px rgba(16,24,40,.18)' },
    },
  },
  plugins: [],
};
