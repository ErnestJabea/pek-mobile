import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// Interceptor to add token & language header
api.interceptors.request.use((config) => {
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
    if (error.response && (error.response.status === 401 || error.response.status === 419)) {
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

