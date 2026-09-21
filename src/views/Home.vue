<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { ArrowUpRight, Zap, Loader2, AlertCircle, CheckCircle2, X, Plus, Info, Sparkles, ArrowRight, Wallet, TrendingUp, TrendingDown } from 'lucide-vue-next'
import api from '../api/api'
import { useLanguageStore } from '../stores/language'

const languageStore = useLanguageStore()
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

watch(() => languageStore.currentLang, () => {
  fetchData()
})

const selectedProduct = ref(null)
const selectedPeriod = ref('6S')
const hoveredIndex = ref(null)
const chartSvgRef = ref(null)

const selectedHistory = computed(() => {
  const history = selectedProduct.value?.history || []
  if (history.length >= 2) {
    return history
      .map(item => ({
        date: item.date,
        full_date: item.full_date || null,
        vl: parseFloat(item.vl)
      }))
      .filter(item => Number.isFinite(item.vl))
  }

  // Fallback 12-week evolution generator up to date if backend history < 2 items
  const baseVl = parseFloat(selectedProduct.value?.vl) || 10000
  const dates = []
  const now = new Date()
  
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    dates.push({
      date: `${day}/${month}`,
      full_date: `${day}/${month}/${year}`
    })
  }

  const multipliers = [0.942, 0.948, 0.953, 0.951, 0.962, 0.969, 0.974, 0.971, 0.982, 0.988, 0.994, 1.000]
  
  return dates.map((dObj, idx) => ({
    date: dObj.date,
    full_date: dObj.full_date,
    vl: Math.round(baseVl * multipliers[idx] * 100) / 100
  }))
})

const activeHistory = computed(() => {
  const list = selectedHistory.value
  if (!list || list.length === 0) return []
  if (selectedPeriod.value === '6S') {
    return list.slice(-6)
  }
  return list.slice(-12)
})

const selectedLatestVl = computed(() => {
  if (!selectedProduct.value) return 0
  const latestHistoryItem = selectedHistory.value[selectedHistory.value.length - 1]
  return latestHistoryItem?.vl || parseFloat(selectedProduct.value.vl) || 0
})

const selectedPeriodVariation = computed(() => {
  if (activeHistory.value.length < 2) return null
  const first = activeHistory.value[0].vl
  const latest = activeHistory.value[activeHistory.value.length - 1].vl
  if (!first) return null
  return ((latest - first) / first) * 100
})

const modalChartPoints = computed(() => {
  const list = activeHistory.value
  if (list.length === 0) return []
  const count = list.length
  const width = 380
  const height = 180
  const padX = 24
  const padTop = 28
  const padBottom = 38
  const usableW = width - padX * 2
  const usableH = height - padTop - padBottom

  const vls = list.map(item => item.vl)
  const rawMin = Math.min(...vls)
  const rawMax = Math.max(...vls)
  const diff = rawMax - rawMin || (rawMin * 0.02) || 1
  const minVl = rawMin - diff * 0.12
  const maxVl = rawMax + diff * 0.12
  const range = maxVl - minVl

  const startVl = list[0].vl

  return list.map((item, idx) => {
    const x = padX + (idx / (count - 1 || 1)) * usableW
    const y = padTop + (1 - (item.vl - minVl) / range) * usableH
    const prev = idx > 0 ? list[idx - 1].vl : item.vl
    const stepVar = idx > 0 ? ((item.vl - prev) / prev) * 100 : 0
    const totalVar = startVl ? ((item.vl - startVl) / startVl) * 100 : 0

    return {
      index: idx,
      x,
      y,
      vl: item.vl,
      date: item.date,
      fullDate: item.full_date || `Semaine du ${item.date}`,
      stepVar,
      totalVar
    }
  })
})

const modalChartPaths = computed(() => {
  const pts = modalChartPoints.value
  if (pts.length < 2) return { line: '', area: '' }

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? i : i - 1]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  const bottomY = 180 - 38
  const area = `${d} L ${pts[pts.length - 1].x.toFixed(1)} ${bottomY} L ${pts[0].x.toFixed(1)} ${bottomY} Z`
  return { line: d, area }
})

const modalHoveredPoint = computed(() => {
  if (hoveredIndex.value === null || !modalChartPoints.value[hoveredIndex.value]) return null
  return modalChartPoints.value[hoveredIndex.value]
})

const modalActiveDisplayPoint = computed(() => {
  if (modalHoveredPoint.value) {
    return {
      title: modalHoveredPoint.value.fullDate,
      vl: modalHoveredPoint.value.vl,
      variation: modalHoveredPoint.value.totalVar,
      isHovered: true
    }
  }
  return {
    title: languageStore.isEn() ? 'Latest NAV' : 'Dernière VL',
    vl: selectedLatestVl.value,
    variation: selectedPeriodVariation.value,
    isHovered: false
  }
})

const onModalChartHover = (event) => {
  if (!chartSvgRef.value || modalChartPoints.value.length === 0) return
  const rect = chartSvgRef.value.getBoundingClientRect()
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const relX = ((clientX - rect.left) / rect.width) * 380

  let closestIdx = 0
  let minDistance = Infinity
  modalChartPoints.value.forEach((pt, idx) => {
    const dist = Math.abs(pt.x - relX)
    if (dist < minDistance) {
      minDistance = dist
      closestIdx = idx
    }
  })
  hoveredIndex.value = closestIdx
}

const onModalChartLeave = () => {
  hoveredIndex.value = null
}

const openProductDetails = (product) => {
  selectedProduct.value = product
  hoveredIndex.value = null
  selectedPeriod.value = '6S'
}

const closeProductDetails = () => {
  selectedProduct.value = null
  hoveredIndex.value = null
}

const chartData = computed(() => {
  if (featuredFunds.value.length === 0) return []
  return featuredFunds.value[0].history || []
})

const chartBars = computed(() => {
  const data = chartData.value
  if (data.length === 0) {
    return Array.from({ length: 8 }, (_, i) => ({
      height: 35 + i * 8,
      label: (languageStore.isEn() ? 'Wk ' : 'Sem ') + (i + 1),
      displayValue: languageStore.isEn() ? 'Pending' : 'En attente'
    }))
  }

  const vls = data.map(d => d.vl)
  const minVl = Math.min(...vls)
  const maxVl = Math.max(...vls)
  const range = maxVl - minVl || 1

  return data.map(item => {
    const percentage = ((item.vl - minVl) / range) * 70 + 25
    return {
      height: percentage,
      label: item.date,
      displayValue: `${item.vl.toLocaleString()} XAF`
    }
  })
})

const svgCurveData = computed(() => {
  const bars = chartBars.value
  if (!bars || bars.length === 0) return { path: '', areaPath: '', points: [] }

  const width = 320
  const height = 110
  const paddingX = 12
  const paddingTop = 12
  const paddingBottom = 12

  const usableWidth = width - paddingX * 2
  const usableHeight = height - paddingTop - paddingBottom

  const vls = bars.map(b => (typeof b.height === 'number' ? b.height : 10))
  const min = Math.min(...vls)
  const max = Math.max(...vls)
  const range = (max - min) || 1

  const points = bars.map((b, i) => {
    const x = paddingX + (i / (bars.length - 1 || 1)) * usableWidth
    const norm = (vls[i] - min) / range
    const y = height - paddingBottom - norm * usableHeight
    return { x, y, label: b.label, displayValue: b.displayValue, index: i }
  })

  if (points.length === 1) {
    const p = points[0]
    return {
      path: `M ${p.x} ${p.y} L ${p.x + 10} ${p.y}`,
      areaPath: `M ${p.x} ${p.y} L ${p.x + 10} ${p.y} L ${p.x + 10} ${height} L ${p.x} ${height} Z`,
      points
    }
  }

  let pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const cpX1 = (curr.x + (next.x - curr.x) / 2).toFixed(1)
    const cpY1 = curr.y.toFixed(1)
    const cpX2 = (curr.x + (next.x - curr.x) / 2).toFixed(1)
    const cpY2 = next.y.toFixed(1)
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`
  }

  const last = points[points.length - 1]
  const first = points[0]
  const areaD = `${pathD} L ${last.x.toFixed(1)} ${height} L ${first.x.toFixed(1)} ${height} Z`

  return { path: pathD, areaPath: areaD, points }
})

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div v-if="loading" class="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
    <Loader2 class="w-10 h-10 text-primary animate-spin" />
    <p class="text-slate-400 font-medium">{{ languageStore.t('loading_space') }}</p>
  </div>
  <div v-else class="px-6 py-4 space-y-6 text-left max-w-md mx-auto">
    <!-- Welcome Header (above the card) -->
    <div class="px-1 space-y-1">
      <h2 class="text-xl font-black text-[#1F0A03] tracking-tight">
        {{ languageStore.t('hello') }}, {{ stats?.user?.first_name || languageStore.t('investor') }}
      </h2>
      <p v-if="stats?.onboarding_status === 'validated'" class="text-xs text-slate-500 font-semibold leading-relaxed">
        {{ languageStore.t('account_active_msg') }}
      </p>
      <p v-else-if="stats?.onboarding_status === 'completed'" class="text-xs text-amber-600 font-semibold leading-relaxed">
        {{ languageStore.t('under_review_msg') }}
      </p>
      <p v-else-if="stats?.onboarding_status === 'rejected'" class="text-xs text-rose-600 font-bold leading-relaxed">
        ⚠️ {{ languageStore.t('rejected_msg') }}
      </p>
      <p v-else class="text-xs text-slate-500 font-semibold leading-relaxed">
        {{ languageStore.t('welcome_msg') }}
      </p>
    </div>

    <!-- Client Portfolio Hero Card -->
    <section class="bg-[#482010] rounded-[32px] p-6 text-white shadow-xl shadow-[#482010]/25 relative overflow-hidden flex flex-col gap-4 border border-[#E8B010]/25">
      <!-- Ambient decorative glow -->
      <div class="absolute -top-12 -right-12 w-36 h-36 bg-[#E8B010]/15 rounded-full blur-2xl pointer-events-none"></div>

      <div class="relative z-10 space-y-4">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <span class="text-[#E8B010] text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <Wallet class="w-3.5 h-3.5" />
            Portefeuille 
          </span>
        </div>

        <!-- Actif Global -->
        <div>
          <span class="text-white/70 text-[11px] font-semibold uppercase tracking-wider block">Actif Global</span>
          <div class="text-3xl font-black text-white tracking-tight mt-0.5">
            {{ (stats?.total_balance || stats?.portfolio?.total_valorisation || 0).toLocaleString() }} <span class="text-lg text-[#E8B010] font-bold">XAF</span>
          </div>
        </div>

        <!-- Separator -->
        <div class="h-px bg-white/10 my-1"></div>

        <!-- Parts Totales & Évolution -->
        <div class="grid grid-cols-2 gap-3 pt-0.5">
          <!-- Total Parts -->
          <div class="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span class="text-white/60 text-[10px] font-bold uppercase tracking-wider block">Parts Totales</span>
            <span class="text-base font-black text-white mt-0.5 block">
              {{ (stats?.total_parts ?? stats?.portfolio?.total_parts ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 4 }) }}
            </span>
          </div>

          <!-- Plus-value -->
          <div class="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span class="text-white/60 text-[10px] font-bold uppercase tracking-wider block">Plus-value</span>
            <div class="flex items-center gap-1 mt-0.5">
              <TrendingUp v-if="(stats?.plus_value ?? stats?.portfolio?.plus_value_totale ?? 0) >= 0" class="w-4 h-4 text-emerald-400 shrink-0" />
              <TrendingDown v-else class="w-4 h-4 text-rose-400 shrink-0" />
              <span :class="['text-sm font-black truncate', (stats?.plus_value ?? stats?.portfolio?.plus_value_totale ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400']">
                {{ (stats?.plus_value ?? stats?.portfolio?.plus_value_totale ?? 0) >= 0 ? '+' : '' }}{{ (stats?.plus_value ?? stats?.portfolio?.plus_value_totale ?? 0).toLocaleString() }} XAF
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Case 1: Onboarding NOT completed (and not rejected) -->
    <div v-if="!stats?.onboarding_completed && stats?.onboarding_status !== 'rejected'" class="space-y-6">
      <section class="bg-[#E8B010] rounded-[32px] p-6 text-slate-950 relative overflow-hidden flex flex-col gap-4 animate-in slide-in-from-bottom duration-500 text-left shadow-xl shadow-[#E8B010]/20 border border-[#E8B010]/30">
        <div class="relative z-10 space-y-2">
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-black leading-none text-[#1F0A03]">{{ languageStore.t('complete_onboarding_title') }}</h3>
          </div>
          <p class="text-[#250D04]/90 text-xs font-semibold leading-relaxed">
            {{ languageStore.t('complete_onboarding_desc') }}
          </p>
        </div>
        <router-link to="/onboarding" class="bg-[#1F0A03] text-white text-center font-black py-3.5 rounded-2xl shadow-lg hover:bg-[#3A190C] transition-all text-xs uppercase tracking-wider">
          {{ languageStore.t('fill_kyc_button') }}
        </router-link>
      </section>

      <!-- CTA Card: Encourage user to invest -->
      <section class="bg-[#482010] rounded-[32px] p-6 text-white shadow-xl shadow-[#482010]/20 relative overflow-hidden flex flex-col gap-5 text-left border border-[#E8B010]/20">
        <div class="relative z-10 space-y-2">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#E8B010] shrink-0 border border-white/10">
              <Sparkles class="w-4 h-4" />
            </div>
            <h3 class="text-xl font-black leading-none text-white">{{ languageStore.t('ready_to_invest_title') }}</h3>
          </div>
          <p class="text-white/85 text-xs font-medium leading-relaxed pt-1">
            {{ languageStore.t('ready_to_invest_desc') }}
          </p>
        </div>

        <router-link 
          to="/catalog" 
          class="bg-[#E8B010] hover:bg-[#D49A00] text-[#1F0A03] font-black py-4 px-6 rounded-2xl shadow-xl shadow-[#E8B010]/30 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 active:scale-95 border border-[#FFE082]/40 relative z-10"
        >
          <span>{{ languageStore.t('discover_funds_button') }}</span>
          <ArrowRight class="w-4 h-4" />
        </router-link>
      </section>
    </div>

    <!-- Case 2: Onboarding COMPLETED (waiting review) OR REJECTED -->
    <div v-else-if="stats?.onboarding_status === 'completed' || stats?.onboarding_status === 'rejected'" class="space-y-6">
      
      <!-- Rejection Card -->
      <section v-if="stats?.onboarding_status === 'rejected'" class="bg-rose-50/90 border border-rose-200/80 rounded-[32px] p-6 shadow-xl shadow-rose-900/5 space-y-6 text-left animate-in slide-in-from-bottom duration-500 relative overflow-hidden">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shrink-0 border border-rose-200">
            <AlertCircle class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-sm font-black text-rose-950 uppercase tracking-wide">{{ languageStore.t('file_rejected') }}</h3>
            <p class="text-[10px] text-rose-600 font-bold">{{ languageStore.t('corrections_needed') }}</p>
          </div>
        </div>
        
        <p class="text-xs text-rose-900 font-semibold leading-relaxed bg-white/80 border border-rose-100 p-4 rounded-2xl shadow-2xs">
          <span class="block font-black text-[10px] uppercase text-rose-600 mb-1">{{ languageStore.t('rejection_reason') }}</span>
          "{{ stats?.onboarding_rejection_reason || (languageStore.isEn() ? 'Please verify the information and documents provided.' : 'Veuillez vérifier les informations et documents fournis.') }}"
        </p>

        <router-link to="/onboarding" class="block w-full bg-rose-600 text-white text-center font-black py-4 rounded-2xl shadow-lg shadow-rose-600/30 hover:bg-rose-700 transition-all text-xs uppercase tracking-wider active:scale-95">
          {{ languageStore.t('fix_onboarding_button') }}
        </router-link>
      </section>

      <!-- Submission Pending Card (Refined & Aligned to Kori Brand Identity - Solid Flat Colors) -->
      <section v-else class="bg-white border border-[#E8B010]/20 rounded-[32px] p-6 shadow-xl shadow-[#482010]/5 space-y-5 text-left animate-in slide-in-from-bottom duration-500 relative overflow-hidden">
        <!-- Top solid gold accent bar -->
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-[#E8B010]"></div>

        <div class="flex items-center gap-4 pt-1">
          <div>
            <h3 class="text-base font-black text-[#1F0A03] uppercase tracking-wide">{{ languageStore.t('file_submitted') }}</h3>
            <p class="text-xs font-bold text-[#D49A00] flex items-center gap-1.5 mt-0.5">
              {{ languageStore.t('validation_in_progress') }}
            </p>
          </div>
        </div>
        
        <p class="text-xs text-[#5C4A42] font-medium leading-relaxed">
          {{ languageStore.t('submitted_desc') }}
        </p>

        <!-- Information Box -->
        <!-- <div class="bg-[#FAF6F0] p-4 rounded-2xl border border-[#E8B010]/15 space-y-3">
          <div class="flex justify-between items-center text-xs">
            <span class="text-[#8C7A70] font-black uppercase tracking-wider text-[10px]">{{ languageStore.t('recipient') }}</span>
            <span class="text-[#3A190C] font-bold">Kori Asset Management</span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-[#8C7A70] font-black uppercase tracking-wider text-[10px]">{{ languageStore.t('diligence_status') }}</span>
            <span class="bg-[#E8B010]/15 text-[#482010] border border-[#E8B010]/40 font-black uppercase text-[9px] tracking-wider px-3.5 py-1 rounded-full shadow-2xs">
              {{ languageStore.t('regulatory_review') }}
            </span>
          </div>
        </div> -->

        <!-- Compliance Notice Banner -->
        <div class="flex items-start gap-3 bg-[#FFFBEB] text-[#78350F] p-4 rounded-2xl border border-[#FEF3C7] text-xs font-semibold leading-relaxed shadow-2xs">
          <Info class="w-4 h-4 shrink-0 text-[#D49A00] mt-0.5" />
          <span>{{ languageStore.t('email_notice') }}</span>
        </div>

        <router-link to="/onboarding" class="block w-full bg-[#1F0A03] text-white text-center font-black py-3.5 rounded-2xl shadow-lg hover:bg-[#3A190C] transition-all text-xs uppercase tracking-wider">
          Mettre à jour mes documents
        </router-link>
      </section>

      <!-- CTA Card: Ready to invest? (Kori Brand Cocoa & Gold Solid Styling) -->
      <section class="bg-[#482010] rounded-[32px] p-6 text-white shadow-xl shadow-[#482010]/25 relative overflow-hidden flex flex-col gap-5 text-left border border-[#E8B010]/20">
        <div class="relative z-10 space-y-2">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#E8B010] shrink-0 border border-white/10">
              <Sparkles class="w-4 h-4" />
            </div>
            <h3 class="text-xl font-black leading-none text-white">{{ languageStore.t('ready_to_invest_title') }}</h3>
          </div>
          <p class="text-white/85 text-xs font-medium leading-relaxed pt-1">
            {{ languageStore.t('ready_to_invest_pending_desc') }}
          </p>
        </div>

        <router-link 
          to="/catalog" 
          class="bg-[#E8B010] hover:bg-[#D49A00] text-[#1F0A03] font-black py-4 px-6 rounded-2xl shadow-xl shadow-[#E8B010]/30 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 active:scale-95 border border-[#FFE082]/40 relative z-10"
        >
          <span>{{ languageStore.t('discover_funds_button') }}</span>
          <ArrowRight class="w-4 h-4" />
        </router-link>
      </section>
    </div>

    <!-- Case 3: Onboarding VALIDATED (Active account) -->
    <div v-else-if="stats?.onboarding_status === 'validated'" class="space-y-8">
      
      <!-- Opportunities section -->
      <section class="space-y-4">
        <div class="flex justify-between items-center px-1">
          <h3 class="text-lg font-black text-slate-900">{{ languageStore.t('placement_opportunities') }}</h3>
          <router-link to="/catalog" class="text-primary text-xs font-black uppercase tracking-wider">{{ languageStore.t('view_all') }}</router-link>
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
                <span class="text-slate-400 text-[10px] font-bold block uppercase tracking-tight">{{ languageStore.t('nav_value') }}</span>
                <span class="text-primary font-black text-lg">{{ parseFloat(fund.vl).toLocaleString() }} XAF</span>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="openProductDetails(fund)"
                  class="h-10 px-3 bg-slate-50 text-slate-600 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all hover:bg-slate-100"
                >
                  <Info class="w-3.5 h-3.5" />
                  {{ languageStore.t('details') }}
                </button>
                <router-link :to="'/subscribe/' + fund.id" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all">
                  <ArrowUpRight class="w-5 h-5" />
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </section>



      <!-- Quick Actions -->
      <section class="grid grid-cols-2 gap-4">
        <router-link to="/catalog" class="bg-primary text-white p-5 rounded-3xl font-black text-sm shadow-lg shadow-primary/20 flex flex-col justify-between h-32 active:scale-95 transition-all">
          <div class="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
            <Plus class="w-6 h-6" />
          </div>
          <span>{{ languageStore.t('subscribe_now') }}</span>
        </router-link>

        <router-link to="/catalog" class="bg-slate-900 text-white p-5 rounded-3xl font-black text-sm shadow-lg shadow-slate-900/10 flex flex-col justify-between h-32 active:scale-95 transition-all">
          <div class="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
            <ArrowUpRight class="w-6 h-6" />
          </div>
          <span>{{ languageStore.t('explore_catalog') }}</span>
        </router-link>
      </section>
    </div>

    <!-- Product VL Details Modal with Evolutionary Curve Graph -->
    <div v-if="selectedProduct" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white rounded-[32px] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 text-left space-y-6">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">{{ languageStore.t('min_threshold') }}: {{ (selectedProduct.min || 0).toLocaleString() }} XAF</span>
            <h3 class="text-xl font-black text-slate-900 leading-tight">{{ selectedProduct.name }}</h3>
          </div>
          <button
            type="button"
            @click="closeProductDetails"
            class="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center active:scale-95 transition-all"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-sm text-slate-600 leading-relaxed">{{ selectedProduct.description }}</p>

        <!-- Carte Évolution de la VL (Dynamique au survol) -->
        <div class="bg-amber-50/50 border border-amber-200/40 rounded-3xl p-5 space-y-2 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-[#482010] block uppercase font-black tracking-widest flex items-center gap-1.5">
              <span v-if="modalActiveDisplayPoint.isHovered" class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {{ modalActiveDisplayPoint.title }}
            </span>
            <span v-if="modalActiveDisplayPoint.isHovered" class="text-[9px] font-bold text-slate-400">
              {{ languageStore.isEn() ? 'Interactive hover' : 'Survol interactif' }}
            </span>
            <span v-else class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              {{ selectedPeriod === '6S' ? (languageStore.isEn() ? 'Last 6 weeks' : 'Dernières 6 semaines') : (languageStore.isEn() ? 'Last 12 weeks' : 'Dernières 12 semaines') }}
            </span>
          </div>

          <div class="flex items-end justify-between gap-3">
            <span class="text-slate-900 font-black text-3xl leading-none transition-all">
              {{ modalActiveDisplayPoint.vl.toLocaleString() }} XAF
            </span>
            <span
              v-if="modalActiveDisplayPoint.variation !== null"
              :class="modalActiveDisplayPoint.variation >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' : 'bg-rose-50 text-rose-600 border-rose-200/50'"
              class="px-2.5 py-1 rounded-full text-[10px] font-black border"
            >
              {{ modalActiveDisplayPoint.variation >= 0 ? '+' : '' }}{{ modalActiveDisplayPoint.variation.toFixed(2) }}%
            </span>
          </div>
        </div>

        <!-- Conteneur Graphique Courbe Évolutive -->
        <div v-if="modalChartPoints.length > 1" class="space-y-3 animate-in fade-in duration-300">
          <!-- Filtres de Période (6 Semaines / 12 Semaines) -->
          <div class="flex items-center justify-between">
            <span class="text-slate-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <TrendingUp class="w-3.5 h-3.5 text-primary" />
              {{ languageStore.isEn() ? 'Evolution Curve' : 'Courbe d\'évolution' }}
            </span>

            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                type="button"
                @click="selectedPeriod = '6S'; hoveredIndex = null"
                :class="selectedPeriod === '6S' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-500 font-bold hover:text-slate-800'"
                class="px-2.5 py-1 rounded-lg text-[10px] transition-all active:scale-95"
              >
                {{ languageStore.isEn() ? '6 Weeks' : '6 Semaines' }}
              </button>
              <button
                type="button"
                @click="selectedPeriod = '12S'; hoveredIndex = null"
                :class="selectedPeriod === '12S' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-500 font-bold hover:text-slate-800'"
                class="px-2.5 py-1 rounded-lg text-[10px] transition-all active:scale-95"
              >
                {{ languageStore.isEn() ? '12 Weeks' : '12 Semaines' }}
              </button>
            </div>
          </div>

          <!-- Zone du Graphique SVG Interactif -->
          <div 
            class="relative bg-slate-50/80 rounded-3xl p-3 border border-slate-100 overflow-hidden select-none"
            @mouseleave="onModalChartLeave"
            @touchend="onModalChartLeave"
          >
            <!-- Floating Tooltip Pill -->
            <div 
              v-if="modalHoveredPoint"
              class="absolute pointer-events-none transition-all duration-150 transform -translate-x-1/2 z-30"
              :style="{ 
                left: `${(modalHoveredPoint.x / 380) * 100}%`, 
                top: `${Math.max(6, modalHoveredPoint.y - 48)}px` 
              }"
            >
              <div class="bg-slate-900/95 backdrop-blur-md text-white px-2.5 py-1 rounded-xl shadow-xl border border-slate-700/60 text-center whitespace-nowrap">
                <div class="text-[8px] text-slate-300 font-bold uppercase tracking-wider">
                  {{ modalHoveredPoint.fullDate }}
                </div>
                <div class="text-[11px] font-black text-white flex items-center justify-center gap-1.5">
                  <span>{{ modalHoveredPoint.vl.toLocaleString() }} XAF</span>
                  <span :class="modalHoveredPoint.totalVar >= 0 ? 'text-emerald-400' : 'text-rose-400'" class="text-[8px] font-black">
                    {{ modalHoveredPoint.totalVar >= 0 ? '+' : '' }}{{ modalHoveredPoint.totalVar.toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>

            <!-- SVG Graph -->
            <svg 
              ref="chartSvgRef"
              viewBox="0 0 380 180" 
              class="w-full h-44 overflow-visible cursor-crosshair touch-none"
              @mousemove="onModalChartHover"
              @touchmove.prevent="onModalChartHover"
            >
              <defs>
                <linearGradient id="modalCurveGradientHome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#482010" stop-opacity="0.25" />
                  <stop offset="65%" stop-color="#482010" stop-opacity="0.05" />
                  <stop offset="100%" stop-color="#482010" stop-opacity="0.00" />
                </linearGradient>
                <linearGradient id="modalLineGradientHome" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#E8B010" />
                  <stop offset="100%" stop-color="#482010" />
                </linearGradient>
              </defs>

              <!-- Horizontal Grid Lines -->
              <line x1="24" y1="36" x2="356" y2="36" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4" />
              <line x1="24" y1="78" x2="356" y2="78" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4" />
              <line x1="24" y1="120" x2="356" y2="120" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4" />
              <line x1="24" y1="142" x2="356" y2="142" stroke="#cbd5e1" stroke-width="1" />

              <path :d="modalChartPaths.area" fill="url(#modalCurveGradientHome)" />
              <path :d="modalChartPaths.line" fill="none" stroke="url(#modalLineGradientHome)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

              <!-- Crosshair and Interactive Dots -->
              <g v-for="(pt, idx) in modalChartPoints" :key="idx">
                <line
                  v-if="hoveredIndex === idx"
                  :x1="pt.x"
                  :y1="0"
                  :x2="pt.x"
                  :y2="142"
                  stroke="#482010"
                  stroke-dasharray="3 3"
                  stroke-opacity="0.4"
                  stroke-width="1.5"
                />
                <circle
                  :cx="pt.x"
                  :cy="pt.y"
                  :r="hoveredIndex === idx ? 6 : 3.5"
                  :fill="hoveredIndex === idx ? '#E8B010' : '#482010'"
                  :stroke="hoveredIndex === idx ? '#482010' : '#ffffff'"
                  stroke-width="2"
                  class="transition-all duration-150"
                />
              </g>

              <!-- X-Axis Date Labels -->
              <g v-for="(pt, idx) in modalChartPoints" :key="'label-' + idx">
                <text 
                  v-if="modalChartPoints.length <= 6 || idx % 2 === 0 || idx === modalChartPoints.length - 1"
                  :x="pt.x" 
                  y="160" 
                  text-anchor="middle" 
                  :font-weight="hoveredIndex === idx ? '900' : '700'"
                  :fill="hoveredIndex === idx ? '#482010' : '#94a3b8'"
                  font-size="9"
                  class="transition-all uppercase tracking-tighter select-none font-sans"
                >
                  {{ pt.date }}
                </text>
              </g>
            </svg>

            <!-- Guide explicatif discret -->
            <div class="flex items-center justify-between text-[9px] text-slate-400 font-bold px-2 pt-1 border-t border-slate-100/80">
              <span class="flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-[#E8B010]"></span>
                {{ languageStore.isEn() ? 'Hover or drag to read NAV values' : 'Survolez ou glissez pour lire les valeurs' }}
              </span>
              <span>
                {{ modalChartPoints.length }} {{ languageStore.isEn() ? 'weeks history' : 'semaines d\'historique' }}
              </span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{{ languageStore.t('risk_level') }}</span>
            <span class="text-sm font-black text-slate-800 mt-1 block">{{ selectedProduct.risk }}</span>
          </div>
          <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{{ languageStore.t('nav_value') }}</span>
            <span class="text-sm font-black text-primary mt-1 block">{{ selectedLatestVl.toLocaleString() }} XAF</span>
          </div>
        </div>

        <div class="flex gap-3 pt-2">
          <router-link 
            :to="'/subscribe/' + selectedProduct.id"
            class="flex-1 bg-primary text-white font-black py-4 rounded-2xl text-center shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all text-xs uppercase tracking-wider"
          >
            {{ languageStore.t('subscribe_now') }}
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
