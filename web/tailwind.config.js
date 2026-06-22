/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#9e80ff',
        sleep: '#7399ff',
        stress: '#ff8c80',
        claude: '#f38c4d',
        ink: '#05050f',
      },
      borderRadius: {
        glass: '20px',
      },
      boxShadow: {
        glass: '0 10px 30px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      },
      backdropBlur: {
        glass: '18px',
      },
    },
  },
  plugins: [],
};
