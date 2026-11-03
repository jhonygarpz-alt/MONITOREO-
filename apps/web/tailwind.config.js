/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#ECF7F0', 100: '#D3EDDC', 200: '#A8DBBA', 300: '#74C394', 400: '#43A86F', 500: '#238C53', 600: '#167A45', 700: '#0F6B3A', 800: '#0C5530', 900: '#0A4427', 950: '#052615' },
        ink: { 50: '#F7F8F8', 100: '#EEF0F1', 200: '#DDE1E4', 300: '#C2C8CD', 400: '#8E979F', 500: '#66707A', 600: '#4B545D', 700: '#363D44', 800: '#22282D', 900: '#14181B' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)', pop: '0 12px 32px -8px rgba(16,24,40,.18)' },
    },
  },
  plugins: [],
};
