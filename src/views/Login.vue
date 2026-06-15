<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-vue-next'
import api from '../api/api'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const validationErrors = ref({})
const showVerificationLink = ref(false)
const showPassword = ref(false)

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  validationErrors.value = {}
  showVerificationLink.value = false
  try {
    const response = await api.post('/login', {
      email: email.value,
      password: password.value
    })
    
    authStore.setToken(response.data.access_token)
    authStore.setUser(response.data.user)
    
    const redirectPath = route.query.redirect || '/'
    router.push(redirectPath)
  } catch (err) {
    if (err.response?.status === 422) {
      validationErrors.value = err.response.data.errors || {}
    } else {
      error.value = err.response?.data?.message || 'Erreur lors de la connexion'
      if (err.response?.status === 403) {
        showVerificationLink.value = true
      }
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="px-6 py-12 flex flex-col justify-center min-h-[80vh] space-y-10">
    <div class="flex flex-col items-center space-y-6">
      <img src="/logo.png" alt="PEK Logo" class="h-20 w-auto object-contain">
      <div class="text-center space-y-2">
        <h2 class="text-3xl font-bold text-primary">Bon retour !</h2>
        <p class="text-slate-500">Connectez-vous à votre Plan d'Épargne Kori.</p>
      </div>
    </div>

    <form @submit.prevent="handleLogin" class="space-y-6">
      <div v-if="error" class="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 flex flex-col gap-2">
        <span>{{ error }}</span>
        <router-link 
          v-if="showVerificationLink" 
          :to="{ path: '/register', query: { email: email, step: '2' } }"
          class="text-xs font-bold text-primary hover:underline mt-1 self-start flex items-center gap-1"
        >
          Saisir le code de vérification →
        </router-link>
      </div>
      <div class="space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">Email</label>
          <div class="relative">
            <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              v-model="email"
              type="email" 
              placeholder="votre@email.com" 
              class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all"
              required
              :aria-invalid="validationErrors.email ? 'true' : 'false'"
              :aria-describedby="validationErrors.email ? 'email-error' : null"
            >
          </div>
          <p v-if="validationErrors.email" id="email-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.email[0] }}
          </p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">Mot de passe</label>
          <div class="relative">
            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              v-model="password"
              :type="showPassword ? 'text' : 'password'" 
              placeholder="••••••••" 
              class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-12 focus:bg-white focus:border-primary transition-all"
              required
              :aria-invalid="validationErrors.password ? 'true' : 'false'"
              :aria-describedby="validationErrors.password ? 'password-error' : null"
            >
            <button 
              type="button" 
              @click="showPassword = !showPassword"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center"
            >
              <component :is="showPassword ? EyeOff : Eye" class="w-5 h-5" />
            </button>
          </div>
          <p v-if="validationErrors.password" id="password-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.password[0] }}
          </p>
          <div class="text-right">
            <router-link to="/forgot-password" class="text-xs font-semibold text-primary hover:underline">Mot de passe oublié ?</router-link>
          </div>
        </div>
      </div>

      <button 
        type="submit"
        :disabled="loading"
        class="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-slate-800 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
      >
        <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
        <template v-else>
          Se connecter
          <ArrowRight class="w-5 h-5" />
        </template>
      </button>
    </form>



    <p class="text-center text-sm text-slate-500">
      Pas encore de compte ? 
      <router-link to="/register" class="text-primary font-bold hover:underline">S'inscrire</router-link>
    </p>
  </div>
</template>
