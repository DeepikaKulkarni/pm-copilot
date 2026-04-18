import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy /api/* to the FastAPI backend in dev so the browser never sees CORS issues.
    // In production, a reverse proxy (nginx/Caddy) handles this instead.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
