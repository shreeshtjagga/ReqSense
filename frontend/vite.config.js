import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_BASE_URL || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Proxy /api requests to the FastAPI backend during local dev
        '/api': {
          target: apiBase,
          changeOrigin: true,
        },
        '/health': {
          target: apiBase,
          changeOrigin: true,
        },
      },
    },
    build: {
      // Increase warning threshold slightly since MUI is large;
      // a real app should code-split with React.lazy
      chunkSizeWarningLimit: 1200,
    },
  }
})
