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
    const welcomeSeen = localStorage.getItem('pek_welcome_seen') === 'true'
    if (!welcomeSeen) {
      await timer
      router.push('/welcome')
    } else if (authStore.token) {
      // On lance la recuperation utilisateur et le timer en parallele
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
    const welcomeSeen = localStorage.getItem('pek_welcome_seen') === 'true'
    if (!welcomeSeen) {
      router.push('/welcome')
    } else {
      router.push('/login')
    }
  }
})
</script>

<template>
  <div class="fixed inset-0 bg-primary flex flex-col items-center justify-center z-[100]">
    <div class="relative flex items-center justify-center">
      <div class="absolute inset-0 bg-accent/15 blur-3xl rounded-full scale-125"></div>
      <img src="/logo-splash.gif" alt="PEK Logo" class="relative z-10 w-52 h-52 object-contain rounded-[2rem] shadow-2xl shadow-cocoa/30">
    </div>

    <div class="mt-10 text-center space-y-4">
      <p class="text-accent/90 text-sm font-bold tracking-[0.3em] uppercase">Plan d'Epargne Kori</p>
    </div>

    <div class="absolute bottom-12 left-0 right-0 flex justify-center">
      <div class="flex gap-1.5">
        <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style="animation-delay: 0s"></div>
        <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
        <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
      </div>
    </div>
  </div>
</template>
