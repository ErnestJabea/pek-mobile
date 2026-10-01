import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

process.env.NO_PROXY = '127.0.0.1,localhost,::1'
process.env.no_proxy = '127.0.0.1,localhost,::1'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'https://pek-api-v2.koriassetmanagement.com'
  return {
  plugins: [
    vue(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: true,
      },
      '/storage': {
        target: apiTarget,
        changeOrigin: true,
        secure: true,
      },
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    emptyOutDir: true,
  }
  }
})
