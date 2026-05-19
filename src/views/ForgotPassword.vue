<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-vue-next'
import api from '../api/api'

const router = useRouter()

const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await api.post('/forgot-password', { email: email.value })
    success.value = true
  } catch (err) {
    error.value = err.response?.data?.message || 'Aucun compte trouvé avec cet email.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="px-6 py-12 flex flex-col justify-center min-h-[80vh] space-y-8">

    <!-- Header -->
    <div class="flex flex-col items-center space-y-5">
      <img src="/logo.png" alt="PEK Logo" class="h-16 w-auto object-contain">
      <div class="text-center space-y-2">
        <h2 class="text-2xl font-bold text-primary">Mot de passe oublié</h2>
        <p class="text-slate-500 text-sm">Entrez votre email pour réinitialiser votre accès.</p>
      </div>
    </div>

    <!-- Succès -->
    <div v-if="success" class="space-y-6">
      <div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center space-y-4">
        <CheckCircle2 class="w-12 h-12 text-emerald-500 mx-auto" />
        <p class="text-emerald-700 font-semibold">Mot de passe réinitialisé !</p>
        <p class="text-slate-500 text-sm">Un email contenant votre nouveau mot de passe temporaire a été envoyé à <strong>{{ email }}</strong>. Consultez votre boîte mail.</p>
      </div>

      <button
        @click="router.push('/login')"
        class="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all"
      >
        Aller à la connexion
      </button>
    </div>

    <!-- Formulaire -->
    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <div v-if="error" class="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium">
        {{ error }}
      </div>

      <div class="space-y-2">
        <label class="text-sm font-bold text-slate-700 ml-1">Adresse email</label>
        <div class="relative">
          <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            v-model="email"
            type="email"
            placeholder="votre@email.com"
            class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all"
            required
          >
        </div>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-slate-800 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
      >
        <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
        <span v-else>Réinitialiser le mot de passe</span>
      </button>
    </form>

    <!-- Retour connexion -->
    <button
      v-if="!success"
      @click="router.push('/login')"
      class="flex items-center justify-center gap-2 text-slate-500 text-sm hover:text-primary transition-colors"
    >
      <ArrowLeft class="w-4 h-4" />
      Retour à la connexion
    </button>

  </div>
</template>
