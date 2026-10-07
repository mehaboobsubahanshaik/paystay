import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, /api and /hubs are proxied to the ASP.NET Core API so no CORS setup is needed.
// Change ports with environment variables (or a .env file in this folder):
//   VITE_PORT=5174 VITE_API_TARGET=http://localhost:5091 npm run dev
const API = process.env.VITE_API_TARGET || 'http://localhost:5090'
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { chunkSizeWarningLimit: 900, rollupOptions: { output: { manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom', 'axios'], charts: ['recharts'], signalr: ['@microsoft/signalr'] } } } },
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    strictPort: false,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/hubs': { target: API, changeOrigin: true, ws: true },
    },
  },
})
