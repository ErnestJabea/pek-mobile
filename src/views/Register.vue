<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'
import { ChevronLeft, ChevronDown, User, Mail, Phone, Lock, ArrowRight, ShieldCheck, MapPin, Globe, Loader2, Eye, EyeOff, FileText } from 'lucide-vue-next'
import api from '../api/api'
import { countries } from '../data/countries'
import { getCitiesForCountry, getImmediateCitiesForCountry } from '../data/cities.js'
import LanguageSelector from '../components/LanguageSelector.vue'
import PasswordCriteria from '../components/PasswordCriteria.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const languageStore = useLanguageStore()
const step = ref(1)
const loading = ref(false)
const error = ref('')
const validationErrors = ref({})
const showCountryList = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isPasswordFocused = ref(false)
const challengeId = ref('')

// Expiration date states (identique à l'onboarding KYC étape 1)
const expDay = ref('')
const expMonth = ref('')
const expYear = ref('')

const frenchMonths = [
  { value: '1', label: 'Janvier' },
  { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' },
  { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' },
  { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' },
  { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' }
]

const monthsList = computed(() => {
  if (languageStore.isEn()) {
    return [
      { value: '1', label: 'January' },
      { value: '2', label: 'February' },
      { value: '3', label: 'March' },
      { value: '4', label: 'April' },
      { value: '5', label: 'May' },
      { value: '6', label: 'June' },
      { value: '7', label: 'July' },
      { value: '8', label: 'August' },
      { value: '9', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' }
    ]
  }
  return frenchMonths
})

const currentYear = new Date().getFullYear()

// Années d'expiration: année courante à année courante + 30 (comme dans Onboarding KYC)
const expYearsList = computed(() => {
  const years = []
  for (let y = currentYear; y <= currentYear + 30; y++) {
    years.push(String(y))
  }
  return years
})

const getDaysInMonth = (month, year) => {
  if (!month) return 31
  const m = parseInt(month)
  const y = parseInt(year) || 2026
  return new Date(y, m, 0).getDate()
}

const expDaysList = computed(() => {
  const maxDay = getDaysInMonth(expMonth.value, expYear.value)
  return Array.from({ length: maxDay }, (_, i) => String(i + 1))
})

const updateExpPayload = () => {
  if (expDay.value && expMonth.value && expYear.value) {
    form.value.expiration_piece = `${expYear.value}-${String(expMonth.value).padStart(2, '0')}-${String(expDay.value).padStart(2, '0')}`
    clearError('expiration_piece')
  } else {
    form.value.expiration_piece = ''
  }
}

watch([expMonth, expYear], () => {
  if (expDay.value && expDaysList.value.length < parseInt(expDay.value)) {
    expDay.value = String(expDaysList.value.length)
  }
  updateExpPayload()
})

watch(expDay, () => {
  updateExpPayload()
})

const clearError = (field) => {
  if (validationErrors.value[field]) {
    delete validationErrors.value[field]
  }
}

const form = ref({
  first_name: '',
  last_name: '',
  email: '',
  phone_prefix: '+237',
  phone: '',
  city: '',
  country: '',
  employer: '',
  type_piece: 'CNI',
  num_piece: '',
  expiration_piece: '',
  password: '',
  password_confirmation: '',
  otp: ''
})

const availableCities = ref([])
const loadingCities = ref(false)
const isCustomCity = ref(false)
const customCity = ref('')

const updateCitiesForSelectedCountry = async (countryName) => {
  if (!countryName) {
    availableCities.value = []
    return
  }
  availableCities.value = getImmediateCitiesForCountry(countryName)
  loadingCities.value = true
  try {
    const list = await getCitiesForCountry(countryName)
    if (form.value.country === countryName) {
      availableCities.value = list
    }
  } catch (err) {
    console.error('Erreur chargement villes:', err)
  } finally {
    loadingCities.value = false
  }
}

watch(() => form.value.country, (newCountry) => {
  if (newCountry) {
    updateCitiesForSelectedCountry(newCountry)
  } else {
    availableCities.value = []
  }
}, { immediate: true })

const handleCountryChange = () => {
  clearError('country')
  clearError('city')
  form.value.city = ''
  isCustomCity.value = false
  customCity.value = ''
  updateCitiesForSelectedCountry(form.value.country)
}

const handleCityChange = (e) => {
  clearError('city')
  const val = e.target.value
  if (val === '__AUTRE__') {
    isCustomCity.value = true
    form.value.city = customCity.value.trim()
  } else {
    isCustomCity.value = false
    form.value.city = val
  }
}

const handleCustomCityInput = () => {
  clearError('city')
  form.value.city = customCity.value.trim()
}

const handlePhoneInput = (e) => {
  let val = e.target.value.replace(/\D/g, '') // Ne garder que les chiffres
  const country = countries.find(c => c.dial_code === form.value.phone_prefix)
  const mask = country?.mask || '999999999999' // Défaut si pas de masque
  
  let formatted = ''
  let valIdx = 0
  for (let i = 0; i < mask.length && valIdx < val.length; i++) {
    if (mask[i] === '9') {
      formatted += val[valIdx]
      valIdx++
    } else {
      formatted += mask[i]
    }
  }
  form.value.phone = formatted
}

const handleResendOtp = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await api.post('/resend-otp', { email: form.value.email })
    challengeId.value = response.data.challenge_id
    // Optionnel: afficher un message de succès (toast ou autre)
  } catch (err) {
    error.value = err.response?.data?.message || 'Erreur lors de l\'envoi du code'
  } finally {
    loading.value = false
  }
}

const handleNext = async () => {
  loading.value = true
  error.value = ''
  validationErrors.value = {}
  
  if (step.value === 1) {
    // Frontend validation for registration required fields
    if (!form.value.first_name || form.value.first_name.trim() === '') {
      validationErrors.value.first_name = ['Le prénom est obligatoire.']
    }
    if (!form.value.last_name || form.value.last_name.trim() === '') {
      validationErrors.value.last_name = ['Le nom est obligatoire.']
    }
    if (!form.value.email || form.value.email.trim() === '') {
      validationErrors.value.email = ['L\'adresse e-mail est obligatoire.']
    }
    if (!form.value.country || form.value.country.trim() === '') {
      validationErrors.value.country = ['Le pays de résidence est obligatoire.']
    }
    if (!form.value.city || form.value.city.trim() === '') {
      validationErrors.value.city = ['La ville est obligatoire.']
    }
    if (!form.value.type_piece) {
      validationErrors.value.type_piece = [languageStore.isEn() ? 'Document type is required.' : 'Le type de pièce d\'identification est obligatoire.']
    }
    if (!form.value.num_piece || form.value.num_piece.trim() === '') {
      validationErrors.value.num_piece = [languageStore.isEn() ? 'Document number is required.' : 'Le numéro de la pièce d\'identification est obligatoire.']
    }
    if (!form.value.expiration_piece) {
      validationErrors.value.expiration_piece = [languageStore.isEn() ? 'Expiration date is required.' : 'La date d\'expiration de la pièce est obligatoire.']
    } else {
      const expDate = new Date(form.value.expiration_piece)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (expDate <= today) {
        validationErrors.value.expiration_piece = [languageStore.isEn() ? 'Expiration date must be in the future.' : 'La date d\'expiration doit être supérieure à la date du jour.']
      }
    }
    if (!form.value.password || form.value.password.trim() === '') {
      validationErrors.value.password = [languageStore.isEn() ? 'Password is required.' : 'Le mot de passe est obligatoire.']
    } else if (form.value.password.length < 12) {
      validationErrors.value.password = [languageStore.isEn() ? 'Password must contain at least 12 characters.' : 'Le mot de passe doit contenir au moins 12 caractères.']
    }

    if (!form.value.password_confirmation || form.value.password_confirmation.trim() === '') {
      validationErrors.value.password_confirmation = [
        languageStore.isEn() ? 'Please confirm your password.' : 'Veuillez confirmer votre mot de passe.'
      ]
    } else if (form.value.password !== form.value.password_confirmation) {
      validationErrors.value.password_confirmation = [
        languageStore.isEn() ? 'Passwords do not match.' : 'Les mots de passe ne correspondent pas.'
      ]
    }

    if (Object.keys(validationErrors.value).length > 0) {
      loading.value = false
      return
    }
  } else {
    // Frontend validation for OTP code field
    if (!form.value.otp || form.value.otp.trim() === '') {
      validationErrors.value.code = ['Le code de vérification est obligatoire.']
      error.value = 'Veuillez saisir le code de vérification.'
      loading.value = false
      return
    }
  }

  try {
    if (step.value === 1) {
      // On combine l'indicatif et le numéro seulement s'il est rempli
      const payload = { ...form.value }
      if (form.value.phone) {
        payload.phone = form.value.phone_prefix + form.value.phone 
      } else {
        delete payload.phone
      }
      const response = await api.post('/register', payload)
      challengeId.value = response.data.challenge_id
      step.value = 2
    } else {
      const response = await api.post('/verify-otp', {
        challenge_id: challengeId.value,
        code: form.value.otp
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
      error.value = err.response?.data?.message || 'Une erreur est survenue'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="px-6 py-6 flex flex-col justify-center min-h-[85vh] space-y-8 max-w-md mx-auto relative">
    <div class="flex items-center justify-between pt-2">
      <router-link to="/login" class="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 text-xs font-bold">
        <ChevronLeft class="w-4 h-4" /> {{ languageStore.t('back') }}
      </router-link>
      <LanguageSelector />
    </div>

    <div class="space-y-2">
      <h2 class="text-3xl font-bold text-slate-900">{{ step === 1 ? languageStore.t('create_account') : languageStore.t('otp_title') }}</h2>
      <p class="text-slate-500 text-sm">
        {{ step === 1 ? languageStore.t('register_subtitle') : (languageStore.isEn() ? 'Enter the 6-digit code sent to ' : 'Entrez le code à 6 chiffres envoyé à ') + form.email }}
      </p>
    </div>

    <form @submit.prevent="handleNext" class="space-y-6">
      <div v-if="error" class="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium">
        {{ error }}
      </div>

      <div v-if="step === 1" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-700 ml-1">{{ languageStore.t('first_name_label') }}</label>
            <input v-model="form.first_name" @blur="clearError('first_name')" @input="clearError('first_name')" type="text" placeholder="Jean" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-4 focus:bg-white focus:border-primary transition-all" required :aria-invalid="validationErrors.first_name ? 'true' : 'false'" :aria-describedby="validationErrors.first_name ? 'first_name-error' : null">
            <p v-if="validationErrors.first_name" id="first_name-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.first_name[0] }}
            </p>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-700 ml-1">{{ languageStore.t('last_name_label') }}</label>
            <input v-model="form.last_name" @blur="clearError('last_name')" @input="clearError('last_name')" type="text" placeholder="Dupont" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-4 focus:bg-white focus:border-primary transition-all" required :aria-invalid="validationErrors.last_name ? 'true' : 'false'" :aria-describedby="validationErrors.last_name ? 'last_name-error' : null">
            <p v-if="validationErrors.last_name" id="last_name-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.last_name[0] }}
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">Email</label>
          <div class="relative">
            <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input v-model="form.email" @blur="clearError('email')" @input="clearError('email')" type="email" placeholder="votre@email.com" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all" required :aria-invalid="validationErrors.email ? 'true' : 'false'" :aria-describedby="validationErrors.email ? 'email-error' : null">
          </div>
          <p v-if="validationErrors.email" id="email-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.email[0] }}
          </p>
        </div>

        <div class="space-y-2 text-left">
          <label class="text-sm font-bold text-slate-700 ml-1">{{ languageStore.t('country_label') }}</label>
          <div class="relative">
            <Globe class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <select v-model="form.country" @change="handleCountryChange" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-10 focus:bg-white focus:border-primary transition-all appearance-none cursor-pointer text-slate-800" required :aria-invalid="validationErrors.country ? 'true' : 'false'" :aria-describedby="validationErrors.country ? 'country-error' : null">
              <option value="" disabled>{{ languageStore.isEn() ? 'Select' : 'Sélectionner' }}</option>
              <option v-for="c in countries.slice().sort((a, b) => a.name.localeCompare(b.name))" :key="c.code" :value="c.name">{{ c.name }}</option>
            </select>
            <ChevronDown class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <p v-if="validationErrors.country" id="country-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.country[0] }}
          </p>
        </div>

        <div class="space-y-2 text-left">
          <label class="text-sm font-bold text-slate-700 ml-1">{{ languageStore.t('city_label') }}</label>
          <div class="relative">
            <MapPin class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <select 
              :value="isCustomCity ? '__AUTRE__' : form.city" 
              @change="handleCityChange" 
              class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-10 focus:bg-white focus:border-primary transition-all appearance-none cursor-pointer text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed" 
              :disabled="!form.country" 
              required 
              :aria-invalid="validationErrors.city ? 'true' : 'false'" 
              :aria-describedby="validationErrors.city ? 'city-error' : null"
            >
              <option value="" disabled>
                {{ !form.country ? (languageStore.isEn() ? "Select country first" : "Sélectionner le pays d'abord") : (availableCities.length ? (languageStore.isEn() ? "Select city" : "Sélectionner la ville") : (languageStore.isEn() ? "No cities listed" : "Aucune ville répertoriée")) }}
              </option>
              <option v-for="city in availableCities" :key="city" :value="city">{{ city }}</option>
              <option v-if="availableCities.length > 0" value="__AUTRE__">{{ languageStore.isEn() ? 'Other city...' : 'Autre ville...' }}</option>
            </select>
            <ChevronDown class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <div v-if="isCustomCity || (form.country && availableCities.length === 0)" class="relative mt-2 animate-in fade-in duration-200">
            <MapPin class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input 
              v-model="customCity" 
              @input="handleCustomCityInput" 
              type="text" 
              :placeholder="languageStore.isEn() ? 'Specify your city' : 'Précisez votre ville'" 
              class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3 pl-11 pr-4 focus:bg-white focus:border-primary transition-all text-xs" 
              required 
            />
          </div>
          <p v-if="validationErrors.city" id="city-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.city[0] }}
          </p>
        </div>

        <div class="space-y-2 text-left">
          <label class="text-sm font-bold text-slate-700 ml-1">{{ languageStore.t('employer_label') }}</label>
          <div class="relative">
            <User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input v-model="form.employer" @blur="clearError('employer')" @input="clearError('employer')" type="text" :placeholder="languageStore.isEn() ? 'Company / Self-employed' : 'Entreprise / Auto-entrepreneur'" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all" :aria-invalid="validationErrors.employer ? 'true' : 'false'" :aria-describedby="validationErrors.employer ? 'employer-error' : null">
          </div>
          <p v-if="validationErrors.employer" id="employer-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.employer[0] }}
          </p>
        </div>

        <!-- Section Pièce d'identité (Informations) -->
        <div class="p-4 bg-slate-50 border-2 border-slate-100 rounded-3xl space-y-4 text-left">
          <div class="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <FileText class="w-4 h-4 text-primary" />
            <span>{{ languageStore.isEn() ? 'Identity Document' : "Pièce d'identification" }}</span>
          </div>

          <div class="grid grid-cols-1 gap-4">
            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-700 ml-1">
                {{ languageStore.isEn() ? 'Document Type *' : 'Type de pièce *' }}
              </label>
              <div class="relative">
                <select v-model="form.type_piece" @change="clearError('type_piece')" class="w-full bg-white border-2 border-slate-100 rounded-2xl py-3 px-4 focus:border-primary transition-all appearance-none text-xs font-bold text-slate-800 cursor-pointer">
                  <option value="CNI">Carte Nationale d'Identité (CNI)</option>
                  <option value="Passeport">Passeport</option>
                  <option value="Carte de séjour">Carte de séjour</option>
                </select>
                <ChevronDown class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <p v-if="validationErrors.type_piece" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.type_piece[0] }}
              </p>
            </div>

            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-700 ml-1">
                {{ languageStore.isEn() ? 'Document Number *' : 'Numéro de pièce *' }}
              </label>
              <input v-model="form.num_piece" @input="clearError('num_piece')" type="text" placeholder="Ex: 1029384756" class="w-full bg-white border-2 border-slate-100 rounded-2xl py-3 px-4 focus:border-primary transition-all text-xs font-semibold text-slate-800" required>
              <p v-if="validationErrors.num_piece" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.num_piece[0] }}
              </p>
            </div>
          </div>

          <!-- Date d'expiration (Structure identique à l'étape 1 Onboarding KYC) -->
          <div class="space-y-2">
            <label class="text-xs font-bold text-slate-700 ml-1">
              {{ languageStore.isEn() ? 'Expiration Date *' : "Date d'expiration de la pièce *" }}
            </label>
            <div class="grid grid-cols-3 gap-2">
              <!-- Jour -->
              <div class="relative">
                <select v-model="expDay" class="w-full bg-white border-2 border-slate-100 rounded-2xl py-3 pl-3 pr-7 text-xs font-bold text-slate-800 focus:border-primary transition-all appearance-none text-center cursor-pointer">
                  <option value="" disabled>{{ languageStore.isEn() ? 'Day' : 'Jour' }}</option>
                  <option v-for="d in expDaysList" :key="d" :value="d">{{ String(d).padStart(2, '0') }}</option>
                </select>
                <ChevronDown class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
              <!-- Mois -->
              <div class="relative">
                <select v-model="expMonth" class="w-full bg-white border-2 border-slate-100 rounded-2xl py-3 pl-2 pr-7 text-xs font-bold text-slate-800 focus:border-primary transition-all appearance-none text-center cursor-pointer">
                  <option value="" disabled>{{ languageStore.isEn() ? 'Month' : 'Mois' }}</option>
                  <option v-for="m in monthsList" :key="m.value" :value="m.value">{{ m.label }}</option>
                </select>
                <ChevronDown class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
              <!-- Année -->
              <div class="relative">
                <select v-model="expYear" class="w-full bg-white border-2 border-slate-100 rounded-2xl py-3 pl-3 pr-7 text-xs font-bold text-slate-800 focus:border-primary transition-all appearance-none text-center cursor-pointer">
                  <option value="" disabled>{{ languageStore.isEn() ? 'Year' : 'Année' }}</option>
                  <option v-for="y in expYearsList" :key="y" :value="y">{{ y }}</option>
                </select>
                <ChevronDown class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <p v-if="validationErrors.expiration_piece" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.expiration_piece[0] }}
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">{{ languageStore.t('phone_label') }}</label>
          <div class="flex gap-2">
            <!-- Custom Country Selector -->
            <div class="relative w-32">
                <button 
                  type="button"
                  @click="showCountryList = !showCountryList"
                  class="w-full h-[60px] bg-slate-50 border-2 border-slate-50 rounded-2xl flex items-center justify-center gap-2 focus:bg-white focus:border-primary transition-all px-2"
                >
                  <img 
                    :src="`https://flagcdn.com/w40/${countries.find(c => c.dial_code === form.phone_prefix)?.code.toLowerCase()}.png`" 
                    class="w-6 h-auto rounded-sm shadow-sm"
                    :alt="form.phone_prefix"
                  >
                  <span class="font-bold text-slate-700 text-sm">{{ form.phone_prefix }}</span>
                  <ChevronLeft class="w-4 h-4 text-slate-400 transition-transform" :class="showCountryList ? 'rotate-90' : '-rotate-90'" />
                </button>

                <!-- Dropdown List -->
                <div v-if="showCountryList" class="absolute top-[70px] left-0 w-64 max-h-60 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-y-auto z-[100] p-2 space-y-1 animate-in fade-in zoom-in-95 duration-200">
                    <button 
                        v-for="c in countries" 
                        :key="c.code"
                        type="button"
                        @click="form.phone_prefix = c.dial_code; form.phone = ''; showCountryList = false"
                        class="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors group"
                    >
                        <img :src="`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`" class="w-6 h-auto rounded-sm shadow-sm" :alt="c.name">
                        <div class="flex-1 text-left">
                            <div class="text-sm font-bold text-slate-700 group-hover:text-primary transition-colors">{{ c.name }}</div>
                            <div class="text-[10px] text-slate-400 font-medium">{{ c.dial_code }}</div>
                        </div>
                    </button>
                </div>
            </div>

            <div class="relative flex-1">
              <Phone class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                v-model="form.phone" 
                @input="(e) => { handlePhoneInput(e); clearError('phone') }"
                @blur="clearError('phone')"
                type="tel" 
                :placeholder="countries.find(c => c.dial_code === form.phone_prefix)?.mask?.replace(/9/g, '0') || '000 000 000'" 
                class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all font-mono" 
                :aria-invalid="validationErrors.phone ? 'true' : 'false'"
                :aria-describedby="validationErrors.phone ? 'phone-error' : null"
              >
            </div>
          </div>
          <p v-if="validationErrors.phone" id="phone-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.phone[0] }}
          </p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">{{ languageStore.t('password_label') }}</label>
          <div class="relative">
            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              v-model="form.password" 
              @focus="isPasswordFocused = true"
              @blur="clearError('password')" 
              @input="clearError('password')" 
              :type="showPassword ? 'text' : 'password'" 
              minlength="12" 
              autocomplete="new-password" 
              :placeholder="languageStore.t('password_hint')" 
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
        </div>

        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">{{ languageStore.t('confirm_password_label') }}</label>
          <div class="relative">
            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              v-model="form.password_confirmation" 
              @focus="isPasswordFocused = true"
              @blur="clearError('password_confirmation')" 
              @input="clearError('password_confirmation')" 
              :type="showConfirmPassword ? 'text' : 'password'" 
              minlength="12" 
              autocomplete="new-password" 
              :placeholder="languageStore.t('confirm_password_placeholder')" 
              class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-12 focus:bg-white focus:border-primary transition-all" 
              required 
              :aria-invalid="validationErrors.password_confirmation ? 'true' : 'false'" 
              :aria-describedby="validationErrors.password_confirmation ? 'password_confirmation-error' : null"
            >
            <button 
              type="button" 
              @click="showConfirmPassword = !showConfirmPassword"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center"
            >
              <component :is="showConfirmPassword ? EyeOff : Eye" class="w-5 h-5" />
            </button>
          </div>
          <p v-if="validationErrors.password_confirmation" id="password_confirmation-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.password_confirmation[0] }}
          </p>
        </div>

        <!-- Real-time security criteria checklist & strength meter -->
        <PasswordCriteria 
          v-if="form.password || form.password_confirmation || isPasswordFocused"
          :password="form.password"
          :confirmation="form.password_confirmation"
          :show-confirmation-criteria="true"
        />
      </div>

      <div v-else class="space-y-6">
        <div class="space-y-2 text-center">
            <label class="text-sm font-bold text-slate-700">{{ languageStore.t('otp_title') }}</label>
            <input v-model="form.otp" @blur="clearError('code')" @input="clearError('code')" type="text" maxlength="6" placeholder="000000" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-4 text-center text-2xl font-bold tracking-[1em] focus:bg-white focus:border-primary transition-all" required :aria-invalid="validationErrors.code ? 'true' : 'false'" :aria-describedby="validationErrors.code ? 'code-error' : null">
            <p v-if="validationErrors.code" id="code-error" role="alert" class="text-rose-500 text-xs mt-1 font-semibold text-center tracking-normal">
              {{ validationErrors.code[0] }}
            </p>
        </div>
        <div class="text-center">
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
          {{ step === 1 ? languageStore.t('next') : languageStore.t('complete_registration') }}
          <ArrowRight class="w-5 h-5" />
        </template>
      </button>
    </form>

    <p class="text-center text-sm text-slate-500">
      {{ languageStore.t('already_account') }} 
      <router-link to="/login" class="text-primary font-bold hover:underline ml-1">
        {{ languageStore.t('login_link') }}
      </router-link>
    </p>
  </div>
</template>
