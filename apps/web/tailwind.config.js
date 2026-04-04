/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F9FAFB',
          muted: '#F3F4F6',
        },
        // Borders
        border: {
          subtle: '#F3F4F6',
          base: '#E5E7EB',
          strong: '#D1D5DB',
        },
        // Text
        content: {
          primary: '#111827',
          secondary: '#6B7280',
          muted: '#9CA3AF',
          disabled: '#D1D5DB',
        },
        // Semantic states
        warning: {
          DEFAULT: '#B45309',
          bg: '#FFFBEB',
          border: '#FDE68A',
          subtle: '#FEF3C7',
          action: '#D97706',
        },
        danger: {
          DEFAULT: '#DC2626',
          bg: '#FEF2F2',
        },
        positive: {
          DEFAULT: '#16A34A',
          bg: '#DCFCE7',
        },
        info: {
          DEFAULT: '#1D4ED8',
          bg: '#EFF6FF',
          border: '#DBEAFE',
          subtle: '#DBEAFE',
        },
        accent: {
          DEFAULT: '#7E22CE',
          bg: '#F3E8FF',
        },
      },
    },
  },
  plugins: [],
}

