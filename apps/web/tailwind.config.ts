import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          foreground: 'hsl(var(--surface-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          foreground: 'hsl(var(--danger-foreground))',
        },
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(15px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-right': {
          '0%': { transform: 'translateX(-15px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slide-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'scanline': 'scanline 8s linear infinite',
      },
      boxShadow: {
        // Neo-brutalist strong shadows
        'solid-sm': '3px 3px 0px 0px rgba(0,0,0,1)',
        'solid-md': '5px 5px 0px 0px rgba(0,0,0,1)',
        'solid-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
        // Luminous versions for dark mode
        'glow-sm': '0 0 10px 0px rgba(0, 255, 230, 0.3)',
        'glow-md': '0 0 20px 2px rgba(0, 255, 230, 0.4)',
        'glow-danger': '0 0 20px 2px rgba(255, 50, 50, 0.4)',
      },
      backgroundImage: {
        'stripe-pattern': 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)',
        'stripe-pattern-dark': 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 20px)',
      },
    },
  },
  plugins: [],
};

export default config;
