<script setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'
import api from '../api/api'
import QrcodeVue from 'qrcode.vue'
import { copyTextToClipboard } from '../utils/clipboard.js'
import {
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  ChevronLeft,
  Loader2,
  KeyRound,
  ShieldOff
} from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  isInitialPrompt: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'updated'])

const authStore = useAuthStore()
const languageStore = useLanguageStore()

const currentMfaType = computed(() => authStore.user?.mfa_type || 'none')

const mode = ref('select') // 'select' | 'setup_totp'
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// TOTP state
const totpSecret = ref('')
const provisioningUri = ref('')
const verificationCode = ref('')
const copiedSecret = ref(false)

const closeModal = () => {
  emit('update:modelValue', false)
  // Reset state after animation
  setTimeout(() => {
    mode.value = 'select'
    errorMessage.value = ''
    successMessage.value = ''
    verificationCode.value = ''
    totpSecret.value = ''
    provisioningUri.value = ''
    copiedSecret.value = false
  }, 250)
}

const copySecretToClipboard = async () => {
  if (!totpSecret.value) return
  const success = await copyTextToClipboard(totpSecret.value)
  if (success) {
    copiedSecret.value = true
    setTimeout(() => {
      copiedSecret.value = false
    }, 2500)
  }
}

const selectMethod = async (method) => {
  errorMessage.value = ''
  successMessage.value = ''

  if (method === 'totp') {
    loading.value = true
    try {
      const response = await api.post('/mfa/setup-totp')
      totpSecret.value = response.data.secret
      provisioningUri.value = response.data.provisioning_uri
      mode.value = 'setup_totp'
    } catch (err) {
      errorMessage.value = err.response?.data?.message || (languageStore.isEn() ? 'Error initializing app' : 'Erreur lors de l\'initialisation de l\'application')
    } finally {
      loading.value = false
    }
    return
  }

  if (method === 'email') {
    loading.value = true
    try {
      const response = await api.post('/mfa/update-preference', { mfa_type: 'email' })
      if (response.data?.user) {
        authStore.setUser(response.data.user)
      }
      successMessage.value = languageStore.isEn() ? 'Two-factor authentication via email enabled successfully.' : 'Authentification à deux facteurs par e-mail activée avec succès.'
      emit('updated', response.data?.user)
      setTimeout(() => {
        closeModal()
      }, 1500)
    } catch (err) {
      errorMessage.value = err.response?.data?.message || (languageStore.isEn() ? 'Error during update' : 'Erreur lors de la mise à jour')
    } finally {
      loading.value = false
    }
    return
  }

  if (method === 'none') {
    loading.value = true
    try {
      const response = await api.post('/mfa/update-preference', { mfa_type: 'none' })
      if (response.data?.user) {
        authStore.setUser(response.data.user)
      }
      successMessage.value = languageStore.isEn() ? 'Two-factor authentication disabled.' : 'Authentification à deux facteurs désactivée.'
      emit('updated', response.data?.user)
      setTimeout(() => {
        closeModal()
      }, 1200)
    } catch (err) {
      errorMessage.value = err.response?.data?.message || (languageStore.isEn() ? 'Error during deactivation' : 'Erreur lors de la désactivation')
    } finally {
      loading.value = false
    }
  }
}

const confirmTotp = async () => {
  if (!verificationCode.value || verificationCode.value.trim().length !== 6) {
    errorMessage.value = languageStore.isEn() ? 'Please enter the 6-digit code shown in your app.' : 'Veuillez saisir le code à 6 chiffres affiché par votre application.'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const response = await api.post('/mfa/confirm-totp', {
      secret: totpSecret.value,
      code: verificationCode.value.trim()
    })

    if (response.data?.user) {
      authStore.setUser(response.data.user)
    }
    successMessage.value = languageStore.isEn() ? 'Authenticator app configured and enabled successfully!' : 'Application d\'authentification configurée et activée avec succès !'
    emit('updated', response.data?.user)
    setTimeout(() => {
      closeModal()
    }, 1800)
  } catch (err) {
    errorMessage.value = err.response?.data?.message || (languageStore.isEn() ? 'Invalid code. Check your device time and try again.' : 'Code invalide. Vérifiez l\'heure de votre appareil et réessayez.')
  } finally {
    loading.value = false
  }
}

const handleDismissPrompt = async () => {
  loading.value = true
  try {
    const response = await api.post('/mfa/dismiss-prompt')
    if (response.data?.user) {
      authStore.setUser(response.data.user)
    }
  } catch (err) {
    console.warn('Could not dismiss prompt', err)
  } finally {
    loading.value = false
    closeModal()
  }
}
</script>

<template>
  <Teleport to="body">
    <div 
      v-if="modelValue" 
      class="fixed inset-0 z-[10000] flex items-center justify-center p-4"
    >
      <div 
        @click="isInitialPrompt ? null : closeModal()" 
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
      ></div>
      <div 
        class="relative bg-white rounded-[32px] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 space-y-5 text-left z-10 animate-in zoom-in-95 duration-200"
      >
        <!-- Close button (uniquement si pas de prompt forcé ou si dismiss possible) -->
        <button 
          type="button" 
          @click="isInitialPrompt ? handleDismissPrompt() : closeModal()" 
          class="absolute right-5 top-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          :aria-label="languageStore.isEn() ? 'Close' : 'Fermer'"
        >
          <X class="w-4 h-4" />
        </button>

      <!-- Header -->
      <div class="space-y-1 pr-8">
        <!-- <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider mb-1">
          <ShieldCheck class="w-3.5 h-3.5 text-emerald-600" />
          Sécurité du compte
        </div> -->
        <h3 class="text-xl font-black text-slate-900">
          {{ isInitialPrompt ? (languageStore.isEn() ? 'Secure your account' : 'Sécurisez votre compte') : (languageStore.isEn() ? 'Two-Factor Authentication (MFA)' : 'Double Authentification (MFA)') }}
        </h3>
        <p class="text-xs text-slate-500 font-medium">
          {{ 
            isInitialPrompt 
              ? (languageStore.isEn() ? 'Choose a validation method to protect your investments and your data.' : 'Choisissez une méthode de validation pour protéger vos investissements et vos données.')
              : (languageStore.isEn() ? 'Configure the verification method requested when signing in to the platform.' : 'Configurez la méthode de vérification demandée lors de votre connexion à la plateforme.') 
          }}
        </p>
      </div>

      <!-- Alerts -->
      <div 
        v-if="successMessage" 
        class="p-4 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-3 animate-in fade-in"
      >
        <CheckCircle2 class="w-5 h-5 shrink-0 text-emerald-600" />
        <span>{{ successMessage }}</span>
      </div>

      <div 
        v-if="errorMessage" 
        class="p-4 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-3 animate-in fade-in"
      >
        <AlertCircle class="w-5 h-5 shrink-0 text-rose-600" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- MODE 1: SÉLECTION DE LA MÉTHODE -->
      <div v-if="mode === 'select'" class="space-y-3.5 pt-1">
        <!-- Option TOTP Authenticator -->
        <div 
          @click="selectMethod('totp')"
          class="group p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between"
          :class="currentMfaType === 'totp' ? 'border-emerald-500 bg-emerald-50/40 shadow-sm' : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50/70'"
        >
          <div class="flex items-center gap-3.5">
            <div 
              class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
              :class="currentMfaType === 'totp' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-700'"
            >
              <Smartphone class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-slate-800 text-sm">{{ languageStore.isEn() ? 'Authenticator app' : 'Application d\'authentification' }}</h4>
                <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {{ languageStore.isEn() ? 'Recommended' : 'Recommandé' }}
                </span>
                <span v-if="currentMfaType === 'totp'" class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                  {{ languageStore.isEn() ? 'Active' : 'Actif' }}
                </span>
              </div>
              <p class="text-slate-500 text-[11px] mt-0.5">
                Google Authenticator, Microsoft Authenticator, 1Password...
              </p>
            </div>
          </div>
          <ArrowRight class="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
        </div>

        <!-- Option Code par e-mail -->
        <div 
          @click="selectMethod('email')"
          class="group p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between"
          :class="currentMfaType === 'email' ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-100 hover:border-primary/30 hover:bg-slate-50/70'"
        >
          <div class="flex items-center gap-3.5">
            <div 
              class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
              :class="currentMfaType === 'email' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-primary/10 group-hover:text-primary'"
            >
              <Mail class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-slate-800 text-sm">{{ languageStore.isEn() ? 'Email verification code' : 'Code de vérification par e-mail' }}</h4>
                <span v-if="currentMfaType === 'email'" class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-primary text-white">
                  {{ languageStore.isEn() ? 'Active' : 'Actif' }}
                </span>
              </div>
              <p class="text-slate-500 text-[11px] mt-0.5">
                {{ languageStore.isEn() ? 'A 6-digit code sent to your email on each login' : 'Un code à 6 chiffres envoyé sur votre adresse à chaque connexion' }}
              </p>
            </div>
          </div>
          <ArrowRight class="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>

        <!-- Option Désactiver / Pas de MFA -->
        <div 
          @click="selectMethod('none')"
          class="group p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between"
          :class="currentMfaType === 'none' ? 'border-slate-300 bg-slate-50 shadow-sm' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/70'"
        >
          <div class="flex items-center gap-3.5">
            <div 
              class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
              :class="currentMfaType === 'none' ? 'bg-slate-400 text-white' : 'bg-slate-100 text-slate-500'"
            >
              <ShieldOff class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-slate-700 text-sm">{{ languageStore.isEn() ? 'Do not enable two-factor' : 'Ne pas activer de double facteur' }}</h4>
                <span v-if="currentMfaType === 'none'" class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {{ languageStore.isEn() ? 'Active' : 'Actif' }}
                </span>
              </div>
              <p class="text-slate-400 text-[11px] mt-0.5">
                {{ languageStore.isEn() ? 'Direct sign-in with your password (standard security)' : 'Connexion directe avec votre mot de passe (sécurité standard)' }}
              </p>
            </div>
          </div>
          <ArrowRight class="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-all" />
        </div>

        <!-- Bouton ignorer pour l'initial prompt -->
        <div v-if="isInitialPrompt" class="pt-3 flex justify-center">
          <button 
            type="button" 
            @click="handleDismissPrompt"
            class="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors py-2 px-4"
          >
            {{ languageStore.isEn() ? 'Configure later' : 'Configurer plus tard' }}
          </button>
        </div>
      </div>

      <!-- MODE 2: CONFIGURATION TOTP AVEC QR CODE -->
      <div v-else-if="mode === 'setup_totp'" class="space-y-5 animate-in fade-in slide-in-from-right-2 duration-200">
        <button 
          type="button" 
          @click="mode = 'select'; errorMessage = ''"
          class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft class="w-4 h-4" /> {{ languageStore.isEn() ? 'Change method' : 'Changer de méthode' }}
        </button>

        <div class="p-4 bg-slate-50 rounded-2xl space-y-3">
          <h4 class="font-black text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span>{{ languageStore.isEn() ? 'Step 1:' : 'Étape 1 :' }}</span> {{ languageStore.isEn() ? 'Scan the QR Code' : 'Scannez le QR Code' }}
          </h4>
          <p class="text-xs text-slate-600 leading-relaxed">
            {{ languageStore.isEn() ? 'Open your authenticator app (Google Authenticator, Microsoft Authenticator, etc.) and scan this code:' : 'Ouvrez votre application d\'authentification (Google Authenticator, Microsoft Authenticator, etc.) et scannez ce code :' }}
          </p>

          <div class="flex justify-center p-4 bg-white rounded-2xl border border-slate-200 shadow-sm w-fit mx-auto">
            <qrcode-vue 
              v-if="provisioningUri" 
              :value="provisioningUri" 
              :size="180" 
              level="M" 
              render-as="svg" 
            />
          </div>

          <div class="pt-1">
            <div class="flex items-center justify-between mb-1">
              <label class="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                {{ languageStore.isEn() ? 'Or enter this secret key manually:' : 'Ou entrez cette clé secrète manuellement :' }}
              </label>
              <span v-if="copiedSecret" class="text-[10px] font-bold text-emerald-600 animate-in fade-in">
                {{ languageStore.isEn() ? 'Copied to clipboard!' : 'Copié dans le presse-papier !' }}
              </span>
            </div>
            <div 
              @click="copySecretToClipboard"
              class="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all cursor-pointer group"
              :title="languageStore.isEn() ? 'Click to copy secret key' : 'Cliquer pour copier la clé secrète'"
            >
              <code class="text-xs font-mono font-bold text-slate-800 tracking-wider flex-1 truncate select-all">
                {{ totpSecret }}
              </code>
              <button 
                type="button" 
                @click.stop="copySecretToClipboard"
                :aria-label="copiedSecret ? (languageStore.isEn() ? 'Secret key copied' : 'Clé secrète copiée') : (languageStore.isEn() ? 'Copy secret key' : 'Copier la clé secrète')"
                class="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-sm active:scale-95"
                :class="copiedSecret ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
              >
                <component :is="copiedSecret ? Check : Copy" class="w-3.5 h-3.5" />
                <span>{{ copiedSecret ? (languageStore.isEn() ? 'Copied!' : 'Copié !') : (languageStore.isEn() ? 'Copy' : 'Copier') }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Saisie du code pour confirmation -->
        <div class="space-y-2">
          <h4 class="font-black text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span>{{ languageStore.isEn() ? 'Step 2:' : 'Étape 2 :' }}</span> {{ languageStore.isEn() ? 'Confirm the 6-digit code' : 'Confirmez le code à 6 chiffres' }}
          </h4>
          <p class="text-xs text-slate-500">
            {{ languageStore.isEn() ? 'Enter the temporary code currently displayed in your app:' : 'Saisissez le code temporaire actuellement affiché sur votre application :' }}
          </p>
          <input 
            v-model="verificationCode"
            type="text" 
            maxlength="6" 
            placeholder="000000" 
            class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3.5 px-4 text-center text-xl font-bold tracking-[0.8em] focus:bg-white focus:border-emerald-500 transition-all font-mono"
            @keyup.enter="confirmTotp"
          >
        </div>

        <button 
          type="button" 
          @click="confirmTotp"
          :disabled="loading || verificationCode.length !== 6"
          class="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
          <template v-else>
            <span>{{ languageStore.isEn() ? 'Enable authenticator' : 'Activer l\'application' }}</span>
            <CheckCircle2 class="w-4 h-4" />
          </template>
        </button>
      </div>
    </div>
  </div>
  </Teleport>
</template>
