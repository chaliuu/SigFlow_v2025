import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/circuits': 'http://127.0.0.1:5000',
      '/favicon.ico': 'http://127.0.0.1:5000',
    },
  },
  build: {
    outDir: 'dist',
  },
})
