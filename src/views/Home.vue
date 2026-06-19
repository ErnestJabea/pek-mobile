<script setup>
import { ref, onMounted, computed } from 'vue'
import { ArrowUpRight, Zap, Loader2, AlertCircle, CheckCircle2, X, Plus, Info } from 'lucide-vue-next'
import api from '../api/api'

const stats = ref(null)
const featuredFunds = ref([])
const loading = ref(true)
const activeBarIndex = ref(null)
const showRedeemModal = ref(false)

const selectBar = (index) => {
  activeBarIndex.value = index
}

const fetchData = async () => {
  try {
    const [statsRes, productsRes] = await Promise.all([
      api.get('/dashboard-stats'),
      api.get('/products')
    ])
    stats.value = statsRes.data
    featuredFunds.value = productsRes.data.slice(0, 3)
    if (chartBars.value.length > 0) {
      activeBarIndex.value = chartBars.value.length - 1
    }
  } catch (error) {
    console.error('Error fetching home data:', error)
  } finally {
    loading.value = false
  }
}

const selectedProduct = ref(null)

const selectedHistory = computed(() => {
  const history = selectedProduct.value?.history || []
  return history
    .map(item => ({
      date: item.date,
      vl: parseFloat(item.vl)
    }))
    .filter(item => Number.isFinite(item.vl))
})

const selectedLatestVl = computed(() => {
  if (!selectedProduct.value) return 0
  const latestHistoryItem = selectedHistory.value[selectedHistory.value.length - 1]
  return latestHistoryItem?.vl || parseFloat(selectedProduct.value.vl) || 0
})

const selectedVariation = computed(() => {
  if (selectedHistory.value.length < 2) return null
  const first = selectedHistory.value[0].vl
  const latest = selectedLatestVl.value
  if (!first) return null
  return ((latest - first) / first) * 100
})

const selectedChartBars = computed(() => {
  if (selectedHistory.value.length === 0) return []

  const vls = selectedHistory.value.map(item => item.vl)
  const minVl = Math.min(...vls)
  const maxVl = Math.max(...vls)
  const range = maxVl - minVl || 1

  return selectedHistory.value.map(item => ({
    height: ((item.vl - minVl) / range) * 65 + 20,
    label: item.date,
    vl: item.vl,
    displayValue: `${item.vl.toLocaleString()} FCFA`
  }))
})

const openProductDetails = (product) => {
  selectedProduct.value = product
}

const closeProductDetails = () => {
  selectedProduct.value = null
}



const chartData = computed(() => {
  if (featuredFunds.value.length === 0) return []
  return featuredFunds.value[0].history || []
})

const chartBars = computed(() => {
  const data = chartData.value
  if (data.length === 0) {
    // Fallback dynamique si aucun historique n'existe encore
    return Array.from({ length: 8 }, (_, i) => ({
      height: 35 + i * 8,
      label: 'Sem ' + (i + 1),
      displayValue: 'En attente'
    }))
  }

  const vls = data.map(d => d.vl)
  const minVl = Math.min(...vls)
  const maxVl = Math.max(...vls)
  const range = maxVl - minVl || 1

  return data.map(item => {
    // Échelle progressive de hauteur (25% à 95%)
    const percentage = ((item.vl - minVl) / range) * 70 + 25
    return {
      height: percentage,
      label: item.date,
      displayValue: `${item.vl.toLocaleString()} FCFA`
    }
  })
})

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div v-if="loading" class="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
    <Loader2 class="w-10 h-10 text-primary animate-spin" />
    <p class="text-slate-400 font-medium">Chargement de votre espace...</p>
  </div>
  <div v-else class="px-6 py-4 space-y-8 text-left">
    <!-- Welcome Header / Identity Card -->
    <section class="bg-primary rounded-3xl p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden flex flex-col gap-3">
      <div class="relative z-10">
        <span class="text-white/60 text-xs font-semibold uppercase tracking-wider block">Plan d'Épargne Kori</span>
        <h2 class="text-2xl font-black mt-1">Bonjour, {{ stats?.user?.first_name || 'Investisseur' }}</h2>
        <p v-if="stats?.onboarding_status === 'validated'" class="text-emerald-400 text-xs mt-1 font-bold leading-relaxed flex items-center gap-1.5">
         
          Votre compte est actif et prêt pour vos investissements.
        </p>
        <p v-else-if="stats?.onboarding_status === 'completed'" class="text-white/80 text-xs mt-1 font-semibold leading-relaxed">
          Votre dossier d'onboarding est en cours d'examen.
        </p>
        <p v-else-if="stats?.onboarding_status === 'rejected'" class="text-rose-400 text-xs mt-1 font-bold leading-relaxed">
          ⚠️ Votre dossier nécessite des corrections.
        </p>
        <p v-else class="text-white/80 text-xs mt-1 font-semibold leading-relaxed">
          Bienvenue dans votre espace. Complétez votre onboarding pour activer votre compte.
        </p>
      </div>
      <div class="absolute -right-10 -bottom-10 w-36 h-36 bg-accent/20 rounded-full blur-3xl"></div>
    </section>

    <!-- Case 1: Onboarding NOT completed (and not rejected) -->
    <div v-if="!stats?.onboarding_completed && stats?.onboarding_status !== 'rejected'" class="space-y-6">
      <section class="bg-amber-500 rounded-3xl p-6 text-white relative overflow-hidden flex flex-col gap-4 animate-in slide-in-from-bottom duration-500 text-left">
        <div class="relative z-10 space-y-2">
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-black leading-none">Complétez votre Onboarding</h3>
          </div>
          <p class="text-white/90 text-xs font-semibold leading-relaxed">
            Pour pouvoir ouvrir votre compte titres réglementé et souscrire à nos fonds, vous devez compléter votre profil de connaissance client.
          </p>
        </div>
        <router-link to="/onboarding" class="bg-white text-amber-600 text-center font-black py-3 rounded-2xl shadow-lg hover:bg-slate-50 transition-all text-xs uppercase tracking-wider">
          Remplir mon dossier réglementaire
        </router-link>
        <div class="absolute -right-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      </section>

      <!-- New CTA Card: encourage user to invest (show catalog) -->
      <section class="bg-gradient-to-br from-primary to-slate-900 rounded-[32px] p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden flex flex-col gap-4 animate-in slide-in-from-bottom duration-500 text-left">
        <div class="relative z-10 space-y-2">
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-black leading-none">Prêt à investir ?</h3>
          </div>
          <p class="text-white/80 text-xs font-semibold leading-relaxed">
            Découvrez dès maintenant notre catalogue de fonds de placement. Explorez nos opportunités et préparez vos futurs investissements.
          </p>
        </div>
        <router-link to="/catalog" class="bg-white text-primary text-center font-black py-3 rounded-2xl shadow-lg hover:bg-slate-50 transition-all text-xs uppercase tracking-wider relative z-10">
          Découvrir les fonds de placement
        </router-link>
        <!-- Circle overlay decoration -->
        <div class="absolute -right-10 -bottom-10 w-32 h-32 bg-accent/25 rounded-full blur-2xl"></div>
      </section>
    </div>

    <!-- Case 2: Onboarding COMPLETED (waiting review) OR REJECTED -->
    <div v-else-if="stats?.onboarding_status === 'completed' || stats?.onboarding_status === 'rejected'" class="space-y-6">
      
      <!-- Rejection Card -->
      <section v-if="stats?.onboarding_status === 'rejected'" class="bg-rose-50 border border-rose-100 rounded-[32px] p-6 shadow-xl shadow-rose-200/20 space-y-6 text-left animate-in slide-in-from-bottom duration-500">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
            <AlertCircle class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-sm font-black text-rose-900 uppercase">Dossier Rejeté</h3>
            <p class="text-[10px] text-rose-500 font-bold">Des corrections sont nécessaires</p>
          </div>
        </div>
        
        <p class="text-xs text-rose-800 font-semibold leading-relaxed bg-white/50 border border-rose-100/50 p-4 rounded-xl">
          <span class="block font-black text-[10px] uppercase text-rose-500 mb-1">Motif du rejet :</span>
          "{{ stats?.user?.onboarding_session?.payload?.rejection_reason || 'Veuillez vérifier les informations et documents fournis.' }}"
        </p>

        <router-link to="/onboarding" class="block w-full bg-rose-600 text-white text-center font-black py-3 rounded-2xl shadow-lg hover:bg-rose-700 transition-all text-xs uppercase tracking-wider">
          Corriger mon dossier d'onboarding
        </router-link>
      </section>

      <!-- Submission Pending Card -->
      <section v-else class="bg-white border border-slate-100 rounded-[32px] p-6 shadow-xl shadow-slate-200/40 space-y-6 text-left animate-in slide-in-from-bottom duration-500">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
            <CheckCircle2 class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-sm font-black text-slate-900 uppercase">Dossier Soumis</h3>
            <p class="text-[10px] text-slate-400 font-bold">En cours de validation</p>
          </div>
        </div>
        
        <p class="text-xs text-slate-500 font-medium leading-relaxed">
          Votre dossier d'onboarding complet (Fiche KYC, Profil Investisseur et Questionnaire LAB/FT) a été signé électroniquement et transmis avec succès à nos équipes. 
        </p>

        <div class="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-400 font-bold uppercase tracking-tighter">Destinataire</span>
            <span class="text-slate-700 font-bold">Kori Asset Management</span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-400 font-bold uppercase tracking-tighter">Statut Diligence</span>
            <span class="text-primary font-black uppercase tracking-wider text-[9px] bg-primary/5 px-2.5 py-1 rounded-full">Examen Réglementaire</span>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-blue-50 text-primary p-4 rounded-2xl border border-blue-100/50 text-[10px] font-bold">
          <AlertCircle class="w-4 h-4 shrink-0 text-primary" />
          <span>Vous recevrez un e-mail dès que la conformité aura validé votre ouverture de compte.</span>
        </div>
      </section>

      <!-- New CTA Card: encourage user to invest (show catalog) -->
      <section class="bg-gradient-to-br from-primary to-slate-900 rounded-[32px] p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden flex flex-col gap-4 animate-in slide-in-from-bottom duration-500 text-left">
        <div class="relative z-10 space-y-2">
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-black leading-none">Prêt à investir ?</h3>
          </div>
          <p class="text-white/80 text-xs font-semibold leading-relaxed">
            Pendant que notre équipe valide votre dossier, découvrez notre catalogue de fonds de placement. Explorez nos opportunités et préparez vos futurs investissements.
          </p>
        </div>
        <router-link to="/catalog" class="bg-white text-primary text-center font-black py-3 rounded-2xl shadow-lg hover:bg-slate-50 transition-all text-xs uppercase tracking-wider relative z-10">
          Découvrir les fonds de placement
        </router-link>
        <!-- Circle overlay decoration -->
        <div class="absolute -right-10 -bottom-10 w-32 h-32 bg-accent/25 rounded-full blur-2xl"></div>
      </section>
    </div>

    <!-- Case 3: Onboarding VALIDATED (Active account) -->
    <div v-else-if="stats?.onboarding_status === 'validated'" class="space-y-8">
      
      <!-- Opportunities section -->
      <section class="space-y-4">
        <div class="flex justify-between items-center px-1">
          <h3 class="text-lg font-black text-slate-900">Opportunités de placement</h3>
          <router-link to="/catalog" class="text-primary text-xs font-black uppercase tracking-wider">Voir tout</router-link>
        </div>
        <div class="space-y-4">
          <div v-for="fund in featuredFunds" :key="fund.id" class="group bg-white border border-slate-100 p-5 rounded-[24px] hover:border-primary/20 hover:shadow-xl hover:shadow-slate-200/50 transition-all">
            <div class="flex justify-between items-center mb-2">
              <h4 class="font-black text-slate-900 text-base">{{ fund.name }}</h4>
              <span class="text-emerald-500 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg text-xs">{{ fund.trend }}</span>
            </div>
            <p class="text-slate-500 text-xs mb-4 leading-relaxed font-medium">{{ fund.description }}</p>
            <div class="flex justify-between items-end">
              <div>
                <span class="text-slate-400 text-[10px] font-bold block uppercase tracking-tight">Valeur Liquidative</span>
                <span class="text-primary font-black text-lg">{{ parseFloat(fund.vl).toLocaleString() }} FCFA</span>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="openProductDetails(fund)"
                  class="h-10 px-3 bg-slate-50 text-slate-600 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all hover:bg-slate-100"
                >
                  <Info class="w-3.5 h-3.5" />
                  Détails
                </button>
                <router-link :to="'/subscribe/' + fund.id" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all">
                  <ArrowUpRight class="w-5 h-5" />
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Performance graph -->
      <section class="bg-slate-50 rounded-[32px] p-6 text-left">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg font-black text-slate-900">Performance Marché</h3>
          <span v-if="featuredFunds[0]" class="text-[10px] font-black text-primary bg-primary/5 px-3 py-1 rounded-full uppercase tracking-wider">
            {{ featuredFunds[0].name }}
          </span>
        </div>
        
        <div class="h-32 w-full flex items-end gap-2 pt-6">
          <div v-for="(bar, index) in chartBars" :key="index" 
            :style="{ height: bar.height + '%' }" 
            class="flex-1 bg-primary/10 hover:bg-primary rounded-t-lg relative group transition-all duration-300"
          >
            <!-- Hover Tooltip -->
            <div class="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1.5 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-20 font-black">
              {{ bar.displayValue }}
            </div>
          </div>
        </div>
        
        <!-- Dynamic Labels -->
        <div class="flex justify-between mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-wider px-1">
          <span v-if="chartBars.length > 0">{{ chartBars[0].label }}</span>
          <span v-if="chartBars.length > 2">{{ chartBars[Math.floor(chartBars.length / 2)].label }}</span>
          <span v-if="chartBars.length > 1">{{ chartBars[chartBars.length - 1].label }}</span>
        </div>
      </section>
    </div>

    <!-- Redeem Modal -->
    <div v-if="showRedeemModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white rounded-[32px] p-6 w-full max-w-sm border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 text-center space-y-6">
        <div class="w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mx-auto">
          <Zap class="w-8 h-8 text-primary" />
        </div>
        <div class="space-y-2">
          <h3 class="text-lg font-black text-slate-900">Demande de Rachat</h3>
          <p class="text-xs text-slate-500 font-medium leading-relaxed">
            Le service de rachat de parts en ligne sera disponible prochainement dans votre application.
          </p>
        </div>
        <button 
          @click="showRedeemModal = false" 
          class="w-full bg-primary text-white font-black py-3 rounded-2xl shadow-lg hover:bg-slate-800 transition-all text-xs uppercase tracking-wider"
        >
          Compris
        </button>
      </div>
    </div>

    <!-- Product VL Details Modal -->
    <div v-if="selectedProduct" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white rounded-[32px] p-6 w-full max-w-sm border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 text-left space-y-6">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Evolution de la VL</span>
            <h3 class="text-lg font-black text-slate-900 leading-tight">{{ selectedProduct.name }}</h3>
          </div>
          <button
            type="button"
            @click="closeProductDetails"
            class="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center active:scale-95 transition-all"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="bg-cream border border-accent/20 rounded-3xl p-5 space-y-2">
          <span class="text-[10px] text-secondary block uppercase font-black tracking-widest">Derniere VL</span>
          <div class="flex items-end justify-between gap-3">
            <span class="text-primary font-black text-3xl leading-none">{{ selectedLatestVl.toLocaleString() }} FCFA</span>
            <span
              v-if="selectedVariation !== null"
              :class="selectedVariation >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'"
              class="px-2.5 py-1 rounded-full text-[10px] font-black"
            >
              {{ selectedVariation >= 0 ? '+' : '' }}{{ selectedVariation.toFixed(2) }}%
            </span>
          </div>
        </div>

        <div v-if="selectedChartBars.length > 1" class="space-y-4 animate-in fade-in duration-300">
          <div class="h-48 w-full flex items-end gap-1.5 pt-8 px-2 bg-slate-50 rounded-3xl p-5 border border-slate-100 relative overflow-hidden">
            <!-- Grid Lines -->
            <div class="absolute inset-x-0 top-1/4 border-b border-slate-100 border-dashed pointer-events-none"></div>
            <div class="absolute inset-x-0 top-2/4 border-b border-slate-100 border-dashed pointer-events-none"></div>
            <div class="absolute inset-x-0 top-3/4 border-b border-slate-100 pointer-events-none"></div>

            <div
              v-for="(bar, index) in selectedChartBars"
              :key="index"
              :style="{ height: bar.height + '%' }"
              class="flex-1 bg-gradient-to-t from-primary/10 to-primary/40 hover:from-primary/30 hover:to-primary/60 border-t-2 border-x border-primary/20 hover:border-primary/40 rounded-t-lg relative group transition-all duration-300 min-h-[16px] flex flex-col justify-end items-center"
            >
              <!-- Permanently visible VL label -->
              <span class="absolute -top-7 text-[8px] font-black text-primary/80 whitespace-nowrap pointer-events-none scale-90 sm:scale-100 bg-white/60 px-1 py-0.5 rounded backdrop-blur-[2px]">
                {{ Math.round(bar.vl).toLocaleString() }}
              </span>

              <!-- Hover Tooltip (Detailed) -->
              <div class="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1.5 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-20 font-black">
                {{ bar.displayValue }}
              </div>
            </div>
          </div>
          <div class="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider px-1">
            <span>{{ selectedChartBars[0].label }}</span>
            <span>{{ selectedChartBars[Math.floor(selectedChartBars.length / 2)].label }}</span>
            <span>{{ selectedChartBars[selectedChartBars.length - 1].label }}</span>
          </div>
        </div>

        <div v-else class="bg-slate-50 rounded-3xl p-6 border border-slate-100 text-center space-y-2">
          <Info class="w-8 h-8 text-primary/40 mx-auto" />
          <p class="text-xs text-slate-500 font-bold leading-relaxed">
            L'historique de VL n'est pas encore disponible pour ce fonds.
          </p>
        </div>

        <router-link
          :to="'/subscribe/' + selectedProduct.id"
          class="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Plus class="w-4 h-4" />
          Souscrire
        </router-link>
      </div>
    </div>
  </div>
</template>
