import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/buyer': 'http://localhost:8000',
      '/registry': 'http://localhost:8000',
      '/webhooks': 'http://localhost:8000',
      '/sessions': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
