<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import MobileLayout from './layouts/MobileLayout.vue'
import { Smartphone, MonitorOff, WifiOff } from 'lucide-vue-next'
import { useAuthStore } from './stores/auth'
import api from './api/api'

const isDesktop = ref(false)
const isOffline = ref(!window.navigator.onLine)
const authStore = useAuthStore()
const showApplePrompt = ref(false)

const checkScreenSize = () => {
  isDesktop.value = window.innerWidth > 1024
}

const updateOnlineStatus = () => {
  isOffline.value = !window.navigator.onLine
}

const detectiOS = () => {
  const userAgent = window.navigator.userAgent.toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(userAgent)
  
  // Standalone vérifie si l'app est lancée comme PWA installée ou dans le navigateur
  const isStandalone = window.navigator.standalone === true
  
  // Vérifie si l'utilisateur a fermé l'invitation pour cette session
  const isClosed = sessionStorage.getItem('pek_ios_prompt_closed') === 'true'

  if (isIOS && !isStandalone && !isClosed) {
    showApplePrompt.value = true
  }
}

const closeApplePrompt = () => {
  showApplePrompt.value = false
  sessionStorage.setItem('pek_ios_prompt_closed', 'true')
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
  detectiOS()
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
  <!-- iOS PWA Install Prompt Banner -->
  <div v-if="showApplePrompt" class="fixed bottom-6 left-6 right-6 bg-slate-900 text-white rounded-[32px] p-6 shadow-2xl z-[9999] border border-white/10 animate-in slide-in-from-bottom duration-500 max-w-md mx-auto text-left">
    <div class="flex justify-between items-start mb-4">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-accent">
          <Smartphone class="w-6 h-6 text-yellow-400" />
        </div>
        <div>
          <h4 class="text-sm font-black uppercase tracking-wider">Installer PEK Mobile</h4>
          <p class="text-[10px] text-white/50 font-bold">Ajoutez l'application sur votre iPhone</p>
        </div>
      </div>
      <button @click="closeApplePrompt" class="text-white/60 hover:text-white font-black text-sm p-1">✕</button>
    </div>
    
    <div class="space-y-2 text-xs font-semibold text-white/80 leading-relaxed pl-1">
      <p class="flex items-center gap-2">
        <span>1. Appuyez sur le bouton de <strong>Partage</strong></span>
        <svg class="w-5 h-5 text-yellow-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </p>
      <p class="flex items-center gap-2">
        <span>2. Faites défiler et sélectionnez <strong>Sur l'écran d'accueil</strong></span>
        <svg class="w-5 h-5 text-yellow-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </p>
    </div>
  </div>

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
