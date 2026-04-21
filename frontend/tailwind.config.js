/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#030712',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
        },
        electric: {
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(56, 189, 248, 0.12), 0 24px 80px rgba(2, 8, 23, 0.55)',
      },
      backgroundImage: {
        'radial-soft': 'radial-gradient(circle at top left, rgba(56,189,248,0.14), transparent 36%), radial-gradient(circle at top right, rgba(148,163,184,0.08), transparent 28%)',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        floaty: 'floaty 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
