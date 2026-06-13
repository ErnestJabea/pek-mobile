<script setup>
import { ref, onMounted, computed } from 'vue'
import { Info, Plus, Search, Filter, Loader2, AlertCircle } from 'lucide-vue-next'
import api from '../api/api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const products = ref([])
const loading = ref(true)
const searchQuery = ref('')
const showWarningModal = ref(false)

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
          <div class="space-y-1 text-left">
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
          <div class="text-right">
          </div>
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
