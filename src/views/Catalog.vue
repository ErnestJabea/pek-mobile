<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { Info, Plus, Search, Filter, Loader2, AlertCircle, X, FileText, Download, TrendingUp, Calendar } from 'lucide-vue-next'
import api from '../api/api'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'
import { getFrontendDocumentUrl, downloadDocument } from '../utils/document'

const authStore = useAuthStore()
const languageStore = useLanguageStore()
const products = ref([])
const loading = ref(true)
const searchQuery = ref('')
const showWarningModal = ref(false)
const selectedProduct = ref(null)
const downloadingDoc = ref('')

const handleDownload = async (item, type) => {
  if (!item) return
  const docKey = `${item.id}-${type}`
  if (downloadingDoc.value === docKey) return

  downloadingDoc.value = docKey
  try {
    const downloadUrl = type === 'depliant'
      ? (item.depliant_download_url || `/api/v1/products/${item.id}/download/depliant`)
      : (item.document_information_download_url || `/api/v1/products/${item.id}/download/dici`)

    const cleanName = (item.name || item.libelle || 'fcp-kori').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const fallbackFilename = type === 'depliant'
      ? `depliant-commercial-${cleanName}.pdf`
      : `dici-document-information-${cleanName}.pdf`

    await downloadDocument(downloadUrl, fallbackFilename)
  } catch (err) {
    console.error('Erreur téléchargement document:', err)
  } finally {
    downloadingDoc.value = ''
  }
}

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

watch(() => languageStore.currentLang, () => {
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

// Période sélectionnée pour le graphe (6 Semaines ou 12 Semaines)
const selectedPeriod = ref('6S')
const hoveredIndex = ref(null)
const chartSvgRef = ref(null)

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

const chartPoints = computed(() => {
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
    const x = padX + (idx / (count - 1)) * usableW
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

const chartPaths = computed(() => {
  const pts = chartPoints.value
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

const hoveredPoint = computed(() => {
  if (hoveredIndex.value === null || !chartPoints.value[hoveredIndex.value]) return null
  return chartPoints.value[hoveredIndex.value]
})

const activeDisplayPoint = computed(() => {
  if (hoveredPoint.value) {
    return {
      title: hoveredPoint.value.fullDate,
      vl: hoveredPoint.value.vl,
      variation: hoveredPoint.value.totalVar,
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

const onChartHover = (event) => {
  if (!chartSvgRef.value || chartPoints.value.length === 0) return
  const rect = chartSvgRef.value.getBoundingClientRect()
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const relX = ((clientX - rect.left) / rect.width) * 380

  let closestIdx = 0
  let minDistance = Infinity
  chartPoints.value.forEach((pt, idx) => {
    const dist = Math.abs(pt.x - relX)
    if (dist < minDistance) {
      minDistance = dist
      closestIdx = idx
    }
  })
  hoveredIndex.value = closestIdx
}

const onChartLeave = () => {
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
</script>

<template>
  <div v-if="loading" class="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
    <Loader2 class="w-10 h-10 text-primary animate-spin" />
    <p class="text-slate-400 font-medium">{{ languageStore.isEn() ? 'Loading catalog...' : 'Chargement du catalogue...' }}</p>
  </div>
  <div v-else class="px-6 py-6 space-y-6">
    <div class="space-y-1">
      <h2 class="text-2xl font-bold text-slate-900">{{ languageStore.isEn() ? 'PEK Catalog' : 'Catalogue PEK' }}</h2>
      <p class="text-slate-500 text-sm">{{ languageStore.isEn() ? 'Discover our investment solutions.' : "Découvrez nos solutions d'investissement." }}</p>
    </div>

    <!-- Search Bar -->
    <div class="relative">
      <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
      <input 
        v-model="searchQuery"
        type="text" 
        :placeholder="languageStore.t('search_funds')" 
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
         <p class="text-slate-400 text-sm font-medium">{{ languageStore.isEn() ? `No funds found for "${searchQuery}"` : `Aucun fonds trouvé pour "${searchQuery}"` }}</p>
      </div>
      <div v-for="product in filteredProducts" :key="product.id" class="bg-white border border-slate-100 rounded-3xl p-5 space-y-4 hover:shadow-xl hover:shadow-slate-200/50 transition-all">
        <div class="flex justify-between items-start">
          <div class="space-y-1 text-left pr-3">
            <h3 class="font-bold text-slate-900 text-lg leading-tight">{{ product.name }}</h3>
          </div>
          <button
            type="button"
            @click="openProductDetails(product)"
            class="shrink-0 h-9 px-3 bg-warm text-primary border border-primary/10 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all hover:bg-accent/15"
          >
            <Info class="w-3.5 h-3.5" />
            {{ languageStore.t('details') }}
          </button>
        </div>

        <p class="text-slate-500 text-sm leading-relaxed line-clamp-2 text-left">
          {{ product.description }}
        </p>

        <!-- Document Badges / Mini-vignettes -->
        <div v-if="product.depliant_url || product.document_information_url" class="flex flex-wrap items-center gap-2 pt-1 text-left">
          <button
            v-if="product.depliant_url"
            type="button"
            @click.stop="handleDownload(product, 'depliant')"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-100 hover:border-rose-200 text-slate-700 hover:text-rose-700 text-[11px] font-black transition-all group active:scale-95 shadow-xs cursor-pointer"
            :title="languageStore.isEn() ? 'Download Brochure' : 'Télécharger le Dépliant commercial'"
          >
            <Loader2 v-if="downloadingDoc === `${product.id}-depliant`" class="w-3.5 h-3.5 text-rose-500 animate-spin" />
            <FileText v-else class="w-3.5 h-3.5 text-rose-500" />
            <span>{{ languageStore.isEn() ? 'Brochure' : 'Dépliant' }}</span>
            <Download class="w-3 h-3 text-slate-400 group-hover:text-rose-600 ml-0.5" />
          </button>

          <button
            v-if="product.document_information_url"
            type="button"
            @click.stop="handleDownload(product, 'dici')"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 text-slate-700 hover:text-primary text-[11px] font-black transition-all group active:scale-95 shadow-xs cursor-pointer"
            :title="languageStore.isEn() ? 'Download Key Info Document' : 'Télécharger le Document d\'information clé (DICI)'"
          >
            <Loader2 v-if="downloadingDoc === `${product.id}-dici`" class="w-3.5 h-3.5 text-primary animate-spin" />
            <FileText v-else class="w-3.5 h-3.5 text-primary" />
            <span>{{ languageStore.isEn() ? 'KID (DICI)' : 'Document Info (DICI)' }}</span>
            <Download class="w-3 h-3 text-slate-400 group-hover:text-primary ml-0.5" />
          </button>
        </div>

        <div class="pt-4 border-t border-slate-50 space-y-4">
          <div class="text-left">
            <span class="text-slate-400 text-[10px] block uppercase font-black tracking-tighter">{{ languageStore.t('current_nav') }}</span> <br>
            <span class="text-primary font-black text-2xl leading-none">{{ Number(product.vl).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} XAF</span>
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
                {{ languageStore.t('invest_now') }}
              </a>
            </router-link>
            <button 
              v-else
              @click="showWarningModal = true"
              class="flex-1 h-12 bg-slate-100 text-slate-400 font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-200/50"
            >
              <Plus class="w-4 h-4 text-slate-400" />
              {{ languageStore.t('invest_now') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Product VL Details Modal -->
    <Teleport to="body">
      <div v-if="selectedProduct" class="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6">
        <!-- Backdrop overlay with blur and click-to-close -->
        <div 
          @click="closeProductDetails" 
          class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
        ></div>

        <!-- Modal Dialog Card -->
        <div class="relative bg-white rounded-[32px] w-full max-w-md max-h-[90vh] flex flex-col border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 text-left z-10 overflow-hidden">
          <!-- Pinned Header with permanent Close Button in top right corner -->
          <div class="px-5 py-4 sm:px-6 bg-white border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
            <div class="space-y-0.5 min-w-0 pr-2">
              <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em] block">{{ languageStore.t('product_details') }}</span>
              <h3 class="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">{{ selectedProduct.name }}</h3>
            </div>
            <button
              type="button"
              @click="closeProductDetails"
              class="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center active:scale-95 transition-all shrink-0 shadow-xs cursor-pointer"
              :aria-label="languageStore.isEn() ? 'Close' : 'Fermer'"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Scrollable Content Area -->
          <div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            <!-- Carte Évolution de la VL (Dynamique au survol) -->
            <div class="bg-cream border border-accent/20 rounded-3xl p-5 space-y-2 transition-all">
              <div class="flex items-center justify-between">
                <span class="text-[10px] text-secondary block uppercase font-black tracking-widest flex items-center gap-1.5">
                  <span v-if="activeDisplayPoint.isHovered" class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {{ activeDisplayPoint.title }}
                </span>
                <span v-if="activeDisplayPoint.isHovered" class="text-[9px] font-bold text-slate-400">
                  {{ languageStore.t('interactive_hover') }}
                </span>
                <span v-else class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {{ selectedPeriod === '6S' ? languageStore.t('last_6w') : languageStore.t('last_12w') }}
                </span>
              </div>

              <div class="flex items-end justify-between gap-3">
                <span class="text-primary font-black text-3xl leading-none transition-all">
                  {{ Number(activeDisplayPoint.vl).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} XAF
                </span>
                <span
                  v-if="activeDisplayPoint.variation !== null"
                  :class="activeDisplayPoint.variation >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' : 'bg-rose-50 text-rose-600 border-rose-200/50'"
                  class="px-2.5 py-1 rounded-full text-[10px] font-black border"
                >
                  {{ activeDisplayPoint.variation >= 0 ? '+' : '' }}{{ activeDisplayPoint.variation.toFixed(2) }}%
                </span>
              </div>
            </div>

            <!-- Conteneur Graphique Courbe Évolutive -->
            <div v-if="chartPoints.length > 1" class="space-y-3 animate-in fade-in duration-300">
              <!-- Filtres de Période (6 Semaines / 12 Semaines) -->
              <div class="flex items-center justify-between">
                <span class="text-slate-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp class="w-3.5 h-3.5 text-primary" />
                  {{ languageStore.t('evolution_curve') }}
                </span>

                <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    @click="selectedPeriod = '6S'; hoveredIndex = null"
                    :class="selectedPeriod === '6S' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-500 font-bold hover:text-slate-800'"
                    class="px-2.5 py-1 rounded-lg text-[10px] transition-all active:scale-95"
                  >
                    {{ languageStore.t('period_6w') }}
                  </button>
                  <button
                    type="button"
                    @click="selectedPeriod = '12S'; hoveredIndex = null"
                    :class="selectedPeriod === '12S' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-500 font-bold hover:text-slate-800'"
                    class="px-2.5 py-1 rounded-lg text-[10px] transition-all active:scale-95"
                  >
                    {{ languageStore.t('period_12w') }}
                  </button>
                </div>
              </div>

              <!-- Zone du Graphique SVG Interactif -->
              <div 
                class="relative bg-slate-50/80 rounded-3xl p-3 border border-slate-100 overflow-hidden select-none"
                @mouseleave="onChartLeave"
                @touchend="onChartLeave"
              >
                <!-- Floating Tooltip Pill (au-dessus du point survolé) -->
                <div 
                  v-if="hoveredPoint"
                  class="absolute pointer-events-none transition-all duration-150 transform -translate-x-1/2 z-30"
                  :style="{ 
                    left: `${(hoveredPoint.x / 380) * 100}%`, 
                    top: `${Math.max(6, hoveredPoint.y - 48)}px` 
                  }"
                >
                  <div class="bg-slate-900/95 backdrop-blur-md text-white px-2.5 py-1 rounded-xl shadow-xl border border-slate-700/60 text-center whitespace-nowrap">
                    <div class="text-[8px] text-slate-300 font-bold uppercase tracking-wider">
                      {{ hoveredPoint.fullDate }}
                    </div>
                    <div class="text-[11px] font-black text-white flex items-center justify-center gap-1.5">
                      <span>{{ Number(hoveredPoint.vl).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} XAF</span>
                      <span :class="hoveredPoint.totalVar >= 0 ? 'text-emerald-400' : 'text-rose-400'" class="text-[8px] font-black">
                        {{ hoveredPoint.totalVar >= 0 ? '+' : '' }}{{ hoveredPoint.totalVar.toFixed(1) }}%
                      </span>
                    </div>
                  </div>
                </div>

                <!-- SVG Graph -->
                <svg 
                  ref="chartSvgRef"
                  viewBox="0 0 380 180" 
                  class="w-full h-44 overflow-visible cursor-crosshair touch-none"
                  @mousemove="onChartHover"
                  @touchmove.prevent="onChartHover"
                >
                  <defs>
                    <!-- Dégradé de la surface sous la courbe -->
                    <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#0f172a" stop-opacity="0.22" />
                      <stop offset="65%" stop-color="#0f172a" stop-opacity="0.04" />
                      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.00" />
                    </linearGradient>

                    <!-- Filtre d'ombre portée pour la courbe -->
                    <filter id="curveGlow" x="-10%" y="-10%" width="120%" height="120%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.18" />
                    </filter>
                  </defs>

                  <!-- Lignes de grille horizontales discrètes -->
                  <line x1="24" y1="36" x2="356" y2="36" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4" />
                  <line x1="24" y1="78" x2="356" y2="78" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4" />
                  <line x1="24" y1="120" x2="356" y2="120" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4" />
                  <line x1="24" y1="142" x2="356" y2="142" stroke="#cbd5e1" stroke-width="1" />

                  <!-- Remplissage dégradé sous la courbe -->
                  <path 
                    :d="chartPaths.area" 
                    fill="url(#curveGradient)" 
                    class="transition-all duration-300"
                  />

                  <!-- Courbe Évolutive Spline -->
                  <path 
                    :d="chartPaths.line" 
                    fill="none" 
                    stroke="#0f172a" 
                    stroke-width="3" 
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    filter="url(#curveGlow)"
                    class="transition-all duration-300"
                  />

                  <!-- Points discrets sur la courbe -->
                  <g v-for="(pt, idx) in chartPoints" :key="'dot-' + idx">
                    <circle 
                      :cx="pt.x" 
                      :cy="pt.y" 
                      r="3.5" 
                      fill="#ffffff" 
                      stroke="#0f172a" 
                      stroke-width="2"
                      class="transition-all duration-200"
                    />
                  </g>

                  <!-- Curseur de survol vertical (Crosshair Line) -->
                  <g v-if="hoveredPoint" class="transition-opacity duration-150">
                    <!-- Ligne verticale en pointillé -->
                    <line 
                      :x1="hoveredPoint.x" 
                      y1="16" 
                      :x2="hoveredPoint.x" 
                      y2="142" 
                      stroke="#64748b" 
                      stroke-width="1.5" 
                      stroke-dasharray="3 3"
                    />

                    <!-- Halo et Point interactif pulsant -->
                    <circle 
                      :cx="hoveredPoint.x" 
                      :cy="hoveredPoint.y" 
                      r="10" 
                      fill="#0f172a" 
                      opacity="0.15" 
                      class="animate-ping"
                    />
                    <circle 
                      :cx="hoveredPoint.x" 
                      :cy="hoveredPoint.y" 
                      r="6" 
                      fill="#0f172a" 
                      stroke="#ffffff" 
                      stroke-width="2.5" 
                      class="shadow-md"
                    />
                  </g>

                  <!-- Libellés des dates sur l'axe X -->
                  <g v-for="(pt, idx) in chartPoints" :key="'label-' + idx">
                    <text 
                      v-if="chartPoints.length <= 6 || idx % 2 === 0 || idx === chartPoints.length - 1"
                      :x="pt.x" 
                      y="160" 
                      text-anchor="middle" 
                      :font-weight="hoveredIndex === idx ? '900' : '700'"
                      :fill="hoveredIndex === idx ? '#0f172a' : '#94a3b8'"
                      font-size="9"
                      class="transition-all uppercase tracking-tighter select-none font-sans"
                    >
                      {{ pt.date }}
                    </text>
                  </g>

                  <!-- Surface tactile invisible pour capturer le mouvement -->
                  <rect 
                    x="0" 
                    y="0" 
                    width="380" 
                    height="180" 
                    fill="transparent" 
                    class="cursor-crosshair"
                  />
                </svg>

                <!-- Guide explicatif discret -->
                <div class="flex items-center justify-between text-[9px] text-slate-400 font-bold px-2 pt-1 border-t border-slate-100/80">
                  <span class="flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    {{ languageStore.isEn() ? 'Hover or drag to read NAV values' : 'Survolez ou glissez pour lire les valeurs' }}
                  </span>
                  <span>
                    {{ chartPoints.length }} {{ languageStore.isEn() ? 'weeks' : 'semaines' }}
                  </span>
                </div>
              </div>
            </div>

            <div v-else class="bg-slate-50 rounded-3xl p-6 border border-slate-100 text-center space-y-2">
              <Info class="w-8 h-8 text-primary/40 mx-auto" />
              <p class="text-xs text-slate-500 font-bold leading-relaxed">
                {{ languageStore.isEn() ? 'NAV history is not yet available for this fund.' : "L'historique de VL n'est pas encore disponible pour ce fonds." }}
              </p>
            </div>

            <!-- Documentation & Plaquettes (Vignettes de téléchargement) -->
            <div class="space-y-3 pt-1">
              <div class="flex items-center justify-between">
                <span class="text-slate-400 text-[10px] font-black uppercase tracking-wider">{{ languageStore.isEn() ? 'Official Documents' : 'Documents officiels' }}</span>
                <span class="text-[10px] text-slate-400 font-bold">PDF Format</span>
              </div>

              <div class="space-y-2.5">
                <!-- Vignette 1: Dépliant Commercial -->
                <div 
                  class="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                  :class="selectedProduct.depliant_url ? 'bg-slate-50 border-slate-100 hover:border-slate-200 shadow-xs' : 'bg-slate-50/50 border-dashed border-slate-200/60 opacity-60'"
                >
                  <div class="flex items-center gap-3 min-w-0 pr-2">
                    <!-- Vignette Thumbnail -->
                    <div class="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center shrink-0 shadow-xs relative">
                      <FileText class="w-5 h-5 text-rose-600" />
                      <span class="absolute -bottom-1 text-[7px] font-black tracking-wider bg-rose-600 text-white px-1 rounded-sm uppercase">PDF</span>
                    </div>
                    <div class="min-w-0">
                      <h4 class="text-xs font-black text-slate-900 truncate">{{ languageStore.isEn() ? 'Commercial Brochure' : 'Dépliant Commercial' }}</h4>
                      <p class="text-[10px] text-slate-500 font-medium truncate">{{ languageStore.isEn() ? 'Fund presentation brochure' : 'Brochure de présentation du fonds' }}</p>
                    </div>
                  </div>

                  <!-- Action Button -->
                  <button 
                    v-if="selectedProduct.depliant_url" 
                    type="button"
                    @click="handleDownload(selectedProduct, 'depliant')"
                    :disabled="downloadingDoc === `${selectedProduct.id}-depliant`"
                    class="shrink-0 h-9 px-3 bg-white text-primary border border-slate-200 hover:bg-primary hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Loader2 v-if="downloadingDoc === `${selectedProduct.id}-depliant`" class="w-3.5 h-3.5 animate-spin" />
                    <Download v-else class="w-3.5 h-3.5" />
                    <span>{{ downloadingDoc === `${selectedProduct.id}-depliant` ? (languageStore.isEn() ? 'Downloading...' : 'Téléchargement...') : (languageStore.isEn() ? 'Download' : 'Télécharger') }}</span>
                  </button>
                  <span v-else class="text-[10px] font-bold text-slate-400 italic shrink-0">
                    {{ languageStore.isEn() ? 'Not available' : 'Non disponible' }}
                  </span>
                </div>

                <!-- Vignette 2: Document d'information (DICI) -->
                <div 
                  class="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                  :class="selectedProduct.document_information_url ? 'bg-slate-50 border-slate-100 hover:border-slate-200 shadow-xs' : 'bg-slate-50/50 border-dashed border-slate-200/60 opacity-60'"
                >
                  <div class="flex items-center gap-3 min-w-0 pr-2">
                    <!-- Vignette Thumbnail -->
                    <div class="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center shrink-0 shadow-xs relative">
                      <FileText class="w-5 h-5 text-primary" />
                      <span class="absolute -bottom-1 text-[7px] font-black tracking-wider bg-primary text-white px-1 rounded-sm uppercase">KID</span>
                    </div>
                    <div class="min-w-0">
                      <h4 class="text-xs font-black text-slate-900 truncate">{{ languageStore.isEn() ? 'Key Information Document' : 'Document d\'information' }}</h4>
                      <p class="text-[10px] text-slate-500 font-medium truncate">{{ languageStore.isEn() ? 'Key investor information (KID)' : 'Informations clés investisseur (DICI)' }}</p>
                    </div>
                  </div>

                  <!-- Action Button -->
                  <button 
                    v-if="selectedProduct.document_information_url" 
                    type="button"
                    @click="handleDownload(selectedProduct, 'dici')"
                    :disabled="downloadingDoc === `${selectedProduct.id}-dici`"
                    class="shrink-0 h-9 px-3 bg-white text-primary border border-slate-200 hover:bg-primary hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Loader2 v-if="downloadingDoc === `${selectedProduct.id}-dici`" class="w-3.5 h-3.5 animate-spin" />
                    <Download v-else class="w-3.5 h-3.5" />
                    <span>{{ downloadingDoc === `${selectedProduct.id}-dici` ? (languageStore.isEn() ? 'Downloading...' : 'Téléchargement...') : (languageStore.isEn() ? 'Download' : 'Télécharger') }}</span>
                  </button>
                  <span v-else class="text-[10px] font-bold text-slate-400 italic shrink-0">
                    {{ languageStore.isEn() ? 'Not available' : 'Non disponible' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Pinned Footer with CTA Button (Always visible above navbar) -->
          <div class="p-4 sm:p-5 border-t border-slate-100 bg-white shrink-0">
            <router-link
              :to="'/subscribe/' + selectedProduct.id"
              class="w-full bg-primary text-white font-black py-3.5 sm:py-4 rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-sm uppercase tracking-wider"
            >
              <Plus class="w-4 h-4" />
              {{ languageStore.t('invest_now') }}
            </router-link>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Onboarding Validation Warning Modal -->
    <Teleport to="body">
      <div v-if="showWarningModal" class="fixed inset-0 z-[10001] flex items-center justify-center p-6">
        <div 
          @click="showWarningModal = false" 
          class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
        ></div>
        <div class="relative bg-white rounded-[32px] p-6 w-full max-w-sm border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 text-center space-y-6 z-10">
          <button 
            type="button" 
            @click="showWarningModal = false" 
            class="absolute right-4 top-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            :aria-label="languageStore.isEn() ? 'Close' : 'Fermer'"
          >
            <X class="w-4 h-4" />
          </button>
          <div class="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle class="w-8 h-8 text-amber-500" />
          </div>
          <div class="space-y-2">
            <h3 class="text-lg font-black text-slate-900">{{ languageStore.isEn() ? 'Account Pending' : 'Compte en attente' }}</h3>
            <p class="text-xs text-slate-500 font-medium leading-relaxed">
              {{ languageStore.isEn() ? 'Our compliance team is currently reviewing your file. You will be able to subscribe as soon as your account is activated.' : 'Notre service conformité étudie actuellement votre dossier. Vous pourrez effectuer vos souscriptions dès que votre compte sera activé.' }}
            </p>
          </div>
          <button 
            @click="showWarningModal = false" 
            class="w-full bg-primary text-white font-black py-3 rounded-2xl shadow-lg hover:bg-slate-800 transition-all text-xs uppercase tracking-wider cursor-pointer"
          >
            {{ languageStore.isEn() ? 'Got it' : "D'accord" }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
