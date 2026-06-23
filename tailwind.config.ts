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
    },
  },
  plugins: [],
};

export default config;
