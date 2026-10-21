import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const rawBase = (import.meta.env.VITE_API_URL || '/api/v1').trim()
const baseURL = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// Interceptor to normalize URL paths, add token & language header
api.interceptors.request.use((config) => {
  if (config.url) {
    // Si baseURL contient déjà /api/v1 et que l'URL commence par /api/v1/
    if (baseURL.endsWith('/api/v1') && config.url.startsWith('/api/v1/')) {
      config.url = config.url.slice(7)
    } else if (baseURL.endsWith('/api') && config.url.startsWith('/api/')) {
      config.url = config.url.slice(4)
    }
  }

  const token = localStorage.getItem('token')
  if (token && token !== 'cookie_session') {
    config.headers.Authorization = `Bearer ${token}`
  }
  const lang = localStorage.getItem('lang') || 'fr'
  config.headers['Accept-Language'] = lang
  return config
})

// Interceptor to handle 401 / 419 session expiration errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response.data?.code === 'PASSWORD_CHANGE_REQUIRED'
      && window.location.pathname !== '/reset-temp-password') {
      window.location.href = '/reset-temp-password'
    }
    const isSessionExpired = error.response && (
      error.response.status === 401 ||
      error.response.status === 419 ||
      error.response.data?.message === 'Unauthenticated.'
    )

    if (isSessionExpired) {
      const isLoginRequest = error.config && error.config.url && error.config.url.includes('/login')
      const isLogoutRequest = error.config && error.config.url && error.config.url.includes('/logout')
      
      const authStore = useAuthStore()
      authStore.clearAuth()
      
      if (!isLoginRequest && !isLogoutRequest && window.location.pathname !== '/login') {
        const currentPath = window.location.pathname + window.location.search
        window.location.href = `/login?expired=1&redirect=${encodeURIComponent(currentPath)}`
      }
    }
    return Promise.reject(error)
  }
)


export default api
