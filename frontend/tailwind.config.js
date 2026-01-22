/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        foreground: '#030213',
        card: '#ffffff',
        'card-foreground': '#030213',
        primary: '#030213',
        'primary-foreground': '#ffffff',
        secondary: '#f3f3f5',
        'secondary-foreground': '#030213',
        muted: '#ececf0',
        'muted-foreground': '#717182',
        accent: '#e9ebef',
        'accent-foreground': '#030213',
        destructive: '#d4183d',
        'destructive-foreground': '#ffffff',
        border: 'rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.425rem',
        sm: '0.225rem',
      },
    },
  },
  plugins: [],
}
