<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'
import { User, UserCheck, Mail, Phone, MapPin, Globe, LogOut, ChevronRight, ChevronDown, ShieldCheck, Bell, CreditCard, Edit3, Save, X, Loader2, Building2, Lock, Eye, EyeOff, AlertCircle, FileText, Calendar } from 'lucide-vue-next'
import api from '../api/api'
import { countries } from '../data/countries'
import { getCitiesForCountry, getImmediateCitiesForCountry } from '../data/cities.js'
import RenewIdentityModal from '../components/RenewIdentityModal.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const languageStore = useLanguageStore()
const showRenewModal = ref(false)

const formattedExpirationDate = computed(() => {
  const exp = authStore.user?.expiration_piece || authStore.user?.effective_expiration_piece
  if (!exp) return 'Non renseignée'
  const parts = exp.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return exp
})

const formattedBirthDate = computed(() => {
  const dob = authStore.user?.dob || authStore.user?.effective_dob
  if (!dob) return 'Non renseignée'
  const parts = dob.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dob
})

onMounted(() => {
  if (route.query?.renew_id === '1' || route.query?.renew_id === 'true') {
    showRenewModal.value = true
  }
})

const onIdRenewed = (updatedUser) => {
  if (updatedUser) {
    authStore.setUser(updatedUser)
  }
  message.value = {
    type: 'success',
    text: 'Pièce d’identité mise à jour avec succès.'
  }
}

const changeLang = (lang) => {
  languageStore.setLanguage(lang)
  window.location.reload()
}
const isEditing = ref(false)
const loading = ref(false)
const message = ref({ type: '', text: '' })
const validationErrors = ref({})

const formattedRegistrationDate = computed(() => {
  const dateStr = authStore.user?.created_at
  if (!dateStr) return '---'
  try {
    const date = new Date(dateStr)
    const formatted = date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    // Capitalize the first letter (useful if month comes first or for layout styling)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch (e) {
    return '---'
  }
})

const verificationStatus = computed(() => {
  const status = authStore.user?.onboarding_status
  switch (status) {
    case 'validated':
      return { label: 'Vérifié', class: 'text-emerald-500' }
    case 'completed':
      return { label: 'En attente', class: 'text-amber-500' }
    case 'rejected':
      return { label: 'À corriger', class: 'text-rose-500' }
    default:
      return { label: 'Incomplet', class: 'text-slate-400' }
  }
})

const showPasswordForm = ref(false)
const passwordForm = ref({
  current_password: '',
  new_password: ''
})
const passwordLoading = ref(false)
const passwordMessage = ref({ type: '', text: '' })
const passwordValidationErrors = ref({})
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)

const handleUpdatePassword = async () => {
  passwordLoading.value = true
  passwordMessage.value = { type: '', text: '' }
  passwordValidationErrors.value = {}
  try {
    const response = await api.post('/update-password', passwordForm.value)
    passwordMessage.value = { type: 'success', text: response.data.message || 'Mot de passe mis à jour !' }
    passwordForm.value.current_password = ''
    passwordForm.value.new_password = ''
    setTimeout(() => {
      showPasswordForm.value = false
      passwordMessage.value = { type: '', text: '' }
    }, 2500)
  } catch (err) {
    if (err.response?.status === 422) {
      passwordValidationErrors.value = err.response.data.errors || {}
    } else {
      passwordMessage.value = { type: 'error', text: err.response?.data?.message || 'Erreur lors de la mise à jour' }
    }
  } finally {
    passwordLoading.value = false
  }
}

const editForm = ref({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  employer: ''
})

const availableCities = ref([])
const loadingCities = ref(false)
const isCustomCity = ref(false)
const customCity = ref('')

const updateCitiesForSelectedCountry = async (countryName, preselectedCity = '') => {
  if (!countryName) {
    availableCities.value = []
    return
  }
  availableCities.value = getImmediateCitiesForCountry(countryName)
  loadingCities.value = true
  try {
    const list = await getCitiesForCountry(countryName)
    if (editForm.value.country === countryName) {
      availableCities.value = list
      if (preselectedCity && list.length > 0 && !list.includes(preselectedCity)) {
        isCustomCity.value = true
        customCity.value = preselectedCity
      }
    }
  } catch (err) {
    console.error('Erreur chargement villes:', err)
  } finally {
    loadingCities.value = false
  }
}

const handleCountryChange = () => {
  if (validationErrors.value.country) delete validationErrors.value.country
  if (validationErrors.value.city) delete validationErrors.value.city
  editForm.value.city = ''
  isCustomCity.value = false
  customCity.value = ''
  updateCitiesForSelectedCountry(editForm.value.country)
}

const handleCityChange = (e) => {
  if (validationErrors.value.city) delete validationErrors.value.city
  const val = e.target.value
  if (val === '__AUTRE__') {
    isCustomCity.value = true
    editForm.value.city = customCity.value.trim()
  } else {
    isCustomCity.value = false
    editForm.value.city = val
  }
}

const handleCustomCityInput = () => {
  if (validationErrors.value.city) delete validationErrors.value.city
  editForm.value.city = customCity.value.trim()
}

const syncForm = () => {
  const currentCity = authStore.user?.city || ''
  const currentCountry = authStore.user?.country || ''
  editForm.value = {
    first_name: authStore.user?.first_name || '',
    last_name: authStore.user?.last_name || '',
    email: authStore.user?.email || '',
    phone: authStore.user?.phone || '',
    city: currentCity,
    country: currentCountry,
    employer: authStore.user?.employer || ''
  }

  isCustomCity.value = false
  customCity.value = ''
  if (currentCountry) {
    updateCitiesForSelectedCountry(currentCountry, currentCity)
  } else {
    availableCities.value = []
  }
}

watch(() => authStore.user, (newUser) => {
  if (newUser) {
    syncForm()
  }
}, { immediate: true })

onMounted(() => {
  if (authStore.user) {
    syncForm()
  }
})

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const toggleEdit = () => {
  if (isEditing.value) {
    syncForm()
  }
  isEditing.value = !isEditing.value
  message.value = { type: '', text: '' }
}

const handleUpdate = async () => {
  loading.value = true
  message.value = { type: '', text: '' }
  validationErrors.value = {}
  try {
    const response = await api.post('/update-profile', editForm.value)
    authStore.setUser(response.data.user)
    isEditing.value = false
    message.value = { type: 'success', text: 'Profil mis à jour !' }
  } catch (err) {
    if (err.response?.status === 422) {
      validationErrors.value = err.response.data.errors || {}
    } else {
      message.value = { type: 'error', text: err.response?.data?.message || 'Erreur de mise à jour' }
    }
  } finally {
    loading.value = false
  }
}

const showProfileCategoryModal = ref(false)
const selectedProfileCategory = ref('Particulier')
const savingProfileCategory = ref(false)

const saveProfileCategory = async () => {
  savingProfileCategory.value = true
  try {
    await api.post('/onboarding/missing-info', {
      categorie_client: selectedProfileCategory.value
    })
    authStore.setUser({
      ...authStore.user,
      categorie_client: selectedProfileCategory.value,
      needs_category: false
    })
    showProfileCategoryModal.value = false
    message.value = { type: 'success', text: 'Catégorie enregistrée avec succès !' }
  } catch (err) {
    console.error('Erreur categorie profile', err)
  } finally {
    savingProfileCategory.value = false
  }
}
</script>

<template>
  <div v-if="!authStore.user" class="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
    <Loader2 class="w-10 h-10 text-primary animate-spin" />
    <p class="text-slate-400 font-bold">Récupération de vos données...</p>
  </div>
  <div v-else class="pb-24">
    <!-- Header Profile -->
    <div class="bg-primary pt-12 pb-24 px-6 rounded-b-[40px] relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
      <div class="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16"></div>
      
      <div class="relative z-10 flex flex-col items-center">
        <div class="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl border-2 border-white/20 p-1 mb-4 shadow-2xl relative">
          <div class="w-full h-full bg-white rounded-2xl flex items-center justify-center text-primary text-3xl font-black">
            {{ authStore.user?.first_name?.charAt(0) }}{{ authStore.user?.last_name?.charAt(0) }}
          </div>
          <button 
            v-if="authStore.user?.onboarding_status !== 'validated'"
            @click="toggleEdit"
            class="absolute -bottom-2 -right-12 h-10 px-4 bg-white rounded-full shadow-lg flex items-center gap-2 text-primary border-4 border-primary hover:scale-105 active:scale-95 transition-all z-20"
          >
            <component :is="isEditing ? X : Edit3" class="w-4 h-4" />
            <span class="text-xs font-black uppercase">{{ isEditing ? 'Annuler' : 'Modifier' }}</span>
          </button>
        </div>
        <h2 class="text-white text-2xl font-bold">{{ authStore.user?.first_name }} {{ authStore.user?.last_name }}</h2>
        <p class="text-white/60 text-sm font-medium mb-6">Membre Premium</p>
 
        <div 
          v-if="authStore.user?.onboarding_status === 'validated'"
          class="bg-white/10 backdrop-blur-md border border-white/10 text-white text-xs font-bold px-6 py-3.5 rounded-2xl max-w-[280px] text-center leading-relaxed"
        >
          Compte vérifié. Contactez le support pour modifier vos données réglementaires.
        </div>
        <button 
          v-else-if="!isEditing"
          @click="toggleEdit"
          class="bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-black uppercase tracking-widest px-6 py-3 rounded-2xl hover:bg-white/20 active:scale-95 transition-all flex items-center gap-2"
        >
          <Edit3 class="w-4 h-4 text-accent" />
          Mettre à jour mes informations
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="px-6 -mt-12 relative z-20">
      <div class="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 flex justify-between divide-x divide-slate-100">
        <div class="flex-1 text-center pr-2">
          <div class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Inscrit le</div>
          <div class="text-slate-700 font-bold">{{ formattedRegistrationDate }}</div>
        </div>
        <div class="flex-1 text-center px-2">
          <div class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Status</div>
          <div :class="verificationStatus.class" class="font-bold">
            {{ verificationStatus.label }}
          </div>
        </div>
      </div>
    </div>

    <!-- Form Section -->
    <div class="px-6 mt-8 space-y-6">
      <div v-if="message.text" :class="message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'" class="p-4 rounded-2xl border text-sm font-bold text-center animate-in fade-in slide-in-from-top-2">
        {{ message.text }}
      </div>

      <div class="space-y-4">
        <div class="flex items-center justify-between ml-1">
          <h3 class="text-slate-400 text-xs font-black uppercase tracking-widest">Informations personnelles</h3>
          <span v-if="isEditing" class="text-[10px] text-primary font-black uppercase italic">Mode Édition</span>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-4 space-y-4 shadow-sm">
          <!-- Email (Désactivé) -->
          <div class="space-y-1">
            <label class="text-[10px] text-slate-400 font-black uppercase ml-1">Adresse Email</label>
            <div class="relative group">
              <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input :value="editForm.email" disabled type="email" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3 pl-11 pr-4 text-slate-400 font-bold text-sm cursor-not-allowed">
            </div>
          </div>

          <!-- Nom/Prénom -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">Prénom</label>
              <input v-model="editForm.first_name" :disabled="!isEditing" type="text" :class="isEditing ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-500'" class="w-full border-2 rounded-2xl py-3 px-4 font-bold text-sm transition-all" :aria-invalid="validationErrors.first_name ? 'true' : 'false'" :aria-describedby="validationErrors.first_name ? 'first_name-error' : null">
              <p v-if="validationErrors.first_name" id="first_name-error" role="alert" class="text-rose-500 text-[10px] mt-1 ml-1 font-semibold">
                {{ validationErrors.first_name[0] }}
              </p>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">Nom</label>
              <input v-model="editForm.last_name" :disabled="!isEditing" type="text" :class="isEditing ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-500'" class="w-full border-2 rounded-2xl py-3 px-4 font-bold text-sm transition-all" :aria-invalid="validationErrors.last_name ? 'true' : 'false'" :aria-describedby="validationErrors.last_name ? 'last_name-error' : null">
              <p v-if="validationErrors.last_name" id="last_name-error" role="alert" class="text-rose-500 text-[10px] mt-1 ml-1 font-semibold">
                {{ validationErrors.last_name[0] }}
              </p>
            </div>
          </div>

          <!-- Téléphone (Désactivé si non vide) -->
          <div class="space-y-1">
            <label class="text-[10px] text-slate-400 font-black uppercase ml-1">Téléphone</label>
            <div class="relative">
              <Phone class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input v-model="editForm.phone" :disabled="!isEditing || !!authStore.user.phone" type="tel" :class="(isEditing && !authStore.user.phone) ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-400'" class="w-full border-2 rounded-2xl py-3 pl-11 pr-4 font-bold text-sm transition-all" :aria-invalid="validationErrors.phone ? 'true' : 'false'" :aria-describedby="validationErrors.phone ? 'phone-error' : null">
            </div>
            <p v-if="validationErrors.phone" id="phone-error" role="alert" class="text-rose-500 text-[10px] mt-1 ml-1 font-semibold">
              {{ validationErrors.phone[0] }}
            </p>
          </div>

          <!-- Pays / Ville -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">Pays</label>
              <div class="relative">
                <select v-model="editForm.country" @change="handleCountryChange" :disabled="!isEditing" :class="isEditing ? 'bg-white border-primary/20 text-slate-700 pr-8' : 'bg-slate-50 border-slate-50 text-slate-500'" class="w-full border-2 rounded-2xl py-3 px-4 font-bold text-sm transition-all appearance-none" :aria-invalid="validationErrors.country ? 'true' : 'false'" :aria-describedby="validationErrors.country ? 'country-error' : null">
                  <option v-for="c in countries.slice().sort((a, b) => a.name.localeCompare(b.name))" :key="c.code" :value="c.name">{{ c.name }}</option>
                </select>
                <ChevronDown v-if="isEditing" class="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
              <p v-if="validationErrors.country" id="country-error" role="alert" class="text-rose-500 text-[10px] mt-1 ml-1 font-semibold">
                {{ validationErrors.country[0] }}
              </p>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">Ville</label>
              <div class="relative">
                <select 
                  v-if="isEditing && availableCities.length > 0" 
                  :value="isCustomCity ? '__AUTRE__' : editForm.city" 
                  @change="handleCityChange" 
                  class="w-full border-2 border-primary/20 rounded-2xl py-3 pl-3 pr-8 font-bold text-sm bg-white text-slate-700 transition-all appearance-none cursor-pointer" 
                  :aria-invalid="validationErrors.city ? 'true' : 'false'" 
                  :aria-describedby="validationErrors.city ? 'city-error' : null"
                >
                  <option value="" disabled>Sélectionner une ville</option>
                  <option v-for="c in availableCities" :key="c" :value="c">{{ c }}</option>
                  <option value="__AUTRE__">Autre ville...</option>
                </select>
                <input 
                  v-else 
                  v-model="editForm.city" 
                  :disabled="!isEditing" 
                  type="text" 
                  placeholder="Ville de résidence" 
                  :class="isEditing ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-500'" 
                  class="w-full border-2 rounded-2xl py-3 px-4 font-bold text-sm transition-all" 
                  :aria-invalid="validationErrors.city ? 'true' : 'false'" 
                  :aria-describedby="validationErrors.city ? 'city-error' : null"
                >
                <ChevronDown v-if="isEditing && availableCities.length > 0" class="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
              <input 
                v-if="isEditing && (isCustomCity || (editForm.country && availableCities.length === 0))" 
                v-model="customCity" 
                @input="handleCustomCityInput" 
                type="text" 
                placeholder="Précisez votre ville" 
                class="mt-1.5 w-full border-2 border-primary/20 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 bg-white" 
              />
              <p v-if="validationErrors.city" id="city-error" role="alert" class="text-rose-500 text-[10px] mt-1 ml-1 font-semibold">
                {{ validationErrors.city[0] }}
              </p>
            </div>
          </div>

          <!-- Date de naissance -->
          <div class="space-y-1">
            <div class="flex justify-between items-center ml-1">
              <label class="text-[10px] text-slate-400 font-black uppercase">Date de naissance</label>
              <span v-if="authStore.user?.age" class="text-[10px] font-bold text-primary">
                {{ authStore.user.age }} ans
              </span>
            </div>
            <div class="relative">
              <Calendar class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input 
                :value="formattedBirthDate" 
                disabled 
                type="text" 
                class="w-full bg-slate-50 border-2 border-slate-50 text-slate-500 rounded-2xl py-3 pl-11 pr-4 font-bold text-sm transition-all cursor-not-allowed" 
                placeholder="Non renseignée"
              >
            </div>
          </div>

          <!-- Employeur -->
          <div class="space-y-1">
            <label class="text-[10px] text-slate-400 font-black uppercase ml-1">Employeur</label>
            <div class="relative">
              <Building2 class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input v-model="editForm.employer" :disabled="!isEditing" type="text" :class="isEditing ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-500'" class="w-full border-2 rounded-2xl py-3 pl-11 pr-4 font-bold text-sm transition-all" placeholder="Non renseigné" :aria-invalid="validationErrors.employer ? 'true' : 'false'" :aria-describedby="validationErrors.employer ? 'employer-error' : null">
            </div>
            <p v-if="validationErrors.employer" id="employer-error" role="alert" class="text-rose-500 text-[10px] mt-1 ml-1 font-semibold">
              {{ validationErrors.employer[0] }}
            </p>
          </div>

          <!-- Catégorie du client -->
          <div class="space-y-1">
            <div class="flex justify-between items-center ml-1">
              <label class="text-[10px] text-slate-400 font-black uppercase">Catégorie du client</label>
              <button 
                type="button" 
                @click="showProfileCategoryModal = true" 
                class="text-[10px] text-primary font-black uppercase tracking-wider hover:underline"
              >
                {{ authStore.user?.categorie_client ? 'Modifier' : 'Préciser' }}
              </button>
            </div>
            <div class="flex items-center justify-between bg-slate-50 border-2 border-slate-50 rounded-2xl py-3 px-4">
              <span class="text-slate-700 font-bold text-sm">{{ authStore.user?.categorie_client || 'Non renseignée' }}</span>
              <span 
                v-if="authStore.user?.categorie_client" 
                class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800"
              >
                {{ authStore.user?.categorie_client }}
              </span>
              <span 
                v-else 
                class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800"
              >
                À compléter
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pièce d'identification (KYC) -->
      <div v-if="!isEditing" class="space-y-4">
        <div class="flex items-center justify-between ml-1">
          <h3 class="text-slate-400 text-xs font-black uppercase tracking-widest">Pièce d'identification</h3>
          <span 
            v-if="authStore.user?.is_id_expired" 
            class="text-[10px] text-rose-600 font-black uppercase tracking-wider bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full"
          >
            Expirée
          </span>
          <span 
            v-else-if="authStore.user?.is_id_expiring_soon" 
            class="text-[10px] text-amber-700 font-black uppercase tracking-wider bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full"
          >
            Expire bientôt
          </span>
          <span 
            v-else-if="authStore.user?.expiration_piece || authStore.user?.effective_expiration_piece" 
            class="text-[10px] text-emerald-700 font-black uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full"
          >
            Valide
          </span>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4 text-left">
          <!-- Alerte expiration -->
          <div 
            v-if="authStore.user?.is_id_expired" 
            class="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3"
          >
            <AlertCircle class="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div class="space-y-0.5">
              <h5 class="text-xs font-black text-rose-950 uppercase tracking-wide">Document expiré</h5>
              <p class="text-[11px] text-rose-800 font-medium leading-relaxed">
                Votre pièce d'identité a expiré le {{ formattedExpirationDate }}. Veuillez la renouveler sans tarder.
              </p>
            </div>
          </div>

          <div 
            v-else-if="authStore.user?.is_id_expiring_soon" 
            class="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3"
          >
            <AlertCircle class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div class="space-y-0.5">
              <h5 class="text-xs font-black text-amber-950 uppercase tracking-wide">Expiration prochaine</h5>
              <p class="text-[11px] text-amber-800 font-medium leading-relaxed">
                Votre pièce d'identité expire dans {{ authStore.user?.id_days_until_expiration }} jours (le {{ formattedExpirationDate }}).
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 bg-slate-50 rounded-2xl space-y-1">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Type de pièce</span>
              <span class="text-xs font-bold text-slate-800 block truncate">{{ authStore.user?.type_piece || 'CNI' }}</span>
            </div>
            <div class="p-3 bg-slate-50 rounded-2xl space-y-1">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block">N° Document</span>
              <span class="text-xs font-bold text-slate-800 block truncate">{{ authStore.user?.num_piece || 'Non renseigné' }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Date d'expiration</span>
              <span class="text-xs font-bold text-slate-800 block">{{ formattedExpirationDate }}</span>
            </div>
            <button 
              type="button" 
              @click="showRenewModal = true"
              class="bg-primary/10 hover:bg-primary/20 text-primary font-black text-[11px] px-3.5 py-2 rounded-xl transition-all active:scale-95 uppercase tracking-wider"
            >
              Renouveler
            </button>
          </div>
        </div>
      </div>

      <!-- Sécurité & Mot de passe -->
      <div v-if="!isEditing" class="space-y-4">
        <div class="flex items-center justify-between ml-1">
          <h3 class="text-slate-400 text-xs font-black uppercase tracking-widest">Sécurité</h3>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm space-y-4">
          <button 
            @click="showPasswordForm = !showPasswordForm"
            class="w-full flex items-center justify-between py-2 text-left"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500">
                <Lock class="w-5 h-5" />
              </div>
              <div>
                <h4 class="font-bold text-slate-700 text-sm">Modifier mon mot de passe</h4>
                <p class="text-slate-400 text-[10px]">Sécurisez votre compte PEK</p>
              </div>
            </div>
            <ChevronRight :class="showPasswordForm ? 'rotate-90' : ''" class="w-5 h-5 text-slate-400 transition-transform" />
          </button>

          <div v-if="showPasswordForm" class="pt-4 border-t border-slate-50 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div v-if="passwordMessage.text" :class="passwordMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'" class="p-3 rounded-2xl border text-xs font-bold text-center">
              {{ passwordMessage.text }}
            </div>

            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">Mot de passe actuel</label>
              <div class="relative">
                <input v-model="passwordForm.current_password" :type="showCurrentPassword ? 'text' : 'password'" placeholder="••••••••" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3 pl-4 pr-12 font-bold text-sm focus:bg-white focus:border-primary transition-all" :aria-invalid="passwordValidationErrors.current_password ? 'true' : 'false'" :aria-describedby="passwordValidationErrors.current_password ? 'current_password-error' : null">
                <button 
                  type="button" 
                  @click="showCurrentPassword = !showCurrentPassword"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center"
                >
                  <component :is="showCurrentPassword ? EyeOff : Eye" class="w-4 h-4" />
                </button>
              </div>
              <p v-if="passwordValidationErrors.current_password" id="current_password-error" role="alert" class="text-rose-500 text-[10px] mt-1 ml-1 font-semibold">
                {{ passwordValidationErrors.current_password[0] }}
              </p>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">Nouveau mot de passe</label>
              <div class="relative">
                <input v-model="passwordForm.new_password" :type="showNewPassword ? 'text' : 'password'" minlength="12" placeholder="Min. 12 caractères" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3 pl-4 pr-12 font-bold text-sm focus:bg-white focus:border-primary transition-all" :aria-invalid="passwordValidationErrors.new_password ? 'true' : 'false'" :aria-describedby="passwordValidationErrors.new_password ? 'new_password-error' : null">
                <button 
                  type="button" 
                  @click="showNewPassword = !showNewPassword"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center"
                >
                  <component :is="showNewPassword ? EyeOff : Eye" class="w-4 h-4" />
                </button>
              </div>
              <p v-if="passwordValidationErrors.new_password" id="new_password-error" role="alert" class="text-rose-500 text-[10px] mt-1 ml-1 font-semibold">
                {{ passwordValidationErrors.new_password[0] }}
              </p>
            </div>

            <button 
              @click="handleUpdatePassword"
              :disabled="passwordLoading || !passwordForm.current_password || passwordForm.new_password.length < 12"
              class="w-full bg-slate-950 text-white font-black py-4 rounded-2xl text-xs flex items-center justify-center gap-2 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:active:scale-100 transition-all"
            >
              <Loader2 v-if="passwordLoading" class="w-4 h-4 animate-spin" />
              Changer le mot de passe
            </button>
          </div>
        </div>
      </div>

      <!-- Langue de l'application -->
      <div v-if="!isEditing" class="space-y-4">
        <div class="flex items-center justify-between ml-1">
          <h3 class="text-slate-400 text-xs font-black uppercase tracking-widest">{{ languageStore.isEn() ? 'Language' : 'Langue' }}</h3>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500">
                <Globe class="w-5 h-5" />
              </div>
              <div>
                <h4 class="font-bold text-slate-700 text-sm">{{ languageStore.isEn() ? 'App Language' : 'Langue de l\'application' }}</h4>
                <p class="text-slate-400 text-[10px]">{{ languageStore.isEn() ? 'Select your language' : 'Choisissez votre langue' }}</p>
              </div>
            </div>
            
            <div class="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
              <button 
                type="button"
                @click="changeLang('fr')" 
                :class="languageStore.currentLang === 'fr' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 font-medium'"
                class="px-3 py-1.5 rounded-xl text-xs transition-all"
              >
                FR
              </button>
              <button 
                type="button"
                @click="changeLang('en')" 
                :class="languageStore.currentLang === 'en' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 font-medium'"
                class="px-3 py-1.5 rounded-xl text-xs transition-all"
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="space-y-3">
        <button 
          v-if="isEditing"
          @click="handleUpdate"
          :disabled="loading"
          class="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
          <Save v-else class="w-5 h-5" />
          Enregistrer les modifications
        </button>

        <button 
          @click="handleLogout"
          v-if="!isEditing"
          class="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 border border-rose-100 active:scale-95"
        >
          <LogOut class="w-5 h-5" />
          Déconnexion
        </button>
      </div>

      <p class="text-center text-slate-300 text-[10px] font-black uppercase tracking-widest pt-4">© 2026 PEK - Tous droits reserves</p>
    </div>

    <!-- Modal Catégorie de client pour le Profil -->
    <div v-if="showProfileCategoryModal" class="fixed inset-0 z-[10000] flex items-end justify-center p-6 sm:items-center">
      <div @click="showProfileCategoryModal = false" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"></div>
      
      <div class="relative w-full max-w-sm bg-white rounded-[36px] p-8 shadow-2xl border border-slate-100/50 z-10 animate-in slide-in-from-bottom duration-300 text-center space-y-6">
        <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
          <UserCheck class="w-8 h-8" />
        </div>
        
        <div class="space-y-2">
          <h3 class="text-lg font-black text-slate-900">Catégorie Client</h3>
          <p class="text-slate-500 font-bold text-xs leading-relaxed px-2">
            Précisez votre catégorie d'investisseur pour vos attestations et bulletins officiels :
          </p>
        </div>

        <div class="relative text-left">
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Catégorie réglementaire *</label>
          <div class="relative">
            <select v-model="selectedProfileCategory" class="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-900 focus:border-primary outline-none transition-all appearance-none cursor-pointer">
              <option value="Particulier">Particulier (Recommandé)</option>
              <option value="Professionnel">Professionnel</option>
              <option value="Institutionnel">Institutionnel</option>
              <option value="Personne Morale">Personne Morale</option>
            </select>
            <ChevronDown class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div class="space-y-2">
          <button 
            type="button"
            @click="saveProfileCategory" 
            :disabled="savingProfileCategory"
            class="w-full bg-primary hover:bg-slate-800 text-white font-black py-4 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <Loader2 v-if="savingProfileCategory" class="w-4 h-4 animate-spin" />
            <span>Enregistrer</span>
          </button>
          <button 
            type="button"
            @click="showProfileCategoryModal = false" 
            class="w-full py-2 text-slate-400 font-bold text-xs hover:text-slate-600 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Renouvellement Pièce d'Identité -->
    <RenewIdentityModal v-model="showRenewModal" @renewed="onIdRenewed" />
  </div>
</template>
