<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldAlert } from 'lucide-vue-next'
import api from '../api/api'

const router = useRouter()
const authStore = useAuthStore()

const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const validationErrors = ref({})
const success = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  validationErrors.value = {}

  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Les mots de passe ne correspondent pas.'
    loading.value = false
    return
  }

  if (newPassword.value.length < 8) {
    error.value = 'Le mot de passe doit contenir au moins 8 caractères.'
    loading.value = false
    return
  }

  try {
    const response = await api.post('/reset-temp-password', {
      new_password: newPassword.value
    })
    
    // Mettre à jour l'utilisateur dans le store avec les nouvelles données
    authStore.setUser(response.data.user)
    success.value = true
    
    setTimeout(() => {
      router.push('/home')
    }, 2000)
  } catch (err) {
    if (err.response?.status === 422) {
      validationErrors.value = err.response.data.errors || {}
    } else {
      error.value = err.response?.data?.message || 'Une erreur est survenue lors de la réinitialisation.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="px-6 py-12 flex flex-col justify-center min-h-[80vh] space-y-8 animate-in fade-in duration-300">
    <!-- Header -->
    <div class="flex flex-col items-center space-y-5">
      <div class="w-16 h-16 rounded-3xl bg-amber-50 flex items-center justify-center text-amber-500 animate-bounce">
        <ShieldAlert class="w-8 h-8" />
      </div>
      <div class="text-center space-y-2">
        <h2 class="text-2xl font-black text-primary">Nouveau mot de passe</h2>
        <p class="text-slate-500 text-sm">Par mesure de sécurité, veuillez définir un mot de passe permanent avant d'accéder à votre compte.</p>
      </div>
    </div>

    <!-- Succès -->
    <div v-if="success" class="space-y-6 animate-in zoom-in duration-300">
      <div class="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 text-center space-y-4">
        <CheckCircle2 class="w-12 h-12 text-emerald-500 mx-auto" />
        <p class="text-emerald-700 font-bold">Mot de passe mis à jour !</p>
        <p class="text-slate-500 text-sm">Votre nouveau mot de passe a été enregistré. Redirection vers votre tableau de bord...</p>
      </div>
    </div>

    <!-- Formulaire -->
    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <div v-if="error" class="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-2xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
        {{ error }}
      </div>

      <div class="space-y-4">
        <!-- Nouveau mot de passe -->
        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">Nouveau mot de passe</label>
          <div class="relative">
            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              v-model="newPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-12 focus:bg-white focus:border-primary transition-all font-sans"
              required
              :aria-invalid="validationErrors.new_password ? 'true' : 'false'"
              :aria-describedby="validationErrors.new_password ? 'new-password-error' : null"
            >
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center"
            >
              <component :is="showPassword ? EyeOff : Eye" class="w-5 h-5" />
            </button>
          </div>
          <p v-if="validationErrors.new_password" id="new-password-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.new_password[0] }}
          </p>
        </div>

        <!-- Confirmer le mot de passe -->
        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">Confirmer le mot de passe</label>
          <div class="relative">
            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="••••••••"
              class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-12 focus:bg-white focus:border-primary transition-all font-sans"
              required
            >
            <button
              type="button"
              @click="showConfirmPassword = !showConfirmPassword"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center"
            >
              <component :is="showConfirmPassword ? EyeOff : Eye" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <button
        type="submit"
        :disabled="loading || !newPassword || !confirmPassword"
        class="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-slate-800 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
      >
        <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
        <span v-else>Enregistrer mon nouveau mot de passe</span>
      </button>
    </form>
  </div>
</template>
