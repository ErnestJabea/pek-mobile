<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import MobileLayout from './layouts/MobileLayout.vue'
import { Smartphone, MonitorOff, WifiOff } from 'lucide-vue-next'
import { useAuthStore } from './stores/auth'
import api from './api/api'

const isDesktop = ref(false)
const isOffline = ref(!window.navigator.onLine)
const authStore = useAuthStore()

const checkScreenSize = () => {
  isDesktop.value = window.innerWidth > 1024
}

const updateOnlineStatus = () => {
  isOffline.value = !window.navigator.onLine
}

const initUser = async () => {
  if (authStore.token && !authStore.user) {
    try {
      const response = await api.get('/user')
      authStore.setUser(response.data)
    } catch (error) {
      authStore.logout()
    }
  }
}

onMounted(() => {
  checkScreenSize()
  initUser()
  window.addEventListener('resize', checkScreenSize)
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenSize)
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})
</script>

<template>
  <!-- Écran de déconnexion Internet -->
  <div v-if="isOffline" class="fixed inset-0 bg-white z-[10000] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
    <div class="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6 animate-bounce">
      <WifiOff class="w-12 h-12 text-rose-500" />
    </div>
    <h2 class="text-2xl font-black text-slate-900 mb-2">Connexion perdue</h2>
    <p class="text-slate-500 font-medium mb-8">
      Vérifiez votre connexion internet pour continuer à utiliser PEK.
    </p>
    <div class="flex items-center gap-2 text-primary font-bold animate-pulse">
      <div class="w-2 h-2 bg-primary rounded-full"></div>
      Tentative de reconnexion...
    </div>
  </div>

  <div v-if="isDesktop" class="fixed inset-0 bg-slate-900 flex items-center justify-center p-6 z-[9999]">
    <div class="max-w-md w-full bg-white rounded-[40px] p-12 text-center space-y-8 shadow-2xl animate-in fade-in zoom-in duration-500">
      <div class="relative inline-block">
        <div class="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center mx-auto">
          <MonitorOff class="w-12 h-12 text-primary" />
        </div>
        <div class="absolute -bottom-2 -right-2 w-10 h-10 bg-rose-500 rounded-full border-4 border-white flex items-center justify-center">
          <Smartphone class="w-5 h-5 text-white" />
        </div>
      </div>
      
      <div class="space-y-4">
        <h1 class="text-2xl font-black text-slate-900 leading-tight">Version Mobile Uniquement</h1>
        <p class="text-slate-500 leading-relaxed font-medium">
          L'expérience PEK FCP est optimisée exclusivement pour les appareils mobiles et tablettes afin de garantir la sécurité de vos transactions.
        </p>
      </div>

      <div class="pt-4">
        <div class="bg-slate-50 p-6 rounded-3xl space-y-4">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Scannez pour continuer</p>
          <div class="w-32 h-32 bg-slate-200 mx-auto rounded-2xl flex items-center justify-center italic text-[10px] text-slate-400">
            QR CODE PEK
          </div>
        </div>
      </div>

      <p class="text-[10px] text-slate-300 font-bold uppercase tracking-widest italic">
        PEK - Plan d'Épargne Kori
      </p>
    </div>
  </div>

  <MobileLayout v-else>
    <router-view v-slot="{ Component }">
      <transition 
        name="slide" 
        mode="out-in"
      >
        <component :is="Component" />
      </transition>
    </router-view>
  </MobileLayout>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

:root {
  --primary: #00236B;
  --accent: #FFD700;
}

body {
  font-family: 'Outfit', sans-serif;
  background-color: #f8fafc;
  margin: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease-out;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Custom scrollbar for premium feel */
::-webkit-scrollbar {
  width: 0px;
}
</style>
