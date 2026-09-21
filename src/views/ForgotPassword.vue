<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-vue-next'
import { useLanguageStore } from '../stores/language'
import api from '../api/api'
import LanguageSelector from '../components/LanguageSelector.vue'

const router = useRouter()
const languageStore = useLanguageStore()

const email = ref('')
const loading = ref(false)
const error = ref('')
const validationErrors = ref({})
const success = ref(false)

const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  validationErrors.value = {}
  try {
    const response = await api.post('/forgot-password', { email: email.value })
    success.value = true
  } catch (err) {
    if (err.response?.status === 422) {
      validationErrors.value = err.response.data.errors || {}
    } else {
      error.value = err.response?.data?.message || 'Aucun compte trouvé avec cet email.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="px-6 py-6 flex flex-col justify-between min-h-[85vh] space-y-8 max-w-md mx-auto relative">
    <div class="flex justify-end pt-2">
      <LanguageSelector />
    </div>

    <!-- Header -->
    <div class="flex flex-col items-center space-y-5">
      <img src="/logo.png" alt="PEK Logo" class="h-16 w-auto object-contain">
      <div class="text-center space-y-2">
        <h2 class="text-2xl font-bold text-primary">{{ languageStore.isEn() ? 'Forgot Password' : 'Mot de passe oublié' }}</h2>
        <p class="text-slate-500 text-sm">{{ languageStore.isEn() ? 'Enter your email to reset access to your account.' : 'Entrez votre email pour réinitialiser votre accès.' }}</p>
      </div>
    </div>

    <!-- Succès -->
    <div v-if="success" class="space-y-6">
      <div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center space-y-4">
        <CheckCircle2 class="w-12 h-12 text-emerald-500 mx-auto" />
        <p class="text-emerald-700 font-semibold">{{ languageStore.isEn() ? 'Request received' : 'Demande prise en compte' }}</p>
        <p class="text-slate-500 text-sm">{{ languageStore.isEn() ? 'If an account matches this email, you will receive a secure reset link.' : 'Si un compte correspond à cette adresse, vous recevrez un lien sécurisé et temporaire. Aucun mot de passe n’est envoyé par e-mail.' }}</p>
      </div>

      <button
        @click="router.push('/login')"
        class="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all active:scale-95"
      >
        {{ languageStore.t('login_link') }}
      </button>
    </div>

    <!-- Formulaire -->
    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <div v-if="error" class="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium">
        {{ error }}
      </div>

      <div class="space-y-2">
        <label class="text-sm font-bold text-slate-700 ml-1">{{ languageStore.t('email_label') }}</label>
        <div class="relative">
          <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            v-model="email"
            type="email"
            :placeholder="languageStore.t('email_placeholder')"
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

      <button
        type="submit"
        :disabled="loading"
        class="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-slate-800 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
        <span v-else>{{ languageStore.isEn() ? 'Reset Password' : 'Réinitialiser le mot de passe' }}</span>
      </button>
    </form>

    <!-- Retour connexion -->
    <button
      v-if="!success"
      @click="router.push('/login')"
      class="flex items-center justify-center gap-2 text-slate-500 text-sm hover:text-primary transition-colors"
    >
      <ArrowLeft class="w-4 h-4" />
      {{ languageStore.isEn() ? 'Back to login' : 'Retour à la connexion' }}
    </button>

  </div>
</template>
