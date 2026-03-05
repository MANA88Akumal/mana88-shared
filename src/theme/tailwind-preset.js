/** Shared Tailwind preset for all TerraIA apps */
export default {
  theme: {
    extend: {
      colors: {
        // Semantic theme tokens (swap between light/dark via CSS vars)
        surface: {
          0: 'rgb(var(--surface-0) / <alpha-value>)',
          1: 'rgb(var(--surface-1) / <alpha-value>)',
          2: 'rgb(var(--surface-2) / <alpha-value>)',
          3: 'rgb(var(--surface-3) / <alpha-value>)',
          invert: 'rgb(var(--surface-invert) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border-default) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
        },
        content: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
          invert: 'rgb(var(--text-invert) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand-primary) / <alpha-value>)',
          subtle: 'rgb(var(--brand-subtle) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-primary) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          subtle: 'rgb(var(--accent-subtle) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          subtle: 'rgb(var(--success-subtle) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          subtle: 'rgb(var(--warning-subtle) / <alpha-value>)',
        },
        error: {
          DEFAULT: 'rgb(var(--error) / <alpha-value>)',
          subtle: 'rgb(var(--error-subtle) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          subtle: 'rgb(var(--info-subtle) / <alpha-value>)',
        },
        sidebar: {
          bg: 'rgb(var(--sidebar-bg) / <alpha-value>)',
          text: 'rgb(var(--sidebar-text) / <alpha-value>)',
          active: 'rgb(var(--sidebar-active) / <alpha-value>)',
        },

        // Raw brand colors (for special cases: logo, landing page, etc.)
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
        terra: {
          50: '#faf3eb', 100: '#f0d4b8', 200: '#daa67a', 300: '#c47d4a',
          400: '#a85d2a', 500: '#8B4513', 600: '#6b3a24', 700: '#4a2518',
          800: '#2d1810', 900: '#1a0f0a',
        },
        copper: {
          300: '#f0b876', 400: '#e89849', 500: '#d4772a',
          600: '#b45e1f', 700: '#8a4a1b',
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
        sans: ['Geist Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
}
