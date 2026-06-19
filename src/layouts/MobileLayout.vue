<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Home, List, User, Bell, Plus, Wallet } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import api from '../api/api'

const route = useRoute()
const authStore = useAuthStore()

const isSubscriptionRoute = computed(() => route.path.includes('/subscribe'))
const isNotificationsRoute = computed(() => route.path === '/notifications')
const isMySubscriptionsRoute = computed(() => route.path === '/my-subscriptions')
const isSplashRoute = computed(() => route.path === '/')
const isAuthRoute = computed(() => route.path === '/login' || route.path === '/register')
const isOnboardingRoute = computed(() => route.path === '/onboarding')
const isWelcomeRoute = computed(() => route.path === '/welcome')

const shouldShowNav = computed(() => {
  return authStore.isAuthenticated && !isSplashRoute.value && !isAuthRoute.value && !isOnboardingRoute.value && !isWelcomeRoute.value
})

const shouldShowHeader = computed(() => {
  return shouldShowNav.value && !isSubscriptionRoute.value && !isNotificationsRoute.value && !isMySubscriptionsRoute.value
})

let pollingInterval = null
const seenNotificationIds = ref(JSON.parse(localStorage.getItem('seen_notification_ids') || '[]'))

const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

const checkNotifications = async () => {
  if (!authStore.isAuthenticated) return
  try {
    const response = await api.get('/notifications')
    const notifications = response.data
    
    // Calculate unread count
    const unreadCount = notifications.filter(n => !n.read_at).length
    authStore.setUnreadNotificationsCount(unreadCount)
    
    // Check for new notifications that haven't been shown in a push notification yet
    const newNotifications = notifications.filter(n => !n.read_at && !seenNotificationIds.value.includes(n.id))
    
    if (newNotifications.length > 0) {
      newNotifications.forEach(n => {
        if (Notification.permission === 'granted') {
          new Notification(n.title, {
            body: n.body,
            icon: '/logo.png'
          })
        }
        seenNotificationIds.value.push(n.id)
      })
      localStorage.setItem('seen_notification_ids', JSON.stringify(seenNotificationIds.value))
    }
  } catch (error) {
    console.error('Failed to poll notifications:', error)
  }
}

const startNotificationPolling = () => {
  stopNotificationPolling()
  checkNotifications()
  requestNotificationPermission()
  pollingInterval = setInterval(checkNotifications, 15000)
}

const stopNotificationPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

watch(() => authStore.isAuthenticated, (newVal) => {
  if (newVal) {
    startNotificationPolling()
  } else {
    stopNotificationPolling()
  }
}, { immediate: true })

onMounted(async () => {
  if (authStore.token && !authStore.user) {
    try {
      const response = await api.get('/user')
      authStore.setUser(response.data)
    } catch (error) {
      console.error('Failed to fetch user in Layout:', error)
      authStore.logout()
    }
  }
})

onUnmounted(() => {
  stopNotificationPolling()
})
</script>

<template>
  <div class="mobile-container flex flex-col">
    <!-- Header -->
    <header v-if="shouldShowHeader" class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex justify-between items-center">
      <router-link to="/home" class="flex items-center gap-3">
        <img src="/logo.png" alt="PEK Logo" class="h-14 w-auto object-contain">
      </router-link>
      <router-link to="/notifications" class="relative w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
        <Bell class="w-5 h-5" />
        <span 
          v-if="authStore.unreadNotificationsCount > 0" 
          class="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-in zoom-in duration-200"
        >
          {{ authStore.unreadNotificationsCount }}
        </span>
      </router-link>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto" :class="shouldShowNav && !isSubscriptionRoute ? 'pb-24' : ''">
      <slot />
    </main>

    <!-- Bottom Navigation -->
    <nav v-if="shouldShowNav && !isSubscriptionRoute" class="fixed bottom-0 left-0 right-0 max-width-container mx-auto bg-white/90 backdrop-blur-lg border-t border-slate-100 px-6 py-2 pb-6 flex justify-around items-center z-50">
      <router-link to="/home" class="flex-1 flex flex-col items-center gap-1 group" v-slot="{ isActive }">
        <Home :class="['w-5 h-5 transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']" />
        <span :class="['text-[10px] font-bold transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']">Accueil</span>
      </router-link>

      <router-link to="/profile" class="flex-1 flex flex-col items-center gap-1 group" v-slot="{ isActive }">
        <User :class="['w-5 h-5 transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']" />
        <span :class="['text-[10px] font-bold transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']">Compte</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.mobile-container {
  width: 100%;
  margin: 0;
  min-height: 100vh;
  background-color: white;
}

.max-width-container {
  width: 100%;
}
</style>
