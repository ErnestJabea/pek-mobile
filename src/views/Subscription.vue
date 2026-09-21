<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, Wallet, CreditCard, Smartphone, Loader2, CheckCircle2, ArrowRight, AlertCircle, FileText, Download, Building2, Copy, Check, Info } from 'lucide-vue-next'
import api from '../api/api'
import { useAuthStore } from '../stores/auth'
import { getFrontendDocumentUrl } from '../utils/document'
import BankTransferProofs from '../components/BankTransferProofs.vue'

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

const parts = ref(1)
const inputMode = ref('amount')
const inputAmount = ref(0)
const paymentMethod = ref('card')
const idempotencyKey = ref(null)
const recordedSubscription = ref(null)
const paymentPhone = ref('')
const paymentOptions = ref({ orange_money: false, mtn_momo: false, fee_basis_points: 100, max_investment: 100000000 })

const allowedCheckoutHosts = (import.meta.env.VITE_PAYMENT_ALLOWED_HOSTS || 'checkout.stripe.com')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean)

const redirectToCheckout = (checkoutUrl) => {
  const url = new URL(checkoutUrl)
  if (url.protocol !== 'https:' || !allowedCheckoutHosts.includes(url.hostname.toLowerCase())) {
    throw new Error('URL de paiement non autorisée.')
  }
  window.location.assign(url.toString())
}

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
const bankAccounts = ref([])
const selectedBankId = ref(null)
const selectedBank = computed(() => {
  if (!bankAccounts.value.length) return null
  return bankAccounts.value.find(b => b.id === selectedBankId.value) || bankAccounts.value[0]
})
const pekDetails = computed(() => selectedBank.value)
const copiedField = ref(null)

const copyToClipboard = async (text, fieldName) => {
  if (!text) return
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand('copy')
      textArea.remove()
    }
    copiedField.value = fieldName
    setTimeout(() => {
      copiedField.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy: ', err)
  }
}

const fetchData = async () => {
  try {
    const [productsRes, bankRes, optionsRes] = await Promise.all([
      api.get('/products'),
      api.get('/bank-details'),
      api.get('/payment-options')
    ])
    fund.value = productsRes.data.find(p => p.id == route.params.id)
    bankAccounts.value = Array.isArray(bankRes.data) ? bankRes.data : (bankRes.data ? [bankRes.data] : [])
    if (bankAccounts.value.length > 0 && !selectedBankId.value) {
      selectedBankId.value = bankAccounts.value[0].id
    }
    paymentOptions.value = optionsRes.data
    paymentPhone.value = (authStore.user?.phone || '').replace(/\D/g, '')
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
    return Math.round(inputAmount.value)
  }
  return Math.round(parts.value * fund.value.vl)
})

const fees = computed(() => {
  return Math.floor((totalAmount.value * paymentOptions.value.fee_basis_points + 5000) / 10000)
})

const finalAmount = computed(() => {
  return Number(totalAmount.value) + Number(fees.value)
})

const isMinimumMet = computed(() => {
  if (!fund.value) return false
  return parts.value >= 1 && parseFloat(totalAmount.value) >= Math.max(fund.value.min || 0, fund.value.vl)
})

const handleSubscribe = async () => {
  if (!navigator.onLine) { stripeError.value = 'Une connexion est nécessaire pour initier un paiement.'; showErrorModal.value = true; return }
  const onboardingStatus = authStore.user?.onboarding_status

  if (onboardingStatus !== 'validated') {
    showOnboardingRequiredModal.value = true
    return
  }

  stripeError.value = null
  submitting.value = true
  try {
    idempotencyKey.value ||= window.crypto?.randomUUID?.() || `pek-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const response = await api.post('/subscriptions', {
      product_id: fund.value.id,
      investment_amount: totalAmount.value,
      moyen_paiement: paymentMethod.value,
      ...(paymentMethod.value === 'bank_transfer' ? { bank_detail_id: selectedBank.value?.id } : {}),
      ...(['orange_money', 'mtn_momo'].includes(paymentMethod.value) ? { 
        payment_phone: (paymentPhone.value.replace(/\D/g, '').length === 9 && paymentPhone.value.replace(/\D/g, '').startsWith('6'))
          ? '237' + paymentPhone.value.replace(/\D/g, '')
          : paymentPhone.value.replace(/\D/g, '') 
      } : {})
    }, {
      headers: { 'Idempotency-Key': idempotencyKey.value }
    })
    
    const { subscription, pek_bank_details, payment } = response.data
    recordedSubscription.value = subscription

    if (payment?.redirect_required && payment?.checkout_url) {
      redirectToCheckout(payment.checkout_url)
      return
    }

    if (pek_bank_details) {
      bankAccounts.value = [pek_bank_details]
      selectedBankId.value = pek_bank_details.id
    }

    transactionRef.value = subscription.reference_transaction
    idempotencyKey.value = null
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
      <div v-if="recordedSubscription?.mobile_provider" class="w-full rounded-2xl bg-blue-50 p-4 text-sm space-y-3">
        <p>Validez la demande sur votre téléphone. Le paiement reste en attente tant que sa confirmation n’a pas été reçue.</p>
        <p v-if="recordedSubscription.mobile_state === 'verification_required'">La réponse du prestataire est à vérifier. Ne recommencez pas le débit.</p>
        <button @click="router.push('/my-subscriptions?tab=transactions')" class="rounded-xl bg-primary text-white px-4 py-3">Suivre le paiement</button>
      </div>
      <BankTransferProofs v-if="recordedSubscription?.moyen_paiement === 'bank_transfer'" :subscription="recordedSubscription" class="w-full" />
      <div v-if="paymentMethod === 'bank_transfer' && pekDetails" class="w-full bg-slate-50 rounded-3xl p-6 border border-slate-100 text-left animate-in fade-in duration-300 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-200/60 pb-3">
          <div class="flex items-center gap-2">
            <Building2 class="w-5 h-5 text-primary" />
            <h4 class="text-xs font-black text-slate-900 uppercase tracking-wider">Coordonnées du compte PEK</h4>
          </div>
          <span class="text-[9px] font-black px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full uppercase tracking-wider">
            Virement Bancaire
          </span>
        </div>

        <!-- Details Grid -->
        <div class="space-y-2.5">
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-white p-3 rounded-2xl border border-slate-100">
              <span class="text-[10px] font-bold text-slate-400 uppercase block">Banque</span>
              <span class="font-black text-slate-900 block truncate">{{ pekDetails.bank_name || 'Kori Asset Management' }}</span>
            </div>
            <div class="bg-white p-3 rounded-2xl border border-slate-100">
              <span class="text-[10px] font-bold text-slate-400 uppercase block">Bénéficiaire</span>
              <span class="font-black text-slate-900 block truncate">{{ pekDetails.beneficiary || 'Bénéficiaire non renseigné' }}</span>
            </div>
          </div>

          <div v-if="pekDetails.iban" class="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <span class="text-[10px] font-bold text-slate-400 uppercase block">IBAN</span>
              <span class="font-black text-slate-900 font-mono text-xs truncate block">{{ pekDetails.iban }}</span>
            </div>
            <button 
              type="button" 
              @click="copyToClipboard(pekDetails.iban, 'iban_success')"
              class="px-2.5 py-1.5 bg-slate-50 hover:bg-primary hover:text-white border border-slate-200 text-slate-700 text-[10px] font-bold rounded-xl transition-all shrink-0 flex items-center gap-1 active:scale-95"
            >
              <Copy v-if="copiedField !== 'iban_success'" class="w-3 h-3 text-slate-400" />
              <Check v-else class="w-3 h-3 text-emerald-600" />
              <span>{{ copiedField === 'iban_success' ? 'Copié !' : 'Copier' }}</span>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <div v-if="pekDetails.rib" class="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between gap-1">
              <div class="min-w-0">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">RIB</span>
                <span class="font-black text-slate-900 font-mono text-xs truncate block">{{ pekDetails.rib }}</span>
              </div>
              <button type="button" @click="copyToClipboard(pekDetails.rib, 'rib_success')" class="p-1 text-slate-400 hover:text-primary">
                <Check v-if="copiedField === 'rib_success'" class="w-3.5 h-3.5 text-emerald-600" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>
            </div>

            <div v-if="pekDetails.swift" class="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between gap-1">
              <div class="min-w-0">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">SWIFT / BIC</span>
                <span class="font-black text-slate-900 font-mono text-xs truncate block">{{ pekDetails.swift }}</span>
              </div>
              <button type="button" @click="copyToClipboard(pekDetails.swift, 'swift_success')" class="p-1 text-slate-400 hover:text-primary">
                <Check v-if="copiedField === 'swift_success'" class="w-3.5 h-3.5 text-emerald-600" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="pekDetails.bank_instructions" class="flex flex-col">
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Consignes de virement</span>
          <div class="text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-line bg-white p-4 rounded-2xl border border-slate-100/50 shadow-sm">
            {{ pekDetails.bank_instructions }}
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
          <span class="text-primary font-black">{{ parseFloat(finalAmount).toLocaleString() }} XAF</span>
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
            <span class="text-primary font-black">{{ fund.vl.toLocaleString() }} XAF</span>
          </div>
          <div class="text-right">
            <span class="text-slate-400 text-[10px] block font-black uppercase tracking-tighter mb-1">Niveau Risque</span>
            <span class="text-slate-800 font-black text-xs">{{ fund.risk || 'Modéré' }}</span>
          </div>
        </div>

        <!-- Documentation & Plaquettes (Vignettes PDF) -->
        <div v-if="fund.depliant_url || fund.document_information_url" class="mt-4 pt-4 border-t border-slate-50 space-y-2 text-left">
          <div class="flex justify-between items-center">
            <span class="text-slate-400 text-[10px] block font-black uppercase tracking-wider">Documents réglementaires</span>
            <span class="text-[9px] text-slate-400 font-bold uppercase">PDF</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <!-- Vignette Dépliant -->
            <a 
              v-if="fund.depliant_url" 
              :href="getFrontendDocumentUrl(fund.depliant_url)" 
              target="_blank" 
              download
              class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-rose-50/80 border border-slate-100 hover:border-rose-200 transition-all text-slate-700 hover:text-rose-700 group shadow-xs active:scale-95"
            >
              <div class="flex items-center gap-2.5 min-w-0 pr-1">
                <div class="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <FileText class="w-4 h-4" />
                </div>
                <div class="min-w-0">
                  <span class="block text-xs font-black truncate">Dépliant</span>
                  <span class="block text-[9px] text-slate-400 font-medium truncate">Brochure commerciale</span>
                </div>
              </div>
              <Download class="w-4 h-4 text-slate-400 group-hover:text-rose-600 shrink-0" />
            </a>

            <!-- Vignette Document d'information (DICI) -->
            <a 
              v-if="fund.document_information_url" 
              :href="getFrontendDocumentUrl(fund.document_information_url)" 
              target="_blank" 
              download
              class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/80 border border-slate-100 hover:border-blue-200 transition-all text-slate-700 hover:text-primary group shadow-xs active:scale-95"
            >
              <div class="flex items-center gap-2.5 min-w-0 pr-1">
                <div class="w-8 h-8 rounded-xl bg-blue-100 text-primary flex items-center justify-center shrink-0">
                  <FileText class="w-4 h-4" />
                </div>
                <div class="min-w-0">
                  <span class="block text-xs font-black truncate">Document Info</span>
                  <span class="block text-[9px] text-slate-400 font-medium truncate">Prospectus / DICI</span>
                </div>
              </div>
              <Download class="w-4 h-4 text-slate-400 group-hover:text-primary shrink-0" />
            </a>
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
            Montant (XAF)
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
              step="1"
              min="0"
              placeholder="Ex: 50 000"
              class="w-full bg-white border-2 border-slate-100 rounded-3xl py-5 px-8 text-3xl font-black text-primary focus:border-primary transition-all outline-none"
            >
            <div class="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-black uppercase text-xs tracking-widest">XAF</div>
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
            Soit un investissement de <strong class="text-primary">{{ parseFloat(totalAmount).toLocaleString() }} XAF</strong>.
          </span>
        </div>
      </section>

      <!-- Payment Methods -->
      <section class="space-y-4">
        <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Moyens de paiement</h3>
        <div class="grid grid-cols-1 gap-3">
          <button type="button" @click="paymentMethod = 'card'"
            :class="paymentMethod === 'card' ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700'"
            class="p-4 rounded-2xl border-2 flex items-center gap-3 text-left transition-all">
            <CreditCard class="w-5 h-5" />
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider">Carte bancaire</span>
              <p :class="paymentMethod === 'card' ? 'text-white/70' : 'text-slate-400'" class="text-[10px] mt-1">Paiement immédiat sur la page sécurisée Stripe.</p>
            </div>
          </button>
          <button v-for="operator in ['orange_money', 'mtn_momo']" :key="operator" type="button" @click="paymentMethod = operator" :disabled="!paymentOptions[operator]"
            :class="paymentMethod === operator ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700'"
            class="p-4 rounded-2xl border-2 flex items-center gap-3 text-left transition-all disabled:opacity-50">
            <Smartphone class="w-5 h-5" />
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider">{{ operator === 'orange_money' ? 'Orange Money' : 'MTN Mobile Money' }}</span>
              <p class="text-[10px] mt-1">{{ paymentOptions[operator] ? (paymentOptions.s3p_mode === 'staging' ? 'Disponible en mode test Maviance.' : 'Confirmation du paiement sur votre téléphone.') : 'Temporairement indisponible.' }}</p>
            </div>
          </button>
          <button type="button" @click="paymentMethod = 'bank_transfer'"
            :class="paymentMethod === 'bank_transfer' ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700'"
            class="p-4 rounded-2xl border-2 flex items-center gap-3 text-left transition-all">
            <Wallet class="w-5 h-5" />
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider">Virement bancaire</span>
              <p :class="paymentMethod === 'bank_transfer' ? 'text-white/70' : 'text-slate-400'" class="text-[10px] mt-1">Validation après réception et rapprochement effectif des fonds.</p>
            </div>
          </button>
        </div>

        <!-- Champ numéro de téléphone Mobile Money -->
        <div v-if="['orange_money', 'mtn_momo'].includes(paymentMethod)" class="bg-white p-5 rounded-[24px] border-2 border-primary/20 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <p v-if="paymentOptions.s3p_mode === 'staging'" class="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">Mode test Maviance : utilisez les numéros de recette. Un paiement réussi ici ne crédite aucune part réelle.</p>
          <div class="flex items-center gap-2">
            <Smartphone class="w-4 h-4 text-primary" />
            <span class="text-xs font-black text-slate-800 uppercase tracking-wider">
              Numéro {{ paymentMethod === 'orange_money' ? 'Orange Money' : 'MTN Mobile Money' }}
            </span>
          </div>
          <div class="relative">
            <input 
              v-model="paymentPhone" 
              type="tel" 
              inputmode="tel" 
              placeholder="Ex : 699 00 00 00 ou 237699000000" 
              maxlength="16" 
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-black text-slate-900 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal" 
            />
          </div>
          <p class="text-[11px] text-slate-500 font-medium leading-relaxed">
            Confirmez votre numéro avant de valider. Votre code secret PIN ne vous sera jamais demandé ici.
          </p>
        </div>
        <p v-if="paymentMethod === 'bank_transfer'" class="text-xs text-slate-600">Les parts affichées sont une estimation. La date de valeur sera la date de réception des fonds ; les parts seront calculées avec la VL de cette date.</p>
        <div v-if="paymentMethod === 'bank_transfer'" class="mt-4 bg-white rounded-[28px] p-5 border-2 border-primary/20 shadow-lg shadow-primary/5 space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
          <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div class="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 class="w-5 h-5" />
            </div>
            <div class="text-left">
              <h4 class="text-xs font-black text-slate-900 uppercase tracking-wider">Coordonnées du compte PEK</h4>
              <p class="text-[10px] text-slate-400 font-semibold">À utiliser pour votre virement</p>
            </div>
          </div>

          <!-- Sélecteur de Banque -->
          <div v-if="bankAccounts.length > 1" class="space-y-2 text-left pt-1">
            <label class="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              Choisir la banque pour le virement
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="bank in bankAccounts"
                :key="bank.id"
                type="button"
                @click="selectedBankId = bank.id"
                :class="selectedBankId === bank.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs' : 'border-slate-200 bg-slate-50/80 text-slate-600 hover:border-slate-300'"
                class="p-2.5 rounded-2xl border-2 text-left transition-all active:scale-95 flex items-center gap-2"
              >
                <div :class="selectedBankId === bank.id ? 'bg-primary text-white' : 'bg-white text-slate-400 border border-slate-200'" class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs transition-colors">
                  <Building2 class="w-3.5 h-3.5" />
                </div>
                <span class="text-xs font-bold truncate">{{ bank.bank_name }}</span>
              </button>
            </div>
          </div>

          <div v-if="selectedBank" class="space-y-3 text-left">
            <!-- Banque & Bénéficiaire -->
            <div class="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Banque</span>
                <span class="font-black text-slate-900 text-xs block truncate">{{ selectedBank.bank_name }}</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Bénéficiaire</span>
                <span class="font-black text-slate-900 text-xs block truncate">{{ selectedBank.beneficiary || 'Bénéficiaire non renseigné' }}</span>
              </div>
            </div>

            <!-- IBAN -->
            <div v-if="selectedBank.iban" class="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">IBAN</span>
                <span class="font-black text-slate-900 tracking-wider truncate block font-mono text-xs">{{ selectedBank.iban }}</span>
              </div>
              <button 
                type="button" 
                @click="copyToClipboard(selectedBank.iban, 'iban')"
                class="px-2.5 py-1.5 bg-white hover:bg-primary hover:text-white border border-slate-200 text-slate-700 text-[10px] font-bold rounded-xl transition-all shrink-0 flex items-center gap-1 shadow-2xs active:scale-95"
              >
                <Copy v-if="copiedField !== 'iban'" class="w-3 h-3 text-slate-400" />
                <Check v-else class="w-3 h-3 text-emerald-600" />
                <span>{{ copiedField === 'iban' ? 'Copié !' : 'Copier' }}</span>
              </button>
            </div>

            <!-- RIB & SWIFT -->
            <div class="grid grid-cols-2 gap-3">
              <div v-if="selectedBank.rib" class="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between gap-1">
                <div class="min-w-0">
                  <span class="text-[10px] font-bold text-slate-400 uppercase block">RIB</span>
                  <span class="font-black text-slate-900 font-mono text-xs truncate block">{{ selectedBank.rib }}</span>
                </div>
                <button 
                  type="button" 
                  @click="copyToClipboard(selectedBank.rib, 'rib')"
                  class="p-1.5 text-slate-400 hover:text-primary transition-colors shrink-0"
                  title="Copier RIB"
                >
                  <Check v-if="copiedField === 'rib'" class="w-3.5 h-3.5 text-emerald-600" />
                  <Copy v-else class="w-3.5 h-3.5" />
                </button>
              </div>

              <div v-if="selectedBank.swift" class="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between gap-1">
                <div class="min-w-0">
                  <span class="text-[10px] font-bold text-slate-400 uppercase block">SWIFT / BIC</span>
                  <span class="font-black text-slate-900 font-mono text-xs truncate block">{{ selectedBank.swift }}</span>
                </div>
                <button 
                  type="button" 
                  @click="copyToClipboard(selectedBank.swift, 'swift')"
                  class="p-1.5 text-slate-400 hover:text-primary transition-colors shrink-0"
                  title="Copier SWIFT"
                >
                  <Check v-if="copiedField === 'swift'" class="w-3.5 h-3.5 text-emerald-600" />
                  <Copy v-else class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Consigne explicative / Instructions configurées dans le backoffice -->
            <div v-if="selectedBank.bank_instructions" class="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-2xl text-[11px] text-amber-950 font-medium leading-relaxed flex items-start gap-2.5">
              <Info class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div class="space-y-1">
                <span class="font-black block text-amber-950 text-xs">Instructions de virement :</span>
                <p class="whitespace-pre-line text-[11px] text-amber-900 leading-normal">{{ selectedBank.bank_instructions }}</p>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-4 text-slate-400 text-xs font-medium flex items-center justify-center gap-2">
            <Loader2 class="w-4 h-4 animate-spin text-primary" />
            <span>Chargement des coordonnées bancaires...</span>
          </div>
        </div>
      </section>

      <!-- Summary -->
      <section class="bg-slate-900 rounded-[32px] p-6 text-white space-y-4 shadow-2xl shadow-slate-900/40">
        <div class="flex justify-between items-center text-xs opacity-60">
          <span>Sous-total</span>
          <span>{{ parseFloat(totalAmount).toLocaleString() }} XAF</span>
        </div>
        <div class="flex justify-between items-center text-xs opacity-60">
          <span>Frais de souscription (1%)</span>
          <span>{{ parseFloat(fees).toLocaleString() }} XAF</span>
        </div>
        <div class="pt-4 border-t border-white/10 flex justify-between items-end">
          <div class="space-y-1">
             <span class="text-white/40 text-[10px] font-black uppercase tracking-widest">Total à payer</span>
             <div class="text-2xl font-black text-white leading-none">{{ parseFloat(finalAmount).toLocaleString() }} XAF</div>
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
          {{ ['card', 'mobile_money', 'orange_money', 'mtn_momo'].includes(paymentMethod) ? 'Confirmer et payer' : 'Enregistrer la demande' }}
        </template>
      </button>
      <p v-if="!isMinimumMet" class="text-center text-rose-500 text-[10px] font-bold mt-3 animate-pulse">
        Seuil minimum de {{ Math.max(fund?.min || 0, fund?.vl || 0).toLocaleString() }} XAF non atteint.
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
          <h3 class="text-lg font-black text-slate-900">Demande non enregistrée</h3>
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
            Votre dossier KYC et votre contrôle d’identité doivent être validés avant toute souscription.
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
