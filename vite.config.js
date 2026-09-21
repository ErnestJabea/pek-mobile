import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

process.env.NO_PROXY = '127.0.0.1,localhost,::1'
process.env.no_proxy = '127.0.0.1,localhost,::1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://pek-api-v2.ejabbing.com',
        changeOrigin: true,
        secure: false,
      },
      '/storage': {
        target: 'https://pek-api-v2.ejabbing.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    emptyOutDir: true,
  }
})
