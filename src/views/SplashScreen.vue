<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api/api'

const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
  const start = Date.now()
  const MIN_DELAY = 3000 // 3 secondes
  
  const timer = new Promise(resolve => setTimeout(resolve, MIN_DELAY))
  
  try {
    if (authStore.token) {
      // On lance la récupération utilisateur et le timer en parallèle
      await Promise.all([
        api.get('/user').then(response => authStore.setUser(response.data)),
        timer
      ])
      router.push('/home')
    } else {
      await timer
      router.push('/login')
    }
  } catch (error) {
    authStore.logout()
    await timer
    router.push('/login')
  }
})
</script>

<template>
  <div class="fixed inset-0 bg-primary flex flex-col items-center justify-center z-[100]">
    <div class="relative">
      <div class="w-32 h-32 bg-white/10 rounded-full absolute -inset-4 animate-ping"></div>
      <div class="w-32 h-32 bg-white rounded-3xl shadow-2xl flex items-center justify-center relative z-10 animate-bounce">
        <img src="/logo.png" alt="PEK Logo" class="w-20 h-auto">
      </div>
    </div>
    
    <div class="mt-12 text-center space-y-4">
      <p class="text-white/60 text-sm font-bold tracking-[0.3em] uppercase">Plan d'Épargne Kori</p>
    </div>

    <div class="absolute bottom-12 left-0 right-0 flex justify-center">
      <div class="flex gap-1.5">
        <div class="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style="animation-delay: 0s"></div>
        <div class="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
        <div class="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
      </div>
    </div>
  </div>
</template>
