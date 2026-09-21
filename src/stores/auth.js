import { defineStore } from 'pinia'
import api from '../api/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || null,
    unreadNotificationsCount: 0,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
  },
  actions: {
    setUnreadNotificationsCount(count) {
      this.unreadNotificationsCount = count
    },
    setToken(token) {
      this.token = token
      localStorage.setItem('token', token)
    },
    setUser(user) {
      this.user = user
    },
    clearAuth() {
      this.user = null
      this.token = null
      this.unreadNotificationsCount = 0
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('pek_onboarding_draft')
      localStorage.removeItem('seen_notification_ids')
    },
    async logout() {
      try {
        if (this.token) {
          await api.post('/logout')
        }
      } catch (error) {
        console.error('Logout error:', error)
      } finally {
        this.clearAuth()
      }
    }
  }
})
