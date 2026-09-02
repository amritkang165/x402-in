/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#06070c',
          900: '#0b0d15',
          850: '#0f1220',
          800: '#141828',
          700: '#1c2134',
          600: '#262c44',
        },
        accent: '#22d3ee',
        violet: '#a78bfa',
        mint: '#34d399',
        amber: '#fbbf24',
        rose: '#fb7185',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -6px rgba(34,211,238,0.45)',
        'glow-violet': '0 0 24px -6px rgba(167,139,250,0.45)',
        'glow-mint': '0 0 24px -6px rgba(52,211,153,0.45)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}
