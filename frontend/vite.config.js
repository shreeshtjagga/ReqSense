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
        '/api': { target: apiBase, changeOrigin: true },
        '/health': { target: apiBase, changeOrigin: true },
      },
    },
    optimizeDeps: {
      include: [
        '@mui/material',
        '@mui/icons-material',
        '@emotion/react',
        '@emotion/styled',
        'react',
        'react-dom',
        'react-router-dom',
        'axios',
        'zustand',
      ],
    },
    build: {
      chunkSizeWarningLimit: 600,
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@mui') || id.includes('node_modules/@emotion')) {
              return 'mui-vendor';
            }
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
              return 'chart-vendor';
            }
            if (id.includes('node_modules/framer-motion')) {
              return 'motion-vendor';
            }
            if (id.includes('node_modules/react-router') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/axios') || id.includes('node_modules/zustand') || id.includes('node_modules/@tanstack')) {
              return 'data-vendor';
            }
          },
        },
      },
    },
  }
})

