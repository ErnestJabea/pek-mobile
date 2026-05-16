<script setup>
import { ref, computed, onMounted } from 'vue'
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

const shouldShowNav = computed(() => {
  return authStore.isAuthenticated && !isSplashRoute.value && !isAuthRoute.value
})

const shouldShowHeader = computed(() => {
  return shouldShowNav.value && !isSubscriptionRoute.value && !isNotificationsRoute.value && !isMySubscriptionsRoute.value
})

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
</script>

<template>
  <div class="mobile-container flex flex-col">
    <!-- Header -->
    <header v-if="shouldShowHeader" class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex justify-between items-center">
      <router-link to="/home" class="flex items-center gap-3">
        <img src="/logo.png" alt="PEK Logo" class="h-10 w-auto object-contain">
      </router-link>
      <router-link to="/notifications" class="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
        <Bell class="w-5 h-5" />
      </router-link>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto" :class="shouldShowNav && !isSubscriptionRoute ? 'pb-24' : ''">
      <slot />
    </main>

    <!-- Bottom Navigation -->
    <nav v-if="shouldShowNav && !isSubscriptionRoute" class="fixed bottom-0 left-0 right-0 max-width-container mx-auto bg-white/90 backdrop-blur-lg border-t border-slate-100 px-6 py-2 pb-6 flex justify-between items-center z-50">
      <router-link to="/home" class="flex-1 flex flex-col items-center gap-1 group" v-slot="{ isActive }">
        <Home :class="['w-5 h-5 transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']" />
        <span :class="['text-[10px] font-bold transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']">Accueil</span>
      </router-link>
      
      <router-link to="/catalog" class="flex-1 flex flex-col items-center gap-1 group" v-slot="{ isActive }">
        <List :class="['w-5 h-5 transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']" />
        <span :class="['text-[10px] font-bold transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']">Fonds</span>
      </router-link>

      <div class="flex-1 flex flex-col items-center -mt-8 relative z-10">
        <router-link to="/catalog" class="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/40 border-4 border-white rotate-45 transition-transform hover:scale-110 active:scale-95">
          <Plus class="w-7 h-7 text-white -rotate-45" />
        </router-link>
        <span class="text-[10px] font-bold text-primary mt-2 uppercase tracking-tighter">Investir</span>
      </div>

      <router-link to="/my-subscriptions" class="flex-1 flex flex-col items-center gap-1 group" v-slot="{ isActive }">
        <Wallet :class="['w-5 h-5 transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']" />
        <span :class="['text-[10px] font-bold transition-colors text-center', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600']">Souscriptions</span>
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
