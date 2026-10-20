/** Цвета подогнаны под скриншоты Moby: синий градиент шапки, светлый фон, белые карточки */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        moby: { 50: '#eff5ff', 100: '#dbe8ff', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 900: '#14306b' },
        bg: '#f3f5fa',
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
}
