<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, User, ShieldCheck, HelpCircle, FileText, CheckCircle2, AlertCircle, PenTool, WifiOff, RefreshCw, Loader2, ArrowRight } from 'lucide-vue-next'
import api from '../api/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const currentStep = ref('kyc') // kyc, risk, labft, signature, completed
const loading = ref(true)
const submitting = ref(false)
const offlineMode = ref(false)
const syncError = ref(null)
const signatureError = ref(null)
const validationErrors = ref({})
const clearError = (field) => {
  if (validationErrors.value[field]) {
    delete validationErrors.value[field]
  }
}

// Error modal state
const showErrorModal = ref(false)
const modalErrorTitle = ref('Attention')
const modalErrorMessage = ref('')

const triggerError = (title, message) => {
  modalErrorTitle.value = title
  modalErrorMessage.value = message
  showErrorModal.value = true
}

// Signature canvas refs
const canvasRef = ref(null)
const isDrawing = ref(false)
const hasSigned = ref(false)
const signatureConfirmed = ref(false)

// Nationality selection refs & handlers
const selectedNationality = ref('Camerounaise')
const otherNationality = ref('')

const onNationalityChange = () => {
  if (selectedNationality.value !== 'Autre') {
    payload.value.nat = selectedNationality.value
  } else {
    payload.value.nat = otherNationality.value
  }
}

const onOtherNationalityInput = () => {
  payload.value.nat = otherNationality.value
}

// Payload for all onboarding steps
const payload = ref({
  // KYC Step
  civ: 'M.',
  nom: '',
  prenom: '',
  nat: 'Camerounaise',
  dob: '',
  lieu_naiss: '',
  adresse: '',
  tel: '',
  email: '',
  piece: 'CNI',
  num_piece: '',
  profession: '',
  employeur: '',

  // Risk Profiler Step
  tranche_revenus: 'moins_500k',
  epargne_possible: 'Non',
  niveau_risque: 'faible',
  conscience_risque: 'Non',
  objectif_invest: 'securite',
  horizon_terme: 'court_terme',
  niveau_perf: 'faible',
  connaissance_marche: 'faible',
  invest_anterieurs: 'Non',

  // LAB-FT Step
  situation_mat: 'Célibataire',
  pays_residence: 'Cameroun',
  expiration_piece: '',
  agent_kam: '',
  secteur: '',
  revenus_annuels: 'moins_5m',
  src_salaire: false,
  src_pro_liberal: false,
  src_foncier: false,
  src_dividendes: false,
  src_heritage: false,
  src_autre_check: false,
  src_autre: '',
  origine_fonds: '',
  banque: '',
  num_compte: '',
  pays_compte: 'Cameroun',
  pays_risque: 'Non',
  secteur_sensible: 'Non',
  ppe: 'Non',
  ppe_detail: '',
  condamnation: 'Non',
  ack_lecture: false,
  ack_donnees: false
})

// Check offline status
const updateOnlineStatus = () => {
  offlineMode.value = !window.navigator.onLine
}

// Watch fields to save in localStorage (auto-save draft)
watch(payload, (newVal) => {
  localStorage.setItem('pek_onboarding_draft', JSON.stringify(newVal))
}, { deep: true })

// Initialize session state
const initSession = async () => {
  // 1. Try to load local draft
  const draft = localStorage.getItem('pek_onboarding_draft')
  if (draft) {
    try {
      payload.value = { ...payload.value, ...JSON.parse(draft) }
    } catch (e) {
      console.error('Error loading draft', e)
    }
  }

  // Pre-fill user data from auth if fields are empty
  if (authStore.user) {
    if (!payload.value.nom) payload.value.nom = authStore.user.last_name || ''
    if (!payload.value.prenom) payload.value.prenom = authStore.user.first_name || ''
    if (!payload.value.email) payload.value.email = authStore.user.email || ''
    if (!payload.value.tel) payload.value.tel = authStore.user.phone || ''
  }

  // 2. Load from server if online
  if (window.navigator.onLine) {
    try {
      const response = await api.get('/onboarding/status')
      const serverSession = response.data.session
      
      if (serverSession) {
        if (serverSession.status === 'completed') {
          currentStep.value = 'completed'
        } else {
          currentStep.value = serverSession.current_step || 'kyc'
          if (serverSession.payload && Object.keys(serverSession.payload).length > 0) {
            // Merge draft and server session, preferring server values for synced steps
            payload.value = { ...payload.value, ...serverSession.payload }
          }
        }
      }
    } catch (e) {
      console.warn('Could not sync with server onboarding status, continuing with local draft', e)
    }
  }
  // Handle selectedNationality initialization based on payload.nat
  const knownNationalities = [
    'Camerounaise', 'Gabonaise', 'Congolaise', 'Tchadienne', 'Centrafricaine', 
    'Équato-guinéenne', 'Ivoirienne', 'Sénégalaise', 'Béninoise', 'Togolaise', 
    'Malienne', 'Burkinabè', 'Nigériane', 'Française', 'Belge', 'Canadienne', 'Américaine'
  ]
  if (payload.value.nat) {
    if (knownNationalities.includes(payload.value.nat)) {
      selectedNationality.value = payload.value.nat
    } else {
      selectedNationality.value = 'Autre'
      otherNationality.value = payload.value.nat
    }
  } else {
    payload.value.nat = 'Camerounaise'
  }

  loading.value = false
}

// Sync progress to server (fails silently if offline, saving locally only)
const syncWithServer = async (stepName) => {
  if (!window.navigator.onLine) {
    syncError.value = "Sauvegardé localement (Hors-ligne)"
    return true
  }

  try {
    syncError.value = null
    await api.post('/onboarding/save-progress', {
      step: stepName,
      payload: payload.value
    })
    return true
  } catch (e) {
    console.warn('Sync failed', e)
    syncError.value = "Sauvegardé localement (Erreur de synchronisation)"
    return true // Let user proceed anyway for low connection tolerance
  }
}

onMounted(() => {
  updateOnlineStatus()
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  initSession()
})

// Progress step percentages
const progressPercentage = computed(() => {
  switch (currentStep.value) {
    case 'kyc': return 25
    case 'risk': return 50
    case 'labft': return 75
    case 'signature': return 95
    case 'completed': return 100
    default: return 0
  }
})

// Local Client-side Scoring (UX only)
const localScore = computed(() => {
  let score = 0
  
  if (payload.value.tranche_revenus === '500k_1_5m') score += 1
  else if (payload.value.tranche_revenus === 'plus_1_5m') score += 2

  if (payload.value.epargne_possible === 'Oui') score += 2

  if (payload.value.niveau_risque === 'faible') score += 1
  else if (payload.value.niveau_risque === 'moyen') score += 2
  else if (payload.value.niveau_risque === 'max') score += 4

  if (payload.value.conscience_risque === 'Oui') score += 1

  if (payload.value.niveau_risque === 'croissance' || payload.value.objectif_invest === 'croissance') score += 2
  else score += 1

  if (payload.value.horizon_terme === 'court_terme') score += 1
  else if (payload.value.horizon_terme === 'moyen_terme') score += 2
  else if (payload.value.horizon_terme === 'long_terme') score += 3

  if (payload.value.niveau_perf === 'moderee' || payload.value.niveau_perf === '2') score += 2
  else if (payload.value.niveau_perf === 'elevee' || payload.value.niveau_perf === '3') score += 4

  if (payload.value.connaissance_marche === 'excellente') score += 2
  if (payload.value.invest_anterieurs === 'Oui') score += 3

  return score
})

const localProfile = computed(() => {
  const s = localScore.value
  if (s <= 10) return 'Prudent'
  if (s <= 19) return 'Modéré'
  return 'Dynamique'
})

const maxBirthDate = computed(() => {
  const today = new Date()
  const year = today.getFullYear() - 21
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

const minExpirationDate = computed(() => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

// Form Step Navigations
const nextStep = async () => {
  validationErrors.value = {}
  
  if (currentStep.value === 'kyc') {
    if (!payload.value.civ) {
      validationErrors.value.civ = "La civilité est obligatoire."
    }
    if (!payload.value.nom || payload.value.nom.trim() === '') {
      validationErrors.value.nom = "Le nom est obligatoire."
    }
    if (!payload.value.prenom || payload.value.prenom.trim() === '') {
      validationErrors.value.prenom = "Le prénom est obligatoire."
    }
    if (!payload.value.dob) {
      validationErrors.value.dob = "La date de naissance est obligatoire."
    }
    if (!payload.value.lieu_naiss || payload.value.lieu_naiss.trim() === '') {
      validationErrors.value.lieu_naiss = "Le lieu de naissance est obligatoire."
    }
    if (!payload.value.nat) {
      validationErrors.value.nat = "La nationalité est obligatoire."
    }
    if (!payload.value.tel || payload.value.tel.trim() === '') {
      validationErrors.value.tel = "Le numéro de téléphone est obligatoire."
    }
    if (!payload.value.email || payload.value.email.trim() === '') {
      validationErrors.value.email = "L'adresse e-mail est obligatoire."
    }
    if (!payload.value.adresse || payload.value.adresse.trim() === '') {
      validationErrors.value.adresse = "L'adresse de résidence est obligatoire."
    }
    if (!payload.value.piece) {
      validationErrors.value.piece = "Le type de pièce est obligatoire."
    }
    if (!payload.value.num_piece || payload.value.num_piece.trim() === '') {
      validationErrors.value.num_piece = "Le numéro de pièce est obligatoire."
    }
    if (!payload.value.expiration_piece) {
      validationErrors.value.expiration_piece = "La date d'expiration de la pièce est obligatoire."
    } else {
      const expDate = new Date(payload.value.expiration_piece)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (expDate <= today) {
        validationErrors.value.expiration_piece = "La date d'expiration doit être supérieure à la date du jour."
      }
    }

    if (Object.keys(validationErrors.value).length > 0) {
      return
    }

    // Check age >= 21
    const birthDate = new Date(payload.value.dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    if (age < 21) {
      validationErrors.value.dob = "Vous devez être âgé d'au moins 21 ans pour procéder à l'onboarding."
      return
    }

    currentStep.value = 'risk'
    await syncWithServer('risk')
  } 
  else if (currentStep.value === 'risk') {
    currentStep.value = 'labft'
    await syncWithServer('labft')
  } 
  else if (currentStep.value === 'labft') {
    const hasSourceOfRevenue = 
      payload.value.src_salaire ||
      payload.value.src_pro_liberal ||
      payload.value.src_foncier ||
      payload.value.src_dividendes ||
      payload.value.src_heritage ||
      payload.value.src_autre_check

    if (!payload.value.situation_mat) {
      validationErrors.value.situation_mat = "La situation matrimoniale est obligatoire."
    }
    if (!payload.value.pays_residence || payload.value.pays_residence.trim() === '') {
      validationErrors.value.pays_residence = "Le pays de résidence est obligatoire."
    }
    if (!payload.value.secteur || payload.value.secteur.trim() === '') {
      validationErrors.value.secteur = "Le secteur d'activité est obligatoire."
    }
    if (!payload.value.revenus_annuels) {
      validationErrors.value.revenus_annuels = "La tranche de revenus est obligatoire."
    }
    if (!hasSourceOfRevenue) {
      validationErrors.value.sources_revenu = "Veuillez cocher au moins une source de revenus."
    }
    if (!payload.value.origine_fonds || payload.value.origine_fonds.trim() === '') {
      validationErrors.value.origine_fonds = "L'origine des fonds est obligatoire."
    }

    if (Object.keys(validationErrors.value).length > 0) {
      return
    }

    if (!payload.value.ack_lecture || !payload.value.ack_donnees) {
      validationErrors.value.consent = "Vous devez accepter les consentements obligatoires."
      return
    }
    if (payload.value.ppe === 'Oui' && !payload.value.ppe_detail) {
      validationErrors.value.ppe = "Veuillez préciser votre fonction politique."
      return
    }
    currentStep.value = 'signature'
    await syncWithServer('signature')
    setTimeout(initCanvas, 100)
  }
}

const prevStep = () => {
  if (currentStep.value === 'risk') currentStep.value = 'kyc'
  else if (currentStep.value === 'labft') currentStep.value = 'risk'
  else if (currentStep.value === 'signature') currentStep.value = 'labft'
}

// Canvas signature helpers
const initCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  // Set canvas resolution
  canvas.width = canvas.parentElement.clientWidth || 320
  canvas.height = 150
  
  const ctx = canvas.getContext('2d')
  ctx.strokeStyle = '#1a2b44'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  
  // Mouse events
  canvas.addEventListener('mousedown', (e) => {
    isDrawing.value = true
    draw(e.offsetX, e.offsetY)
  })
  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing.value) return
    draw(e.offsetX, e.offsetY)
  })
  window.addEventListener('mouseup', () => {
    isDrawing.value = false
  })

  // Touch events (Mobile)
  canvas.addEventListener('touchstart', (e) => {
    isDrawing.value = true
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    draw(touch.clientX - rect.left, touch.clientY - rect.top)
    // Scroll Lock on touch start
    document.body.style.overflow = 'hidden'
  })

  canvas.addEventListener('touchmove', (e) => {
    if (!isDrawing.value) return
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    draw(touch.clientX - rect.left, touch.clientY - rect.top)
    e.preventDefault()
  })

  canvas.addEventListener('touchend', () => {
    isDrawing.value = false
    // Release scroll lock
    document.body.style.overflow = ''
  })
}

const draw = (x, y) => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  
  if (!hasSigned.value) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    hasSigned.value = true
  } else {
    ctx.lineTo(x, y)
    ctx.stroke()
  }
}

const clearSignature = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  hasSigned.value = false
}

// Final Submit
const submitOnboarding = async () => {
  if (!signatureConfirmed.value) {
    signatureError.value = "Veuillez cocher la case de confirmation légale."
    return
  }

  if (!hasSigned.value) {
    signatureError.value = "Veuillez apposer votre signature pour continuer."
    return
  }

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  
  // Fill background with white (since JPEG doesn't support transparency and defaults to black)
  ctx.save()
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.restore()

  // Compress signature as JPEG with 0.5 quality to save bandwidth (approx 15KB instead of 80KB PNG)
  const signatureData = canvas.toDataURL('image/jpeg', 0.5)

  submitting.value = true
  signatureError.value = null

  try {
    const response = await api.post('/onboarding/finalize', {
      signature: signatureData
    })
    
    // Clear local storage draft
    localStorage.removeItem('pek_onboarding_draft')
    
    // Fetch updated user to refresh authStore (contains updated onboarding status)
    try {
      const userRes = await api.get('/user')
      authStore.setUser(userRes.data)
    } catch (userErr) {
      console.error('Failed to refresh user after onboarding finalization', userErr)
    }
    
    currentStep.value = 'completed'
  } catch (e) {
    console.error('Finalization failed', e)
    if (e.response && e.response.data) {
      if (e.response.data.errors) {
        validationErrors.value = {}
        const errors = e.response.data.errors
        Object.keys(errors).forEach(key => {
          const err = errors[key]
          const errMsg = Array.isArray(err) ? err[0] : err
          validationErrors.value[key] = errMsg
          
          // Map backend validation keys to frontend display keys
          if (key === 'ack_lecture' || key === 'ack_donnees') {
            validationErrors.value.consent = errMsg
          }
          if (key === 'ppe_detail') {
            validationErrors.value.ppe = errMsg
          }
        })
        
        // Redirect user to the step containing errors
        const kycFields = ['civ', 'nom', 'prenom', 'dob', 'lieu_naiss', 'nat', 'tel', 'email', 'adresse', 'piece', 'num_piece', 'expiration_piece']
        const hasKycError = Object.keys(validationErrors.value).some(key => kycFields.includes(key))
        if (hasKycError) {
          currentStep.value = 'kyc'
        } else {
          currentStep.value = 'labft'
        }
        signatureError.value = e.response.data.message || "Erreur de validation. Veuillez vérifier vos données."
      } else {
        // Autre erreur API (ex: 400 "L'onboarding est déjà finalisé.")
        signatureError.value = e.response.data.message || "Une erreur est survenue lors de la validation de votre dossier."
        triggerError("Attention", signatureError.value)
      }
    } else {
      // Erreur réelle de connexion internet (pas de réponse du serveur)
      signatureError.value = "Une erreur est survenue lors de l'envoi de votre dossier. Veuillez vérifier votre connexion internet et réessayer."
      triggerError("Échec de l'envoi", signatureError.value)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="min-h-screen flex flex-col items-center justify-center space-y-4">
    <Loader2 class="w-10 h-10 text-primary animate-spin" />
    <p class="text-slate-400 font-medium">Récupération de votre dossier...</p>
  </div>

  <div v-else class="min-h-screen flex flex-col bg-slate-50">
    <!-- Header -->
    <header class="bg-white px-6 py-6 flex flex-col sticky top-0 z-10 border-b border-slate-100">
      <div class="flex items-center gap-4">
        <button v-if="currentStep !== 'completed'" @click="router.back()" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all">
          <ChevronLeft class="w-6 h-6" />
        </button>
        <div>
          <h2 class="text-xl font-black text-slate-900">Onboarding</h2>
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Plan d'Épargne Kori</p>
        </div>
      </div>
      
      <!-- Progress Bar -->
      <div v-if="currentStep !== 'completed'" class="mt-6 space-y-2">
        <div class="flex justify-between items-center text-xs font-bold text-slate-400">
          <span class="uppercase">Progression</span>
          <span>{{ progressPercentage }}%</span>
        </div>
        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div :style="{ width: progressPercentage + '%' }" class="bg-primary h-full transition-all duration-500"></div>
        </div>
      </div>

      <!-- Low connectivity warning header -->
      <div v-if="offlineMode || syncError" class="mt-3 flex items-center gap-2 bg-amber-50 text-amber-800 p-2.5 rounded-xl border border-amber-200/50 text-[10px] font-bold">
        <WifiOff class="w-3.5 h-3.5 text-amber-600" />
        <span>{{ syncError || "Mode hors-ligne : saisies sécurisées localement." }}</span>
      </div>
    </header>

    <!-- Content Sections -->
    <div class="flex-1 px-6 py-8 pb-36 overflow-y-auto space-y-6">
      
      <!-- STEP 1: KYC FORM -->
      <div v-if="currentStep === 'kyc'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Étape 1 sur 4</span>
          <h3 class="text-xl font-black text-slate-900">Identité & KYC</h3>
          <p class="text-slate-500 text-xs font-medium">Complétez vos informations réglementaires d'identité.</p>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <!-- Civilité -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Civilité *</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.civ = 'M.'; clearError('civ')" :class="payload.civ === 'M.' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Monsieur</button>
              <button type="button" @click="payload.civ = 'Mme'; clearError('civ')" :class="payload.civ === 'Mme' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Madame</button>
            </div>
            <p v-if="validationErrors.civ" id="civ-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.civ }}
            </p>
          </div>

          <!-- Nom et Prénom -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Nom *</label>
              <input v-model="payload.nom" @blur="clearError('nom')" @input="clearError('nom')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.nom ? 'true' : 'false'" :aria-describedby="validationErrors.nom ? 'nom-error' : null">
              <p v-if="validationErrors.nom" id="nom-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.nom }}
              </p>
            </div>
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Prénom *</label>
              <input v-model="payload.prenom" @blur="clearError('prenom')" @input="clearError('prenom')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.prenom ? 'true' : 'false'" :aria-describedby="validationErrors.prenom ? 'prenom-error' : null">
              <p v-if="validationErrors.prenom" id="prenom-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.prenom }}
              </p>
            </div>
          </div>

          <!-- Date de naissance et Lieu -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Date Naissance *</label>
              <input v-model="payload.dob" @blur="clearError('dob')" @change="clearError('dob')" type="date" :max="maxBirthDate" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.dob ? 'true' : 'false'" :aria-describedby="validationErrors.dob ? 'dob-error' : null">
              <p v-if="validationErrors.dob" id="dob-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.dob }}
              </p>
            </div>
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Lieu Naissance *</label>
              <input v-model="payload.lieu_naiss" @blur="clearError('lieu_naiss')" @input="clearError('lieu_naiss')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.lieu_naiss ? 'true' : 'false'" :aria-describedby="validationErrors.lieu_naiss ? 'lieu_naiss-error' : null">
              <p v-if="validationErrors.lieu_naiss" id="lieu_naiss-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.lieu_naiss }}
              </p>
            </div>
          </div>

          <!-- Nationalité & Résidence -->
          <div class="space-y-4 text-left">
            <div class="space-y-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Nationalité *</label>
              <select v-model="selectedNationality" @change="onNationalityChange(); clearError('nat')" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.nat ? 'true' : 'false'" :aria-describedby="validationErrors.nat ? 'nat-error' : null">
                <option value="Camerounaise">Camerounaise</option>
                <option value="Gabonaise">Gabonaise</option>
                <option value="Congolaise">Congolaise</option>
                <option value="Tchadienne">Tchadienne</option>
                <option value="Centrafricaine">Centrafricaine</option>
                <option value="Équato-guinéenne">Équato-guinéenne</option>
                <option value="Ivoirienne">Ivoirienne</option>
                <option value="Sénégalaise">Sénégalaise</option>
                <option value="Béninoise">Béninoise</option>
                <option value="Togolaise">Togolaise</option>
                <option value="Malienne">Malienne</option>
                <option value="Burkinabè">Burkinabè</option>
                <option value="Nigériane">Nigériane</option>
                <option value="Française">Française</option>
                <option value="Belge">Belge</option>
                <option value="Canadienne">Canadienne</option>
                <option value="Américaine">Américaine</option>
                <option value="Autre">Autre (Saisir manuellement)</option>
              </select>
              <p v-if="validationErrors.nat" id="nat-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.nat }}
              </p>
            </div>
            
            <div v-if="selectedNationality === 'Autre'" class="space-y-2 animate-in fade-in duration-300">
              <label class="text-[10px] font-black text-slate-400 uppercase pl-1">Précisez votre nationalité *</label>
              <input v-model="otherNationality" @input="onOtherNationalityInput(); clearError('nat')" type="text" placeholder="Ex: Italienne" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
          </div>

          <!-- Contact (Tel, Email) -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Téléphone *</label>
            <input v-model="payload.tel" @blur="clearError('tel')" @input="clearError('tel')" type="tel" placeholder="Ex: 699009900" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.tel ? 'true' : 'false'" :aria-describedby="validationErrors.tel ? 'tel-error' : null">
            <p v-if="validationErrors.tel" id="tel-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.tel }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">E-mail de contact *</label>
            <input v-model="payload.email" @blur="clearError('email')" @input="clearError('email')" type="email" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.email ? 'true' : 'false'" :aria-describedby="validationErrors.email ? 'email-error' : null">
            <p v-if="validationErrors.email" id="email-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.email }}
            </p>
          </div>

          <!-- Adresse physique -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Adresse de résidence *</label>
            <input v-model="payload.adresse" @blur="clearError('adresse')" @input="clearError('adresse')" type="text" placeholder="Quartier, Ville" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.adresse ? 'true' : 'false'" :aria-describedby="validationErrors.adresse ? 'adresse-error' : null">
            <p v-if="validationErrors.adresse" id="adresse-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.adresse }}
            </p>
          </div>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Documents Officiels</h4>
          
          <!-- Pièce d'identité -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Type de pièce *</label>
            <select v-model="payload.piece" @change="clearError('piece')" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.piece ? 'true' : 'false'" :aria-describedby="validationErrors.piece ? 'piece-error' : null">
              <option value="CNI">Carte Nationale d'Identité (CNI)</option>
              <option value="Passeport">Passeport</option>
              <option value="Carte Résident">Carte de Résident</option>
            </select>
            <p v-if="validationErrors.piece" id="piece-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.piece }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Numéro de pièce *</label>
            <input v-model="payload.num_piece" @blur="clearError('num_piece')" @input="clearError('num_piece')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.num_piece ? 'true' : 'false'" :aria-describedby="validationErrors.num_piece ? 'num_piece-error' : null">
            <p v-if="validationErrors.num_piece" id="num_piece-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.num_piece }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Date d'expiration de la pièce *</label>
            <input v-model="payload.expiration_piece" :min="minExpirationDate" @blur="clearError('expiration_piece')" @change="clearError('expiration_piece')" type="date" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.expiration_piece ? 'true' : 'false'" :aria-describedby="validationErrors.expiration_piece ? 'expiration_piece-error' : null">
            <p v-if="validationErrors.expiration_piece" id="expiration_piece-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.expiration_piece }}
            </p>
          </div>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Profession</h4>
          
          <div class="space-y-4">
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Profession (Optionnel)</label>
              <input v-model="payload.profession" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Employeur (Optionnel)</label>
              <input v-model="payload.employeur" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
          </div>
        </div>
      </div>

      <!-- STEP 2: RISK PROFILER -->
      <div v-else-if="currentStep === 'risk'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Étape 2 sur 4</span>
          <h3 class="text-xl font-black text-slate-900">Profil d'Investissement</h3>
          <p class="text-slate-500 text-xs font-medium">Déterminez vos objectifs et évaluez votre tolérance au risque.</p>
        </div>

        <!-- Dynamic Live Score Card -->
        <div class="bg-primary text-white p-6 rounded-[32px] shadow-xl shadow-primary/20 space-y-3 relative overflow-hidden">
          <div class="relative z-10 flex justify-between items-center">
            <div class="space-y-1">
              <span class="text-white/60 text-[10px] font-black uppercase tracking-widest">Profil Estimé localement</span>
              <h4 class="text-2xl font-black text-white leading-none">{{ localProfile }}</h4>
            </div>
          </div>
          <div class="absolute -right-8 -bottom-8 w-28 h-28 bg-accent/10 rounded-full blur-2xl"></div>
        </div>

        <!-- Questionnaire qBlocks -->
        <div class="space-y-6">
          
          <!-- Q1: Revenus -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">1. Quelle est votre tranche de revenus annuels ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.tranche_revenus = 'moins_500k'" :class="payload.tranche_revenus === 'moins_500k' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Moins de 500 000 FCFA</button>
              <button type="button" @click="payload.tranche_revenus = '500k_1_5m'" :class="payload.tranche_revenus === '500k_1_5m' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">De 500 000 à 1 500 000 FCFA</button>
              <button type="button" @click="payload.tranche_revenus = 'plus_1_5m'" :class="payload.tranche_revenus === 'plus_1_5m' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Plus de 1 500 000 FCFA</button>
            </div>
          </div>

          <!-- Q2: Epargne régulière -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">2. Avez-vous une capacité d'épargne résiduelle régulière ?</h4>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" @click="payload.epargne_possible = 'Oui'" :class="payload.epargne_possible === 'Oui' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Oui</button>
              <button type="button" @click="payload.epargne_possible = 'Non'" :class="payload.epargne_possible === 'Non' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Non</button>
            </div>
          </div>

          <!-- Q3: Niveau de risque accepté -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">3. Quel niveau de risque acceptez-vous sur vos placements ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.niveau_risque = 'faible'" :class="payload.niveau_risque === 'faible' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Faible (préservation prioritaire)</button>
              <button type="button" @click="payload.niveau_risque = 'moyen'" :class="payload.niveau_risque === 'moyen' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Moyen (équilibre rendement/fluctuation)</button>
              <button type="button" @click="payload.niveau_risque = 'max'" :class="payload.niveau_risque === 'max' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Maximum (recherche de croissance à tout prix)</button>
            </div>
          </div>

          <!-- Q4: Conscience risque -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">4. Êtes-vous conscient qu'un rendement potentiel élevé s'accompagne d'un risque élevé de perte en capital ?</h4>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" @click="payload.conscience_risque = 'Oui'" :class="payload.conscience_risque === 'Oui' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Oui</button>
              <button type="button" @click="payload.conscience_risque = 'Non'" :class="payload.conscience_risque === 'Non' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Non</button>
            </div>
          </div>

          <!-- Q5: Objectif investissement -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">5. Quel est votre objectif principal d'investissement ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.objectif_invest = 'securite'" :class="payload.objectif_invest === 'securite' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Sécuriser une épargne de précaution</button>
              <button type="button" @click="payload.objectif_invest = 'equilibre'" :class="payload.objectif_invest === 'equilibre' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Équilibrer mon patrimoine entre sécurité et croissance</button>
              <button type="button" @click="payload.objectif_invest = 'croissance'" :class="payload.objectif_invest === 'croissance' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Faire fructifier mon capital à long terme</button>
            </div>
          </div>

          <!-- Q6: Horizon de placement -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">6. Quelle est la durée (horizon) de votre placement ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.horizon_terme = 'court_terme'" :class="payload.horizon_terme === 'court_terme' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Court terme - Moins de 2 ans</button>
              <button type="button" @click="payload.horizon_terme = 'moyen_terme'" :class="payload.horizon_terme === 'moyen_terme' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Moyen terme - De 2 à 5 ans</button>
              <button type="button" @click="payload.horizon_terme = 'long_terme'" :class="payload.horizon_terme === 'long_terme' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Long terme - Plus de 5 ans</button>
            </div>
          </div>

          <!-- Q7: Performance ciblée -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">7. Quelle performance ciblez-vous, sachant les risques induits ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.niveau_perf = 'faible'" :class="payload.niveau_perf === 'faible' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Rendement régulier, risque de perte nul/très faible</button>
              <button type="button" @click="payload.niveau_perf = 'moderee'" :class="payload.niveau_perf === 'moderee' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Rendement équilibré, fluctuations légères acceptées</button>
              <button type="button" @click="payload.niveau_perf = 'elevee'" :class="payload.niveau_perf === 'elevee' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Forte appréciation, fortes fluctuations acceptées</button>
            </div>
          </div>

          <!-- Q8: Connaissance des marchés -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">8. Comment évaluez-vous votre connaissance des marchés financiers ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.connaissance_marche = 'faible'" :class="payload.connaissance_marche === 'faible' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Faible ou inexistante</button>
              <button type="button" @click="payload.connaissance_marche = 'moyenne'" :class="payload.connaissance_marche === 'moyenne' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Moyenne - Je connais le concept des fonds d'investissement</button>
              <button type="button" @click="payload.connaissance_marche = 'excellente'" :class="payload.connaissance_marche === 'excellente' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Excellente - J'achète activement des valeurs mobilières</button>
            </div>
          </div>

          <!-- Q9: Investissements antérieurs -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">9. Avez-vous déjà réalisé des investissements financiers dans le passé ?</h4>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" @click="payload.invest_anterieurs = 'Oui'" :class="payload.invest_anterieurs === 'Oui' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Oui</button>
              <button type="button" @click="payload.invest_anterieurs = 'Non'" :class="payload.invest_anterieurs === 'Non' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Non</button>
            </div>
          </div>

        </div>
      </div>

      <!-- STEP 3: LAB/FT COMPLIANCE -->
      <div v-else-if="currentStep === 'labft'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Étape 3 sur 4</span>
          <h3 class="text-xl font-black text-slate-900">Conformité LAB-FT</h3>
          <p class="text-slate-500 text-xs font-medium">Déclarations réglementaires de conformité COBAC.</p>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <!-- Situation de famille & résidence -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Situation Matrimoniale *</label>
            <select v-model="payload.situation_mat" @change="clearError('situation_mat')" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.situation_mat ? 'true' : 'false'" :aria-describedby="validationErrors.situation_mat ? 'situation_mat-error' : null">
              <option>Célibataire</option>
              <option>Marié(e)</option>
              <option>Divorcé(e)</option>
              <option>Veuf(ve)</option>
            </select>
            <p v-if="validationErrors.situation_mat" id="situation_mat-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.situation_mat }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Pays de Résidence *</label>
            <input v-model="payload.pays_residence" @blur="clearError('pays_residence')" @input="clearError('pays_residence')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.pays_residence ? 'true' : 'false'" :aria-describedby="validationErrors.pays_residence ? 'pays_residence-error' : null">
            <p v-if="validationErrors.pays_residence" id="pays_residence-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.pays_residence }}
            </p>
          </div>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Profil Économique</h4>
          
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Secteur d'Activité *</label>
            <input v-model="payload.secteur" @blur="clearError('secteur')" @input="clearError('secteur')" type="text" placeholder="Ex: Finance, Commerce, Santé..." class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.secteur ? 'true' : 'false'" :aria-describedby="validationErrors.secteur ? 'secteur-error' : null">
            <p v-if="validationErrors.secteur" id="secteur-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.secteur }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Tranche de revenus annuels *</label>
            <select v-model="payload.revenus_annuels" @change="clearError('revenus_annuels')" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.revenus_annuels ? 'true' : 'false'" :aria-describedby="validationErrors.revenus_annuels ? 'revenus_annuels-error' : null">
              <option value="moins_5m">Moins de 5 000 000 FCFA</option>
              <option value="5m_15m">De 5 000 000 à 15 000 000 FCFA</option>
              <option value="plus_15m">Plus de 15 000 000 FCFA</option>
            </select>
            <p v-if="validationErrors.revenus_annuels" id="revenus_annuels-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.revenus_annuels }}
            </p>
          </div>

          <!-- Sources de revenus -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Sources de revenus (Cochez) *</label>
            <div class="space-y-2 pl-1">
              <label class="flex items-center gap-3 text-xs font-bold text-slate-700">
                <input v-model="payload.src_salaire" type="checkbox" @change="clearError('sources_revenu')" class="w-4 h-4 text-primary rounded border-slate-300">
                Salaire
              </label>
              <label class="flex items-center gap-3 text-xs font-bold text-slate-700">
                <input v-model="payload.src_pro_liberal" type="checkbox" @change="clearError('sources_revenu')" class="w-4 h-4 text-primary rounded border-slate-300">
                Profession Libérale / Honoraires
              </label>
              <label class="flex items-center gap-3 text-xs font-bold text-slate-700">
                <input v-model="payload.src_foncier" type="checkbox" @change="clearError('sources_revenu')" class="w-4 h-4 text-primary rounded border-slate-300">
                Revenus Fonciers
              </label>
              <label class="flex items-center gap-3 text-xs font-bold text-slate-700">
                <input v-model="payload.src_dividendes" type="checkbox" @change="clearError('sources_revenu')" class="w-4 h-4 text-primary rounded border-slate-300">
                Dividendes / Placements
              </label>
              <label class="flex items-center gap-3 text-xs font-bold text-slate-700">
                <input v-model="payload.src_heritage" type="checkbox" @change="clearError('sources_revenu')" class="w-4 h-4 text-primary rounded border-slate-300">
                Héritage
              </label>
              <label class="flex items-center gap-3 text-xs font-bold text-slate-700">
                <input v-model="payload.src_autre_check" type="checkbox" @change="clearError('sources_revenu')" class="w-4 h-4 text-primary rounded border-slate-300">
                Autre
              </label>
            </div>
            
            <div v-if="payload.src_autre_check" class="mt-2 animate-in fade-in duration-300">
              <input v-model="payload.src_autre" type="text" placeholder="Précisez la source" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
            <p v-if="validationErrors.sources_revenu" id="sources_revenu-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.sources_revenu }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Origine des fonds à investir *</label>
            <input v-model="payload.origine_fonds" @blur="clearError('origine_fonds')" @input="clearError('origine_fonds')" type="text" placeholder="Ex: Épargne salariale, Vente immobilière..." class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.origine_fonds ? 'true' : 'false'" :aria-describedby="validationErrors.origine_fonds ? 'origine_fonds-error' : null">
            <p v-if="validationErrors.origine_fonds" id="origine_fonds-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.origine_fonds }}
            </p>
          </div>
        </div>



        <!-- LAB-FT Specific Risk Indicators -->
        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Déclarations de Risques</h4>
          
          <!-- PPE -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Êtes-vous une Personne Politiquement Exposée (PPE) ? *</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.ppe = 'Oui'; clearError('ppe')" :class="payload.ppe === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Oui</button>
              <button type="button" @click="payload.ppe = 'Non'; clearError('ppe')" :class="payload.ppe === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Non</button>
            </div>
            
            <div v-if="payload.ppe === 'Oui'" class="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-300">
              <label class="text-[10px] font-black text-slate-400 uppercase pl-1">Précisez votre fonction publique / mandat *</label>
              <input v-model="payload.ppe_detail" @blur="clearError('ppe')" @input="clearError('ppe')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.ppe ? 'true' : 'false'" :aria-describedby="validationErrors.ppe ? 'ppe-error' : null">
              <p v-if="validationErrors.ppe" id="ppe-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.ppe }}
              </p>
            </div>
          </div>

          <!-- Pays à risque -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Votre compte bancaire ou résidence est-il situé dans un pays sous sanctions ou à haut risque ? *</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.pays_risque = 'Oui'" :class="payload.pays_risque === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Oui</button>
              <button type="button" @click="payload.pays_risque = 'Non'" :class="payload.pays_risque === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Non</button>
            </div>
          </div>

          <!-- Secteur sensible -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Vos fonds proviennent-ils d'un secteur sensible (ex: armement, minier, jeux d'argent) ? *</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.secteur_sensible = 'Oui'" :class="payload.secteur_sensible === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Oui</button>
              <button type="button" @click="payload.secteur_sensible = 'Non'" :class="payload.secteur_sensible === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Non</button>
            </div>
          </div>

          <!-- Condamnation -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Avez-vous fait l'objet d'une condamnation passée liée au blanchiment ou au terrorisme ? *</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.condamnation = 'Oui'" :class="payload.condamnation === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Oui</button>
              <button type="button" @click="payload.condamnation = 'Non'" :class="payload.condamnation === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Non</button>
            </div>
          </div>
        </div>

        <!-- Consentements -->
        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4 text-left">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Consentements réglementaires</h4>
          
          <label class="flex items-start gap-3 text-xs font-bold text-slate-700 leading-normal">
            <input v-model="payload.ack_lecture" type="checkbox" @change="clearError('consent')" class="w-4 h-4 text-primary rounded border-slate-300 mt-0.5">
            <span>Je declare avoir pris connaissance des règlements généraux et conditions de Kori Asset Management. *</span>
          </label>

          <label class="flex items-start gap-3 text-xs font-bold text-slate-700 leading-normal">
            <input v-model="payload.ack_donnees" type="checkbox" @change="clearError('consent')" class="w-4 h-4 text-primary rounded border-slate-300 mt-0.5">
            <span>J'autorise le traitement informatique sécurisé de mes données dans le cadre de la conformité LAB-FT. *</span>
          </label>
          <p v-if="validationErrors.consent" id="consent-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.consent }}
          </p>
        </div>
      </div>

      <!-- STEP 4: ELECTRONIC SIGNATURE -->
      <div v-else-if="currentStep === 'signature'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Étape 4 sur 4</span>
          <h3 class="text-xl font-black text-slate-900">Signature Électronique</h3>
          <p class="text-slate-500 text-xs font-medium">Dessinez votre signature dans le cadre ci-dessous pour finaliser.</p>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4 text-left">
         

          <div class="flex justify-between items-center border-b border-slate-100 pb-3">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Tracé de signature *</label>
            <button type="button" @click="clearSignature" class="text-[10px] font-black text-rose-500 uppercase hover:text-rose-600 transition-colors">Effacer</button>
          </div>

          <div class="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden relative" style="height: 152px;">
            <canvas ref="canvasRef" class="w-full h-full block cursor-crosshair"></canvas>
            <div v-if="!hasSigned" class="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-bold select-none">
              Signez ici avec votre doigt ou stylet
            </div>
          </div> 
          <!-- Legal confirmation statement checkbox -->
          <div class="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <label class="flex items-start gap-3 cursor-pointer select-none">
              <input v-model="signatureConfirmed" type="checkbox" class="w-5 h-5 text-primary rounded border-slate-300 mt-0.5 focus:ring-primary">
              <span class="text-slate-700 text-xs font-bold leading-normal">
                <!-- Je, soussigné(e) <span class="text-primary font-black">{{ payload.prenom }} {{ payload.nom }}</span>, certifie sur l'honneur l'exactitude de toutes les informations fournies dans ce dossier d'onboarding. 
                Je déclare accepter expressément les règlements du PEK et reconnais de manière irrévocable que la signature électronique ci-dessous constituera la preuve de mon engagement contractuel et aura la même valeur juridique qu'une signature manuscrite. -->
                Je déclare avoir pris connaissance du document d'information et du règlement de gestion du fonds commun de placement KORI SERENITE
              </span>
            </label>
          </div>

          <!-- <div class="flex items-start gap-2 bg-blue-50 text-blue-900 p-4 rounded-2xl border border-blue-100/50 text-[10px] font-bold mt-2">
            <span>Conformément à la Loi n°2010/012 du Cameroun sur le commerce électronique, cette signature numérique apposée à vos fiches contractuelles fait foi de votre consentement réglementaire.</span>
          </div> -->
        </div>

        <p v-if="signatureError" class="text-rose-500 text-xs font-bold pl-2 flex items-center gap-1.5"><AlertCircle class="w-4 h-4" /> {{ signatureError }}</p>
      </div>

      <!-- COMPLETED SCREEN -->
      <div v-else-if="currentStep === 'completed'" class="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <div class="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
          <CheckCircle2 class="w-10 h-10 text-emerald-500" />
        </div>
        
        <div class="space-y-2">
          <h2 class="text-2xl font-black text-slate-900">Dossier Soumis !</h2>
          <p class="text-slate-500 text-xs leading-relaxed max-w-[280px] mx-auto font-medium">
            Votre onboarding client FCP a été validé. Vos documents officiels signés ont été envoyés à l'équipe de conformité Kori.
          </p>
        </div>

        <div class="w-full bg-slate-50 rounded-3xl p-6 space-y-3 border border-slate-100 text-left">
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-400 font-bold uppercase tracking-tighter">Profil Calculé</span>
            <span class="text-slate-900 font-black">{{ localProfile }}</span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-400 font-bold uppercase tracking-tighter">Statut Dossier</span>
            <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">En cours d'étude</span>
          </div>
        </div>

        <div class="w-full pt-6">
          <button @click="router.push('/home')" class="w-full bg-primary text-white font-black py-4.5 rounded-3xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-sm uppercase tracking-wider">
            Retour au Tableau de Bord
            <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>

    <!-- Sticky Navigation Buttons (Bottom) -->
    <div v-if="currentStep !== 'completed'" class="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 z-50 flex gap-4 max-width-container mx-auto">
      
      <!-- Back Button -->
      <button 
        v-if="currentStep !== 'kyc'"
        @click="prevStep"
        class="bg-slate-100 text-slate-600 font-black px-6 py-4.5 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider"
      >
        Retour
      </button>

      <!-- Next / Submit Button -->
      <button 
        @click="currentStep === 'signature' ? submitOnboarding() : nextStep()"
        :disabled="submitting"
        class="flex-1 bg-primary text-white font-black py-4.5 rounded-2xl shadow-xl shadow-primary/35 active:scale-95 disabled:bg-slate-200 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-wider"
      >
        <Loader2 v-if="submitting" class="w-5 h-5 animate-spin" />
        <span v-else>
          {{ currentStep === 'signature' ? 'Finaliser et Signer' : 'Étape suivante' }}
        </span>
      </button>
    </div>

    <!-- Error Modal -->
    <div v-if="showErrorModal" class="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <!-- Dark backdrop -->
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="showErrorModal = false"></div>
      
      <!-- Modal card -->
      <div class="relative bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div class="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
          <AlertCircle class="w-8 h-8" />
        </div>
        
        <div class="space-y-2">
          <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest">{{ modalErrorTitle }}</h3>
          <p class="text-slate-500 text-xs font-semibold leading-relaxed">
            {{ modalErrorMessage }}
          </p>
        </div>
        
        <button 
          @click="showErrorModal = false" 
          class="w-full bg-slate-950 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all"
        >
          D'accord
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.max-width-container {
  max-width: 480px;
}
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
