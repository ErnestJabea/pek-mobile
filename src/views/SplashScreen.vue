<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api/api'
import logoSplashGif from '../assets/logo-splash.gif'
import logoPng from '../assets/logo.png'

const router = useRouter()
const authStore = useAuthStore()
const gifLoaded = ref(false)
const gifFailed = ref(false)

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
  <div class="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100]">
    <div class="relative flex items-center justify-center w-52 h-52">
      <div class="absolute inset-0 bg-accent/10 blur-3xl rounded-full scale-125"></div>
      
      <!-- Static Logo visible immediately (zero network wait time) -->
      <img
        :src="logoPng"
        @error="$event.target.src = '/logo.png'"
        alt="PEK Logo"
        class="absolute inset-0 w-full h-full object-contain rounded-[2rem] transition-opacity duration-500"
        :class="{ 'opacity-0': gifLoaded, 'opacity-100 animate-pulse': !gifLoaded }"
      >

      <!-- Animated GIF loaded on top -->
      <img
        :src="logoSplashGif"
        @load="gifLoaded = true"
        @error="gifFailed = true"
        v-show="!gifFailed"
        alt="PEK Logo Animé"
        class="relative z-10 w-full h-full object-contain rounded-[2rem] transition-opacity duration-500"
        :class="{ 'opacity-100': gifLoaded, 'opacity-0': !gifLoaded }"
      >
    </div>

    <div class="mt-10 text-center space-y-4">
      <p class="text-primary text-sm font-extrabold tracking-[0.3em] uppercase">Plan d'Epargne Kori</p>
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
