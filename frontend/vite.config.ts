import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true — чтобы открывать с телефона по адресу ноутбука в Wi-Fi.
// proxy: запросы на /api фронт-сервер сам пересылает бэкенду на :8000.
// Так браузер ходит только на один адрес: нет проблем с CORS,
// и всё работает с телефона и через туннель, где localhost:8000 недоступен.
export default defineConfig({
  plugins: [react()],
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
