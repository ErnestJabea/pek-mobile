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

      // Vérification périodique toutes les 30 minutes si l'application reste active
      setInterval(() => {
        registration.update().catch(() => {})
      }, 30 * 60 * 1000)

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

  // Recharger l'application pour charger la nouvelle version uniquement hors des parcours sensibles
  let isRefreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const isSensitiveFlow = window.location.pathname.includes('/onboarding') || window.location.pathname.includes('/subscription')
    if (isSensitiveFlow) {
      // Préserver la saisie utilisateur et éviter tout rechargement lors d'upload ou de prise de photo
      return
    }
    if (!isRefreshing) {
      isRefreshing = true
      window.location.reload()
    }
  })
}
