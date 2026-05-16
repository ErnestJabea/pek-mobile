<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ChevronLeft, User, Mail, Phone, Lock, ArrowRight, ShieldCheck, MapPin, Globe, Loader2 } from 'lucide-vue-next'
import api from '../api/api'
import { countries } from '../data/countries'
import { locations } from '../data/locations'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const step = ref(1)
const loading = ref(false)
const error = ref('')
const showCountryList = ref(false)

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
    error.value = err.response?.data?.message || 'Une erreur est survenue'
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
            <input v-model="form.first_name" type="text" placeholder="Jean" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-4 focus:bg-white focus:border-primary transition-all" required>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-700 ml-1">Nom</label>
            <input v-model="form.last_name" type="text" placeholder="Dupont" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-4 focus:bg-white focus:border-primary transition-all" required>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">Email</label>
          <div class="relative">
            <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input v-model="form.email" type="email" placeholder="votre@email.com" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all" required>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2 text-left">
            <label class="text-sm font-bold text-slate-700 ml-1">Pays de résidence</label>
            <div class="relative">
              <Globe class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select v-model="form.country" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all appearance-none" required>
                <option value="" disabled>Sélectionner</option>
                <option v-for="(loc, code) in locations" :key="code" :value="loc.name">{{ loc.name }}</option>
              </select>
            </div>
          </div>
          <div class="space-y-2 text-left">
            <label class="text-sm font-bold text-slate-700 ml-1">Ville</label>
            <div class="relative">
              <MapPin class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select v-model="form.city" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all appearance-none disabled:opacity-50" :disabled="!form.country" required>
                <option value="" disabled>Ville</option>
                <template v-if="form.country">
                  <option v-for="city in Object.values(locations).find(l => l.name === form.country)?.cities" :key="city" :value="city">{{ city }}</option>
                </template>
              </select>
            </div>
          </div>
        </div>

        <div class="space-y-2 text-left">
          <label class="text-sm font-bold text-slate-700 ml-1">Employeur (Optionnel)</label>
          <div class="relative">
            <User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input v-model="form.employer" type="text" placeholder="Entreprise / Auto-entrepreneur" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all">
          </div>
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
                @input="handlePhoneInput"
                type="tel" 
                :placeholder="countries.find(c => c.dial_code === form.phone_prefix)?.mask?.replace(/9/g, '0') || '000 000 000'" 
                class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all font-mono" 
              >
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 ml-1">Mot de passe</label>
          <div class="relative">
            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input v-model="form.password" type="password" placeholder="••••••••" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-primary transition-all" required>
          </div>
        </div>
      </div>

      <div v-else class="space-y-6">
        <div class="space-y-2 text-center">
            <label class="text-sm font-bold text-slate-700">Code de vérification</label>
            <input v-model="form.otp" type="text" maxlength="6" placeholder="000000" class="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-4 text-center text-2xl font-bold tracking-[1em] focus:bg-white focus:border-primary transition-all" required>
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
