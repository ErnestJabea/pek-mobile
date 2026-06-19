import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// Interceptor to add token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token && token !== 'cookie_session') {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginRequest = error.config && error.config.url && error.config.url.includes('/login')
      const isLogoutRequest = error.config && error.config.url && error.config.url.includes('/logout')
      
      if (!isLogoutRequest) {
        const authStore = useAuthStore()
        authStore.logout()
      }
      
      if (window.location.pathname !== '/login' && !isLoginRequest && !isLogoutRequest) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)


export default api

