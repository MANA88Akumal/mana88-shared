/** Shared Tailwind preset for all MANA 88 apps */
export default {
  theme: {
    extend: {
      colors: {
        mana: {
          50: '#faf8f5',
          100: '#f5f0eb',
          200: '#e8e0d6',
          300: '#d4c4b0',
          400: '#c1a885',
          500: '#ce9e62',
          600: '#b88a50',
          700: '#9a7342',
          800: '#7d5c35',
          900: '#60452a',
          950: '#3d2a18',
        },
        'mana-red': '#c1432e',
        'mana-silver': '#4b6777',
        'mana-gold': '#ce9e62',
        'mana-black': '#2c2c2c',
        'mana-cream': '#faf8f5',
        'mana-border': '#e8e0d6',
        'mana-gold-light': 'rgba(206,158,98,0.12)',
        'mana-red-light': 'rgba(193,67,46,0.1)',
        'mana-silver-light': 'rgba(75,103,119,0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
}
