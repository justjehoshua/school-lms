/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Figtree', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          50: '#eef5ff', 100: '#d9e8ff', 200: '#bcd5ff', 300: '#8ebaff',
          400: '#5994ff', 500: '#3370f5', 600: '#1f54e0', 700: '#1a43b8',
          800: '#173a94', 900: '#14306f', 950: '#0d1f4a',
        },
      },
      boxShadow: { card: '0 1px 2px rgba(15,35,80,.06), 0 1px 3px rgba(15,35,80,.04)' },
    },
  },
  plugins: [],
};
