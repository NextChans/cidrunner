/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // developer-tool dark surface scale (slate-based)
        surface: {
          DEFAULT: '#0f172a', // slate-900
          raised: '#1e293b', // slate-800
          border: '#334155', // slate-700
        },
        accent: {
          DEFAULT: '#10b981', // emerald-500
          soft: '#34d399', // emerald-400
          dim: '#065f46', // emerald-800
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
