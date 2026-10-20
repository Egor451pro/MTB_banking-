/**
 * Палитра МТБанка из брендбука:
 *   MT Blue 60% (основной), MT Red 20% и MT Orange 20% (акценты),
 *   Cloud / Sky / Soft Blue — фоны, белый и чёрный — текст.
 * Правило: синий + красный можно без оранжевого, синий + оранжевый — только вместе с красным.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mt: {
          blue: '#2334C8',
          'blue-dark': '#1B289E',
          red: '#E42C26',
          orange: '#FF5912',
          cloud: '#E7F4FF',
          sky: '#97CFFF',
          soft: '#82AED3',
          ink: '#141416',
        },
        line: '#DCE5F0',
        muted: '#5E6878',
      },
      fontFamily: {
        sans: ['Onest', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
