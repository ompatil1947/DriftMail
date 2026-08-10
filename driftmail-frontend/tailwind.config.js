/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: '#FFFFFF',
        bg: '#F5F4F0',
        navy: {
          DEFAULT: '#1A1A2E',
          light: '#252542',
          border: '#2E2E50',
        },
        accent: {
          DEFAULT: '#6C63FF',
          light: '#8B84FF',
          muted: 'rgba(108,99,255,0.15)',
        },
        category: {
          forum:        '#DBEAFE',
          promotions:   '#FCE7F3',
          social_media: '#D1FAE5',
          spam:         '#FEE2E2',
          updates:      '#E0E7FF',
          verify_code:  '#FEF3C7',
          oportunities: '#ECFDF5',
          finance:      '#F3F4F6',
          college:      '#EDE9FE',
        },
        categoryText: {
          forum:        '#1D4ED8',
          promotions:   '#BE185D',
          social_media: '#065F46',
          spam:         '#991B1B',
          updates:      '#3730A3',
          verify_code:  '#92400E',
          oportunities: '#047857',
          finance:      '#374151',
          college:      '#5B21B6',
        },
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'panel': '0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
