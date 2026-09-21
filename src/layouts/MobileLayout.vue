<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Home, Wallet, TrendingUp, History, Settings, Bell } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'
import api from '../api/api'
import LanguageSelector from '../components/LanguageSelector.vue'

const route = useRoute()
const authStore = useAuthStore()
const languageStore = useLanguageStore()

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
const supportsBrowserNotifications = 'Notification' in window

const requestNotificationPermission = async () => {
  if (!supportsBrowserNotifications) return
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

const showBrowserNotification = async (notification) => {
  const options = {
    body: notification.body,
    icon: '/logo.png',
    data: { url: '/notifications' }
  }

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.showNotification(notification.title, options)
      return
    }
  }

  new Notification(notification.title, options)
}

const checkNotifications = async () => {
  if (!authStore.isAuthenticated || document.visibilityState !== 'visible') return
  try {
    const response = await api.get('/notifications')
    const notifications = response.data.data || response.data

    // Calculate unread count
    const unreadCount = notifications.filter(n => !n.read_at).length
    authStore.setUnreadNotificationsCount(unreadCount)

    // Check for new notifications that have not been shown by the browser yet.
    const newNotifications = notifications.filter(n => !n.read_at && !seenNotificationIds.value.includes(n.id))

    if (newNotifications.length > 0) {
      for (const n of newNotifications) {
        if (supportsBrowserNotifications && Notification.permission === 'granted') {
          await showBrowserNotification(n)
          seenNotificationIds.value.push(n.id)
        }
      }
      localStorage.setItem('seen_notification_ids', JSON.stringify(seenNotificationIds.value))
    }
  } catch (error) {
    console.error('Failed to poll notifications:', error)
  }
}

const startNotificationPolling = async () => {
  stopNotificationPolling()
  await requestNotificationPermission()
  await checkNotifications()
  pollingInterval = setInterval(checkNotifications, 60000)
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
  window.addEventListener('pek:notifications-refresh', checkNotifications)

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
  window.removeEventListener('pek:notifications-refresh', checkNotifications)
})
</script>

<template>
  <div class="mobile-container flex flex-col">
    <!-- Header -->
    <header v-if="shouldShowHeader" class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex justify-between items-center">
      <router-link to="/home" class="flex items-center gap-3">
        <img src="/logo.png" alt="PEK Logo" class="h-20 max-h-20 w-auto object-contain py-1">
      </router-link>
      <div class="flex items-center gap-3">
        <LanguageSelector />
        <router-link to="/notifications" class="relative w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
          <Bell class="w-5 h-5" />
          <span
            v-if="authStore.unreadNotificationsCount > 0"
            class="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-in zoom-in duration-200"
          >
            {{ authStore.unreadNotificationsCount }}
          </span>
        </router-link>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto" :class="shouldShowNav && !isSubscriptionRoute ? 'pb-24' : ''">
      <slot />
    </main>

    <!-- Bottom Navigation -->
    <nav v-if="shouldShowNav && !isSubscriptionRoute" class="fixed bottom-0 left-0 right-0 max-width-container mx-auto bg-white/95 backdrop-blur-lg border-t border-slate-100 px-4 py-2 pb-4 flex justify-between items-center z-50 shadow-2xl">
      <!-- 1. Accueil -->
      <router-link to="/home" class="flex-1 flex flex-col items-center gap-1 group" v-slot="{ isActive }">
        <Home :class="['w-5 h-5 transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']" />
        <span :class="['text-[10px] font-bold transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']">
          {{ languageStore.t('nav_home') }}
        </span>
      </router-link>

      <!-- 2. Mon portefeuille -->
      <router-link to="/my-subscriptions" class="flex-1 flex flex-col items-center gap-1 group" v-slot="{ isActive }">
        <Wallet :class="['w-5 h-5 transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']" />
        <span :class="['text-[10px] font-bold transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']">
          {{ languageStore.t('nav_portfolio') }}
        </span>
      </router-link>

      <!-- 3. Investir (Centre / Main Action CTA Button) -->
      <router-link to="/catalog" class="flex-1 flex flex-col items-center -mt-5 group" v-slot="{ isActive }">
        <div :class="[
          'w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 border-2 border-white',
          isActive ? 'bg-[#E8B010] text-[#1F0A03] shadow-[#E8B010]/40' : 'bg-[#482010] text-white shadow-[#482010]/30 group-hover:bg-[#3A190C]'
        ]">
          <TrendingUp class="w-6 h-6" />
        </div>
        <span :class="['text-[10px] font-black mt-1 transition-colors uppercase tracking-wider', isActive ? 'text-[#D49A00]' : 'text-[#482010]']">
          {{ languageStore.t('nav_invest') }}
        </span>
      </router-link>

      <!-- 4. Historique -->
      <router-link to="/history" class="flex-1 flex flex-col items-center gap-1 group" v-slot="{ isActive }">
        <History :class="['w-5 h-5 transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']" />
        <span :class="['text-[10px] font-bold transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']">
          {{ languageStore.t('nav_history') }}
        </span>
      </router-link>

      <!-- 5. Paramètres -->
      <router-link to="/profile" class="flex-1 flex flex-col items-center gap-1 group" v-slot="{ isActive }">
        <Settings :class="['w-5 h-5 transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']" />
        <span :class="['text-[10px] font-bold transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']">
          {{ languageStore.t('nav_settings') }}
        </span>
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
