import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Vérifier immédiatement si une nouvelle version est disponible sur le serveur
      registration.update().catch(() => {})

      // Vérifier à chaque fois que l'utilisateur rouvre l'application mobile (mise en avant)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {})
        }
      })

      // Vérification périodique toutes les 15 minutes si l'application reste active
      setInterval(() => {
        registration.update().catch(() => {})
      }, 15 * 60 * 1000)

      // Si un worker est déjà en attente, le pousser à s'activer sans attendre
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        }
      })
    }).catch(() => {})
  })

  // Recharger automatiquement l'application pour charger la nouvelle version
  let isRefreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!isRefreshing) {
      isRefreshing = true
      window.location.reload()
    }
  })
}
