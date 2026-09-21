<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, Clock, CheckCircle2, AlertCircle, RefreshCw, CreditCard, Smartphone, Landmark, Search, Filter, History as HistoryIcon } from 'lucide-vue-next'
import api from '../api/api'
import { useLanguageStore } from '../stores/language'

const router = useRouter()
const languageStore = useLanguageStore()

const loading = ref(true)
const subscriptions = ref([])
const activeFilter = ref('all') // 'all' | 'validated' | 'pending' | 'rejected'
const searchQuery = ref('')

const fetchData = async () => {
  loading.value = true
  try {
    const response = await api.get('/subscriptions')
    subscriptions.value = response.data.data || response.data
  } catch (error) {
    console.error('Erreur lors du chargement de l\'historique:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})

const filteredSubscriptions = computed(() => {
  return subscriptions.value.filter(sub => {
    const status = (sub.statut || sub.status || sub.payment_status || '').toString().toLowerCase()
    
    // Status Filter
    if (activeFilter.value === 'validated') {
      if (!['succès', 'validé', 'validated', 'paid', 'success'].includes(status)) return false
    } else if (activeFilter.value === 'pending') {
      if (!['en attente', 'pending', 'created', 'initialised', 'in_progress'].includes(status)) return false
    } else if (activeFilter.value === 'rejected') {
      if (!['échec', 'rejeté', 'rejected', 'cancelled', 'failed'].includes(status)) return false
    }

    // Search Filter
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase()
      const productName = (sub.product?.libelle || sub.product?.name || sub.product_name || '').toLowerCase()
      const reference = (sub.reference_transaction || sub.reference || sub.id || '').toString().toLowerCase()
      const paymentMethod = (sub.moyen_paiement || sub.payment_method || '').toLowerCase()
      return productName.includes(query) || reference.includes(query) || paymentMethod.includes(query)
    }

    return true
  })
})

const getStatusBadge = (sub) => {
  const status = (sub.statut || sub.status || sub.payment_status || '').toString().toLowerCase()
  if (['succès', 'validé', 'validated', 'paid', 'success'].includes(status)) {
    return {
      label: languageStore.isEn() ? 'Validated' : 'Validé',
      class: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      icon: CheckCircle2
    }
  }
  if (['échec', 'rejeté', 'rejected', 'cancelled', 'failed'].includes(status)) {
    return {
      label: languageStore.isEn() ? 'Rejected' : 'Rejeté',
      class: 'bg-rose-50 text-rose-700 border-rose-200/60',
      icon: AlertCircle
    }
  }
  return {
    label: languageStore.isEn() ? 'Pending' : 'En attente',
    class: 'bg-amber-50 text-amber-700 border-amber-200/60',
    icon: Clock
  }
}

const getPaymentIcon = (method) => {
  const m = (method || '').toLowerCase()
  if (m.includes('stripe') || m.includes('card') || m.includes('carte')) return CreditCard
  if (m.includes('momo') || m.includes('orange') || m.includes('mobile')) return Smartphone
  return Landmark
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(languageStore.isEn() ? 'en-US' : 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getNetPlacement = (sub) => {
  if (sub.montant_net !== undefined && sub.montant_net !== null) return Number(sub.montant_net)
  const total = Number(sub.montant_total || sub.amount || 0)
  return Math.round(total / 1.01)
}

const getFeesAmount = (sub) => {
  if (sub.frais_gestion !== undefined && sub.frais_gestion !== null) return Number(sub.frais_gestion)
  const net = getNetPlacement(sub)
  const total = Number(sub.montant_total || sub.amount || 0)
  return Math.max(0, total - net)
}

const getTotalAmount = (sub) => {
  return Number(sub.montant_total || sub.amount || 0)
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <!-- Header -->
    <header class="bg-white px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all hover:bg-slate-100">
          <ChevronLeft class="w-6 h-6" />
        </button>
        <div>
          <h1 class="text-xl font-black text-slate-900 leading-tight">
            {{ languageStore.isEn() ? 'Transaction History' : 'Historique des Transactions' }}
          </h1>
          <p class="text-xs text-slate-400 font-medium">
            {{ languageStore.isEn() ? 'Subscriptions & Payments' : 'Souscriptions & Paiements' }}
          </p>
        </div>
      </div>
      <button @click="fetchData" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all hover:bg-slate-100">
        <RefreshCw :class="['w-5 h-5', loading ? 'animate-spin text-primary' : '']" />
      </button>
    </header>

    <!-- Main Container -->
    <main class="flex-1 p-6 space-y-6 max-w-lg mx-auto w-full pb-28">

      <!-- Search & Filter Controls -->
      <div class="space-y-4">
        <!-- Search Input -->
        <div class="relative">
          <Search class="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="languageStore.isEn() ? 'Search by reference, product...' : 'Rechercher par référence, produit...'"
            class="w-full bg-white pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xs"
          />
        </div>

        <!-- Filter Chips -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            @click="activeFilter = 'all'"
            :class="activeFilter === 'all' ? 'bg-[#482010] text-white shadow-md shadow-[#482010]/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'"
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95"
          >
            {{ languageStore.isEn() ? 'All' : 'Tous' }} ({{ subscriptions.length }})
          </button>

          <button
            @click="activeFilter = 'validated'"
            :class="activeFilter === 'validated' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'"
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95"
          >
            {{ languageStore.isEn() ? 'Validated' : 'Validés' }}
          </button>

          <button
            @click="activeFilter = 'pending'"
            :class="activeFilter === 'pending' ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'"
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95"
          >
            {{ languageStore.isEn() ? 'Pending' : 'En attente' }}
          </button>

          <button
            @click="activeFilter = 'rejected'"
            :class="activeFilter === 'rejected' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'"
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95"
          >
            {{ languageStore.isEn() ? 'Rejected' : 'Rejetés' }}
          </button>
        </div>
      </div>

      <!-- Loading Skeleton -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 4" :key="i" class="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4 animate-pulse">
          <div class="flex justify-between items-start">
            <div class="space-y-2">
              <div class="h-3 bg-slate-200 rounded-full w-24"></div>
              <div class="h-5 bg-slate-200 rounded-full w-44"></div>
            </div>
            <div class="w-20 h-6 bg-slate-200 rounded-full"></div>
          </div>
          <div class="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
            <div class="h-4 bg-slate-100 rounded-full w-20"></div>
            <div class="h-4 bg-slate-100 rounded-full w-24 justify-self-end"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredSubscriptions.length === 0" class="bg-white rounded-3xl p-10 text-center border border-slate-100 shadow-xs space-y-4 my-8">
        <div class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
          <HistoryIcon class="w-8 h-8" />
        </div>
        <div class="space-y-1">
          <h3 class="text-base font-bold text-slate-900">
            {{ languageStore.isEn() ? 'No transactions found' : 'Aucune transaction trouvée' }}
          </h3>
          <p class="text-xs text-slate-500 max-w-xs mx-auto">
            {{ searchQuery ? (languageStore.isEn() ? 'Try modifying your search criteria.' : 'Essayez de modifier vos critères de recherche.') : (languageStore.isEn() ? 'Your transaction history will appear here.' : 'Votre historique des opérations apparaîtra ici.') }}
          </p>
        </div>
      </div>

      <!-- Transactions List -->
      <div v-else class="space-y-4">
        <div
          v-for="sub in filteredSubscriptions"
          :key="sub.id"
          class="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-all space-y-4"
        >
          <!-- Card Top: Product & Status -->
          <div class="flex justify-between items-start gap-3">
            <div class="space-y-1">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                {{ sub.reference_transaction || sub.reference || `#SUB-${sub.id}` }}
              </span>
              <h3 class="font-bold text-slate-900 text-sm leading-snug">
                {{ sub.product?.libelle || sub.product?.name || sub.product_name || 'FCP PEK' }}
              </h3>
            </div>

            <!-- Status Badge -->
            <div :class="[getStatusBadge(sub).class, 'px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 shrink-0']">
              <component :is="getStatusBadge(sub).icon" class="w-3.5 h-3.5" />
              <span>{{ getStatusBadge(sub).label }}</span>
            </div>
          </div>

          <!-- Card Info Grid with Placement & Fee breakdown -->
          <div class="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50 text-xs">
            <div>
              <span class="text-slate-400 text-[10px] font-bold uppercase block">{{ languageStore.isEn() ? 'Net Placement' : 'Placement Net' }}</span>
              <span class="text-slate-900 font-bold text-xs mt-0.5 block">
                {{ getNetPlacement(sub).toLocaleString() }} XAF
              </span>
            </div>

            <div class="text-right">
              <span class="text-slate-400 text-[10px] font-bold uppercase block">{{ languageStore.isEn() ? 'Management Fee (1%)' : 'Frais de gestion (1%)' }}</span>
              <span class="text-slate-600 font-medium text-xs mt-0.5 block">
                + {{ getFeesAmount(sub).toLocaleString() }} XAF
              </span>
            </div>

            <div>
              <span class="text-primary text-[10px] font-black uppercase block">{{ languageStore.isEn() ? 'Total Debited' : 'Montant Total Débité' }}</span>
              <span class="text-primary font-black text-sm mt-0.5 block">
                {{ getTotalAmount(sub).toLocaleString() }} XAF
              </span>
            </div>

            <div class="text-right">
              <span class="text-slate-400 text-[10px] font-bold uppercase block">{{ languageStore.isEn() ? 'Shares / Units' : 'Nombre de Parts' }}</span>
              <span class="text-slate-900 font-bold text-xs mt-0.5 block">
                {{ parseFloat(sub.nb_parts || sub.shares_count || 1).toLocaleString() }} part(s)
              </span>
            </div>
          </div>

          <!-- Card Footer: Payment Method & Date -->
          <div class="flex justify-between items-center pt-3 border-t border-slate-50 text-[11px] text-slate-500">
            <div class="flex items-center gap-1.5">
              <component :is="getPaymentIcon(sub.moyen_paiement || sub.payment_method)" class="w-3.5 h-3.5 text-primary" />
              <span class="capitalize font-medium">{{ sub.moyen_paiement || sub.payment_method || 'Paiement' }}</span>
            </div>
            <span class="font-medium text-slate-400">{{ formatDate(sub.created_at) }}</span>
          </div>
        </div>
      </div>

    </main>
  </div>
</template>
