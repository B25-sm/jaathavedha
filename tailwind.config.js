/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        leo: {
          gold: '#C9922A',
          amber: '#E8A83E',
          sunlit: '#F5C842',
          ochre: '#9B6E1A',
          bronze: '#7A4F10',
        },
        den: {
          dark: '#0D0B07',
          card: '#161309',
          hover: '#1F1A0E',
          ember: '#2A2210',
        },
        fur: {
          ivory: '#F5EDD6',
          dune: '#D4C49A',
          straw: '#8C7A55',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'leo-gold': '0 0 24px rgba(201, 146, 42, 0.3)',
        'leo-glow': '0 0 60px rgba(232, 168, 62, 0.15)',
        'leo-card': '0 8px 32px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'leo-breathe': 'leo-breathe 4s ease-in-out infinite',
        'eye-glow': 'eye-glow 3s ease-in-out infinite',
        'shimmer-sweep': 'shimmer-sweep 2s linear infinite',
        'crown-pulse': 'crown-pulse 2s ease-in-out infinite',
      },
    },
  },
}
