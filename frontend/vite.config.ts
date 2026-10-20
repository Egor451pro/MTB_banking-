import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true — чтобы открывать с телефона по адресу ноутбука в Wi-Fi.
// proxy: запросы на /api фронт-сервер сам пересылает бэкенду на :8000.
// Так браузер ходит только на один адрес: нет проблем с CORS,
// и всё работает с телефона и через туннель, где localhost:8000 недоступен.
export default defineConfig({
  plugins: [react()],
  css: {
    // Файл, а не tailwindcss() в памяти: иначе конфиг Tailwind замирает до рестарта
    postcss: './postcss.config.js',
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
