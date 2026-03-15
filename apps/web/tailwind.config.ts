import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
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
      boxShadow: {
        glow: '0 18px 65px -28px rgba(9, 62, 70, 0.55)',
      },
      backgroundImage: {
        'mesh-light':
          'radial-gradient(circle at top left, rgba(12, 166, 152, 0.18), transparent 35%), radial-gradient(circle at top right, rgba(245, 158, 11, 0.18), transparent 28%), linear-gradient(180deg, rgba(253, 250, 245, 0.95), rgba(248, 251, 250, 0.96))',
        'mesh-dark':
          'radial-gradient(circle at top left, rgba(24, 206, 184, 0.18), transparent 32%), radial-gradient(circle at bottom right, rgba(244, 136, 66, 0.16), transparent 30%), linear-gradient(180deg, rgba(8, 22, 28, 0.97), rgba(9, 18, 24, 0.98))',
      },
    },
  },
  plugins: [],
};

export default config;
