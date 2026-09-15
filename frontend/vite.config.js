import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/detect': 'http://localhost:8000',
      '/evaluate': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
      '/reports': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/model': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
