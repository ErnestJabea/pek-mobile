<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Lock, Loader2, CheckCircle2 } from 'lucide-vue-next'
import api from '../api/api'
import PasswordCriteria from '../components/PasswordCriteria.vue'

const route = useRoute()
const router = useRouter()
const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

const submit = async () => {
  error.value = ''
  if (password.value.length < 12) {
    error.value = 'Le mot de passe doit contenir au moins 12 caractères.'
    return
  }
  if (password.value !== confirmation.value) {
    error.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  loading.value = true
  try {
    await api.post('/reset-password', {
      token: route.params.token,
      email: route.query.email,
      password: password.value,
      password_confirmation: confirmation.value
    })
    success.value = true
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Ce lien est invalide ou expiré.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="px-6 py-12 min-h-[80vh] flex flex-col justify-center space-y-8">
    <div class="text-center space-y-3">
      <div class="w-16 h-16 mx-auto rounded-3xl bg-primary/5 text-primary flex items-center justify-center"><Lock class="w-8 h-8" /></div>
      <h1 class="text-2xl font-black text-primary">Nouveau mot de passe</h1>
      <p class="text-sm text-slate-500">Choisissez au moins 12 caractères. Le lien ne peut être utilisé qu’une fois.</p>
    </div>

    <div v-if="success" class="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 text-center space-y-4">
      <CheckCircle2 class="w-10 h-10 text-emerald-500 mx-auto" />
      <p class="font-bold text-emerald-700">Mot de passe réinitialisé.</p>
      <button @click="router.push('/login')" class="w-full bg-primary text-white font-bold py-4 rounded-2xl">Se connecter</button>
    </div>

    <form v-else @submit.prevent="submit" class="space-y-5">
      <p v-if="error" class="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-sm">{{ error }}</p>
      <input v-model="password" type="password" autocomplete="new-password" placeholder="Nouveau mot de passe" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-4" required>
      <input v-model="confirmation" type="password" autocomplete="new-password" placeholder="Confirmer le mot de passe" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-4" required>
      <PasswordCriteria 
        v-if="password || confirmation"
        :password="password"
        :confirmation="confirmation"
        :show-confirmation-criteria="true"
      />
      <button type="submit" :disabled="loading" class="w-full bg-primary text-white font-bold py-4 rounded-2xl flex justify-center gap-2 disabled:bg-slate-300">
        <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
        Réinitialiser
      </button>
    </form>
  </main>
</template>
