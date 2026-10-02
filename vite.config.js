import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Plugin injectant un identifiant de version dynamique dans sw.js lors du build
const pwaAutoUpdatePlugin = () => ({
  name: 'pwa-auto-update',
  closeBundle() {
    const swDistPath = path.resolve(__dirname, 'dist/sw.js')
    if (fs.existsSync(swDistPath)) {
      let swContent = fs.readFileSync(swDistPath, 'utf-8')
      const buildVersion = `pek-cache-v${Date.now()}`
      swContent = swContent.replace(/const CACHE_NAME = ['"][^'"]+['"]/, `const CACHE_NAME = '${buildVersion}'`)
      fs.writeFileSync(swDistPath, swContent, 'utf-8')
    }
  }
})

process.env.NO_PROXY = '127.0.0.1,localhost,::1'
process.env.no_proxy = '127.0.0.1,localhost,::1'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'https://pek-api-v3.koriassetmanagement.com'
  return {
  plugins: [
    vue(),
    tailwindcss(),
    pwaAutoUpdatePlugin(),
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
    cssCodeSplit: false,
    emptyOutDir: true,
  }
  }
})
