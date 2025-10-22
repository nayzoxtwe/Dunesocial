import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#a855f7',
        'bg-0': '#0B0B0F',
        'bg-1': '#15151B'
      }
    }
  },
  plugins: []
};

export default config;
