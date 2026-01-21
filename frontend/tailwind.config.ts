import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Dark charcoal palette
                charcoal: {
                    950: '#0a0a0a',
                    900: '#111111',
                    800: '#1a1a1a',
                    700: '#1e1e1e',
                    600: '#252525',
                    500: '#2a2a2a',
                    400: '#333333',
                    300: '#444444',
                },
                // Muted bone text
                bone: {
                    100: '#f5f2ed',
                    200: '#e5e0d5',
                    300: '#d5d0c5',
                    400: '#b5b0a5',
                    500: '#9a9590',
                    600: '#7a7570',
                    700: '#5a5855',
                    800: '#3a3835',
                },
                // Amber/gold accent
                gold: {
                    50: 'rgba(212, 168, 83, 0.1)',
                    100: 'rgba(212, 168, 83, 0.2)',
                    200: '#e5c580',
                    300: '#dbb468',
                    400: '#d4a853',
                    500: '#c99a45',
                    600: '#b8943f',
                    700: '#9a7a35',
                    800: '#7a6028',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            letterSpacing: {
                protocol: '0.25em',
                wide: '0.1em',
            },
            borderRadius: {
                'card': '12px',
            },
            boxShadow: {
                'card': '0 4px 20px rgba(0, 0, 0, 0.3)',
                'glow-gold': '0 0 20px rgba(212, 168, 83, 0.15)',
            },
            animation: {
                'fade-in': 'fadeIn 0.4s ease-out forwards',
                'slide-up': 'slideUp 0.5s ease-out forwards',
                'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    from: { opacity: '0', transform: 'translateY(10px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    from: { opacity: '0', transform: 'translateY(20px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'pulse-subtle': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.5' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
