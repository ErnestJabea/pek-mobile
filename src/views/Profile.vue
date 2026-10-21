<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'
import { formatErrorMessage } from '../utils/formatError'
import { 
  User, UserCheck, Mail, Phone, MapPin, Globe, LogOut, ChevronRight, ChevronDown, 
  ShieldCheck, Bell, CreditCard, Edit3, Save, X, Loader2, Building2, Lock, Eye, EyeOff, 
  AlertCircle, FileText, Calendar, Smartphone, ShieldAlert, ShieldOff, Landmark, 
  Clock, CheckCircle2, AlertTriangle, UploadCloud, Plus 
} from 'lucide-vue-next'
import api from '../api/api'
import { countries } from '../data/countries'
import { getCitiesForCountry, getImmediateCitiesForCountry } from '../data/cities.js'
import RenewIdentityModal from '../components/RenewIdentityModal.vue'
import MfaConfigModal from '../components/MfaConfigModal.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const languageStore = useLanguageStore()
const showRenewModal = ref(false)
const showMfaModal = ref(false)

const formattedExpirationDate = computed(() => {
  const exp = authStore.user?.expiration_piece || authStore.user?.effective_expiration_piece
  if (!exp) return languageStore.t('profile_id_not_set')
  const parts = exp.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return exp
})

const formattedBirthDate = computed(() => {
  const dob = authStore.user?.dob || authStore.user?.effective_dob
  if (!dob) return languageStore.t('profile_id_not_set')
  const parts = dob.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dob
})

const formatCategory = (cat) => {
  if (!cat) return ''
  if (!languageStore.isEn()) return cat
  switch (cat) {
    case 'Salarié secteur public': return 'Public Sector Employee'
    case 'Salarié secteur privé': return 'Private Sector Employee'
    case 'Agent des organismes internationaux': return 'International Organization Official'
    case 'Profession libérale': return 'Self-Employed / Liberal Professional'
    case 'Commerçant / entrepreneur': return 'Trader / Entrepreneur'
    case 'Chômeur': return 'Unemployed'
    case 'Particulier': return 'Individual'
    case 'Professionnel': return 'Professional'
    case 'Institutionnel': return 'Institutional'
    case 'Personne Morale': return 'Corporate Entity'
    case 'Banques': return 'Banks'
    case 'OPC': return 'UCITS / Investment Funds'
    case 'Caisses de dépôt et consignation (CDC)': return 'Deposit and Consignment Funds (CDC)'
    case 'Autres institutions financières': return 'Other Financial Institutions'
    case 'Sociétés de bourse': return 'Brokerage Firms'
    case "Société de gestion d'OPC": return 'Asset Management Company'
    case 'Entreprises non financières': return 'Non-Financial Corporates'
    case 'Banques / Établissements financiers': return 'Banks / Financial Institutions'
    case 'OPC / Sociétés de gestion': return 'UCITS / Asset Managers'
    default: return cat
  }
}

const formatNature = (nature) => {
  if (!nature) return languageStore.isEn() ? 'Natural Person' : 'Personne Physique'
  if (!languageStore.isEn()) return nature
  switch (nature) {
    case 'Personne Physique': return 'Natural Person'
    case 'Personne Morale': return 'Corporate Entity'
    default: return nature
  }
}

const isEditing = ref(false)
const loading = ref(false)
const message = ref({ type: '', text: '' })
const validationErrors = ref({})

const editForm = ref({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  country: '',
  city: '',
  employer: ''
})

const availableCities = ref([])
const loadingCities = ref(false)
const isCustomCity = ref(false)
const customCity = ref('')

const syncFormWithUser = () => {
  if (authStore.user) {
    const userCountry = authStore.user.country || 'Cameroun'
    const userCity = authStore.user.city || ''

    editForm.value = {
      first_name: authStore.user.first_name || '',
      last_name: authStore.user.last_name || '',
      email: authStore.user.email || '',
      phone: authStore.user.phone || '',
      country: userCountry,
      city: userCity,
      employer: authStore.user.employer || ''
    }

    const immediate = getImmediateCitiesForCountry(userCountry)
    if (immediate.length > 0) {
      availableCities.value = immediate
      isCustomCity.value = !!userCity && !immediate.includes(userCity)
      customCity.value = isCustomCity.value ? userCity : ''
    }
  }
}

const handleCountryChange = async () => {
  const selectedCountry = editForm.value.country
  if (!selectedCountry) {
    availableCities.value = []
    editForm.value.city = ''
    isCustomCity.value = false
    customCity.value = ''
    return
  }

  const immediate = getImmediateCitiesForCountry(selectedCountry)
  if (immediate.length > 0) {
    availableCities.value = immediate
    if (!availableCities.value.includes(editForm.value.city)) {
      editForm.value.city = ''
      isCustomCity.value = false
      customCity.value = ''
    }
    return
  }

  loadingCities.value = true
  availableCities.value = []
  editForm.value.city = ''
  isCustomCity.value = false
  customCity.value = ''

  try {
    const loaded = await getCitiesForCountry(selectedCountry)
    availableCities.value = loaded
  } catch (err) {
    console.warn('Erreur chargement villes:', err)
  } finally {
    loadingCities.value = false
  }
}

const handleCityChange = (e) => {
  const value = e.target.value
  if (value === '__AUTRE__') {
    isCustomCity.value = true
    editForm.value.city = customCity.value
  } else {
    isCustomCity.value = false
    editForm.value.city = value
  }
}

const handleCustomCityInput = (e) => {
  editForm.value.city = e.target.value
}

const toggleEdit = () => {
  if (isEditing.value) {
    syncFormWithUser()
    validationErrors.value = {}
  }
  isEditing.value = !isEditing.value
}

// État réglementaire & bancaire du profil
const regulatoryData = ref({
  nature_client: 'Personne Physique',
  categorie_client: '',
  pending_category_request: null,
  bank_account: null,
  pending_bank_request: null,
  taxonomies: {
    natures: ['Personne Physique', 'Personne Morale'],
    categories_by_nature: {
      'Personne Physique': [
        'Salarié secteur public',
        'Salarié secteur privé',
        'Agent des organismes internationaux',
        'Profession libérale',
        'Commerçant / entrepreneur',
        'Chômeur'
      ],
      'Personne Morale': [
        'Banques',
        'OPC',
        'Caisses de dépôt et consignation (CDC)',
        'Autres institutions financières',
        'Sociétés de bourse',
        "Société de gestion d'OPC",
        'Entreprises non financières'
      ]
    }
  }
})

const loadingRegulatory = ref(false)

const fetchRegulatoryStatus = async () => {
  try {
    loadingRegulatory.value = true
    const res = await api.get('/user/profile-regulatory')
    regulatoryData.value = res.data
    if (authStore.user) {
      authStore.setUser({
        ...authStore.user,
        nature_client: res.data.nature_client,
        categorie_client: res.data.categorie_client
      })
    }
  } catch (err) {
    console.error('Erreur chargement regulatory:', err)
  } finally {
    loadingRegulatory.value = false
  }
}

onMounted(() => {
  syncFormWithUser()
  fetchRegulatoryStatus()

  if (route.query?.renew_id === '1' || route.query?.renew_id === 'true') {
    showRenewModal.value = true
  }
})

watch(() => authStore.user, () => {
  if (!isEditing.value) {
    syncFormWithUser()
  }
}, { deep: true })

const onIdRenewed = (updatedUser) => {
  if (updatedUser) {
    authStore.setUser(updatedUser)
  }
  message.value = {
    type: 'success',
    text: languageStore.isEn() ? 'Identity document updated successfully.' : 'Pièce d’identité mise à jour avec succès.'
  }
}

const changeLang = async (lang) => {
  await languageStore.setLanguage(lang)
  window.location.reload()
}

// Formulaire de changement de mot de passe
const passwordForm = ref({
  current_password: '',
  new_password: '',
})
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const passwordLoading = ref(false)
const passwordMessage = ref({ type: '', text: '' })
const passwordValidationErrors = ref({})

const handleUpdatePassword = async () => {
  passwordLoading.value = true
  passwordMessage.value = { type: '', text: '' }
  passwordValidationErrors.value = {}

  try {
    const response = await api.post('/update-password', {
      current_password: passwordForm.value.current_password,
      new_password: passwordForm.value.new_password,
    })

    passwordForm.value.current_password = ''
    passwordForm.value.new_password = ''
    passwordMessage.value = { 
      type: 'success', 
      text: languageStore.isEn() ? 'Password changed successfully.' : (response.data?.message || 'Mot de passe modifié avec succès.') 
    }
  } catch (err) {
    if (err.response?.status === 422) {
      passwordValidationErrors.value = err.response.data.errors || {}
    } else {
      passwordMessage.value = { 
        type: 'error', 
        text: formatErrorMessage(err, languageStore.isEn() ? 'Error changing password.' : 'Erreur lors du changement de mot de passe.') 
      }
    }
  } finally {
    passwordLoading.value = false
  }
}

const handleUpdate = async () => {
  loading.value = true
  message.value = { type: '', text: '' }
  validationErrors.value = {}
  try {
    const response = await api.post('/update-profile', editForm.value)
    authStore.setUser(response.data.user)
    isEditing.value = false
    message.value = { 
      type: 'success', 
      text: languageStore.isEn() ? 'Profile updated!' : 'Profil mis à jour !' 
    }
  } catch (err) {
    if (err.response?.status === 422) {
      validationErrors.value = err.response.data.errors || {}
    } else {
      message.value = { 
        type: 'error', 
        text: formatErrorMessage(err, languageStore.isEn() ? 'Update error.' : 'Erreur de mise à jour') 
      }
    }
  } finally {
    loading.value = false
  }
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

// --- GESTION DE LA NATURE ET CATÉGORIE DU CLIENT ---
const showProfileCategoryModal = ref(false)
const selectedNature = ref('Personne Physique')
const selectedCategory = ref('Salarié secteur privé')
const savingCategoryRequest = ref(false)

const openCategoryModal = () => {
  selectedNature.value = regulatoryData.value.nature_client || 'Personne Physique'
  const cats = regulatoryData.value.taxonomies?.categories_by_nature?.[selectedNature.value] || []
  selectedCategory.value = regulatoryData.value.categorie_client || cats[0] || 'Salarié secteur privé'
  showProfileCategoryModal.value = true
}

const currentNatureCategories = computed(() => {
  return regulatoryData.value.taxonomies?.categories_by_nature?.[selectedNature.value] || []
})

const onNatureChange = () => {
  const cats = currentNatureCategories.value
  if (cats.length > 0 && !cats.includes(selectedCategory.value)) {
    selectedCategory.value = cats[0]
  }
}

const submitCategoryRequest = async () => {
  savingCategoryRequest.value = true
  try {
    const res = await api.post('/user/request-category-update', {
      nature_client: selectedNature.value,
      categorie_client: selectedCategory.value,
    })
    showProfileCategoryModal.value = false
    await fetchRegulatoryStatus()
    message.value = { 
      type: 'success', 
      text: languageStore.isEn() 
        ? 'Request successfully submitted to Kori compliance team!' 
        : (res.data?.message || 'Demande transmise avec succès à l\'équipe de conformité Kori !')
    }
  } catch (err) {
    console.error('Erreur soumission categorie', err)
    message.value = {
      type: 'error',
      text: languageStore.isEn()
        ? 'Error submitting category request.'
        : (err.response?.data?.message || 'Erreur lors de la soumission de la demande.')
    }
  } finally {
    savingCategoryRequest.value = false
  }
}

// --- GESTION DES COORDONNÉES BANCAIRES DU CLIENT ---
const showBankModal = ref(false)
const submittingBank = ref(false)
const bankValidationErrors = ref({})
const isCustomBank = ref(false)

const popularBanks = [
  'Afriland First Bank',
  'BICEC',
  'Société Générale Cameroun',
  'SCB Cameroun',
  'Ecobank',
  'UBA (United Bank for Africa)',
  'Commercial Bank (CBC)',
  'Banque Atlantique',
  'CCA-Bank',
  'BGFI Bank',
  'Autre établissement bancaire...'
]

const bankForm = ref({
  selected_bank: 'Afriland First Bank',
  custom_bank_name: '',
  account_holder_name: '',
  account_number: '',
  bank_code: '',
  branch_code: '',
  rib_key: '',
  iban: '',
  swift_bic: '',
})

const selectedRibFile = ref(null)
const ribFileName = ref('')

const openBankModal = () => {
  bankValidationErrors.value = {}
  const cur = regulatoryData.value.bank_account

  const fullName = `${authStore.user?.first_name || ''} ${authStore.user?.last_name || ''}`.trim()

  if (cur) {
    const isPop = popularBanks.includes(cur.bank_name)
    bankForm.value = {
      selected_bank: isPop ? cur.bank_name : 'Autre établissement bancaire...',
      custom_bank_name: isPop ? '' : cur.bank_name,
      account_holder_name: cur.account_holder_name || fullName,
      account_number: cur.account_number || '',
      bank_code: cur.bank_code || '',
      branch_code: cur.branch_code || '',
      rib_key: cur.rib_key || '',
      iban: cur.iban || '',
      swift_bic: cur.swift_bic || '',
    }
    isCustomBank.value = !isPop
  } else {
    bankForm.value = {
      selected_bank: 'Afriland First Bank',
      custom_bank_name: '',
      account_holder_name: fullName,
      account_number: '',
      bank_code: '',
      branch_code: '',
      rib_key: '',
      iban: '',
      swift_bic: '',
    }
    isCustomBank.value = false
  }

  selectedRibFile.value = null
  ribFileName.value = ''
  showBankModal.value = true
}

const onBankSelectChange = () => {
  isCustomBank.value = (bankForm.value.selected_bank === 'Autre établissement bancaire...')
}

const onRibFileSelected = (e) => {
  const file = e.target.files?.[0]
  if (file) {
    selectedRibFile.value = file
    ribFileName.value = file.name
  }
}

const submitBankRequest = async () => {
  submittingBank.value = true
  bankValidationErrors.value = {}

  try {
    const finalBankName = isCustomBank.value ? bankForm.value.custom_bank_name : bankForm.value.selected_bank

    const formData = new FormData()
    formData.append('bank_name', finalBankName)
    formData.append('account_holder_name', bankForm.value.account_holder_name)
    formData.append('account_number', bankForm.value.account_number)
    if (bankForm.value.bank_code) formData.append('bank_code', bankForm.value.bank_code)
    if (bankForm.value.branch_code) formData.append('branch_code', bankForm.value.branch_code)
    if (bankForm.value.rib_key) formData.append('rib_key', bankForm.value.rib_key)
    if (bankForm.value.iban) formData.append('iban', bankForm.value.iban)
    if (bankForm.value.swift_bic) formData.append('swift_bic', bankForm.value.swift_bic)
    if (selectedRibFile.value) {
      formData.append('rib_document', selectedRibFile.value)
    }

    const res = await api.post('/user/request-bank-update', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    showBankModal.value = false
    await fetchRegulatoryStatus()
    message.value = {
      type: 'success',
      text: languageStore.isEn() 
        ? 'Bank details submitted for validation by the Kori team!' 
        : (res.data?.message || 'Coordonnées bancaires transmises pour validation par l\'équipe Kori !'),
    }
  } catch (err) {
    if (err.response?.status === 422) {
      bankValidationErrors.value = err.response.data.errors || {}
    } else {
      message.value = {
        type: 'error',
        text: languageStore.isEn() 
          ? 'Error submitting bank details.' 
          : (err.response?.data?.message || 'Erreur lors de la transmission des coordonnées bancaires.'),
      }
    }
  } finally {
    submittingBank.value = false
  }
}
</script>

<template>
  <div v-if="!authStore.user" class="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
    <Loader2 class="w-10 h-10 text-primary animate-spin" />
    <p class="text-slate-400 font-bold">{{ languageStore.isEn() ? 'Retrieving your profile...' : 'Récupération de vos données...' }}</p>
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
            <span class="text-xs font-black uppercase">{{ isEditing ? languageStore.t('cancel') : languageStore.t('modify') }}</span>
          </button>
        </div>
        <h2 class="text-white text-2xl font-bold">{{ authStore.user?.first_name }} {{ authStore.user?.last_name }}</h2>
        <!-- <p class="text-white/60 text-sm font-medium mb-6">Membre Premium</p> -->

        <div 
          v-if="authStore.user?.onboarding_status === 'validated'"
          class="bg-white/10 backdrop-blur-md border border-white/10 text-white text-xs font-bold px-6 py-3.5 rounded-2xl max-w-[280px] text-center leading-relaxed"
        >
          {{ languageStore.isEn() ? 'Verified account. Regulatory updates require prior compliance review.' : 'Compte vérifié. Vos modifications réglementaires font l\'objet d\'un examen préalable.' }}
        </div>
      </div>
    </div>

    <!-- Content Sections -->
    <div class="px-6 -mt-12 relative z-20 space-y-6">
      <!-- Feedback Message -->
      <div v-if="message.text" :class="message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'" class="p-4 rounded-2xl border text-sm font-bold text-center animate-in fade-in slide-in-from-top-2">
        {{ message.text }}
      </div>

      <!-- INFORMATIONS PERSONNELLES -->
      <div class="space-y-4">
        <div class="flex items-center justify-between ml-1">
          <h3 class="text-slate-400 text-xs font-black uppercase tracking-widest">{{ languageStore.t('profile_personal_info') }}</h3>
          <span v-if="isEditing" class="text-[10px] text-primary font-black uppercase italic">{{ languageStore.isEn() ? 'Edit Mode' : 'Mode Édition' }}</span>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-4 space-y-4 shadow-sm">
          <!-- Email (Désactivé) -->
          <div class="space-y-1">
            <label class="text-[10px] text-slate-400 font-black uppercase ml-1">{{ languageStore.t('email_label') }}</label>
            <div class="relative group">
              <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input :value="editForm.email" disabled type="email" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3 pl-11 pr-4 text-slate-400 font-bold text-sm cursor-not-allowed">
            </div>
          </div>

          <!-- Nom/Prénom -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">{{ languageStore.t('first_name_label') }}</label>
              <input v-model="editForm.first_name" :disabled="!isEditing" type="text" :class="isEditing ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-500'" class="w-full border-2 rounded-2xl py-3 px-4 font-bold text-sm transition-all">
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">{{ languageStore.t('last_name_label') }}</label>
              <input v-model="editForm.last_name" :disabled="!isEditing" type="text" :class="isEditing ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-500'" class="w-full border-2 rounded-2xl py-3 px-4 font-bold text-sm transition-all">
            </div>
          </div>

          <!-- Téléphone -->
          <div class="space-y-1">
            <label class="text-[10px] text-slate-400 font-black uppercase ml-1">{{ languageStore.t('phone_label') }}</label>
            <div class="relative">
              <Phone class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input v-model="editForm.phone" :disabled="!isEditing || !!authStore.user.phone" type="tel" :class="(isEditing && !authStore.user.phone) ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-400'" class="w-full border-2 rounded-2xl py-3 pl-11 pr-4 font-bold text-sm transition-all">
            </div>
          </div>

          <!-- Pays / Ville -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">{{ languageStore.t('country_label') }}</label>
              <div class="relative">
                <select v-model="editForm.country" @change="handleCountryChange" :disabled="!isEditing" :class="isEditing ? 'bg-white border-primary/20 text-slate-700 pr-8' : 'bg-slate-50 border-slate-50 text-slate-500'" class="w-full border-2 rounded-2xl py-3 px-4 font-bold text-sm transition-all appearance-none">
                  <option v-for="c in countries.slice().sort((a, b) => a.name.localeCompare(b.name))" :key="c.code" :value="c.name">{{ c.name }}</option>
                </select>
                <ChevronDown v-if="isEditing" class="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div class="space-y-1">
              <div class="flex items-center justify-between ml-1">
                <label class="text-[10px] text-slate-400 font-black uppercase">{{ languageStore.t('city_label') }}</label>
                <span v-if="isEditing && loadingCities" class="text-[10px] font-bold text-primary flex items-center gap-1 animate-pulse">
                  <Loader2 class="w-3 h-3 animate-spin text-primary" />
                  {{ languageStore.t('loading') }}
                </span>
              </div>
              <div class="relative">
                <select 
                  v-if="isEditing && (availableCities.length > 0 || loadingCities)" 
                  :value="isCustomCity ? '__AUTRE__' : editForm.city" 
                  @change="handleCityChange" 
                  :disabled="loadingCities"
                  class="w-full border-2 border-primary/20 rounded-2xl py-3 pl-3 pr-8 font-bold text-sm bg-white text-slate-700 transition-all appearance-none cursor-pointer" 
                >
                  <option value="" disabled>{{ loadingCities ? (languageStore.isEn() ? 'Loading cities...' : 'Chargement des villes en cours...') : languageStore.t('profile_select_city') }}</option>
                  <option v-for="c in availableCities" :key="c" :value="c">{{ c }}</option>
                  <option v-if="!loadingCities" value="__AUTRE__">{{ languageStore.t('profile_other_city') }}</option>
                </select>
                <input 
                  v-else 
                  v-model="editForm.city" 
                  :disabled="!isEditing" 
                  type="text" 
                  :placeholder="languageStore.t('profile_city_placeholder')" 
                  :class="isEditing ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-500'" 
                  class="w-full border-2 rounded-2xl py-3 px-4 font-bold text-sm transition-all" 
                >
                <ChevronDown v-if="isEditing && (availableCities.length > 0 || loadingCities)" class="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <!-- Date de naissance -->
          <div class="space-y-1">
            <div class="flex justify-between items-center ml-1">
              <label class="text-[10px] text-slate-400 font-black uppercase">{{ languageStore.t('profile_dob_label') }}</label>
              <span v-if="authStore.user?.age" class="text-[10px] font-bold text-primary">
                {{ authStore.user.age }} {{ languageStore.t('profile_years_old') }}
              </span>
            </div>
            <div class="relative">
              <Calendar class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input 
                :value="formattedBirthDate" 
                disabled 
                type="text" 
                class="w-full bg-slate-50 border-2 border-slate-50 text-slate-500 rounded-2xl py-3 pl-11 pr-4 font-bold text-sm transition-all cursor-not-allowed" 
                :placeholder="languageStore.t('profile_id_not_set')"
              >
            </div>
          </div>

          <!-- Employeur -->
          <div class="space-y-1">
            <label class="text-[10px] text-slate-400 font-black uppercase ml-1">{{ languageStore.t('employer_label') }}</label>
            <div class="relative">
              <Building2 class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input v-model="editForm.employer" :disabled="!isEditing" type="text" :class="isEditing ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-500'" class="w-full border-2 rounded-2xl py-3 pl-11 pr-4 font-bold text-sm transition-all" :placeholder="languageStore.t('profile_id_not_set')">
            </div>
          </div>

          <!-- NATURE ET CATÉGORIE DU CLIENT -->
          <div class="space-y-2 pt-2 border-t border-slate-100">
            <div class="flex justify-between items-center ml-1">
              <label class="text-[10px] text-slate-400 font-black uppercase">{{ languageStore.t('profile_nature_category') }}</label>
              <button 
                type="button" 
                @click="openCategoryModal" 
                class="text-[10px] text-primary font-black uppercase tracking-wider hover:underline"
              >
                {{ languageStore.t('modify') }}
              </button>
            </div>

            <div class="bg-slate-50 border-2 border-slate-50 rounded-2xl p-3.5 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-500 font-bold">{{ languageStore.t('profile_nature_label') }}</span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-700">
                  {{ formatNature(regulatoryData.nature_client) }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-500 font-bold">{{ languageStore.t('profile_category_label') }}</span>
                <span 
                  v-if="regulatoryData.categorie_client" 
                  class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800"
                >
                  {{ formatCategory(regulatoryData.categorie_client) }}
                </span>
                <span 
                  v-else 
                  class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800"
                >
                  {{ languageStore.t('profile_to_complete') }}
                </span>
              </div>
            </div>

            <!-- Alerte Demande en attente de validation Kori -->
            <div 
              v-if="regulatoryData.pending_category_request" 
              class="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900 animate-in fade-in"
            >
              <Clock class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div class="text-[11px] leading-tight space-y-1">
                <p class="font-black text-amber-800 uppercase tracking-wider text-[10px]">
                  {{ languageStore.t('profile_pending_kori_validation') }}
                </p>
                <p class="font-medium text-amber-900/80">
                  {{ languageStore.isEn() ? 'Requested:' : 'Demandé :' }} <strong>{{ formatNature(regulatoryData.pending_category_request.requested_nature) }}</strong> » <strong>{{ formatCategory(regulatoryData.pending_category_request.requested_categorie) }}</strong>
                </p>
                <p class="text-[9px] text-amber-700/70 font-semibold">
                  {{ languageStore.isEn() ? 'Submitted on' : 'Soumis le' }} {{ regulatoryData.pending_category_request.created_at }}. {{ languageStore.isEn() ? 'Pending compliance validation.' : 'En attente de validation par l\'équipe de conformité.' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- COORDONNÉES BANCAIRES POUR VIREMENTS -->
      <div v-if="!isEditing" class="space-y-4">
        <div class="flex items-center justify-between ml-1">
          <h3 class="text-slate-400 text-xs font-black uppercase tracking-widest">{{ languageStore.t('profile_bank_details') }}</h3>
          <button 
            type="button" 
            @click="openBankModal" 
            class="text-[10px] text-primary font-black uppercase tracking-wider hover:underline flex items-center gap-1"
          >
            <component :is="regulatoryData.bank_account ? Edit3 : Plus" class="w-3 h-3" />
            <span>{{ regulatoryData.bank_account ? languageStore.t('modify') : (languageStore.isEn() ? 'Provide' : 'Renseigner') }}</span>
          </button>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-5 space-y-4 shadow-sm relative overflow-hidden">
          <!-- Si compte bancaire existant -->
          <div v-if="regulatoryData.bank_account" class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Landmark class="w-5 h-5" />
                </div>
                <div>
                  <h4 class="font-black text-slate-800 text-sm">{{ regulatoryData.bank_account.bank_name }}</h4>
                  <p class="text-slate-400 text-xs font-semibold">{{ regulatoryData.bank_account.account_holder_name }}</p>
                </div>
              </div>
              <span 
                :class="{
                  'bg-emerald-100 text-emerald-800': regulatoryData.bank_account.status === 'validated',
                  'bg-amber-100 text-amber-800': regulatoryData.bank_account.status === 'pending',
                  'bg-rose-100 text-rose-800': regulatoryData.bank_account.status === 'rejected',
                }" 
                class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
              >
                <CheckCircle2 v-if="regulatoryData.bank_account.status === 'validated'" class="w-3 h-3 text-emerald-600" />
                <Clock v-else-if="regulatoryData.bank_account.status === 'pending'" class="w-3 h-3 text-amber-600" />
                <AlertTriangle v-else class="w-3 h-3 text-rose-600" />
                <span>{{ regulatoryData.bank_account.status === 'validated' ? languageStore.t('profile_bank_validated') : (regulatoryData.bank_account.status === 'pending' ? languageStore.t('profile_bank_pending') : languageStore.t('profile_bank_rejected')) }}</span>
              </span>
            </div>

            <div class="bg-slate-50 rounded-2xl p-3 text-xs space-y-1 font-mono">
              <div class="flex justify-between items-center text-slate-500 text-[11px]">
                <span>{{ languageStore.t('profile_bank_account_num') }}</span>
                <span class="font-bold text-slate-800 tracking-wider">{{ regulatoryData.bank_account.account_number }}</span>
              </div>
              <div v-if="regulatoryData.bank_account.bank_code" class="flex justify-between items-center text-slate-400 text-[10px] pt-1 border-t border-slate-200/60">
                <span>{{ languageStore.isEn() ? 'Bank Code:' : 'Code Banque :' }} {{ regulatoryData.bank_account.bank_code }}</span>
                <span>{{ languageStore.isEn() ? 'Branch:' : 'Guichet :' }} {{ regulatoryData.bank_account.branch_code }}</span>
                <span>{{ languageStore.isEn() ? 'Key:' : 'Clé :' }} {{ regulatoryData.bank_account.rib_key }}</span>
              </div>
            </div>

            <p v-if="regulatoryData.bank_account.status === 'validated'" class="text-[10px] text-emerald-700 font-bold bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-100/80">
              ✓ {{ languageStore.isEn() ? 'This account is registered and verified for your withdrawals and redemptions.' : 'Ce compte est enregistré et certifié pour vos virements sortants et demandes de rachat.' }}
            </p>

            <div v-else-if="regulatoryData.bank_account.status === 'rejected'" class="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[10px] text-rose-800 font-medium">
              <strong>{{ languageStore.isEn() ? 'Rejection reason:' : 'Motif du refus :' }}</strong> {{ regulatoryData.bank_account.rejection_reason || (languageStore.isEn() ? 'Document or data non-compliant.' : 'Document ou informations non conformes.') }}
            </div>
          </div>

          <!-- Si aucune coordonnée bancaire -->
          <div v-else class="text-center py-4 space-y-3">
            <div class="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <Landmark class="w-6 h-6" />
            </div>
            <div class="space-y-1">
              <h4 class="font-bold text-slate-700 text-sm">{{ languageStore.t('profile_bank_none_title') }}</h4>
              <p class="text-slate-400 text-xs px-4">
                {{ languageStore.t('profile_bank_none_desc') }}
              </p>
            </div>
            <button 
              type="button" 
              @click="openBankModal" 
              class="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              {{ languageStore.t('profile_bank_add_btn') }}
            </button>
          </div>
        </div>
      </div>

      <!-- PIÈCE D'IDENTIFICATION (KYC) -->
      <div v-if="!isEditing" class="space-y-4">
        <div class="flex items-center justify-between ml-1">
          <h3 class="text-slate-400 text-xs font-black uppercase tracking-widest">{{ languageStore.t('profile_id_doc') }}</h3>
          <span 
            v-if="authStore.user?.is_id_expired" 
            class="text-[10px] text-rose-600 font-black uppercase tracking-wider bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full"
          >
            {{ languageStore.t('profile_id_expired') }}
          </span>
          <span 
            v-else-if="authStore.user?.is_id_expiring_soon" 
            class="text-[10px] text-amber-700 font-black uppercase tracking-wider bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full"
          >
            {{ languageStore.t('profile_id_expiring_soon') }}
          </span>
          <span 
            v-else-if="authStore.user?.expiration_piece || authStore.user?.effective_expiration_piece" 
            class="text-[10px] text-emerald-700 font-black uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full"
          >
            {{ languageStore.t('profile_id_valid') }}
          </span>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-4 space-y-4 shadow-sm">
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">{{ languageStore.t('profile_id_type_label') }}</label>
              <div class="bg-slate-50 rounded-2xl py-3 px-4 font-bold text-sm text-slate-700 border border-slate-50">
                {{ authStore.user?.type_piece || languageStore.t('profile_id_not_set') }}
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">{{ languageStore.t('profile_id_doc_num') }}</label>
              <div class="bg-slate-50 rounded-2xl py-3 px-4 font-bold text-sm text-slate-700 border border-slate-50 truncate">
                {{ authStore.user?.num_piece || languageStore.t('profile_id_not_set') }}
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 items-end">
            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">{{ languageStore.t('profile_id_expiration_date') }}</label>
              <div 
                class="bg-slate-50 rounded-2xl py-3 px-4 font-bold text-sm border flex items-center justify-between"
                :class="authStore.user?.is_id_expired ? 'text-rose-600 border-rose-100' : (authStore.user?.is_id_expiring_soon ? 'text-amber-700 border-amber-100' : 'text-slate-700 border-slate-50')"
              >
                <span>{{ formattedExpirationDate }}</span>
              </div>
            </div>

            <div>
              <button 
                type="button" 
                @click="showRenewModal = true"
                class="w-full py-3 px-3 rounded-2xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                :class="authStore.user?.is_id_expired ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-slate-900 text-white'"
              >
                <FileText class="w-3.5 h-3.5" />
                <span>{{ authStore.user?.is_id_expired ? languageStore.t('profile_id_renew_btn') : languageStore.t('profile_id_update_btn') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- SÉCURITÉ DU COMPTE & MFA -->
      <div v-if="!isEditing" class="space-y-4">
        <div class="flex items-center justify-between ml-1">
          <h3 class="text-slate-400 text-xs font-black uppercase tracking-widest">{{ languageStore.t('profile_security_title') }}</h3>
          <span 
            v-if="authStore.user?.mfa_type && authStore.user?.mfa_type !== 'none'"
            class="text-[10px] text-emerald-700 font-black uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full"
          >
            {{ languageStore.t('profile_mfa_active') }}
          </span>
          <span 
            v-else 
            class="text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-100 px-2.5 py-0.5 rounded-full"
          >
            {{ languageStore.t('profile_mfa_disabled') }}
          </span>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div 
                :class="authStore.user?.mfa_type && authStore.user?.mfa_type !== 'none' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'"
                class="w-10 h-10 rounded-2xl flex items-center justify-center"
              >
                <ShieldCheck v-if="authStore.user?.mfa_type && authStore.user?.mfa_type !== 'none'" class="w-5 h-5" />
                <ShieldOff v-else class="w-5 h-5" />
              </div>
              <div>
                <h4 class="font-bold text-slate-700 text-sm">{{ languageStore.t('profile_mfa_title') }}</h4>
                <p class="text-slate-400 text-[10px]">
                  {{ authStore.user?.mfa_type === 'totp' ? languageStore.t('profile_mfa_desc_totp') : (authStore.user?.mfa_type === 'email' ? languageStore.t('profile_mfa_desc_email') : languageStore.t('profile_mfa_desc_none')) }}
                </p>
              </div>
            </div>
            <button 
              type="button" 
              @click="showMfaModal = true" 
              class="px-3 py-1.5 rounded-xl border border-primary/20 text-primary font-black text-xs hover:bg-primary hover:text-white transition-all active:scale-95"
            >
              {{ languageStore.t('manage') }}
            </button>
          </div>

          <div class="pt-3 border-t border-slate-100">
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">{{ languageStore.t('profile_change_pwd') }}</p>
            <div class="space-y-3">
              <input v-model="passwordForm.current_password" type="password" :placeholder="languageStore.t('profile_current_pwd')" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-2.5 px-4 font-bold text-xs focus:bg-white focus:border-primary transition-all">
              <input v-model="passwordForm.new_password" type="password" minlength="12" :placeholder="languageStore.t('profile_new_pwd')" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-2.5 px-4 font-bold text-xs focus:bg-white focus:border-primary transition-all">
              <button 
                type="button" 
                @click="handleUpdatePassword" 
                :disabled="passwordLoading || !passwordForm.current_password || passwordForm.new_password.length < 12"
                class="w-full bg-slate-900 text-white font-black py-3 rounded-2xl text-xs active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 transition-all flex items-center justify-center gap-2"
              >
                <Loader2 v-if="passwordLoading" class="w-3.5 h-3.5 animate-spin" />
                {{ languageStore.t('profile_change_pwd_btn') }}
              </button>
              <p v-if="passwordMessage.text" :class="passwordMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-500'" class="text-[10px] font-bold text-center">
                {{ passwordMessage.text }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- LANGUE DE L'APPLICATION -->
      <div v-if="!isEditing" class="space-y-4">
        <div class="flex items-center justify-between ml-1">
          <h3 class="text-slate-400 text-xs font-black uppercase tracking-widest">{{ languageStore.t('language') }}</h3>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500">
              <Globe class="w-5 h-5" />
            </div>
            <div>
              <h4 class="font-bold text-slate-700 text-sm">{{ languageStore.t('app_language') }}</h4>
              <p class="text-slate-400 text-[10px]">{{ languageStore.t('select_language') }}</p>
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
          {{ languageStore.t('profile_save_btn') }}
        </button>

        <button 
          @click="handleLogout"
          v-if="!isEditing"
          class="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 border border-rose-100 active:scale-95"
        >
          <LogOut class="w-5 h-5" />
          {{ languageStore.t('logout') }}
        </button>
      </div>

      <p class="text-center text-slate-300 text-[10px] font-black uppercase tracking-widest pt-4">{{ languageStore.isEn() ? '© 2026 PEK - All rights reserved' : '© 2026 PEK - Tous droits réservés' }}</p>
    </div>

    <!-- MODAL NATURE & CATÉGORIE DU CLIENT -->
    <Teleport to="body">
      <div v-if="showProfileCategoryModal" class="fixed inset-0 z-[10000] flex items-end justify-center p-6 sm:items-center">
        <div @click="showProfileCategoryModal = false" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"></div>
        
        <div class="relative w-full max-w-sm bg-white rounded-[36px] p-7 shadow-2xl border border-slate-100/50 z-10 animate-in slide-in-from-bottom duration-300 space-y-5">
          <button 
            type="button" 
            @click="showProfileCategoryModal = false" 
            class="absolute right-5 top-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            :aria-label="languageStore.isEn() ? 'Close' : 'Fermer'"
          >
            <X class="w-4 h-4" />
          </button>

          <div class="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
            <UserCheck class="w-7 h-7" />
          </div>
          
          <div class="text-center space-y-1">
            <h3 class="text-lg font-black text-slate-900">{{ languageStore.isEn() ? 'Client Nature & Category' : 'Nature & Catégorie Client' }}</h3>
            <p class="text-slate-500 font-bold text-xs leading-relaxed">
              {{ languageStore.isEn() ? 'This information is mandatory under COSUMAF regulations.' : 'Ces informations sont obligatoires selon la réglementation COSUMAF.' }}
            </p>
          </div>

          <div class="space-y-4 text-left">
            <!-- Choix de la Nature -->
            <div>
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">{{ languageStore.isEn() ? 'Client Nature *' : 'Nature du client *' }}</label>
              <div class="relative">
                <select 
                  v-model="selectedNature" 
                  @change="onNatureChange"
                  class="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-900 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="Personne Physique">{{ languageStore.isEn() ? 'Natural Person' : 'Personne Physique' }}</option>
                  <option value="Personne Morale">{{ languageStore.isEn() ? 'Corporate Entity' : 'Personne Morale' }}</option>
                </select>
                <ChevronDown class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <!-- Choix de la Catégorie -->
            <div>
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">{{ languageStore.isEn() ? 'Regulatory category *' : 'Catégorie réglementaire *' }}</label>
              <div class="relative">
                <select 
                  v-model="selectedCategory" 
                  class="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-900 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                >
                  <option v-for="cat in currentNatureCategories" :key="cat" :value="cat">{{ formatCategory(cat) }}</option>
                </select>
                <ChevronDown class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <!-- Avertissement validation Kori -->
          <div class="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[10px] text-amber-900 font-semibold leading-relaxed flex items-start gap-2">
            <ShieldAlert class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span v-if="languageStore.isEn()">
              Any modification will be <strong>verified and approved by the Kori Asset Management compliance team</strong> before becoming active on your profile.
            </span>
            <span v-else>
              Toute modification sera <strong>vérifiée et validée par l'équipe de conformité Kori Asset Management</strong> avant d'être active sur votre profil.
            </span>
          </div>

          <div class="space-y-2">
            <button 
              type="button"
              @click="submitCategoryRequest" 
              :disabled="savingCategoryRequest"
              class="w-full bg-primary hover:bg-slate-800 text-white font-black py-4 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Loader2 v-if="savingCategoryRequest" class="w-4 h-4 animate-spin" />
              <span>{{ languageStore.isEn() ? 'Submit for Kori validation' : 'Soumettre pour validation Kori' }}</span>
            </button>
            <button 
              type="button" 
              @click="showProfileCategoryModal = false" 
              class="w-full py-2 text-slate-400 font-bold text-xs hover:text-slate-600 transition-colors cursor-pointer"
            >
              {{ languageStore.isEn() ? 'Cancel' : 'Annuler' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- MODAL COORDONNÉES BANCAIRES (RIB) -->
    <Teleport to="body">
      <div v-if="showBankModal" class="fixed inset-0 z-[10000] flex items-end justify-center p-6 sm:items-center">
        <div @click="showBankModal = false" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"></div>
        
        <div class="relative w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white rounded-[36px] p-6 shadow-2xl border border-slate-100/50 z-10 animate-in slide-in-from-bottom duration-300 space-y-4">
          <button 
            type="button" 
            @click="showBankModal = false" 
            class="absolute right-4 top-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            :aria-label="languageStore.isEn() ? 'Close' : 'Fermer'"
          >
            <X class="w-4 h-4" />
          </button>

          <div class="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
            <Landmark class="w-7 h-7" />
          </div>
          
          <div class="text-center space-y-1">
            <h3 class="text-lg font-black text-slate-900">{{ languageStore.isEn() ? 'Bank Details' : 'Coordonnées Bancaires' }}</h3>
            <p class="text-slate-500 font-bold text-xs leading-relaxed">
              {{ languageStore.isEn() ? 'To receive your refunds, redemptions and dividends by bank transfer.' : 'Pour recevoir vos remboursements, rachats et dividendes par virement bancaire.' }}
            </p>
          </div>

          <div class="space-y-3 text-left">
            <!-- Banque -->
            <div class="space-y-1">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">{{ languageStore.isEn() ? 'Banking Institution *' : 'Établissement bancaire *' }}</label>
              <div class="relative">
                <select 
                  v-model="bankForm.selected_bank" 
                  @change="onBankSelectChange"
                  class="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-3.5 text-xs font-bold text-slate-900 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                >
                  <option v-for="b in popularBanks" :key="b" :value="b">{{ b === 'Autre établissement bancaire...' ? (languageStore.isEn() ? 'Other banking institution...' : 'Autre établissement bancaire...') : b }}</option>
                </select>
                <ChevronDown class="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <input 
                v-if="isCustomBank" 
                v-model="bankForm.custom_bank_name" 
                type="text" 
                :placeholder="languageStore.isEn() ? 'Specify your bank name' : 'Précisez le nom de votre banque'" 
                class="mt-2 w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 px-3.5 text-xs font-bold text-slate-900 focus:border-primary outline-none transition-all"
              />
              <p v-if="bankValidationErrors.bank_name" class="text-rose-500 text-[10px] font-semibold mt-1">
                {{ bankValidationErrors.bank_name[0] }}
              </p>
            </div>

            <!-- Titulaire -->
            <div class="space-y-1">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">{{ languageStore.isEn() ? 'Account Holder *' : 'Titulaire du compte *' }}</label>
              <input 
                v-model="bankForm.account_holder_name" 
                type="text" 
                :placeholder="languageStore.isEn() ? 'Full name of account holder' : 'Nom et prénom du titulaire'" 
                class="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-3.5 text-xs font-bold text-slate-900 focus:border-primary outline-none transition-all"
              />
              <p v-if="bankValidationErrors.account_holder_name" class="text-rose-500 text-[10px] font-semibold mt-1">
                {{ bankValidationErrors.account_holder_name[0] }}
              </p>
            </div>

            <!-- N° Compte ou RIB -->
            <div class="space-y-1">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">{{ languageStore.isEn() ? 'Account Number / RIB *' : 'Numéro de compte / RIB *' }}</label>
              <input 
                v-model="bankForm.account_number" 
                type="text" 
                placeholder="Ex: 10005 00001 01234567890 12" 
                class="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-3.5 text-xs font-bold text-slate-900 font-mono focus:border-primary outline-none transition-all"
              />
              <p v-if="bankValidationErrors.account_number" class="text-rose-500 text-[10px] font-semibold mt-1">
                {{ bankValidationErrors.account_number[0] }}
              </p>
            </div>

            <!-- Détails CEMAC optionnels (Banque, Guichet, Clé) -->
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="text-[9px] font-black text-slate-400 uppercase pl-1 block">{{ languageStore.isEn() ? 'Bank Code (5)' : 'Code Bq (5ch)' }}</label>
                <input v-model="bankForm.bank_code" maxlength="10" placeholder="10005" class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2 text-center text-xs font-bold font-mono">
              </div>
              <div>
                <label class="text-[9px] font-black text-slate-400 uppercase pl-1 block">{{ languageStore.isEn() ? 'Branch (5)' : 'Guichet (5ch)' }}</label>
                <input v-model="bankForm.branch_code" maxlength="10" placeholder="00001" class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2 text-center text-xs font-bold font-mono">
              </div>
              <div>
                <label class="text-[9px] font-black text-slate-400 uppercase pl-1 block">{{ languageStore.isEn() ? 'Key (2)' : 'Clé (2ch)' }}</label>
                <input v-model="bankForm.rib_key" maxlength="5" placeholder="89" class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2 text-center text-xs font-bold font-mono">
              </div>
            </div>

            <!-- Justificatif de RIB -->
            <div class="space-y-1 pt-1">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">{{ languageStore.isEn() ? 'Official Bank Statement / RIB (PDF or Image)' : 'Justificatif officiel de RIB (PDF ou Photo)' }}</label>
              <label class="border-2 border-dashed border-slate-200 hover:border-primary/50 bg-slate-50/50 rounded-2xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all">
                <UploadCloud class="w-6 h-6 text-slate-400 mb-1" />
                <span class="text-xs font-bold text-slate-600 truncate max-w-[200px]">
                  {{ ribFileName || (languageStore.isEn() ? 'Upload document (RIB)' : 'Téléverser le document (RIB)') }}
                </span>
                <span class="text-[9px] text-slate-400 font-medium">{{ languageStore.isEn() ? 'PDF, JPG, PNG (Max 5 MB)' : 'PDF, JPG, PNG (Max 5 Mo)' }}</span>
                <input type="file" accept=".pdf,image/*" @change="onRibFileSelected" class="hidden">
              </label>
              <p v-if="bankValidationErrors.rib_document" class="text-rose-500 text-[10px] font-semibold mt-1">
                {{ bankValidationErrors.rib_document[0] }}
              </p>
            </div>
          </div>

          <!-- Avertissement conformité -->
          <div class="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[10px] text-amber-900 font-semibold leading-relaxed flex items-start gap-2">
            <ShieldAlert class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span v-if="languageStore.isEn()">
              Bank details will be <strong>verified and approved by the Kori compliance team</strong> to secure your future transfers.
            </span>
            <span v-else>
              Les informations bancaires seront <strong>validées par l'équipe de conformité Kori</strong> pour sécuriser vos futurs virements.
            </span>
          </div>

          <div class="space-y-2">
            <button 
              type="button"
              @click="submitBankRequest" 
              :disabled="submittingBank || (!bankForm.account_number || (!isCustomBank && !bankForm.selected_bank))"
              class="w-full bg-primary hover:bg-slate-800 text-white font-black py-4 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Loader2 v-if="submittingBank" class="w-4 h-4 animate-spin" />
              <span>{{ languageStore.isEn() ? 'Save and Submit to Kori' : 'Enregistrer et Soumettre à Kori' }}</span>
            </button>
            <button 
              type="button" 
              @click="showBankModal = false" 
              class="w-full py-2 text-slate-400 font-bold text-xs hover:text-slate-600 transition-colors cursor-pointer"
            >
              {{ languageStore.isEn() ? 'Cancel' : 'Annuler' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal Renouvellement Pièce d'Identité -->
    <RenewIdentityModal v-model="showRenewModal" @renewed="onIdRenewed" />

    <!-- Modal Configuration MFA -->
    <MfaConfigModal v-model="showMfaModal" />
  </div>
</template>
