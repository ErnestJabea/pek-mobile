<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Landmark, ChevronLeft, Wallet, ArrowRight, Loader2, CheckCircle2, Clock, AlertCircle, ChevronRight } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import api from '../api/api'

const router = useRouter()
const subscriptions = ref([])
const loading = ref(true)
const currentPage = ref(1)
const itemsPerPage = 4

const fetchSubscriptions = async () => {
  try {
    const response = await api.get('/subscriptions')
    subscriptions.value = response.data
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
  } finally {
    loading.value = false
  }
}

const totalPages = computed(() => Math.ceil(subscriptions.value.length / itemsPerPage))

const checkingId = ref(null)

const verifyPayment = async (subId) => {
  checkingId.value = subId
  try {
    const response = await api.post(`/subscriptions/${subId}/check-status`)
    alert(response.data.message)
    await fetchSubscriptions()
  } catch (error) {
    console.error('Error checking payment status:', error)
    alert(error.response?.data?.message || 'Erreur lors de la vérification du paiement.')
  } finally {
    checkingId.value = null
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
  fetchSubscriptions()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <!-- Header -->
    <header class="bg-white px-6 py-6 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-10">
      <button @click="router.back()" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all">
        <ChevronLeft class="w-6 h-6" />
      </button>
      <h2 class="text-xl font-bold text-slate-900">Souscriptions</h2>
    </header>

    <main class="flex-1 flex flex-col p-6 pb-24">
      <div v-if="loading" class="flex-1 flex flex-col items-center justify-center space-y-4">
        <Loader2 class="w-10 h-10 text-primary animate-spin" />
        <p class="text-slate-400 font-bold">Chargement de vos investissements...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="subscriptions.length === 0" class="flex-1 flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in zoom-in duration-500">
        <div class="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center">
          <Wallet class="w-10 h-10 text-primary/30" />
        </div>
        
        <div class="space-y-2">
          <h3 class="text-xl font-bold text-slate-900">Aucun investissement</h3>
          <p class="text-slate-500 text-sm max-w-[240px] mx-auto leading-relaxed">
            Vous n'avez pas encore souscrit à un fonds. Commencez dès maintenant à faire fructifier votre épargne.
          </p>
        </div>

        <router-link to="/catalog" class="inline-flex items-center gap-2 bg-primary text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
          Parcourir le catalogue
          <ArrowRight class="w-4 h-4" />
        </router-link>
      </div>

      <!-- Subscriptions List -->
      <div v-else class="space-y-6">
        <div class="space-y-4">
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

            <div class="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
              <div>
                <span class="text-slate-400 text-[10px] block font-black uppercase tracking-tighter mb-1">Parts</span>
                <span class="text-slate-900 font-black">{{ parseFloat(sub.nb_parts).toLocaleString() }}</span>
              </div>
              <div class="text-right">
                <span class="text-slate-400 text-[10px] block font-black uppercase tracking-tighter mb-1">Montant Total</span>
                <span class="text-primary font-black">{{ parseFloat(sub.montant_total).toLocaleString() }} FCFA</span>
              </div>
            </div>

            <div class="flex flex-col gap-1 text-[10px] text-slate-400 font-bold border-t border-slate-50 pt-3">
              <div class="flex justify-between items-center">
                <span>Réf PEK : <span class="text-slate-600 font-black">{{ sub.reference_transaction }}</span></span>
                <span class="italic font-normal">{{ new Date(sub.created_at).toLocaleDateString() }}</span>
              </div>
              <div v-if="sub.coolpay_transaction_ref" class="flex justify-between items-center">
                <span>Réf CoolPay : <span class="text-slate-600 font-black truncate max-w-[200px]">{{ sub.coolpay_transaction_ref }}</span></span>
              </div>
            </div>

            <!-- Bouton premium pour forcer la vérification de paiement -->
            <div v-if="sub.statut === 'En attente' && ['orange_money', 'mtn_momo'].includes(sub.moyen_paiement)" class="pt-2">
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
            Précédent
          </button>

          <span class="text-slate-400 font-black text-[10px] uppercase">
            Page {{ currentPage }} sur {{ totalPages }}
          </span>

          <button 
            @click="nextPage" 
            :disabled="currentPage === totalPages"
            :class="currentPage === totalPages ? 'opacity-30' : 'active:scale-95'"
            class="flex items-center gap-2 text-slate-600 font-black uppercase text-[10px] bg-white border border-slate-100 px-4 py-3 rounded-2xl transition-all"
          >
            Suivant
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
