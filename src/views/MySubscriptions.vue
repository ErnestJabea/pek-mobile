<script setup>
import { ref, computed, onMounted } from 'vue'
import { Landmark, ChevronLeft, Wallet, CreditCard, Smartphone, ArrowRight, Loader2, CheckCircle2, Clock, AlertCircle, ChevronRight, TrendingUp, TrendingDown, PieChart, Coins, Layers, Sparkles } from 'lucide-vue-next'
import { useRouter, useRoute } from 'vue-router'
import BankTransferProofs from '../components/BankTransferProofs.vue'
import api from '../api/api'
import { useLanguageStore } from '../stores/language'

const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '0,00'
  return Number(val).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const router = useRouter()
const languageStore = useLanguageStore()
const subscriptions = ref([])
const valuation = ref(null)
const loading = ref(true)
const currentPage = ref(1)
const itemsPerPage = 4
const activeTab = ref(useRoute().query.tab === 'transactions' ? 'transactions' : 'positions')

const fetchData = async () => {
  try {
    const [subRes, valRes] = await Promise.all([
      api.get('/subscriptions'),
      api.get('/portfolio/valuation')
    ])
    subscriptions.value = subRes.data.data || subRes.data
    valuation.value = valRes.data
  } catch (error) {
    console.error('Error fetching subscriptions or valuation:', error)
  } finally {
    loading.value = false
  }
}

const fetchSubscriptions = fetchData

const totalPages = computed(() => Math.ceil(subscriptions.value.length / itemsPerPage))

const checkingId = ref(null)
const redirectingId = ref(null)
const showStatusModal = ref(false)
const statusModalTitle = ref('')
const statusModalMessage = ref('')
const statusModalType = ref('success')

const openStatusModal = (title, message, type = 'success') => {
  statusModalTitle.value = title
  statusModalMessage.value = message
  statusModalType.value = type
  showStatusModal.value = true
}

const verifyPayment = async (subId) => {
  checkingId.value = subId
  try {
    const response = await api.post(`/subscriptions/${subId}/check-status`)
    const paid = response.data.subscription?.statut === 'Succès' || ['paid', 'success'].includes(response.data.status)
    openStatusModal(paid ? 'Paiement confirmé' : 'État du paiement', response.data.message, paid ? 'success' : 'info')
    await fetchData()
  } catch (error) {
    console.error('Error checking payment status:', error)
    openStatusModal(
      'Échec de la vérification ⚠️',
      error.response?.data?.message || 'Erreur lors de la vérification du paiement.',
      'error'
    )
  } finally {
    checkingId.value = null
  }
}

const allowedCheckoutHosts = (import.meta.env.VITE_PAYMENT_ALLOWED_HOSTS || 'checkout.stripe.com')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean)

const resumeHostedPayment = async (subId) => {
  redirectingId.value = subId
  try {
    const response = await api.post(`/subscriptions/${subId}/payment-session`)
    if (response.data.payment?.provider === 's3p') {
      await fetchData()
      openStatusModal('État du paiement', response.data.message, 'info')
      return
    }
    if (response.data.payment?.status === 'paid') {
      await fetchData()
      openStatusModal('Paiement confirmé ✅', 'Vos parts sont créditées.', 'success')
      return
    }

    const url = new URL(response.data.payment?.checkout_url)
    if (url.protocol !== 'https:' || !allowedCheckoutHosts.includes(url.hostname.toLowerCase())) {
      throw new Error('URL de paiement non autorisée.')
    }
    window.location.assign(url.toString())
  } catch (error) {
    openStatusModal(
      'Paiement indisponible',
      error.response?.data?.message || error.message || 'Impossible de reprendre le paiement.',
      'error'
    )
  } finally {
    redirectingId.value = null
  }
}

const paginatedSubscriptions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return subscriptions.value.slice(start, end)
})

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}

const getStatusClass = (status) => {
  switch (status) {
    case 'Succès': return 'bg-emerald-50 text-emerald-600 border-emerald-100'
    case 'Validé': return 'bg-emerald-50 text-emerald-600 border-emerald-100'
    case 'En attente': return 'bg-amber-50 text-amber-600 border-amber-100'
    case 'Échec': return 'bg-rose-50 text-rose-600 border-rose-100'
    default: return 'bg-slate-50 text-slate-600 border-slate-100'
  }
}

const getStatusIcon = (status) => {
  switch (status) {
    case 'Succès': return CheckCircle2
    case 'Validé': return CheckCircle2
    case 'En attente': return Clock
    case 'Échec': return AlertCircle
    default: return Clock
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <!-- Skeleton loader covering the entire view (including Appbar) -->
    <div v-if="loading" class="flex-1 flex flex-col animate-pulse">
      <!-- Skeleton Header -->
      <header class="bg-white px-6 py-6 border-b border-slate-100 flex items-center gap-4">
        <div class="w-10 h-10 bg-slate-100 rounded-xl"></div>
        <div class="h-6 bg-slate-200 rounded-lg w-32"></div>
      </header>

      <!-- Skeleton Main Content -->
      <main class="flex-1 p-6 space-y-6">
        <div class="space-y-4">
          <div v-for="i in 3" :key="i" class="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
            <div class="flex justify-between items-start">
              <div class="space-y-2">
                <div class="h-3 bg-slate-200 rounded-full w-20"></div>
                <div class="h-5 bg-slate-200 rounded-full w-40"></div>
              </div>
              <div class="w-20 h-6 bg-slate-200 rounded-full"></div>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
              <div class="space-y-2">
                <div class="h-3 bg-slate-100 rounded-full w-12"></div>
                <div class="h-5 bg-slate-200 rounded-full w-16"></div>
              </div>
              <div class="space-y-2 flex flex-col items-end">
                <div class="h-3 bg-slate-100 rounded-full w-16"></div>
                <div class="h-5 bg-slate-200 rounded-full w-24"></div>
              </div>
            </div>

            <div class="flex flex-col gap-2 border-t border-slate-50 pt-3">
              <div class="flex justify-between items-center">
                <div class="h-3 bg-slate-100 rounded-full w-32"></div>
                <div class="h-3 bg-slate-100 rounded-full w-16"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Actual Content -->
    <template v-else>
      <!-- Header -->
      <header class="bg-white px-6 py-6 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-10">
        <button @click="router.back()" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all">
          <ChevronLeft class="w-6 h-6" />
        </button>
        <h2 class="text-xl font-bold text-slate-900">{{ languageStore.isEn() ? 'My Portfolio & Subscriptions' : 'Portefeuille & Souscriptions' }}</h2>
      </header>

      <main class="flex-1 flex flex-col p-6 pb-24 space-y-6">
        
        <!-- Global Portfolio Valuation Banner -->
        <section v-if="valuation && valuation.valorisation_totale > 0" class="bg-[#482010] rounded-[32px] p-6 text-white shadow-xl shadow-[#482010]/20 space-y-5 text-left border border-[#E8B010]/20 relative overflow-hidden">
          <div class="flex justify-between items-start">
            <div class="space-y-1">
              <span class="text-[#E8B010] text-[10px] font-black uppercase tracking-widest block">{{ languageStore.isEn() ? 'Total Portfolio Valuation' : 'Portefeuille Total ' }}</span>
              <div class="text-3xl font-black text-white leading-tight">
                {{ valuation.valorisation_totale.toLocaleString() }} XAF
              </div>
            </div>
            <!-- <div :class="valuation.plus_value_totale >= 0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'" class="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black border backdrop-blur-md">
              <TrendingUp class="w-3.5 h-3.5" />
              <span>{{ valuation.plus_value_totale >= 0 ? '+' : '' }}{{ valuation.rendement_global.toFixed(2) }}%</span>
            </div> -->
          </div>

          <div class="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs">
            <div>
              <span class="text-white/60 text-[10px] font-black uppercase tracking-wider block">{{ languageStore.isEn() ? 'Capital Invested' : 'Total Investi' }}</span>
              <span class="text-white font-bold text-sm mt-0.5 block">{{ valuation.cout_revient_total.toLocaleString() }} XAF</span>
            </div>
            <div>
              <span class="text-white/60 text-[10px] font-black uppercase tracking-wider block">{{ languageStore.isEn() ? 'Unrealized Gain/Loss' : 'Plus-Value ' }}</span>
              <span :class="valuation.plus_value_totale >= 0 ? 'text-emerald-400' : 'text-rose-400'" class="font-bold text-sm mt-0.5 block">
                {{ valuation.plus_value_totale >= 0 ? '+' : '' }}{{ valuation.plus_value_totale.toLocaleString() }} XAF
              </span>
            </div>
          </div>
        </section>

        <!-- View Navigation Tabs (Positions par Produit / Historique Souscriptions) -->
        <div v-if="subscriptions.length > 0" class="flex bg-slate-200/60 p-1.5 rounded-2xl gap-1.5 border border-slate-200/50">
          <button
            @click="activeTab = 'positions'"
            :class="activeTab === 'positions' ? 'bg-white text-[#482010] shadow-sm font-extrabold' : 'text-slate-600 font-bold hover:text-slate-900'"
            class="flex-1 py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-95 min-w-0"
          >
            <PieChart class="w-4 h-4 text-[#E8B010] shrink-0" />
            <span class="truncate">{{ languageStore.isEn() ? 'Investments' : 'Investissements' }}</span>
          </button>

          <button
            @click="activeTab = 'transactions'"
            :class="activeTab === 'transactions' ? 'bg-white text-[#482010] shadow-sm font-extrabold' : 'text-slate-600 font-bold hover:text-slate-900'"
            class="flex-1 py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-95 min-w-0"
          >
            <Coins class="w-4 h-4 text-primary shrink-0" />
            <span class="truncate">{{ languageStore.isEn() ? 'Subscriptions' : 'Souscriptions' }}</span>
          </button>
        </div>

        <!-- Empty State -->
        <div v-if="subscriptions.length === 0" class="flex-1 flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in zoom-in duration-500 py-12">
          <div class="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center">
            <Wallet class="w-10 h-10 text-primary/30" />
          </div>
          
          <div class="space-y-2">
            <h3 class="text-xl font-bold text-slate-900">{{ languageStore.isEn() ? 'No investments yet' : 'Aucun investissement' }}</h3>
            <p class="text-slate-500 text-sm max-w-[240px] mx-auto leading-relaxed">
              {{ languageStore.isEn() ? 'You have not subscribed to any fund yet. Start growing your savings today.' : 'Vous n\'avez pas encore souscrit à un fonds. Commencez dès maintenant à faire fructifier votre épargne.' }}
            </p>
          </div>

          <router-link to="/catalog" class="inline-flex items-center gap-2 bg-primary text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-wider">
            {{ languageStore.isEn() ? 'Browse Catalog' : 'Parcourir le catalogue' }}
            <ArrowRight class="w-4 h-4" />
          </router-link>
        </div>

        <!-- TAB 1: Consolidations / Positions par Produit (PMP, Parts Totales, Valorisation) -->
        <div v-else-if="activeTab === 'positions'" class="space-y-4 text-left">
          <div v-if="!valuation || valuation.product_positions.length === 0" class="bg-white p-6 rounded-3xl border border-slate-100 text-center space-y-2 text-slate-500 text-xs">
            <Clock class="w-6 h-6 text-amber-500 mx-auto" />
            <p class="font-semibold">{{ languageStore.isEn() ? 'Your subscriptions are pending validation or confirmation.' : 'Vos souscriptions sont en cours de validation ou de paiement.' }}</p>
          </div>

          <div v-for="pos in valuation?.product_positions || []" :key="pos.product_id" class="bg-white p-5 rounded-[32px] border border-[#E8B010]/20 shadow-sm space-y-4 hover:shadow-md transition-all">
            <div class="flex justify-between items-start">
              <div>
                <span class="text-primary text-[10px] font-black uppercase tracking-widest">{{ pos.produit }}</span>
                <h4 class="font-bold text-slate-900 text-base mt-0.5">{{ pos.code_produit || pos.produit }}</h4>
              </div>
              <!-- <span :class="pos.plus_value >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'" class="px-3 py-1 rounded-full text-[10px] font-black border">
                {{ pos.plus_value >= 0 ? '+' : '' }}{{ pos.rendement_pct.toFixed(2) }}%
              </span> -->
            </div>

            <div class="space-y-2 pt-3 border-t border-slate-100 text-xs">
              <div class="flex justify-between items-center gap-2">
                <span class="text-slate-400 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">{{ languageStore.isEn() ? 'Total Shares Owned' : 'Nombre de parts' }}</span>
                <span class="text-slate-900 font-black text-sm tabular-nums whitespace-nowrap">{{ pos.nb_parts_total.toLocaleString() }} parts</span>
              </div>
              <div class="flex justify-between items-center gap-2">
                <span class="text-slate-400 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">{{ languageStore.isEn() ? 'Current Position Value' : 'Valorisation' }}</span>
                <span class="text-primary font-black text-sm tabular-nums whitespace-nowrap">{{ formatCurrency(pos.valorisation_actuelle) }} XAF</span>
              </div>
            </div>

            <!-- Mesures Financières Consolidées (VL, Plus-Value) -->
            <div class="grid grid-cols-2 gap-3 text-center">
              <!-- VL Actuelle -->
              <div class="bg-gradient-to-b from-[#FAF8F5] to-[#F5EFEB] rounded-2xl p-3 border border-[#E8B010]/20 flex flex-col justify-center shadow-xs">
                <span class="text-[#8C7A70] text-[10px] font-bold uppercase tracking-wider block whitespace-nowrap">
                  {{ languageStore.isEn() ? 'Current NAV' : 'VL Actuelle' }}
                </span>
                <div class="mt-1">
                  <span class="text-sm font-black text-[#3A190C] tabular-nums block whitespace-nowrap">
                    {{ formatCurrency(pos.vl_actuelle) }}
                  </span>
                  <span class="text-[9px] font-bold text-[#8C7A70] uppercase tracking-widest block mt-0.5">XAF</span>
                </div>
              </div>

              <!-- Plus-Value -->
              <div 
                :class="pos.plus_value >= 0 
                  ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-900 shadow-emerald-500/5' 
                  : 'bg-rose-50/80 border-rose-200/80 text-rose-900 shadow-rose-500/5'"
                class="rounded-2xl p-3 border flex flex-col justify-center shadow-xs transition-all"
              >
                <div class="flex items-center justify-center gap-1.5">
                  <component 
                    :is="pos.plus_value >= 0 ? TrendingUp : TrendingDown" 
                    class="w-3.5 h-3.5 shrink-0" 
                    :class="pos.plus_value >= 0 ? 'text-emerald-600' : 'text-rose-600'" 
                  />
                  <span 
                    class="text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
                    :class="pos.plus_value >= 0 ? 'text-emerald-700' : 'text-rose-700'"
                  >
                    {{ languageStore.isEn() ? 'Net Gain' : 'Plus-Value' }}
                  </span>
                </div>
                <div class="mt-1">
                  <span 
                    :class="pos.plus_value >= 0 ? 'text-emerald-700' : 'text-rose-700'"
                    class="text-sm font-black tabular-nums block whitespace-nowrap"
                  >
                    {{ pos.plus_value >= 0 ? '+' : '' }}{{ formatCurrency(pos.plus_value) }}
                  </span>
                  <span 
                    :class="pos.plus_value >= 0 ? 'text-emerald-600/70' : 'text-rose-600/70'"
                    class="text-[9px] font-bold uppercase tracking-widest block mt-0.5"
                  >
                    XAF
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 2: Historique des Souscriptions individuelles -->
        <div v-else-if="activeTab === 'transactions'" class="space-y-4 text-left">
          <div v-for="sub in paginatedSubscriptions" :key="sub.id" class="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
            <div class="flex justify-between items-start">
              <div class="space-y-1">
                <span class="text-primary text-[10px] font-black uppercase tracking-widest">{{ sub.product?.libelle }}</span>
                <h4 class="font-bold text-slate-900">{{ sub.product?.name }}</h4>
              </div>
              <div :class="getStatusClass(sub.statut)" class="px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 border">
                <component :is="getStatusIcon(sub.statut)" class="w-3 h-3" />
                {{ sub.statut }}
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50 text-xs">
              <div>
                <span class="text-slate-400 text-[10px] block font-black uppercase tracking-tighter mb-0.5">Placement Net</span>
                <span class="text-slate-900 font-black">{{ (sub.montant_net !== undefined && sub.montant_net !== null ? sub.montant_net : Math.round(sub.montant_total / 1.01)).toLocaleString() }} XAF</span>
              </div>
              <div class="text-right">
                <span class="text-slate-400 text-[10px] block font-black uppercase tracking-tighter mb-0.5">Frais de gestion (1%)</span>
                <span class="text-slate-600 font-bold">+ {{ (sub.frais_gestion !== undefined && sub.frais_gestion !== null ? sub.frais_gestion : Math.max(0, sub.montant_total - Math.round(sub.montant_total / 1.01))).toLocaleString() }} XAF</span>
              </div>
              <div>
                <span class="text-primary text-[10px] block font-black uppercase tracking-tighter mb-0.5">Montant Total Débité</span>
                <span class="text-primary font-black">{{ parseFloat(sub.montant_total).toLocaleString() }} XAF</span>
              </div>
              <div class="text-right">
                <span class="text-slate-400 text-[10px] block font-black uppercase tracking-tighter mb-0.5">Parts</span>
                <span class="text-slate-900 font-black">{{ parseFloat(sub.nb_parts).toLocaleString() }}</span>
              </div>
            </div>

            <div class="flex flex-col gap-1 text-[10px] text-slate-400 font-bold border-t border-slate-50 pt-3">
              <div class="flex justify-between items-center">
                <span>Réf PEK : <span class="text-slate-600 font-black">{{ sub.reference_transaction }}</span></span>
                <span class="italic font-normal">{{ new Date(sub.created_at).toLocaleDateString() }}</span>
              </div>
              <div v-if="sub.maviance_transaction_ref" class="flex justify-between items-center">
                <span>Réf Maviance : <span class="text-slate-600 font-black truncate max-w-[200px]">{{ sub.maviance_transaction_ref }}</span></span>
              </div>
            </div>

            <!-- Bouton premium pour forcer la vérification de paiement -->
            <BankTransferProofs v-if="['bank_transfer', 'virement'].includes(sub.moyen_paiement)" :subscription="sub" />
            <div v-if="sub.mobile_provider" class="text-xs space-y-2 rounded-xl bg-slate-50 p-3">
              <p class="font-semibold">{{ sub.mobile_provider === 'orange_money' ? 'Orange Money' : 'MTN Mobile Money' }}</p>
              <p v-if="sub.valuation_status === 'staging_only'" class="font-semibold text-amber-800">Paiement de test réussi — aucune part réelle créditée.</p>
              <p v-if="sub.s3p_ptn" class="break-all">Référence opérateur : {{ sub.s3p_ptn }}</p>
              <p v-if="sub.s3p_receipt_number">Reçu opérateur : {{ sub.s3p_receipt_number }}</p>
              <p v-if="sub.mobile_state === 'errored' && sub.s3p_error_code">Code de retour : {{ sub.s3p_error_code }} — conservez votre référence PEK pour le support.</p>
              <p v-if="sub.valuation_status === 'awaiting_payment_date'">Paiement confirmé. La date de réception reste à rapprocher avant attribution des parts.</p>
              <button v-if="sub.mobile_state === 'quote_failed'" @click="resumeHostedPayment(sub.id)" :disabled="redirectingId === sub.id" class="w-full rounded-xl bg-primary text-white py-3 disabled:opacity-50">Réessayer la préparation du paiement</button>
              <p v-if="sub.mobile_state === 'quote_failed'">Le paiement n’a pas été transmis à l’opérateur.</p>
              <p v-if="sub.valuation_status === 'awaiting_nav'">Fonds reçus. Les parts attendent la VL du {{ sub.value_date?.slice(0, 10) }}.</p>
              <p v-if="sub.mobile_state === 'simulation_review'">Opération de simulation exclue du portefeuille. Contactez le support.</p>
              <button v-if="sub.mobile_state === 'errored'" @click="router.push(`/subscribe/${sub.product_id}`)" class="underline text-primary">Créer une nouvelle demande après cet échec confirmé</button>
              <p>{{ { preparing: 'Préparation du paiement', submitted: 'Confirmez sur votre téléphone', pending: 'En attente de confirmation', verification_required: 'Résultat à vérifier — ne relancez pas de débit', success: 'Paiement confirmé', errored: 'Paiement non abouti', reversed: 'Paiement annulé par le prestataire — contactez le support' }[sub.mobile_state] || 'En attente' }}</p>
              <button v-if="!['success', 'reversed'].includes(sub.mobile_state)" @click="verifyPayment(sub.id)" :disabled="checkingId === sub.id" class="w-full rounded-xl bg-primary text-white py-3 disabled:opacity-50">{{ checkingId === sub.id ? 'Vérification…' : 'Vérifier le paiement' }}</button>
            </div>
            <div v-if="sub.statut !== 'Succès' && ['card', 'mobile_money'].includes(sub.moyen_paiement)" class="pt-2">
              <button
                @click="resumeHostedPayment(sub.id)"
                :disabled="redirectingId === sub.id"
                class="w-full bg-primary text-white text-xs font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:bg-slate-300"
              >
                <Loader2 v-if="redirectingId === sub.id" class="w-4 h-4 animate-spin" />
                <Smartphone v-if="sub.moyen_paiement === 'mobile_money' && redirectingId !== sub.id" class="w-4 h-4" />
                <CreditCard v-else-if="redirectingId !== sub.id" class="w-4 h-4" />
                {{ redirectingId === sub.id ? 'Ouverture du paiement...' : 'Payer maintenant' }}
              </button>
            </div>

            <div v-if="sub.statut === 'En attente' && sub.maviance_transaction_ref && ['mobile_money', 'orange_money', 'mtn_momo'].includes(sub.moyen_paiement)" class="pt-2">
              <button 
                @click="verifyPayment(sub.id)"
                :disabled="checkingId === sub.id"
                class="w-full bg-primary/5 hover:bg-primary hover:text-white text-primary text-xs font-bold py-3 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 border border-primary/10 hover:border-transparent active:scale-[0.98]"
              >
                <Loader2 v-if="checkingId === sub.id" class="w-4 h-4 animate-spin" />
                <Clock v-else class="w-4 h-4" />
                {{ checkingId === sub.id ? 'Vérification en cours...' : 'Vérifier le statut du paiement' }}
              </button>
            </div>
          </div>

          <!-- Pagination Controls -->
          <div v-if="totalPages > 1" class="flex items-center justify-between pt-4 pb-8">
            <button 
              @click="prevPage" 
              :disabled="currentPage === 1"
              :class="currentPage === 1 ? 'opacity-30' : 'active:scale-95'"
              class="flex items-center gap-2 text-slate-600 font-black uppercase text-[10px] bg-white border border-slate-100 px-4 py-3 rounded-2xl transition-all"
            >
              <ChevronLeft class="w-4 h-4" />
              {{ languageStore.isEn() ? 'Previous' : 'Précédent' }}
            </button>

            <span class="text-slate-400 font-black text-[10px] uppercase">
              Page {{ currentPage }} / {{ totalPages }}
            </span>

            <button 
              @click="nextPage" 
              :disabled="currentPage === totalPages"
              :class="currentPage === totalPages ? 'opacity-30' : 'active:scale-95'"
              class="flex items-center gap-2 text-slate-600 font-black uppercase text-[10px] bg-white border border-slate-100 px-4 py-3 rounded-2xl transition-all"
            >
              {{ languageStore.isEn() ? 'Next' : 'Suivant' }}
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </template>

    <!-- Premium Verification Status Modal Window -->
    <div v-if="showStatusModal" class="fixed inset-0 z-[10000] flex items-end justify-center p-6 sm:items-center">
      <!-- Backdrop with glassmorphism blur -->
      <div @click="showStatusModal = false" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"></div>
      
      <!-- Modal card -->
      <div class="relative w-full max-w-sm bg-white rounded-[36px] p-8 shadow-2xl border border-slate-100/50 z-10 animate-in slide-in-from-bottom duration-300 text-center space-y-6">
        <!-- Icon wrapper based on status -->
        <div 
          :class="statusModalType === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'" 
          class="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
        >
          <CheckCircle2 v-if="statusModalType === 'success'" class="w-8 h-8" />
          <AlertCircle v-else class="w-8 h-8" />
        </div>
        
        <!-- Text details -->
        <div class="space-y-2">
          <h3 class="text-lg font-black text-slate-900">{{ statusModalTitle }}</h3>
          <p class="text-slate-500 font-bold text-xs leading-relaxed px-2">
            {{ statusModalMessage }}
          </p>
        </div>
        
        <!-- Primary Action Button -->
        <button 
          @click="showStatusModal = false"
          :class="statusModalType === 'success' ? 'bg-primary shadow-primary/20' : 'bg-slate-900 shadow-slate-900/20'"
          class="w-full text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
        >
          Fermer
        </button>
      </div>
    </div>
  </div>
</template>
