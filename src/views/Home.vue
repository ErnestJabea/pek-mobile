<script setup>
import { ref, onMounted, computed } from 'vue'
import { TrendingUp, TrendingDown, ArrowUpRight, ShieldCheck, Zap, Loader2 } from 'lucide-vue-next'
import api from '../api/api'

const stats = ref(null)
const featuredFunds = ref([])
const loading = ref(true)
const activeBarIndex = ref(null)

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

// Rendement positif ou négatif
const isPositive = computed(() => (stats.value?.plus_value ?? 0) >= 0)

const rendementLabel = computed(() => {
  const r = stats.value?.rendement_global ?? 0
  return (r >= 0 ? '+' : '') + r.toFixed(2) + '%'
})

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
  <div v-else class="px-6 py-4 space-y-8">
    <!-- Hero Card -->
    <section class="relative overflow-hidden bg-primary rounded-3xl p-6 text-white shadow-xl shadow-primary/20">
      <div class="relative z-10 space-y-4">
        <div class="flex justify-between items-start">
          <span class="text-white/70 text-sm font-medium">Solde Total</span>
        </div>
        <div class="space-y-1">
          <h2 class="text-3xl font-bold">{{ (stats?.total_balance || 0).toLocaleString() }} FCFA</h2>
          <!-- Plus-value réelle et rendement depuis PortfolioService -->
          <div class="flex items-center gap-1 text-sm" :class="isPositive ? 'text-emerald-400' : 'text-red-400'">
            <TrendingUp v-if="isPositive" class="w-4 h-4" />
            <TrendingDown v-else class="w-4 h-4" />
            <span>
              {{ isPositive ? '+' : '' }}{{ (stats?.plus_value || 0).toLocaleString() }} FCFA
              &nbsp;({{ rendementLabel }})
            </span>
          </div>
          <!-- Coût de revient (masqué temporairement)
          <div class="text-white/50 text-xs mt-1">
            Coût de revient : {{ (stats?.cout_revient || 0).toLocaleString() }} FCFA
          </div>
          -->
        </div>
        <div class="pt-4 flex gap-3">
          <router-link to="/catalog" class="flex-1 bg-white text-primary font-bold py-3 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
            
            Investir
          </router-link>
          <button 
            @click="alert('Le retrait sera disponible prochainement.')" 
            :disabled="!stats || stats.total_balance <= 0"
            class="flex-1 bg-white/10 backdrop-blur-md text-white font-bold py-3 rounded-xl hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/10"
          >
            Racheter
          </button>
        </div>
      </div>
      <!-- Decorative circle -->
      <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl"></div>
    </section>

    <!-- Quick Actions -->
    <section>
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold text-slate-900">Opportunités</h3>
        <router-link to="/catalog" class="text-primary text-sm font-semibold">Voir tout</router-link>
      </div>
      <div class="space-y-4">
        <div v-for="fund in featuredFunds" :key="fund.id" class="group bg-white border border-slate-100 p-4 rounded-2xl hover:border-primary/20 hover:shadow-lg hover:shadow-slate-200/50 transition-all">
          <div class="flex justify-between items-center mb-2">
            <h4 class="font-bold text-slate-900">{{ fund.name }}</h4>
            <span class="text-emerald-500 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg text-xs">{{ fund.trend }}</span>
          </div>
          <p class="text-slate-500 text-sm mb-4 leading-relaxed">{{ fund.description }}</p>
          <div class="flex justify-between items-end">
            <div>
              <span class="text-slate-400 text-xs block">Valeur Liquidative</span>
              <span class="text-primary font-bold">{{ fund.vl }} FCFA</span>
            </div>
            <router-link :to="'/subscribe/' + fund.id" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
              <ArrowUpRight class="w-5 h-5" />
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Market Performance Chart (Dynamic from ProductVl) -->
    <section class="bg-slate-50 rounded-3xl p-6 text-left">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold text-slate-900">Performance Marché</h3>
        <span v-if="featuredFunds[0]" class="text-[10px] font-black text-primary bg-primary/5 px-3 py-1 rounded-full uppercase tracking-wider">
          {{ featuredFunds[0].name }}
        </span>
      </div>

      <!-- Live Interactive Details (Stunning Premium Display Card) -->
      <div class="bg-white rounded-2xl p-4 border border-slate-100 mb-6 flex justify-between items-center shadow-sm">
        <div class="space-y-1">
          <span class="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            {{ activeBarIndex !== null && chartBars[activeBarIndex] ? 'Vl au ' + chartBars[activeBarIndex].label : 'Sélectionnez une période' }}
          </span>
          <div class="text-xl font-black text-primary leading-none transition-all duration-300">
            {{ activeBarIndex !== null && chartBars[activeBarIndex] ? chartBars[activeBarIndex].displayValue : '--- FCFA' }}
          </div>
        </div>
      </div>
      
      <div class="h-32 w-full flex items-end gap-2 pt-6">
        <button v-for="(bar, index) in chartBars" :key="index" 
          @click="selectBar(index)"
          :style="{ height: bar.height + '%' }" 
          :class="activeBarIndex === index ? 'bg-primary shadow-lg shadow-primary/20 scale-y-[1.03]' : 'bg-primary/20 hover:bg-primary/30'"
          class="flex-1 rounded-t-lg relative group transition-all duration-300 focus:outline-none"
        >
          <!-- Active Indicator dot on Top of Selected Bar -->
          <div v-if="activeBarIndex === index" class="absolute -top-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
        </button>
      </div>
      
      <!-- Dynamic Labels -->
      <div class="flex justify-between mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-wider px-1">
        <span v-if="chartBars.length > 0">{{ chartBars[0].label }}</span>
        <span v-if="chartBars.length > 2">{{ chartBars[Math.floor(chartBars.length / 2)].label }}</span>
        <span v-if="chartBars.length > 1">{{ chartBars[chartBars.length - 1].label }}</span>
      </div>
    </section>
  </div>
</template>
