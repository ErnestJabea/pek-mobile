<script setup>
import { ref, onMounted } from 'vue'
import { Bell, ChevronLeft, BellOff, ArrowRight, Loader2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import api from '../api/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const notifications = ref([])
const loading = ref(true)

const fetchNotifications = async () => {
  try {
    const response = await api.get('/notifications')
    notifications.value = response.data
    
    // Mark as read in backend if any are unread, and clear count in store
    const hasUnread = notifications.value.some(n => !n.read_at)
    if (hasUnread) {
      await api.post('/notifications/read-all')
      authStore.setUnreadNotificationsCount(0)
    }
  } catch (error) {
    console.error('Error fetching notifications:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchNotifications()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <!-- Skeleton loader covering the entire view (including Appbar) -->
    <div v-if="loading" class="flex-1 flex flex-col animate-pulse">
      <!-- Skeleton Header -->
      <header class="bg-white px-6 py-6 border-b border-slate-100 flex items-center gap-4">
        <div class="w-10 h-10 bg-slate-100 rounded-xl"></div>
        <div class="h-6 bg-slate-200 rounded-lg w-32"></div>
      </header>

      <!-- Skeleton Main Content -->
      <main class="flex-1 p-6 space-y-4">
        <div v-for="i in 4" :key="i" class="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex gap-4">
          <div class="w-10 h-10 bg-slate-100 rounded-2xl shrink-0"></div>
          <div class="space-y-2 flex-1 pt-1">
            <div class="h-4 bg-slate-200 rounded-full w-2/3"></div>
            <div class="h-3 bg-slate-100 rounded-full w-5/6"></div>
            <div class="h-3 bg-slate-100 rounded-full w-12"></div>
          </div>
        </div>
      </main>
    </div>

    <!-- Actual Content -->
    <template v-else>
      <!-- Header -->
      <header class="bg-white px-6 py-6 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-10">
        <button @click="router.back()" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all">
          <ChevronLeft class="w-6 h-6" />
        </button>
        <h2 class="text-xl font-bold text-slate-900">Notifications</h2>
      </header>

      <main class="flex-1 flex flex-col p-6">
        <!-- Empty State -->
        <div v-if="notifications.length === 0" class="flex-1 flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in zoom-in duration-500">
        <div class="relative">
          <div class="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center">
            <BellOff class="w-10 h-10 text-primary/30" />
          </div>
          <div class="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-white animate-pulse"></div>
        </div>
        
        <div class="space-y-2">
          <h3 class="text-xl font-bold text-slate-900">Tout est calme ici</h3>
          <p class="text-slate-500 text-sm max-w-[240px] mx-auto leading-relaxed">
            Vous n'avez aucune notification pour l'instant. Nous vous tiendrons informé de vos investissements.
          </p>
        </div>

        <router-link to="/catalog" class="inline-flex items-center gap-2 bg-primary text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
          Découvrir les fonds
          <ArrowRight class="w-4 h-4" />
        </router-link>
      </div>

      <!-- Notifications List -->
      <div v-else class="space-y-4">
        <div v-for="notif in notifications" :key="notif.id" :class="notif.read_at ? 'bg-white' : 'bg-primary/5 border-primary/10'" class="p-4 rounded-3xl border border-slate-100 shadow-sm flex gap-4 transition-all">
          <div :class="notif.read_at ? 'bg-slate-100 text-slate-400' : 'bg-primary text-white'" class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
            <Bell class="w-5 h-5" />
          </div>
          <div class="space-y-1">
            <h4 class="font-bold text-slate-900 text-sm">{{ notif.title }}</h4>
            <p class="text-slate-500 text-xs leading-relaxed">{{ notif.body }}</p>
            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{{ new Date(notif.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }}</span>
          </div>
        </div>
      </div>
    </main>
    </template>
  </div>
</template>
