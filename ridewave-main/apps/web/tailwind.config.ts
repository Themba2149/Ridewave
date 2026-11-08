import type { Config } from 'tailwindcss';

// Design tokens live here and in src/index.css (CSS variables). Change them in one place.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#0B1220', 800: '#111B2E' },
        accent: { DEFAULT: '#B9F227', dark: '#8DB814' },
        ink: { DEFAULT: '#F8FAFC', muted: '#94A3B8' },
        surface: '#FFFFFF',
        page: '#F5F7FA',
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(11,18,32,.06), 0 8px 24px rgba(11,18,32,.08)' },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
} satisfies Config;
