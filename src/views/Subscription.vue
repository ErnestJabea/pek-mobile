<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, CreditCard, Wallet, Smartphone, ShieldCheck, Loader2, CheckCircle2, ArrowRight, AlertCircle, Landmark } from 'lucide-vue-next'
import api from '../api/api'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const fund = ref(null)
const loading = ref(true)
const submitting = ref(false)
const success = ref(false)
const showErrorModal = ref(false)
const showOnboardingModal = ref(false)
const showOnboardingRequiredModal = ref(false)
const transactionRef = ref('')
const coolpayTransactionRef = ref('')
const phoneNumber = ref('')

const parts = ref(1)
const inputMode = ref('amount')
const inputAmount = ref(0)
const paymentMethod = ref('orange_money')

const onAmountInput = (e) => {
  const val = parseFloat(e.target.value) || 0
  inputAmount.value = val
  if (fund.value && fund.value.vl > 0) {
    parts.value = parseFloat((val / fund.value.vl).toFixed(8))
  }
}

const onPartsInput = (e) => {
  const val = parseFloat(e.target.value) || 0
  parts.value = val
  if (fund.value) {
    inputAmount.value = parseFloat((val * fund.value.vl).toFixed(2))
  }
}

// Stripe/Payment state
const stripeError = ref(null)
const pekDetails = ref(null)

const fetchData = async () => {
  try {
    const [productsRes, bankRes] = await Promise.all([
      api.get('/products'),
      api.get('/bank-details')
    ])
    fund.value = productsRes.data.find(p => p.id == route.params.id)
    pekDetails.value = bankRes.data
    if (fund.value) {
      inputAmount.value = fund.value.vl
    } else {
      router.push('/catalog')
    }
  } catch (error) {
    console.error('Error fetching data:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})

const totalAmount = computed(() => {
  if (!fund.value) return 0
  if (inputMode.value === 'amount') {
    return inputAmount.value.toFixed(2)
  }
  return (parts.value * fund.value.vl).toFixed(2)
})

const fees = computed(() => {
  return (totalAmount.value * 0.01).toFixed(2) // 1% fees
})

const finalAmount = computed(() => {
  return (parseFloat(totalAmount.value) + parseFloat(fees.value)).toFixed(2)
})

const isMinimumMet = computed(() => {
  if (!fund.value) return false
  return parts.value >= 1
})

const handleSubscribe = async () => {
  const amount = inputMode.value === 'amount' ? inputAmount.value : (parts.value * fund.value.vl)
  const onboardingStatus = authStore.user?.onboarding_status

  if (amount > 50000 && onboardingStatus !== 'validated') {
    showOnboardingRequiredModal.value = true
    return
  }

  stripeError.value = null
  submitting.value = true
  try {
    const response = await api.post('/subscriptions', {
      product_id: fund.value.id,
      nb_parts: parts.value,
      moyen_paiement: paymentMethod.value,
      montant_total: inputMode.value === 'amount' ? inputAmount.value : null
    })
    
    const { subscription, pek_bank_details } = response.data

    if (pek_bank_details) {
      pekDetails.value = pek_bank_details
    }

    transactionRef.value = subscription.reference_transaction
    success.value = true
  } catch (error) {
    if (error.response && error.response.data) {
      stripeError.value = error.response.data.error || error.response.data.message || error.message
    } else {
      if (error.message === 'Network Error') {
        stripeError.value = "Impossible de contacter le serveur. Veuillez vérifier votre connexion internet."
      } else if (error.message && error.message.includes('timeout')) {
        stripeError.value = "Le serveur a mis trop de temps à répondre. Veuillez réessayer dans quelques instants."
      } else {
        stripeError.value = "Une erreur de connexion est survenue. Veuillez réessayer."
      }
    }
    showErrorModal.value = true
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="min-h-screen flex flex-col items-center justify-center space-y-4">
    <Loader2 class="w-10 h-10 text-primary animate-spin" />
    <p class="text-slate-400 font-medium">Initialisation...</p>
  </div>

  <div v-else-if="success" class="min-h-screen bg-white flex flex-col p-6 animate-in fade-in zoom-in duration-500">
    <div class="flex-1 flex flex-col items-center justify-center text-center space-y-6">
      <div class="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
        <CheckCircle2 class="w-10 h-10 text-emerald-500" />
      </div>
      
      <div class="space-y-2">
        <h2 class="text-2xl font-black text-slate-900">Demande Enregistrée !</h2>
        <p class="text-slate-500 text-sm leading-relaxed max-w-[280px] mx-auto">
          Votre demande de souscription a été enregistrée avec succès. Veuillez suivre les instructions de règlement ci-dessous.
        </p>
      </div>

      <!-- Instructions Card -->
      <div v-if="pekDetails" class="w-full bg-slate-50 rounded-3xl p-6 border border-slate-100 text-left animate-in fade-in duration-300">
        <div class="space-y-4">
          <div class="flex flex-col">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Procédure de règlement</span>
            <div class="text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-line bg-white p-4 rounded-2xl border border-slate-100/50 shadow-sm">
              {{ 
                paymentMethod === 'orange_money' ? pekDetails.om_instructions :
                paymentMethod === 'mtn_momo' ? pekDetails.momo_instructions :
                pekDetails.bank_instructions
              }}
            </div>
          </div>
        </div>
      </div>

      <div class="bg-slate-50 w-full rounded-3xl p-6 space-y-4 border border-slate-100">
        <div class="flex justify-between items-center text-sm">
          <span class="text-slate-400 font-bold uppercase tracking-tighter">Réf PEK</span>
          <span class="text-slate-900 font-black">{{ transactionRef }}</span>
        </div>

        <div class="flex justify-between items-center text-sm">
          <span class="text-slate-400 font-bold uppercase tracking-tighter">Statut</span>
          <span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">En attente</span>
        </div>
        <div class="pt-2 border-t border-slate-200 flex justify-between items-center">
          <span class="text-slate-400 font-bold uppercase tracking-tighter">Montant total</span>
          <span class="text-primary font-black">{{ parseFloat(finalAmount).toLocaleString() }} FCFA</span>
        </div>
      </div>

      <!-- Warning alert box for unvalidated onboarding status -->
      <div v-if="authStore.user?.onboarding_status !== 'validated'" class="w-full bg-amber-50 rounded-3xl p-6 border border-amber-100 text-left animate-in fade-in duration-300">
        <div class="flex items-start gap-3 text-amber-800">
          <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
          <div class="text-xs font-bold leading-relaxed">
            Attention : Votre souscription a bien été enregistrée mais elle ne sera validée que si et seulement si vous renseignez les informations qui vous sont demandées par mail pour finaliser votre dossier d'onboarding.
          </div>
        </div>
      </div>
    </div>

    <div class="w-full space-y-3 pt-8 pb-4">
      <button @click="router.push('/home')" class="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all">
        Retour au Dashboard
        <ArrowRight class="w-4 h-4" />
      </button>
    </div>
  </div> 

  <div v-else class="min-h-full flex flex-col bg-slate-50">
    <!-- Header -->
    <header class="bg-white px-6 py-6 flex items-center gap-4 sticky top-0 z-10 border-b border-slate-100">
      <button @click="router.back()" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all">
        <ChevronLeft class="w-6 h-6" />
      </button>
      <h2 class="text-xl font-bold text-slate-900">Souscription</h2>
    </header>

    <div class="flex-1 px-6 py-8 space-y-8 pb-44">
      <!-- Fund Summary Card -->
      <section class="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
        <div class="flex justify-between items-start mb-6">
          <div class="space-y-1">
            <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Sélection</span>
            <h3 class="text-xl font-black text-slate-900">{{ fund.name }}</h3>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
          <div>
            <span class="text-slate-400 text-[10px] block font-black uppercase tracking-tighter mb-1">VL Actuelle</span>
            <span class="text-primary font-black">{{ fund.vl.toLocaleString() }} FCFA</span>
          </div>
          <div class="text-right">
          </div>
        </div>
      </section>

      <!-- Calculator Section -->
      <section class="space-y-4">
        <!-- Premium Tab Switcher -->
        <div class="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
          <button 
            @click="inputMode = 'amount'" 
            type="button"
            :class="[
              'flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
              inputMode === 'amount' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'
            ]"
          >
            Montant (FCFA)
          </button>
          <button 
            @click="inputMode = 'parts'" 
            type="button"
            :class="[
              'flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
              inputMode === 'parts' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'
            ]"
          >
            Nombre de parts
          </button>
        </div>

        <!-- Dynamic Inputs -->
        <!-- Mode Montant -->
        <div v-if="inputMode === 'amount'" class="space-y-2 text-left animate-in fade-in duration-300">
          <label class="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Montant de l'investissement</label>
          <div class="relative group">
            <input 
              :value="inputAmount"
              @input="onAmountInput"
              type="number" 
              placeholder="Ex: 50 000"
              class="w-full bg-white border-2 border-slate-100 rounded-3xl py-5 px-8 text-3xl font-black text-primary focus:border-primary transition-all outline-none"
            >
            <div class="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-black uppercase text-xs tracking-widest">FCFA</div>
          </div>
          <span class="text-[10px] text-slate-400 font-bold block px-2">
            Soit environ <strong class="text-primary">{{ parts }} parts</strong> à acquérir.
          </span>
        </div>

        <!-- Mode Parts -->
        <div v-else class="space-y-2 text-left animate-in fade-in duration-300">
          <label class="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Nombre de parts souhaité</label>
          <div class="relative group">
            <input 
              :value="parts"
              @input="onPartsInput"
              type="number" 
              step="0.5"
              placeholder="Ex: 5"
              class="w-full bg-white border-2 border-slate-100 rounded-3xl py-5 px-8 text-3xl font-black text-primary focus:border-primary transition-all outline-none"
            >
            <div class="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-black uppercase text-xs tracking-widest">Parts</div>
          </div>
          <span class="text-[10px] text-slate-400 font-bold block px-2">
            Soit un investissement de <strong class="text-primary">{{ parseFloat(totalAmount).toLocaleString() }} FCFA</strong>.
          </span>
        </div>
      </section>

      <!-- Payment Methods -->
      <section class="space-y-4">
        <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Moyen de paiement</h3>
        <div class="grid grid-cols-3 gap-2">
          <button type="button" @click="paymentMethod = 'orange_money'" :class="['p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2', paymentMethod === 'orange_money' ? 'border-primary bg-primary' : 'border-white bg-white']">
            <Smartphone :class="paymentMethod === 'orange_money' ? 'text-white' : 'text-slate-400'" class="w-5 h-5" />
            <span :class="['text-[9px] font-black uppercase tracking-wider text-center', paymentMethod === 'orange_money' ? 'text-white' : 'text-slate-500']">Orange Money</span>
          </button>

          <!-- <button type="button" @click="paymentMethod = 'mtn_momo'" :class="['p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2', paymentMethod === 'mtn_momo' ? 'border-primary bg-primary' : 'border-white bg-white']">
            <Smartphone :class="paymentMethod === 'mtn_momo' ? 'text-white' : 'text-slate-400'" class="w-5 h-5" />
            <span :class="['text-[9px] font-black uppercase tracking-wider text-center', paymentMethod === 'mtn_momo' ? 'text-white' : 'text-slate-500']">MTN MoMo</span>
          </button> -->

          <button type="button" @click="paymentMethod = 'stripe'" :class="['p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2', paymentMethod === 'stripe' ? 'border-primary bg-primary' : 'border-white bg-white']">
            <Wallet :class="paymentMethod === 'stripe' ? 'text-white' : 'text-slate-400'" class="w-5 h-5" />
            <span :class="['text-[9px] font-black uppercase tracking-wider text-center', paymentMethod === 'stripe' ? 'text-white' : 'text-slate-500']">Virement</span>
          </button>
        </div>
      </section>

      <!-- Summary -->
      <section class="bg-slate-900 rounded-[32px] p-6 text-white space-y-4 shadow-2xl shadow-slate-900/40">
        <div class="flex justify-between items-center text-xs opacity-60">
          <span>Sous-total</span>
          <span>{{ parseFloat(totalAmount).toLocaleString() }} FCFA</span>
        </div>
        <div class="flex justify-between items-center text-xs opacity-60">
          <span>Frais de souscription (1%)</span>
          <span>{{ parseFloat(fees).toLocaleString() }} FCFA</span>
        </div>
        <div class="pt-4 border-t border-white/10 flex justify-between items-end">
          <div class="space-y-1">
             <span class="text-white/40 text-[10px] font-black uppercase tracking-widest">Total à payer</span>
             <div class="text-2xl font-black text-white leading-none">{{ parseFloat(finalAmount).toLocaleString() }} FCFA</div>
          </div>
          <div class="bg-accent text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase">Sécurisé</div>
        </div>
      </section>
    </div>

    <!-- Sticky Button -->
    <div class="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 z-50">
      <button 
        @click="handleSubscribe"
        :disabled="submitting || !isMinimumMet"
        class="w-full bg-primary text-white font-black py-5 rounded-3xl shadow-xl shadow-primary/30 active:scale-95 disabled:bg-slate-200 transition-all flex items-center justify-center gap-3"
      >
        <Loader2 v-if="submitting" class="w-6 h-6 animate-spin" />
        <template v-else>
          Procéder au paiement
        </template>
      </button>
      <p v-if="!isMinimumMet" class="text-center text-rose-500 text-[10px] font-bold mt-3 animate-pulse">
        Minimum de souscription de 1 part ({{ fund?.vl.toLocaleString() }} FCFA) non atteint.
      </p>
    </div>

    <!-- Premium Error Modal Window -->
    <div v-if="showErrorModal" class="fixed inset-0 z-[10000] flex items-end justify-center p-6 sm:items-center">
      <!-- Backdrop with glassmorphism blur -->
      <div @click="showErrorModal = false" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"></div>
      
      <!-- Modal card -->
      <div class="relative w-full max-w-sm bg-white rounded-[36px] p-8 shadow-2xl border border-slate-100/50 z-10 animate-in slide-in-from-bottom duration-300 text-center space-y-6">
        <!-- Floating Red Alert Icon -->
        <div class="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
          <AlertCircle class="w-8 h-8" />
        </div>
        
        <!-- Text details -->
        <div class="space-y-2">
          <h3 class="text-lg font-black text-slate-900">Échec du paiement</h3>
          <p class="text-slate-500 font-bold text-xs leading-relaxed px-2">
            {{ stripeError }}
          </p>
        </div>
        
        <!-- Primary Action Button -->
        <button 
          @click="showErrorModal = false" 
          class="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4.5 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider"
        >
          Réessayer
        </button>
      </div>
    </div>

    <!-- Premium Onboarding Reminder Modal Window -->
    <div v-if="showOnboardingModal" class="fixed inset-0 z-[10000] flex items-end justify-center p-6 sm:items-center">
      <!-- Backdrop with glassmorphism blur -->
      <div @click="showOnboardingModal = false" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"></div>
      
      <!-- Modal card -->
      <div class="relative w-full max-w-sm bg-white rounded-[36px] p-8 shadow-2xl border border-slate-100/50 z-10 animate-in slide-in-from-bottom duration-300 text-center space-y-6">
        <!-- Floating Yellow Onboarding Icon -->
        <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
          <AlertCircle class="w-8 h-8" />
        </div>
        
        <!-- Text details -->
        <div class="space-y-2">
          <h3 class="text-lg font-black text-slate-900">Onboarding Requis</h3>
          <p class="text-slate-500 font-bold text-xs leading-relaxed px-2">
            Pour pouvoir souscrire à nos produits d'investissement, vous devez au préalable compléter votre dossier d'onboarding réglementaire.
          </p>
        </div>
        
        <!-- Actions -->
        <div class="space-y-2">
          <button 
            @click="router.push('/onboarding')" 
            class="w-full bg-primary hover:bg-slate-800 text-white font-black py-4.5 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider shadow-lg shadow-primary/20"
          >
            Remplir mon onboarding
          </button>
          <button 
            @click="showOnboardingModal = false" 
            class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>

    <!-- Premium Onboarding Required Modal Window -->
    <div v-if="showOnboardingRequiredModal" class="fixed inset-0 z-[10000] flex items-end justify-center p-6 sm:items-center">
      <!-- Backdrop with glassmorphism blur -->
      <div @click="showOnboardingRequiredModal = false" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"></div>
      
      <!-- Modal card -->
      <div class="relative w-full max-w-sm bg-white rounded-[36px] p-8 shadow-2xl border border-slate-100/50 z-10 animate-in slide-in-from-bottom duration-300 text-center space-y-6">
        <!-- Floating Red Icon -->
        <div class="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
          <AlertCircle class="w-8 h-8" />
        </div>
        
        <!-- Text details -->
        <div class="space-y-2">
          <h3 class="text-lg font-black text-slate-900">Validation Requise</h3>
          <p class="text-slate-500 font-bold text-xs leading-relaxed px-2">
            Pour finaliser votre souscription de plus de 50 000 FCFA, vous devez fournir les informations restantes qui vous ont été demandées par mail pour faire valider votre dossier d'onboarding.
          </p>
        </div>
        
        <!-- Actions -->
        <div class="space-y-2">
          <button 
            @click="router.push('/onboarding')" 
            class="w-full bg-primary hover:bg-slate-800 text-white font-black py-4.5 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider shadow-lg shadow-primary/20"
          >
            Compléter mon onboarding
          </button>
          <button 
            @click="showOnboardingRequiredModal = false" 
            class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Hide arrows for number input */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>

<style scoped>
.max-width-container {
  max-width: 480px;
}
</style>
