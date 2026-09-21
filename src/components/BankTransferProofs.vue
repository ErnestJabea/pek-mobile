<script setup>
import { ref, onMounted } from 'vue'
import { UploadCloud, FileText, CheckCircle2, X, AlertCircle, Loader2, Download, ShieldCheck, Clock } from 'lucide-vue-next'
import api from '../api/api'

const props = defineProps({ subscription: { type: Object, required: true } })
const proofs = ref([])
const file = ref(null)
const fileInput = ref(null)
const busy = ref(false)
const message = ref('')
const error = ref('')
const isDragging = ref(false)
const declaredDate = ref(new Date().toLocaleDateString('en-CA'))
const declaredAmount = ref(Math.round(Number(props.subscription.montant_total)))
const declaredReference = ref('')

const load = async () => {
  try { 
    proofs.value = (await api.get(`/subscriptions/${props.subscription.id}/proofs`)).data 
  } catch { 
    error.value = 'Impossible de charger les justificatifs.' 
  }
}

onMounted(load)

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko'
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
}

const handleDrop = (e) => {
  isDragging.value = false
  if (e.dataTransfer?.files?.length) {
    validateAndSetFile(e.dataTransfer.files[0])
  }
}

const handleFileInputChange = (e) => {
  if (e.target.files?.length) {
    validateAndSetFile(e.target.files[0])
  }
}

const validateAndSetFile = (f) => {
  error.value = ''
  if (!f) return
  const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  if (!validTypes.includes(f.type)) {
    error.value = 'Format non supporté. Veuillez choisir un fichier PDF, JPEG ou PNG.'
    return
  }
  if (f.size > 10 * 1024 * 1024) {
    error.value = 'Fichier trop volumineux. La taille maximale autorisée est de 10 Mo.'
    return
  }
  file.value = f
}

const removeFile = () => {
  file.value = null
  if (fileInput.value) fileInput.value.value = ''
}

const upload = async () => {
  error.value = ''
  message.value = ''
  if (!navigator.onLine) { 
    error.value = 'Une connexion Internet est requise pour envoyer le justificatif.'
    return 
  }
  if (!file.value || file.value.size > 10 * 1024 * 1024) { 
    error.value = 'Veuillez sélectionner un fichier PDF, JPEG ou PNG de 10 Mo maximum.'
    return 
  }
  busy.value = true
  try {
    const data = new FormData()
    data.append('file', file.value)
    data.append('declared_date', declaredDate.value)
    data.append('declared_amount', declaredAmount.value)
    data.append('declared_reference', declaredReference.value)
    const response = await api.post(`/subscriptions/${props.subscription.id}/proofs`, data, { 
      headers: { 'Content-Type': 'multipart/form-data' } 
    })
    message.value = response.data.message
    removeFile()
    await load()
  } catch (e) { 
    error.value = e.response?.data?.message || 'Envoi impossible. Vérifiez les informations avant de réessayer.' 
  } finally { 
    busy.value = false 
  }
}

const download = async (proof) => {
  try {
    const response = await api.get(`/payment-proofs/${proof.id}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `justificatif-${proof.id}.${proof.mime === 'application/pdf' ? 'pdf' : proof.mime === 'image/png' ? 'png' : 'jpg'}`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch { 
    error.value = 'Document indisponible ou contrôle de sécurité en cours.' 
  }
}

const scanLabel = (status) => ({ 
  clean: 'Contrôle validé ✅', 
  quarantined: 'Contrôle antivirus en cours ⏳', 
  infected: 'Document bloqué ⚠️' 
}[status] || status)

const reviewLabel = (status) => ({ 
  received: 'Reçu', 
  examined: 'Justificatif examiné',
  replacement_requested: 'Remplacement demandé' 
}[status] || status)
</script>

<template>
  <section class="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 text-left text-sm shadow-xs">
    <!-- Entête -->
    <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
      <div class="space-y-1">
        <h3 class="font-black text-slate-900 text-sm flex items-center gap-1.5">
          <ShieldCheck class="w-4 h-4 text-primary" />
          Justificatif de virement
        </h3>
        <p class="text-xs text-slate-500 leading-snug">
          Transmettez votre reçu pour le rapprochement bancaire. Son dépôt ne confirme pas le paiement : les parts seront calculées avec la VL à la date de réception effective des fonds.
        </p>
      </div>
    </div>

    <!-- Coordonnées bancaires récapitulatives si présentes -->
    <div v-if="subscription.bank_snapshot" class="text-xs bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-1.5">
      <div class="flex justify-between items-center text-slate-600">
        <span class="font-bold">Banque :</span>
        <span class="font-black text-slate-900">{{ subscription.bank_snapshot.bank_name }}</span>
      </div>
      <div v-if="subscription.bank_snapshot.beneficiary" class="flex justify-between items-center text-slate-600">
        <span class="font-bold">Bénéficiaire :</span>
        <span class="font-black text-slate-900">{{ subscription.bank_snapshot.beneficiary }}</span>
      </div>
      <div class="flex justify-between items-center text-slate-600">
        <span class="font-bold">Compte / IBAN :</span>
        <span class="font-mono font-bold text-slate-900 text-[11px]">{{ subscription.bank_snapshot.iban || subscription.bank_snapshot.rib }}</span>
      </div>
      <div class="flex justify-between items-center text-slate-600">
        <span class="font-bold">Réf. à mentionner :</span>
        <span class="font-mono font-black text-primary text-[11px]">{{ subscription.reference_transaction }}</span>
      </div>
      <div class="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-200/60">
        <span class="font-bold">Total à virer :</span>
        <span class="font-black text-primary">{{ Number(subscription.montant_total).toLocaleString() }} XAF</span>
      </div>
    </div>

    <div v-if="subscription.value_date" class="text-xs font-semibold text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-2">
      <Clock class="w-4 h-4 shrink-0" />
      <span>Date de valeur : {{ subscription.value_date.slice(0, 10) }}<span v-if="subscription.valuation_status === 'awaiting_nav'"> — fonds reçus, en attente de la VL de cette date.</span></span>
    </div>

    <!-- Formulaire d'upload de justificatif -->
    <form v-if="!subscription.funds_received_at && subscription.statut !== 'Succès'" @submit.prevent="upload" class="space-y-4 pt-1">
      
      <!-- Zone d'Upload Stylisée -->
      <div class="space-y-1.5">
        <label class="block text-xs font-black uppercase text-slate-500 tracking-wider">
          Fichier du justificatif <span class="text-rose-500">*</span>
        </label>
        
        <!-- Zone vide : Glisser-déposer ou Parcourir -->
        <div
          v-if="!file"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          @click="fileInput?.click()"
          :class="[
            isDragging ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-slate-300/80 bg-slate-50/60 hover:bg-slate-100/80 hover:border-primary/50',
          ]"
          class="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group active:scale-[0.99] shadow-2xs"
        >
          <input
            ref="fileInput"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            @click.stop
            @change="handleFileInputChange"
            class="hidden"
          />
          <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2.5 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all shadow-xs">
            <UploadCloud class="w-6 h-6" />
          </div>
          <p class="text-xs text-slate-800 font-bold select-none">
            Cliquez pour choisir un fichier ou <span class="text-primary font-black underline">Parcourir</span>
          </p>
          <p class="text-[11px] text-slate-400 font-medium mt-1 select-none">
            PDF, JPEG ou PNG — 10 Mo maximum
          </p>
        </div>

        <!-- Fichier sélectionné : Carte de confirmation et suppression -->
        <div
          v-else
          class="rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-3.5 flex items-center justify-between gap-3 shadow-xs animate-in fade-in zoom-in-95 duration-200"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
              <FileText class="w-5 h-5" />
            </div>
            <div class="min-w-0 text-left">
              <p class="text-xs font-black text-slate-900 truncate" :title="file.name">
                {{ file.name }}
              </p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-[10px] text-slate-500 font-semibold">{{ formatFileSize(file.size) }}</span>
                <span class="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 class="w-3 h-3 text-emerald-600" /> Prêt pour l'envoi
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            @click.stop="removeFile"
            class="w-8 h-8 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 flex items-center justify-center shrink-0 transition-all active:scale-90"
            title="Supprimer ce fichier"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Champs complémentaires : Date, Montant, Référence -->
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Date du virement</label>
          <input v-model="declaredDate" type="date" required class="block w-full rounded-xl border border-slate-200 p-2.5 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs" />
        </div>
        <div class="space-y-1">
          <label class="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Montant viré (XAF)</label>
          <input v-model="declaredAmount" type="number" min="1" step="1" required class="block w-full rounded-xl border border-slate-200 p-2.5 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs" />
        </div>
      </div>

      <div class="space-y-1">
        <label class="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
          Référence bancaire <span class="text-slate-400 font-normal lowercase">(si disponible)</span>
        </label>
        <input v-model="declaredReference" placeholder="Ex: VIR-849202 ou n° de transaction banque" maxlength="120" class="block w-full rounded-xl border border-slate-200 p-2.5 bg-white text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs" />
      </div>

      <!-- Messages d'erreur et de succès -->
      <div v-if="message" role="status" class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
        <span>{{ message }}</span>
      </div>
      <div v-if="error" role="alert" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
        <AlertCircle class="w-4 h-4 text-rose-600 shrink-0" />
        <span>{{ error }}</span>
      </div>

      <!-- Bouton de soumission -->
      <button 
        type="submit"
        :disabled="busy || !file" 
        class="w-full rounded-2xl bg-primary text-white py-3.5 px-4 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md shadow-primary/20"
      >
        <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
        <UploadCloud v-else class="w-4 h-4" />
        <span>{{ busy ? 'Envoi et contrôle en cours…' : 'Envoyer le justificatif' }}</span>
      </button>
    </form>

    <!-- Liste des justificatifs déjà envoyés -->
    <div v-if="proofs.length > 0" class="space-y-2 pt-2 border-t border-slate-100">
      <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Justificatifs transmis ({{ proofs.length }})</span>
      <ul class="space-y-2">
        <li v-for="proof in proofs" :key="proof.id" class="rounded-2xl bg-slate-50 p-3.5 text-xs space-y-1.5 border border-slate-100">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <FileText class="w-4 h-4 text-primary shrink-0" />
              <p class="font-bold text-slate-900 truncate">{{ proof.original_name }}</p>
            </div>
            <button 
              v-if="proof.scan_status === 'clean'" 
              @click="download(proof)" 
              class="text-primary hover:underline font-bold text-[11px] flex items-center gap-1 shrink-0"
            >
              <Download class="w-3 h-3" />
              <span>Télécharger</span>
            </button>
          </div>
          <div class="flex items-center gap-2 text-[10px] text-slate-500">
            <span>{{ scanLabel(proof.scan_status) }}</span>
            <span>•</span>
            <span class="font-medium">{{ reviewLabel(proof.review_status) }}</span>
          </div>
          <p v-if="proof.review_note" class="text-[10px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-100 font-medium">
            Note de conformité : {{ proof.review_note }}
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
