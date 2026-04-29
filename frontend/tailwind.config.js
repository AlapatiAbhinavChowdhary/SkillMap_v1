/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#FAF7F2', 100: '#F5F0E8', 200: '#EDE5D8' },
        orange: {
          50: '#FEF2EB', 100: '#FADBC6', 200: '#F5A67A',
          300: '#F28C5E', 400: '#F06828', 500: '#E8470A',
          600: '#C23B08', 700: '#9A3412', 800: '#7C2D12', 900: '#431407',
        },
        brand: { primary: '#E8470A', light: '#F28C5E', dark: '#C23B08' },
      },
    },
  },
  plugins: [],
};
