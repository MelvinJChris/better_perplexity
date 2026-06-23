import type { Config } from 'tailwindcss';

// Design tokens from issue #27 (Perplexity-familiar, trust-native).
// Trust is shown on a sequential ramp, never binary red/green.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1A1C1F',
        muted: '#5B6472',
        paper: '#FBFBFA',
        surface: '#FFFFFF',
        hairline: '#E6E8EB',
        accent: '#0E7490',
        trust: {
          high: '#0F766E',
          mid: '#9AA0A6',
          low: '#B45309',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        // Cards use a 10 to 12px radius (issue #27).
        card: '0.75rem',
      },
      boxShadow: {
        // One soft, low shadow; long-form reading comes first.
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        focus: '0 0 0 3px rgba(14, 116, 144, 0.35)',
      },
      keyframes: {
        reveal: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        // Subtle results reveal; disabled under prefers-reduced-motion (globals.css).
        reveal: 'reveal 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
