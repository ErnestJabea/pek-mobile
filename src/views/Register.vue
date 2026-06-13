<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ChevronLeft, User, Mail, Phone, Lock, ArrowRight, ShieldCheck, MapPin, Globe, Loader2 } from 'lucide-vue-next'
import api from '../api/api'
import { countries } from '../data/countries'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const step = ref(1)
const loading = ref(false)
const error = ref('')
const validationErrors = ref({})
const showCountryList = ref(false)

const clearError = (field) => {
  if (validationErrors.value[field]) {
    delete validationErrors.value[field]
  }
}

onMounted(() => {
  if (route.query.email && route.query.step === '2') {
    form.value.email = route.query.email
    step.value = 2
  }
})

const form = ref({
  first_name: '',
  last_name: '',
  email: '',
  phone_prefix: '+237',
  phone: '',
  city: '',
  country: '',
  employer: '',
  password: '',
  otp: ''
})

const cities = ref([])
const loadingCities = ref(false)

const handleCountryChange = async () => {
  clearError('country')
  form.value.city = ''
  cities.value = []
  
  if (!form.value.country) return
  
  const countryObj = countries.find(c => c.name === form.value.country)
  const englishName = countryObj ? countryObj.english : form.value.country
  
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
    if (response.data.otp_debug) {
      console.log('DEBUG NEW OTP:', response.data.otp_debug)
    }
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
    if (!form.value.password || form.value.password.trim() === '') {
      validationErrors.value.password = ['Le mot de passe est obligatoire.']
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
      step.value = 2
      if (response.data.otp_debug) {
        console.log('DEBUG OTP:', response.data.otp_debug)
      }
    } else {
      const response = await api.post('/verify-otp', {
        email: form.value.email,
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
  <div class="px-6 py-12 flex flex-col justify-center min-h-[80vh] space-y-8">
    <div class="space-y-2">
      <h2 class="text-3xl font-bold text-slate-900">{{ step === 1 ? 'Créer un compte' : 'Vérification' }}</h2>
      <p class="text-slate-500">
        {{ step === 1 ? 'Rejoignez des milliers d\'investisseurs dès aujourd\'hui.' : 'Entrez le code à 6 chiffres envoyé à ' + form.email }}
      </p>
    </div>

    <form @submit.prevent="handleNext" class="space-y-6">
      <div v-if="error" class="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium">
        {{ error }}
      </div>

      <div v-if="step === 1" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-700 ml-1">Prénom</label>
            <input v-model="form.first_name" @blur="clearError('first_name')" @input="clearError('first_name')" type="text" placeholder="Jean" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-4 focus:bg-white focus:border-primary transition-all" required :aria-invalid="validationErrors.first_name ? 'true' : 'false'" :aria-describedby="validationErrors.first_name ? 'first_name-error' : null">
            <p v-if="validationErrors.first_name" id="first_name-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.first_name[0] }}
            </p>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-700 ml-1">Nom</label>
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

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2 text-left">
            <label class="text-sm font-bold text-slate-700 ml-1">Pays de résidence</label>
            <div class="relative">
              <Globe class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select v-model="form.country" @change="handleCountryChange" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all appearance-none" required :aria-invalid="validationErrors.country ? 'true' : 'false'" :aria-describedby="validationErrors.country ? 'country-error' : null">
                <option value="" disabled>Sélectionner</option>
                <option v-for="c in countries.slice().sort((a, b) => a.name.localeCompare(b.name))" :key="c.code" :value="c.name">{{ c.name }}</option>
              </select>
            </div>
            <p v-if="validationErrors.country" id="country-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.country[0] }}
            </p>
          </div>
          <div class="space-y-2 text-left">
            <label class="text-sm font-bold text-slate-700 ml-1">Ville</label>
            <div class="relative">
              <MapPin class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select v-model="form.city" @change="clearError('city')" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all appearance-none disabled:opacity-50" :disabled="!form.country || loadingCities" required :aria-invalid="validationErrors.city ? 'true' : 'false'" :aria-describedby="validationErrors.city ? 'city-error' : null">
                <option value="" disabled>{{ loadingCities ? 'Chargement...' : 'Ville' }}</option>
                <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
              </select>
            </div>
            <p v-if="validationErrors.city" id="city-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.city[0] }}
            </p>
          </div>
        </div>

        <div class="space-y-2 text-left">
          <label class="text-sm font-bold text-slate-700 ml-1">Employeur (Optionnel)</label>
          <div class="relative">
            <User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input v-model="form.employer" @blur="clearError('employer')" @input="clearError('employer')" type="text" placeholder="Entreprise / Auto-entrepreneur" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all" :aria-invalid="validationErrors.employer ? 'true' : 'false'" :aria-describedby="validationErrors.employer ? 'employer-error' : null">
          </div>
          <p v-if="validationErrors.employer" id="employer-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.employer[0] }}
          </p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">Téléphone</label>
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
          <label class="text-sm font-bold text-slate-700 ml-1">Mot de passe</label>
          <div class="relative">
            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input v-model="form.password" @blur="clearError('password')" @input="clearError('password')" type="password" placeholder="••••••••" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all" required :aria-invalid="validationErrors.password ? 'true' : 'false'" :aria-describedby="validationErrors.password ? 'password-error' : null">
          </div>
          <p v-if="validationErrors.password" id="password-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.password[0] }}
          </p>
        </div>
      </div>

      <div v-else class="space-y-6">
        <div class="space-y-2 text-center">
            <label class="text-sm font-bold text-slate-700">Code de vérification</label>
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
            Renvoyer le code
          </button>
        </div>
      </div>

      <button 
        type="submit"
        :disabled="loading"
        class="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-slate-800 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
      >
        <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
        <template v-else>
          {{ step === 1 ? 'Suivant' : 'Vérifier et S\'inscrire' }}
          <ArrowRight class="w-5 h-5" />
        </template>
      </button>
    </form>

    <p class="text-center text-sm text-slate-500">
      Déjà un compte ? 
      <router-link to="/login" class="text-primary font-bold hover:underline">Se connecter</router-link>
    </p>
  </div>
</template>
