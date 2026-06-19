<script setup>
import { ref, onMounted, computed } from 'vue'
import { Info, Plus, Search, Filter, Loader2, AlertCircle, X } from 'lucide-vue-next'
import api from '../api/api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const products = ref([])
const loading = ref(true)
const searchQuery = ref('')
const showWarningModal = ref(false)
const selectedProduct = ref(null)

const canSubscribe = computed(() => {
  return true
})

const fetchData = async () => {
  try {
    const response = await api.get('/products')
    products.value = response.data
  } catch (error) {
    console.error('Error fetching products:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})

const filteredProducts = computed(() => {
  if (!searchQuery.value) return products.value
  const q = searchQuery.value.toLowerCase()
  return products.value.filter(p => 
    p.name.toLowerCase().includes(q) || 
    p.description.toLowerCase().includes(q)
  )
})

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
</script>

<template>
  <div v-if="loading" class="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
    <Loader2 class="w-10 h-10 text-primary animate-spin" />
    <p class="text-slate-400 font-medium">Chargement du catalogue...</p>
  </div>
  <div v-else class="px-6 py-6 space-y-6">
    <div class="space-y-1">
      <h2 class="text-2xl font-bold text-slate-900">Catalogue PEK</h2>
      <p class="text-slate-500 text-sm">Découvrez nos solutions d'investissement.</p>
    </div>

    <!-- Search Bar -->
    <div class="relative">
      <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
      <input 
        v-model="searchQuery"
        type="text" 
        placeholder="Rechercher un fonds..." 
        class="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 transition-all text-slate-900 placeholder:text-slate-400"
      >
      <button class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-600">
        <Filter class="w-4 h-4" />
      </button>
    </div>

    <!-- Products List -->
    <div class="space-y-4">
      <div v-if="filteredProducts.length === 0" class="text-center py-12 space-y-4">
         <Search class="w-12 h-12 text-slate-200 mx-auto" />
         <p class="text-slate-400 text-sm font-medium">Aucun fonds trouvé pour "{{ searchQuery }}"</p>
      </div>
      <div v-for="product in filteredProducts" :key="product.id" class="bg-white border border-slate-100 rounded-3xl p-5 space-y-4 hover:shadow-xl hover:shadow-slate-200/50 transition-all">
        <div class="flex justify-between items-start">
          <div class="space-y-1 text-left pr-3">
            <h3 class="font-bold text-slate-900 text-lg leading-tight">{{ product.name }}</h3>
            <div class="flex items-center gap-2">
              <span :class="[
                'text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider',
                product.risk === 'Faible' ? 'bg-emerald-100 text-emerald-700' : 
                product.risk === 'Moyen' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
              ]">
                Risque {{ product.risk }}
              </span>
              <span class="text-slate-500 text-[10px] font-bold"></span>
            </div>
          </div>
          <button
            type="button"
            @click="openProductDetails(product)"
            class="shrink-0 h-9 px-3 bg-warm text-primary border border-primary/10 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all hover:bg-accent/15"
          >
            <Info class="w-3.5 h-3.5" />
            Detail
          </button>
        </div>

        <p class="text-slate-500 text-sm leading-relaxed line-clamp-2 text-left">
          {{ product.description }}
        </p>

        <div class="pt-4 border-t border-slate-50 space-y-4">
          <div class="text-left">
            <span class="text-slate-400 text-[10px] block uppercase font-black tracking-tighter">Valeur Actuelle</span>
            <span class="text-primary font-black text-2xl leading-none">{{ parseFloat(product.vl).toLocaleString() }} FCFA</span>
          </div>
          <div class="flex gap-2">
            <router-link 
              v-slot="{ href, navigate }" 
              v-if="canSubscribe" 
              :to="'/subscribe/' + product.id"
              custom
            >
              <a 
                :href="href" 
                @click="navigate" 
                class="flex-1 h-12 bg-primary text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-primary/20"
              >
                <Plus class="w-4 h-4" />
                Souscrire
              </a>
            </router-link>
            <button 
              v-else
              @click="showWarningModal = true"
              class="flex-1 h-12 bg-slate-100 text-slate-400 font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-200/50"
            >
              <Plus class="w-4 h-4 text-slate-400" />
              Souscrire
            </button>
          </div>
        </div>
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

    <!-- Onboarding Validation Warning Modal -->
    <div v-if="showWarningModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white rounded-[32px] p-6 w-full max-w-sm border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 text-center space-y-6">
        <div class="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle class="w-8 h-8 text-amber-500" />
        </div>
        <div class="space-y-2">
          <h3 class="text-lg font-black text-slate-900">Compte en attente</h3>
          <p class="text-xs text-slate-500 font-medium leading-relaxed">
            Notre service conformité étudie actuellement votre dossier. Vous pourrez effectuer vos souscriptions dès que votre compte sera activé.
          </p>
        </div>
        <button 
          @click="showWarningModal = false" 
          class="w-full bg-primary text-white font-black py-3 rounded-2xl shadow-lg hover:bg-slate-800 transition-all text-xs uppercase tracking-wider"
        >
          D'accord
        </button>
      </div>
    </div>
  </div>
</template>
