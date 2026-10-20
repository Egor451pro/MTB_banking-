/**
 * Палитра МТБанка из брендбука:
 *   MT Blue 60% (основной), MT Red 20% и MT Orange 20% (акценты),
 *   Cloud / Sky / Soft Blue — фоны, белый и чёрный — текст.
 * Правило: синий + красный можно без оранжевого, синий + оранжевый — только вместе с красным.
 *
 * Поверхности (surface/card/elevated/ink/muted/line) — CSS-переменные,
 * чтобы светлая и тёмная тема переключались одним классом на <html>.
 */
export default {
  darkMode: 'class',
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
          ink: 'rgb(var(--ink) / <alpha-value>)',
        },
        surface: 'rgb(var(--surface) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        tint: 'rgb(var(--tint) / <alpha-value>)',
        'tint-red': 'rgb(var(--tint-red) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Onest', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
