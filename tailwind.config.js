/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sky: { 50: '#F3FAFE', 100: '#DDF0FC', 200: '#BCE2F8', 300: '#8CCBF0', 500: '#2A93D5', 600: '#1C7BB8', 700: '#145F94' },
        ink: { DEFAULT: '#0F2A3D', soft: '#4A6275' },
        butter: '#FFF1C9',
        blush: '#FFE0E5',
        mint: '#D9F4E7',
      },
      fontFamily: { sans: ['"Noto Sans Bengali"', 'system-ui', 'sans-serif'] },
      boxShadow: { frame: '0 1px 0 #fff inset, 0 10px 24px -14px rgba(20,95,148,.35)' },
    },
  },
  plugins: [],
};
