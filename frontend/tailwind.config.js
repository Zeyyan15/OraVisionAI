/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        clinical: {
          50: '#effbf9',
          100: '#d8f5ef',
          200: '#afeade',
          300: '#75dacc',
          400: '#39c9b8',
          500: '#12b5a6',
          600: '#087f75',
          700: '#08675f',
          800: '#10534d',
          900: '#123e3a',
        },
        slate: {
          850: '#1e293b',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
