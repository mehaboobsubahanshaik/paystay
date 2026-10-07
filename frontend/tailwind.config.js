/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0E2240', 2: '#45597A', 3: '#7C8CA5' },
        sky: { 1: '#0C1E3B', 2: '#244B85', 3: '#E8813A' },
        pop: { DEFAULT: '#D9701F', soft: '#FBE7D6' },
        sun: '#FFC978',
        avail: { DEFAULT: '#1B8450', soft: '#DAF0E3' },
        booked: { DEFAULT: '#C5372C', soft: '#F8DFDB' },
        clean: { DEFAULT: '#B4740B', soft: '#F7EACD' },
        maint: { DEFAULT: '#67718C', soft: '#E4E8EF' },
        line: '#D7DFEA',
        surface: { DEFAULT: '#FFFFFF', 2: '#E8EDF4' },
        page: '#F1F4F8',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['Manrope', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      boxShadow: { card: '0 1px 2px rgba(14,34,64,.06), 0 10px 30px rgba(14,34,64,.08)' },
      keyframes: {
        'hotel-bob': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } },
        'hotel-shadow': { '0%, 100%': { transform: 'scaleX(1)', opacity: '.9' }, '50%': { transform: 'scaleX(.6)', opacity: '.5' } },
        'hotel-dot': { '0%, 80%, 100%': { opacity: '.25', transform: 'scale(.8)' }, '40%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'hotel-bob': 'hotel-bob 1.1s ease-in-out infinite',
        'hotel-shadow': 'hotel-shadow 1.1s ease-in-out infinite',
        'hotel-dot': 'hotel-dot 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
