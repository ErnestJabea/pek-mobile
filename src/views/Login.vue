<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, ChevronLeft } from 'lucide-vue-next'
import api from '../api/api'
import LanguageSelector from '../components/LanguageSelector.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const languageStore = useLanguageStore()

const email = ref('')
const password = ref('')
const step = ref(1) // 1 = credentials, 2 = MFA OTP
const otpCode = ref('')
const challengeId = ref('')
const loading = ref(false)
const error = ref('')
const validationErrors = ref({})
const showVerificationLink = ref(false)
const showPassword = ref(false)

const clearError = (field) => {
  if (validationErrors.value[field]) {
    delete validationErrors.value[field]
  }
}

onMounted(() => {
  if (route.query.expired || route.query.session_expired) {
    error.value = languageStore.t('session_expired_msg')
  }
})

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  validationErrors.value = {}
  showVerificationLink.value = false
  try {
    if (step.value === 1) {
      const response = await api.post('/login', {
        email: email.value,
        password: password.value
      })
      
      if (response.data.requires_mfa) {
        challengeId.value = response.data.challenge_id
        step.value = 2
      } else {
        authStore.setToken(response.data.access_token)
        authStore.setUser(response.data.user)
        
        const redirectPath = route.query.redirect || '/'
        router.push(redirectPath)
      }
    } else {
      if (!otpCode.value || otpCode.value.trim() === '') {
        validationErrors.value.code = ['Le code de vérification est obligatoire.']
        error.value = 'Veuillez saisir le code de vérification.'
        loading.value = false
        return
      }

      const response = await api.post('/verify-otp', {
        challenge_id: challengeId.value,
        code: otpCode.value
      })
      
      authStore.setToken(response.data.access_token)
      authStore.setUser(response.data.user)
      
      const redirectPath = route.query.redirect || '/'
      router.push(redirectPath)
    }
  } catch (err) {
    if (err.response?.status === 422) {
      validationErrors.value = err.response.data.errors || {}
      if (err.response.data.message && !err.response.data.errors) {
        if (step.value === 2) {
          validationErrors.value.code = [err.response.data.message]
        } else {
          error.value = err.response.data.message
        }
      }
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

const handleResendOtp = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await api.post('/resend-otp', { email: email.value })
    challengeId.value = response.data.challenge_id
  } catch (err) {
    error.value = err.response?.data?.message || 'Erreur lors de l\'envoi du code'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="px-6 py-6 flex flex-col justify-between min-h-[85vh] space-y-8 max-w-md mx-auto relative">
    <!-- Top Bar with Language Selector -->
    <div class="flex justify-end pt-2">
      <LanguageSelector />
    </div>

    <div class="flex flex-col items-center space-y-6">
      <img src="/logo.png" alt="PEK Logo" class="h-24 max-w-[200px] w-auto object-contain">
      <div class="text-center space-y-2">
        <h2 class="text-3xl font-bold text-primary">
          {{ step === 1 ? languageStore.t('welcome_back') : languageStore.t('otp_title') }}
        </h2>
        <p class="text-slate-500 text-sm">
          {{ step === 1 ? languageStore.t('login_subtitle') : (languageStore.isEn() ? 'Enter the verification code sent to ' : 'Saisissez le code de vérification envoyé à ') + email }}
        </p>
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

      <div v-if="step === 1" class="space-y-4">
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

        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">{{ languageStore.t('password_label') }}</label>
          <div class="relative">
            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              v-model="password"
              :type="showPassword ? 'text' : 'password'" 
              :placeholder="languageStore.t('password_placeholder')" 
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
            <router-link to="/forgot-password" class="text-xs font-semibold text-primary hover:underline">
              {{ languageStore.t('forgot_password') }}
            </router-link>
          </div>
        </div>
      </div>

      <div v-else class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div class="space-y-2 text-center">
            <label class="text-sm font-bold text-slate-700">{{ languageStore.t('otp_title') }}</label>
            <input 
              v-model="otpCode" 
              @blur="clearError('code')" 
              @input="clearError('code')" 
              type="text" 
              maxlength="6" 
              placeholder="000000" 
              class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-4 text-center text-2xl font-bold tracking-[1em] focus:bg-white focus:border-primary transition-all font-mono" 
              required 
              :aria-invalid="validationErrors.code ? 'true' : 'false'" 
              :aria-describedby="validationErrors.code ? 'code-error' : null"
            >
            <p v-if="validationErrors.code" id="code-error" role="alert" class="text-rose-500 text-xs mt-1 font-semibold text-center tracking-normal">
              {{ validationErrors.code[0] }}
            </p>
        </div>
        
        <div class="flex items-center justify-between px-2">
          <button 
            type="button" 
            @click="step = 1; challengeId = ''; otpCode = ''; error = ''; validationErrors = {}"
            class="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <ChevronLeft class="w-4 h-4" /> {{ languageStore.t('back') }}
          </button>
          
          <button 
            type="button" 
            @click="handleResendOtp"
            :disabled="loading"
            class="text-xs font-bold text-primary hover:underline disabled:text-slate-400"
          >
            {{ languageStore.t('resend_code') }}
          </button>
        </div>
      </div>

      <button 
        type="submit"
        :disabled="loading"
        class="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-slate-800 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
        <template v-else>
          {{ step === 1 ? languageStore.t('login_button') : languageStore.t('verify_button') }}
          <ArrowRight class="w-5 h-5" />
        </template>
      </button>
    </form>

    <p class="text-center text-sm text-slate-500 pt-4">
      {{ languageStore.t('no_account') }} 
      <router-link to="/register" class="text-primary font-bold hover:underline ml-1">
        {{ languageStore.t('register_link') }}
      </router-link>
    </p>
  </div>
</template>
