<script setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'
import api from '../api/api'
import { 
  X, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Trash2, 
  ShieldCheck, 
  ChevronDown,
  Loader2
} from 'lucide-vue-next'
import {
  getMinExpirationDate,
  getValidExpirationYears,
  getValidExpirationMonths,
  getValidExpirationDays,
  isExpirationDateValid,
  getExpirationErrorMessage,
} from '../utils/idExpiration'

const props = defineEmits(['update:modelValue', 'renewed'])
defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const authStore = useAuthStore()
const languageStore = useLanguageStore()

const typePiece = ref(authStore.user?.type_piece || 'CNI')
const numPiece = ref(authStore.user?.num_piece || '')

// Date state
const currentYear = new Date().getFullYear()
const expDay = ref('')
const expMonth = ref('')
const expYear = ref('')

// Initialize date if present in user
const initDateFromUser = () => {
  const existing = authStore.user?.expiration_piece || authStore.user?.effective_expiration_piece
  if (existing && existing.includes('-')) {
    const parts = existing.split('-')
    if (parts.length === 3) {
      expYear.value = parts[0]
      expMonth.value = String(parseInt(parts[1], 10))
      expDay.value = String(parseInt(parts[2], 10))
    }
  } else {
    expDay.value = ''
    expMonth.value = ''
    expYear.value = ''
  }
  typePiece.value = authStore.user?.type_piece || 'CNI'
  numPiece.value = authStore.user?.num_piece || ''
}

watch(() => authStore.user, initDateFromUser, { immediate: true })

const expYearsList = computed(() => {
  return getValidExpirationYears()
})

const monthsList = computed(() => {
  return getValidExpirationMonths(expYear.value, languageStore.isEn())
})

const expDaysList = computed(() => {
  return getValidExpirationDays(expYear.value, expMonth.value)
})

const expirationDate = computed(() => {
  if (expDay.value && expMonth.value && expYear.value) {
    return `${expYear.value}-${String(expMonth.value).padStart(2, '0')}-${String(expDay.value).padStart(2, '0')}`
  }
  return ''
})

// Watchers avec auto-clamping pour l'expiration
watch(expYear, (newYear) => {
  if (newYear && expMonth.value) {
    const validMonthValues = monthsList.value.map(m => m.value)
    if (!validMonthValues.includes(expMonth.value)) {
      expMonth.value = validMonthValues[0] || ''
    }
  }
  if (validationErrors.value.expiration_piece) {
    delete validationErrors.value.expiration_piece
  }
})

watch(expMonth, (newMonth) => {
  if (newMonth && expDay.value) {
    const validDays = expDaysList.value
    if (!validDays.includes(expDay.value)) {
      expDay.value = validDays[0] || ''
    }
  }
  if (validationErrors.value.expiration_piece) {
    delete validationErrors.value.expiration_piece
  }
})

watch(expDay, () => {
  if (validationErrors.value.expiration_piece) {
    delete validationErrors.value.expiration_piece
  }
})

// Files state
const pieceRecto = ref(null)
const pieceVerso = ref(null)
const rectoFileName = ref('')
const versoFileName = ref('')

const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const validationErrors = ref({})

const isVersoRequired = computed(() => {
  const t = (typePiece.value || '').toLowerCase()
  return t.includes('cni') || t.includes('resident') || t.includes('séjour')
})

const handleFileUpload = (field, event) => {
  const file = event.target.files?.[0]
  if (!file) return

  if (file.size > 8 * 1024 * 1024) {
    errorMessage.value = languageStore.isEn() ? 'File is too large (maximum 8 MB).' : 'Le fichier est trop volumineux (maximum 8 Mo).'
    return
  }

  if (field === 'recto') {
    rectoFileName.value = file.name
  } else {
    versoFileName.value = file.name
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target.result
    if (file.type === 'application/pdf') {
      if (field === 'recto') pieceRecto.value = result
      else pieceVerso.value = result
      return
    }

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const MAX_WIDTH = 1200
      const MAX_HEIGHT = 1200
      let width = img.width
      let height = img.height

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width))
          width = MAX_WIDTH
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round(width * (MAX_HEIGHT / height))
          height = MAX_HEIGHT
        }
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      if (field === 'recto') pieceRecto.value = dataUrl
      else pieceVerso.value = dataUrl
    }
    img.src = result
  }
  reader.readAsDataURL(file)
}

const removeFile = (field) => {
  if (field === 'recto') {
    pieceRecto.value = null
    rectoFileName.value = ''
  } else {
    pieceVerso.value = null
    versoFileName.value = ''
  }
}

const closeModal = () => {
  props('update:modelValue', false)
  errorMessage.value = ''
  successMessage.value = ''
  validationErrors.value = {}
}

const submitRenewal = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  validationErrors.value = {}

  if (!typePiece.value) {
    validationErrors.value.type_piece = [languageStore.isEn() ? 'ID document type is required.' : 'Le type de pièce est requis.']
  }
  if (!numPiece.value || numPiece.value.trim().length < 3) {
    validationErrors.value.num_piece = [languageStore.isEn() ? 'Document number is required (minimum 3 characters).' : 'Le numéro de la pièce est requis (minimum 3 caractères).']
  }
  if (!expirationDate.value) {
    validationErrors.value.expiration_piece = [languageStore.isEn() ? 'Complete expiration date is required.' : 'La date d’expiration complète est obligatoire.']
  } else if (!isExpirationDateValid(expirationDate.value)) {
    validationErrors.value.expiration_piece = [getExpirationErrorMessage(languageStore.isEn())]
  }

  if (Object.keys(validationErrors.value).length > 0) {
    return
  }

  isSubmitting.value = true

  try {
    const payload = {
      type_piece: typePiece.value,
      num_piece: numPiece.value.trim(),
      expiration_piece: expirationDate.value,
      piece_recto: pieceRecto.value || null,
      piece_verso: pieceVerso.value || null
    }

    const response = await api.post('/user/renew-identity-document', payload)

    if (response.data?.user) {
      authStore.setUser(response.data.user)
    }

    successMessage.value = languageStore.isEn() ? 'Your new identity document has been successfully recorded.' : 'Votre nouvelle pièce d’identité a été enregistrée avec succès.'
    props('renewed', response.data?.user)

    // Notify other components
    window.dispatchEvent(new CustomEvent('pek:notifications-refresh'))

    setTimeout(() => {
      closeModal()
    }, 1800)
  } catch (error) {
    console.error('Error renewing identity document:', error)
    if (error.response?.data?.errors) {
      validationErrors.value = error.response.data.errors
    } else {
      errorMessage.value = error.response?.data?.message || (languageStore.isEn() ? 'An error occurred during update.' : 'Une erreur est survenue lors de la mise à jour.')
    }
  } finally {
    isSubmitting.value = false
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
        @click="closeModal" 
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
      ></div>
      <div 
        class="relative bg-white rounded-[32px] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 space-y-6 text-left z-10 animate-in zoom-in-95 duration-200"
      >
        <!-- Close button -->
        <button 
          type="button" 
          @click="closeModal" 
          class="absolute right-5 top-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          :aria-label="languageStore.isEn() ? 'Close' : 'Fermer'"
        >
          <X class="w-4 h-4" />
        </button>

      <!-- Header -->
      <div class="space-y-1 pr-8">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-[10px] font-black uppercase tracking-wider mb-1">
          <ShieldCheck class="w-3.5 h-3.5 text-amber-600" />
          {{ languageStore.isEn() ? 'Regulatory Compliance' : 'Conformité Réglementaire' }}
        </div>
        <h3 class="text-lg font-black text-slate-900">{{ languageStore.isEn() ? 'Renew my ID document' : 'Renouveler ma pièce d\'identité' }}</h3>
        <p class="text-xs text-slate-500 font-medium">
          {{ languageStore.isEn() ? 'Update your identity document to keep your PEK account active and compliant.' : 'Mettez à jour votre document d\'identification pour maintenir votre compte PEK actif et conforme.' }}
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

      <!-- Form -->
      <form @submit.prevent="submitRenewal" class="space-y-5">
        <!-- Type de pièce -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-black uppercase tracking-wider text-slate-600">
            {{ languageStore.isEn() ? 'Identity document type' : 'Type de pièce d\'identité' }} <span class="text-rose-500">*</span>
          </label>
          <div class="relative">
            <select 
              v-model="typePiece"
              class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-xs text-slate-800 focus:bg-white focus:border-primary transition-all appearance-none cursor-pointer"
            >
              <option value="CNI">{{ languageStore.isEn() ? 'National Identity Card (CNI)' : 'Carte Nationale d\'Identité (CNI)' }}</option>
              <option value="Passeport">{{ languageStore.isEn() ? 'Passport' : 'Passeport' }}</option>
              <option value="Carte Résident">{{ languageStore.isEn() ? 'Resident Card / Residence Permit' : 'Carte Résident / Carte de Séjour' }}</option>
            </select>
            <ChevronDown class="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <p v-if="validationErrors.type_piece" class="text-rose-500 text-[10px] font-semibold mt-1">
            {{ validationErrors.type_piece[0] }}
          </p>
        </div>

        <!-- Numéro de la pièce -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-black uppercase tracking-wider text-slate-600">
            {{ languageStore.isEn() ? 'Document number' : 'Numéro de la pièce' }} <span class="text-rose-500">*</span>
          </label>
          <input 
            v-model="numPiece"
            type="text" 
            :placeholder="languageStore.isEn() ? 'E.g.: 100234589 or Passport No.' : 'Ex : 100234589 ou N° passeport'"
            class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-xs text-slate-800 focus:bg-white focus:border-primary transition-all"
          />
          <p v-if="validationErrors.num_piece" class="text-rose-500 text-[10px] font-semibold mt-1">
            {{ validationErrors.num_piece[0] }}
          </p>
        </div>

        <!-- Date d'expiration -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-black uppercase tracking-wider text-slate-600">
            {{ languageStore.isEn() ? 'New expiration date' : 'Nouvelle Date d\'expiration' }} <span class="text-rose-500">*</span>
          </label>
          <div class="grid grid-cols-3 gap-2">
            <!-- Jour -->
            <div class="relative">
              <select 
                v-model="expDay"
                class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-3 font-bold text-xs text-slate-800 focus:bg-white focus:border-primary transition-all appearance-none cursor-pointer"
              >
                <option value="" disabled>{{ languageStore.isEn() ? 'Day' : 'Jour' }}</option>
                <option v-for="d in expDaysList" :key="d" :value="d">{{ String(d).padStart(2, '0') }}</option>
              </select>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <!-- Mois -->
            <div class="relative">
              <select 
                v-model="expMonth"
                class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-3 font-bold text-xs text-slate-800 focus:bg-white focus:border-primary transition-all appearance-none cursor-pointer"
              >
                <option value="" disabled>{{ languageStore.isEn() ? 'Month' : 'Mois' }}</option>
                <option v-for="m in monthsList" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <!-- Année -->
            <div class="relative">
              <select 
                v-model="expYear"
                class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-3 font-bold text-xs text-slate-800 focus:bg-white focus:border-primary transition-all appearance-none cursor-pointer"
              >
                <option value="" disabled>{{ languageStore.isEn() ? 'Year' : 'Année' }}</option>
                <option v-for="y in expYearsList" :key="y" :value="y">{{ y }}</option>
              </select>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <p v-if="validationErrors.expiration_piece" class="text-rose-500 text-[10px] font-semibold mt-1">
            {{ validationErrors.expiration_piece[0] }}
          </p>
        </div>

        <!-- Upload Document Recto -->
        <div class="space-y-1.5 pt-2">
          <div class="flex justify-between items-center">
            <label class="text-[11px] font-black uppercase tracking-wider text-slate-600">
              {{ languageStore.isEn() ? 'Photo / Scan of document (Front)' : 'Photo / Scan de la pièce (Recto)' }}
            </label>
            <span v-if="pieceRecto" class="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 class="w-3 h-3" /> {{ languageStore.isEn() ? 'File ready' : 'Fichier prêt' }}
            </span>
          </div>

          <div 
            v-if="!pieceRecto" 
            class="relative border-2 border-dashed border-slate-200 hover:border-primary/50 bg-slate-50/60 rounded-2xl p-4 text-center cursor-pointer transition-colors"
          >
            <input 
              type="file" 
              accept="image/*,application/pdf" 
              @change="handleFileUpload('recto', $event)" 
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div class="flex flex-col items-center justify-center gap-1.5 text-slate-500">
              <Upload class="w-5 h-5 text-primary" />
              <p class="text-xs font-bold text-slate-700">{{ languageStore.isEn() ? 'Choose or take a photo of the front' : 'Choisir ou photographier le recto' }}</p>
              <p class="text-[10px] text-slate-400">JPG, PNG ou PDF (max 8 Mo)</p>
            </div>
          </div>

          <div 
            v-else 
            class="flex items-center justify-between p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl"
          >
            <div class="flex items-center gap-2.5">
              <FileText class="w-4 h-4 text-emerald-600" />
              <span class="text-xs font-bold text-slate-700 truncate max-w-[200px]">
                {{ rectoFileName || (languageStore.isEn() ? 'Front document loaded' : 'Document Recto chargé') }}
              </span>
            </div>
            <button 
              type="button" 
              @click="removeFile('recto')" 
              class="text-rose-500 hover:text-rose-600 p-1 rounded-lg"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Upload Document Verso (si CNI ou Carte Résident) -->
        <div v-if="isVersoRequired" class="space-y-1.5">
          <div class="flex justify-between items-center">
            <label class="text-[11px] font-black uppercase tracking-wider text-slate-600">
              {{ languageStore.isEn() ? 'Photo / Scan of document (Back)' : 'Photo / Scan de la pièce (Verso)' }}
            </label>
            <span v-if="pieceVerso" class="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 class="w-3 h-3" /> {{ languageStore.isEn() ? 'File ready' : 'Fichier prêt' }}
            </span>
          </div>

          <div 
            v-if="!pieceVerso" 
            class="relative border-2 border-dashed border-slate-200 hover:border-primary/50 bg-slate-50/60 rounded-2xl p-4 text-center cursor-pointer transition-colors"
          >
            <input 
              type="file" 
              accept="image/*,application/pdf" 
              @change="handleFileUpload('verso', $event)" 
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div class="flex flex-col items-center justify-center gap-1.5 text-slate-500">
              <Upload class="w-5 h-5 text-primary" />
              <p class="text-xs font-bold text-slate-700">{{ languageStore.isEn() ? 'Choose or take a photo of the back' : 'Choisir ou photographier le verso' }}</p>
              <p class="text-[10px] text-slate-400">JPG, PNG ou PDF (max 8 Mo)</p>
            </div>
          </div>

          <div 
            v-else 
            class="flex items-center justify-between p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl"
          >
            <div class="flex items-center gap-2.5">
              <FileText class="w-4 h-4 text-emerald-600" />
              <span class="text-xs font-bold text-slate-700 truncate max-w-[200px]">
                {{ versoFileName || (languageStore.isEn() ? 'Back document loaded' : 'Document Verso chargé') }}
              </span>
            </div>
            <button 
              type="button" 
              @click="removeFile('verso')" 
              class="text-rose-500 hover:text-rose-600 p-1 rounded-lg"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="pt-3">
          <button 
            type="submit" 
            :disabled="isSubmitting"
            class="w-full bg-[#8E5E0A] hover:bg-[#724a08] text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-[#8E5E0A]/20 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            <span>{{ isSubmitting ? (languageStore.isEn() ? 'Saving in progress...' : 'Enregistrement en cours...') : (languageStore.isEn() ? 'Save my new document' : 'Enregistrer ma nouvelle pièce') }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
  </Teleport>
</template>
