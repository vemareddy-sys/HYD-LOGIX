/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#06090f',
          900: '#090e17',
          850: '#0e1523',
          800: '#131e30',
          700: '#1b2a42',
          600: '#253959',
        },
        logix: {
          amber: {
            DEFAULT: '#f59e0b',
            hover: '#d97706',
            dark: '#b45309',
            glow: 'rgba(245, 158, 11, 0.15)',
          },
          steel: {
            DEFAULT: '#94a3b8',
            dim: '#64748b',
            dark: '#334155',
            line: '#1e293b',
          },
          signal: {
            green: '#10b981',
            red: '#f43f5e',
            blue: '#38bdf8',
          }
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        tech: ['"Chakra Petch"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'panel': '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'panel-hover': '0 8px 30px -4px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(245, 158, 11, 0.25)',
        'card-active': '0 0 0 2px #f59e0b, 0 10px 25px -5px rgba(245, 158, 11, 0.2)',
      },
      letterSpacing: {
        'widest-tech': '0.18em',
      }
    },
  },
  plugins: [],
}
