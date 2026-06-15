<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { User, Mail, Phone, MapPin, Globe, LogOut, ChevronRight, ShieldCheck, Bell, CreditCard, Edit3, Save, X, Loader2, Building2, Lock, Eye, EyeOff } from 'lucide-vue-next'
import api from '../api/api'
import { countries } from '../data/countries'

const router = useRouter()
const authStore = useAuthStore()
const isEditing = ref(false)
const loading = ref(false)
const message = ref({ type: '', text: '' })
const validationErrors = ref({})

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

const cities = ref([])
const loadingCities = ref(false)

const fetchCitiesOfCountry = async (countryName) => {
  if (!countryName) {
    cities.value = []
    return
  }
  const countryObj = countries.find(c => c.name === countryName)
  const englishName = countryObj ? countryObj.english : countryName
  
  loadingCities.value = true
  try {
    const response = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ country: englishName })
    })
    const data = await response.json()
    if (data && !data.error && Array.isArray(data.data)) {
      cities.value = data.data.sort((a, b) => a.localeCompare(b))
    } else {
      cities.value = []
    }
  } catch (error) {
    console.error('Error fetching cities:', error)
    cities.value = []
  } finally {
    loadingCities.value = false
  }
}

const handleCountryChange = async () => {
  editForm.value.city = ''
  cities.value = []
  await fetchCitiesOfCountry(editForm.value.country)
}

const syncForm = () => {
  editForm.value = {
    first_name: authStore.user.first_name || '',
    last_name: authStore.user.last_name || '',
    email: authStore.user.email || '',
    phone: authStore.user.phone || '',
    city: authStore.user.city || '',
    country: authStore.user.country || '',
    employer: authStore.user.employer || ''
  }
}

watch(() => authStore.user, (newUser) => {
  if (newUser) {
    syncForm()
    fetchCitiesOfCountry(newUser.country)
  }
}, { immediate: true })

onMounted(() => {
  if (authStore.user) {
    syncForm()
    fetchCitiesOfCountry(authStore.user.country)
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
            @click="toggleEdit"
            class="absolute -bottom-2 -right-12 h-10 px-4 bg-white rounded-full shadow-lg flex items-center gap-2 text-primary border-4 border-primary hover:scale-105 active:scale-95 transition-all z-20"
          >
            <component :is="isEditing ? X : Edit3" class="w-4 h-4" />
            <span class="text-xs font-black uppercase">{{ isEditing ? 'Annuler' : 'Modifier' }}</span>
          </button>
        </div>
        <h2 class="text-white text-2xl font-bold">{{ authStore.user?.first_name }} {{ authStore.user?.last_name }}</h2>
        <p class="text-white/60 text-sm font-medium mb-6">Membre Premium</p>

        <button 
          v-if="!isEditing"
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
          <div class="text-slate-700 font-bold">Mai 2026</div>
        </div>
        <div class="flex-1 text-center px-2">
          <div class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Status</div>
          <div class="flex items-center justify-center gap-1 text-emerald-500 font-bold">
            <ShieldCheck class="w-4 h-4" />
            Vérifié
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
              <select v-model="editForm.country" @change="handleCountryChange" :disabled="!isEditing" :class="isEditing ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-500'" class="w-full border-2 rounded-2xl py-3 px-4 font-bold text-sm transition-all appearance-none" :aria-invalid="validationErrors.country ? 'true' : 'false'" :aria-describedby="validationErrors.country ? 'country-error' : null">
                <option v-for="c in countries.slice().sort((a, b) => a.name.localeCompare(b.name))" :key="c.code" :value="c.name">{{ c.name }}</option>
              </select>
              <p v-if="validationErrors.country" id="country-error" role="alert" class="text-rose-500 text-[10px] mt-1 ml-1 font-semibold">
                {{ validationErrors.country[0] }}
              </p>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-slate-400 font-black uppercase ml-1">Ville</label>
              <select v-model="editForm.city" :disabled="!isEditing || loadingCities" :class="isEditing ? 'bg-white border-primary/20 text-slate-700' : 'bg-slate-50 border-slate-50 text-slate-500'" class="w-full border-2 rounded-2xl py-3 px-4 font-bold text-sm transition-all appearance-none" :aria-invalid="validationErrors.city ? 'true' : 'false'" :aria-describedby="validationErrors.city ? 'city-error' : null">
                <option value="" disabled>{{ loadingCities ? 'Chargement...' : 'Ville de résidence' }}</option>
                <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
              </select>
              <p v-if="validationErrors.city" id="city-error" role="alert" class="text-rose-500 text-[10px] mt-1 ml-1 font-semibold">
                {{ validationErrors.city[0] }}
              </p>
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
                <input v-model="passwordForm.new_password" :type="showNewPassword ? 'text' : 'password'" placeholder="Min. 8 caractères" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3 pl-4 pr-12 font-bold text-sm focus:bg-white focus:border-primary transition-all" :aria-invalid="passwordValidationErrors.new_password ? 'true' : 'false'" :aria-describedby="passwordValidationErrors.new_password ? 'new_password-error' : null">
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
              :disabled="passwordLoading || !passwordForm.current_password || passwordForm.new_password.length < 8"
              class="w-full bg-slate-950 text-white font-black py-4 rounded-2xl text-xs flex items-center justify-center gap-2 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:active:scale-100 transition-all"
            >
              <Loader2 v-if="passwordLoading" class="w-4 h-4 animate-spin" />
              Changer le mot de passe
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

      <p class="text-center text-slate-300 text-[10px] font-black uppercase tracking-widest pt-4">© 2026 PEK - Sécurisé par Sanctum</p>
    </div>
  </div>
</template>
