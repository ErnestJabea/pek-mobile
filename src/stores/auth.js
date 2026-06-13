import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user')) || null,
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
      localStorage.setItem('user', JSON.stringify(user))
    },
    async logout() {
      this.user = null
      this.token = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      
      try {
        const api = (await import('../api/api')).default
        await api.post('/logout')
      } catch (error) {
        console.error('Logout error:', error)
      }
    }
  }
})
