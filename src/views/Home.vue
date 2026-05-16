<script setup>
import { ref, onMounted } from 'vue'
import { TrendingUp, ArrowUpRight, ShieldCheck, Zap, Loader2 } from 'lucide-vue-next'
import api from '../api/api'

const stats = ref(null)
const featuredFunds = ref([])
const loading = ref(true)

const fetchData = async () => {
  try {
    const [statsRes, productsRes] = await Promise.all([
      api.get('/dashboard-stats'),
      api.get('/products')
    ])
    stats.value = statsRes.data
    featuredFunds.value = productsRes.data.slice(0, 3)
  } catch (error) {
    console.error('Error fetching home data:', error)
  } finally {
    loading.value = false
  }
}

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
          <ShieldCheck class="w-5 h-5 text-accent" />
        </div>
        <div class="space-y-1">
          <h2 class="text-3xl font-bold">{{ (stats?.total_balance || 0).toLocaleString() }} FCFA</h2>
          <div class="flex items-center gap-1 text-emerald-400 text-sm">
            <TrendingUp class="w-4 h-4" />
            <span>+{{ (stats?.performance_month || 0).toLocaleString() }} FCFA (Ce mois)</span>
          </div>
        </div>
        <div class="pt-4 flex gap-3">
          <router-link to="/catalog" class="flex-1 bg-white text-primary font-bold py-3 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
            <Zap class="w-4 h-4" />
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

    <!-- Market Simulation Chart (SVG) -->
    <section class="bg-slate-50 rounded-3xl p-6">
      <h3 class="text-lg font-bold text-slate-900 mb-6">Performance Marché</h3>
      <div class="h-32 w-full flex items-end gap-2">
        <div v-for="i in 12" :key="i" 
          :style="{ height: (30 + Math.random() * 70) + '%' }" 
          class="flex-1 bg-primary/10 rounded-t-lg relative group transition-all hover:bg-primary/30"
        >
          <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {{ Math.floor(Math.random() * 100) }}%
          </div>
        </div>
      </div>
      <div class="flex justify-between mt-4 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
        <span>Jan</span>
        <span>Jun</span>
        <span>Dec</span>
      </div>
    </section>
  </div>
</template>
