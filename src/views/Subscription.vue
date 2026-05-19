<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, CreditCard, Wallet, Smartphone, ShieldCheck, Loader2, CheckCircle2, ArrowRight, AlertCircle, Landmark } from 'lucide-vue-next'
import api from '../api/api'

const route = useRoute()
const router = useRouter()

const fund = ref(null)
const loading = ref(true)
const submitting = ref(false)
const success = ref(false)
const showErrorModal = ref(false)
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

// Stripe State
const stripe = ref(null)
const cardElements = ref({
  number: null,
  expiry: null,
  cvc: null
})
const cardComplete = ref(false)
const stripeError = ref(null)

const loadStripe = () => {
  if (window.Stripe) {
    initStripe()
  } else {
    // Retry in 100ms if not yet ready
    setTimeout(loadStripe, 100)
  }
}

const initStripe = () => {
  // Use public key
  stripe.value = window.Stripe('pk_test_51J945MHNUQZvKL6d65ylKTZCJb5YT3A8ZJIgOR5FJyHFk51pVrnhrJ31Q1LWNtK8xgOJGhJIZhjaLPRmm1vdWP6d00Q3uwJ68A')
  const elements = stripe.value.elements()
  
  const style = {
    base: {
      fontSize: '16px',
      color: '#0f172a',
      fontFamily: 'Inter, sans-serif',
      '::placeholder': { color: '#94a3b8' },
    },
    invalid: {
      color: '#ef4444',
    }
  }

  cardElements.value.number = elements.create('cardNumber', { style })
  cardElements.value.expiry = elements.create('cardExpiry', { style })
  cardElements.value.cvc = elements.create('cardCvc', { style })

  // Listen for changes to validate
  const handleChange = (e) => {
    stripeError.value = e.error ? e.error.message : null
    // Basic check: in separate elements, we'd need to check all 3. 
    // Simplified: we'll check if the last interaction was valid.
  }

  cardElements.value.number.on('change', handleChange)
  cardElements.value.expiry.on('change', handleChange)
  cardElements.value.cvc.on('change', handleChange)
}

const mountCard = () => {
  if (paymentMethod.value === 'bank_card' && cardElements.value.number) {
    setTimeout(() => {
      cardElements.value.number.mount('#card-number')
      cardElements.value.expiry.mount('#card-expiry')
      cardElements.value.cvc.mount('#card-cvc')
    }, 150)
  }
}

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
    loadStripe()
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
  return parseFloat(totalAmount.value) >= fund.value.min
})

const isPhoneValid = computed(() => {
  const regex = /^6[256789][0-9]{7}$/
  return regex.test(phoneNumber.value.replace(/\s/g, ''))
})

const canSubmit = computed(() => {
  if (!isMinimumMet.value || submitting.value) return false
  
  if (['orange_money', 'mtn_momo'].includes(paymentMethod.value)) {
    return isPhoneValid.value
  }
  
  if (paymentMethod.value === 'bank_card') {
    return !stripeError.value
  }
  
  return true
})

const pekDetails = ref(null)

const handleSubscribe = async () => {
  stripeError.value = null
  submitting.value = true
  try {
    const response = await api.post('/subscriptions', {
      product_id: fund.value.id,
      nb_parts: parts.value,
      moyen_paiement: paymentMethod.value,
      phone_number: phoneNumber.value,
      montant_total: inputMode.value === 'amount' ? inputAmount.value : null
    })
    
    const { client_secret, subscription, pek_bank_details } = response.data

    if (client_secret && paymentMethod.value === 'bank_card') {
      const result = await stripe.value.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElements.value.number,
          billing_details: { name: 'Client PEK' },
        },
      })
      if (result.error) throw new Error(result.error.message)
    }

    if (pek_bank_details) {
      pekDetails.value = pek_bank_details
    }

    transactionRef.value = subscription.reference_transaction
    if (subscription.coolpay_transaction_ref) {
      coolpayTransactionRef.value = subscription.coolpay_transaction_ref
    }
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
        <!-- Virement (Stripe inside code) -->
        <template v-if="paymentMethod === 'stripe'">
          <h2 class="text-2xl font-black text-slate-900">Instructions de virement</h2>
          <p class="text-slate-500 text-sm leading-relaxed max-w-[280px] mx-auto">
            Veuillez effectuer le virement vers le compte bancaire de PEK.
          </p>
        </template>
        
        <!-- Mobile Money -->
        <template v-else-if="['orange_money', 'mtn_momo'].includes(paymentMethod)">
          <h2 class="text-2xl font-black text-slate-900">Paiement Mobile Initié !</h2>
          <p class="text-slate-500 text-sm leading-relaxed max-w-[280px] mx-auto">
            Une demande de débit a été envoyée sur votre téléphone.
          </p>
        </template>
        
        <!-- Carte Bancaire -->
        <template v-else>
          <h2 class="text-2xl font-black text-slate-900">Paiement Réussi !</h2>
          <p class="text-slate-500 text-sm leading-relaxed max-w-[280px] mx-auto">
            Votre paiement par carte a été traité et validé avec succès.
          </p>
        </template>
      </div>

      <!-- Case 1: Virement Bank Details Card -->
      <div v-if="paymentMethod === 'stripe' && pekDetails" class="w-full bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100 text-left">
        <div class="space-y-4">
          <div class="flex flex-col">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Banque</span>
            <span class="text-sm font-black text-slate-900">{{ pekDetails.bank_name }}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">IBAN</span>
            <span class="text-sm font-black text-slate-900 break-all bg-white p-3 rounded-xl border border-slate-100 mt-1">{{ pekDetails.iban }}</span>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">RIB</span>
              <span class="text-sm font-black text-slate-900">{{ pekDetails.rib }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">SWIFT / BIC</span>
              <span class="text-sm font-black text-slate-900">{{ pekDetails.swift }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Case 2: Mobile Money Instructions Card -->
      <div v-else-if="['orange_money', 'mtn_momo'].includes(paymentMethod)" class="w-full bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100 text-left">
        <div class="flex items-center gap-3 pb-3 border-b border-slate-200/60">
          <div :class="paymentMethod === 'orange_money' ? 'bg-orange-50 text-orange-500' : 'bg-yellow-50 text-yellow-600'" class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs uppercase">
            {{ paymentMethod === 'orange_money' ? 'OM' : 'MoMo' }}
          </div>
          <div>
            <h4 class="text-xs font-black text-slate-900 uppercase">
              {{ paymentMethod === 'orange_money' ? 'Orange Money Cameroun' : 'MTN Mobile Money' }}
            </h4>
            <p class="text-[10px] text-slate-400 font-bold">Numéro de débit : {{ phoneNumber }}</p>
          </div>
        </div>
        <div class="space-y-2 text-xs text-slate-600 font-medium leading-relaxed">
          <p>1. Tapez votre **code secret** sur l'écran d'autorisation qui apparaît sur votre téléphone.</p>
          <p v-if="paymentMethod === 'orange_money'">2. Si l'écran d'autorisation ne s'ouvre pas automatiquement, composez le <span class="font-black text-primary">#150#</span> pour valider.</p>
          <p v-else>2. Si l'écran d'autorisation ne s'ouvre pas automatiquement, composez le <span class="font-black text-primary">*126#</span> pour valider.</p>
        </div>
      </div>

      <!-- Case 3: Credit Card Confirmation Card -->
      <div v-else class="w-full bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100 text-left">
        <div class="flex items-center gap-3">
          <div>
            <h4 class="text-xs font-black text-slate-900 uppercase">Paiement Sécurisé</h4>
            <p class="text-[10px] text-slate-400 font-bold">Transaction traitée avec Stripe</p>
          </div>
        </div>
        <p class="text-xs text-slate-500 font-medium leading-relaxed">
          Votre paiement a été approuvé. Votre reçu vous a été envoyé par email. Le traitement de votre souscription est en cours.
        </p>
      </div>

      <div class="bg-slate-50 w-full rounded-3xl p-6 space-y-4 border border-slate-100">
        <div class="flex justify-between items-center text-sm">
          <span class="text-slate-400 font-bold uppercase tracking-tighter">Réf PEK</span>
          <span class="text-slate-900 font-black">{{ transactionRef }}</span>
        </div>
        <div v-if="coolpayTransactionRef" class="flex justify-between items-center text-sm">
          <span class="text-slate-400 font-bold uppercase tracking-tighter">Réf CoolPay</span>
          <span class="text-slate-900 font-black truncate max-w-[200px]">{{ coolpayTransactionRef }}</span>
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
            <span class="text-slate-400 text-[10px] block font-black uppercase tracking-tighter mb-1">Seuil Minimum</span>
            <span :class="isMinimumMet ? 'text-emerald-500' : 'text-rose-500'" class="font-black">
               {{ fund.min.toLocaleString() }} FCFA
            </span>
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
              step="0.0001"
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
        <div class="grid grid-cols-2 gap-3">
          <button @click="paymentMethod = 'orange_money'" :class="['p-5 rounded-[28px] border-2 transition-all flex flex-col items-center gap-3', paymentMethod === 'orange_money' ? 'border-primary bg-primary' : 'border-white bg-white']">
            <Smartphone :class="paymentMethod === 'orange_money' ? 'text-white' : 'text-slate-400'" class="w-6 h-6" />
            <span :class="['text-[10px] font-black uppercase tracking-wider', paymentMethod === 'orange_money' ? 'text-white' : 'text-slate-500']">Orange MONEY</span>
          </button>

          <button @click="paymentMethod = 'mtn_momo'" :class="['p-5 rounded-[28px] border-2 transition-all flex flex-col items-center gap-3', paymentMethod === 'mtn_momo' ? 'border-primary bg-primary' : 'border-white bg-white']">
            <Smartphone :class="paymentMethod === 'mtn_momo' ? 'text-white' : 'text-slate-400'" class="w-6 h-6" />
            <span :class="['text-[10px] font-black uppercase tracking-wider', paymentMethod === 'mtn_momo' ? 'text-white' : 'text-slate-500']">MTN MOBILE MONEY</span>
          </button>

          <button @click="paymentMethod = 'bank_card'; mountCard()" :class="['p-5 rounded-[28px] border-2 transition-all flex flex-col items-center gap-3', paymentMethod === 'bank_card' ? 'border-primary bg-primary' : 'border-white bg-white']">
            <CreditCard :class="paymentMethod === 'bank_card' ? 'text-white' : 'text-slate-400'" class="w-6 h-6" />
            <span :class="['text-[10px] font-black uppercase tracking-wider', paymentMethod === 'bank_card' ? 'text-white' : 'text-slate-500']">Carte</span>
          </button>

          <button @click="paymentMethod = 'stripe'" :class="['p-5 rounded-[28px] border-2 transition-all flex flex-col items-center gap-3', paymentMethod === 'stripe' ? 'border-primary bg-primary' : 'border-white bg-white']">
            <Wallet :class="paymentMethod === 'stripe' ? 'text-white' : 'text-slate-400'" class="w-6 h-6" />
            <span :class="['text-[10px] font-black uppercase tracking-wider', paymentMethod === 'stripe' ? 'text-white' : 'text-slate-500']">Virement</span>
          </button>
        </div>

        <!-- Phone Number for Mobile Money -->
        <div v-if="['orange_money', 'mtn_momo'].includes(paymentMethod)" class="mt-6 animate-in slide-in-from-bottom-4 duration-300">
           <div class="bg-white border-2 border-primary/10 p-6 rounded-[32px] space-y-4 shadow-xl shadow-slate-200/50">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Numéro de téléphone (Cameroun)</label>
              <div class="relative">
                <Smartphone class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  v-model="phoneNumber"
                  type="tel" 
                  maxlength="9"
                  placeholder="6xx xxx xxx"
                  class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-black text-slate-900 focus:border-primary outline-none transition-all"
                >
              </div>
              <p v-if="phoneNumber && !isPhoneValid" class="text-[10px] text-rose-500 font-bold flex items-center gap-1 pl-1">
                <AlertCircle class="w-3 h-3" />
                Format invalide (Ex: 699009900)
              </p>
           </div>
        </div>

        <!-- NEW: Manual Virement Preview -->
        <div v-if="paymentMethod === 'stripe' && pekDetails" class="mt-6 animate-in slide-in-from-bottom-4 duration-300">
           <div class="bg-white border-2 border-primary/10 p-6 rounded-[32px] space-y-4 shadow-xl shadow-slate-200/50">
              <div class="flex items-center gap-3 pb-3 border-b border-slate-50">
                <div class="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                  <Landmark class="w-5 h-5" />
                </div>
                <div>
                  <h4 class="text-xs font-black text-slate-900 uppercase">Compte de dépôt PEK</h4>
                  <p class="text-[10px] text-slate-400 font-bold">{{ pekDetails.bank_name }}</p>
                </div>
              </div>
              
              <div class="space-y-3">
                <div class="flex flex-col">
                  <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">IBAN</span>
                  <span class="text-sm font-black text-slate-900 break-all select-all">{{ pekDetails.iban }}</span>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">RIB</span>
                    <span class="text-sm font-black text-slate-900">{{ pekDetails.rib }}</span>
                  </div>
                  <div class="flex flex-col">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">SWIFT</span>
                    <span class="text-sm font-black text-slate-900">{{ pekDetails.swift }}</span>
                  </div>
                </div>
              </div>
           </div>
        </div>

        <!-- NEW: Multi-field Stripe Element -->
        <div v-show="paymentMethod === 'bank_card'" class="mt-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
           <div class="bg-white border-2 border-primary/10 p-6 rounded-[32px] space-y-6 shadow-xl shadow-slate-200/50">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Numéro de carte</label>
                <div id="card-number" class="bg-slate-50 p-4 rounded-2xl border border-slate-100"></div>
              </div>
              
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Expiration</label>
                  <div id="card-expiry" class="bg-slate-50 p-4 rounded-2xl border border-slate-100"></div>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">CVV / CVC</label>
                  <div id="card-cvc" class="bg-slate-50 p-4 rounded-2xl border border-slate-100"></div>
                </div>
              </div>

            </div>
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
          {{ paymentMethod === 'bank_card' ? 'Payer maintenant' : 'Confirmer le paiement' }}
        </template>
      </button>
      <p v-if="!isMinimumMet" class="text-center text-rose-500 text-[10px] font-bold mt-3 animate-pulse">
        Montant minimum ({{ fund?.min.toLocaleString() }} FCFA) non atteint.
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
