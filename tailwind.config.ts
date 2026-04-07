import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic Color System using CSS Variables
        // These map to CSS custom properties defined in index.css
        // Enables smooth theme transitions without page reload
        
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        'surface-hover': 'var(--color-surface-hover)',
        
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          disabled: 'var(--color-text-disabled)',
        },
        
        border: {
          DEFAULT: 'var(--color-border)',
          subtle: 'var(--color-border-subtle)',
          elevated: 'var(--color-border-elevated)',
        },
        
        // Semantic Alert Colors (Muted in Dark Mode)
        success: {
          DEFAULT: 'var(--color-success)',
          bg: 'var(--color-success-bg)',
          border: 'var(--color-success-border)',
          text: 'var(--color-success-text)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg: 'var(--color-warning-bg)',
          border: 'var(--color-warning-border)',
          text: 'var(--color-warning-text)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          bg: 'var(--color-danger-bg)',
          border: 'var(--color-danger-border)',
          text: 'var(--color-danger-text)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg: 'var(--color-info-bg)',
          border: 'var(--color-info-border)',
          text: 'var(--color-info-text)',
        },
        
        // Brand Colors (Blue gradient for primary actions)
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
          text: 'var(--color-primary-text)',
        },
        
        // Accent Colors (For highlights and badges)
        accent: {
          DEFAULT: 'var(--color-accent)',
          secondary: 'var(--color-accent-secondary)',
        },
      },
      
      // Typography Scale (Optimized for readability in both modes)
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5', fontWeight: '500' }],  // 12px
        'sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '500' }], // 14px
        'base': ['1rem', { lineHeight: '1.6', fontWeight: '500' }],   // 16px
        'lg': ['1.125rem', { lineHeight: '1.6', fontWeight: '600' }], // 18px
        'xl': ['1.25rem', { lineHeight: '1.6', fontWeight: '600' }],  // 20px
        '2xl': ['1.5rem', { lineHeight: '1.5', fontWeight: '700' }],  // 24px
        '3xl': ['1.875rem', { lineHeight: '1.4', fontWeight: '700' }], // 30px
      },
      
      // Spacing (8px base grid for consistency)
      spacing: {
        '4.5': '1.125rem', // 18px
        '13': '3.25rem',    // 52px
        '15': '3.75rem',    // 60px
        '18': '4.5rem',     // 72px
        '112': '28rem',     // 448px
        '128': '32rem',     // 512px
      },
      
      // Border Radius (Subtle, modern curves)
      borderRadius: {
        'sm': '0.375rem',   // 6px
        DEFAULT: '0.5rem',   // 8px
        'md': '0.625rem',   // 10px
        'lg': '0.75rem',    // 12px
        'xl': '1rem',       // 16px
        '2xl': '1.25rem',   // 20px
      },
      
      // Box Shadows (Elevated Neutrals instead of heavy shadows)
      boxShadow: {
        'bento': 'var(--shadow-bento)',
        'bento-hover': 'var(--shadow-bento-hover)',
        'elevated': 'var(--shadow-elevated)',
        'modal': 'var(--shadow-modal)',
      },
      
      // Transition Timing (Smooth, not jarring)
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      
      // Animation Keyframes
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },
      
      // Backdrop Blur for modals
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [
    // Custom plugin for Bento Grid utilities
    function({ addUtilities }: { addUtilities: any }) {
      addUtilities({
        '.bento-grid': {
          'display': 'grid',
          'gap': '1rem',
          'grid-template-columns': 'repeat(auto-fit, minmax(280px, 1fr))',
        },
        '.bento-grid-dense': {
          'display': 'grid',
          'gap': '0.75rem',
          'grid-template-columns': 'repeat(auto-fit, minmax(240px, 1fr))',
        },
        '.bento-card': {
          '@apply bg-surface border border-border-subtle rounded-sm p-6 shadow-bento transition-all duration-250': {},
          '&:hover': {
            '@apply shadow-bento-hover': {},
          },
        },
        '.text-balance': {
          'text-wrap': 'balance',
        },
      })
    },
  ],
}

export default config
