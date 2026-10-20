import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true — чтобы открывать с телефона по адресу ноутбука в Wi-Fi
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
})
