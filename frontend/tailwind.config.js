/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--app-font-family)', 'Sarabun', 'IBM Plex Sans Thai', 'Prompt', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        sarabun: ['Sarabun', 'sans-serif'],
        ibm: ['IBM Plex Sans Thai', 'sans-serif'],
        prompt: ['Prompt', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1rem' }],     /* 12px */
        'xs': ['0.8125rem', { lineHeight: '1.25rem' }], /* 13px */
        'sm': ['0.9375rem', { lineHeight: '1.375rem' }], /* 15px */
        'base': ['1.0625rem', { lineHeight: '1.625rem' }], /* 17px */
        'lg': ['1.1875rem', { lineHeight: '1.75rem' }], /* 19px */
        'xl': ['1.3125rem', { lineHeight: '1.875rem' }], /* 21px */
        '2xl': ['1.5625rem', { lineHeight: '2rem' }],   /* 25px */
      },
      colors: {
        obsidian: {
          950: 'rgb(var(--obsidian-950) / <alpha-value>)',
          900: 'rgb(var(--obsidian-900) / <alpha-value>)',
          850: 'rgb(var(--obsidian-850) / <alpha-value>)',
          800: 'rgb(var(--obsidian-800) / <alpha-value>)',
          700: 'rgb(var(--obsidian-700) / <alpha-value>)',
        },
        slate: {
          50: 'rgb(var(--slate-50) / <alpha-value>)',
          100: 'rgb(var(--slate-100) / <alpha-value>)',
          200: 'rgb(var(--slate-200) / <alpha-value>)',
          300: 'rgb(var(--slate-300) / <alpha-value>)',
          400: 'rgb(var(--slate-400) / <alpha-value>)',
          500: 'rgb(var(--slate-500) / <alpha-value>)',
          600: 'rgb(var(--slate-600) / <alpha-value>)',
          700: 'rgb(var(--slate-700) / <alpha-value>)',
          800: 'rgb(var(--slate-800) / <alpha-value>)',
          900: 'rgb(var(--slate-900) / <alpha-value>)',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        primary: {
          DEFAULT: '#f97316',
          hover: '#ea580c',
        }
      }
    },
  },
  plugins: [],
}
