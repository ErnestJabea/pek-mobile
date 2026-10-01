<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Printer, Download, Loader2, AlertCircle } from 'lucide-vue-next'
import api from '../api/api'

const route = useRoute()
const router = useRouter()
const subscriptionId = route.params.id

const data = ref(null)
const loading = ref(true)
const error = ref('')

const cadreRef = ref(null)
const pageRef = ref(null)

const adjustScale = () => {
  if (!cadreRef.value || !pageRef.value) return
  const pageWidth = pageRef.value.offsetWidth || 794 // 210mm in px @ 96dpi
  const clientWidth = document.documentElement.clientWidth - 32
  const s = Math.min(1, clientWidth / pageWidth)
  cadreRef.value.style.setProperty('--s', s.toFixed(4))
}

const printDocument = () => {
  window.print()
}

const downloadPdf = async () => {
  try {
    const res = await api.get(`/subscriptions/${subscriptionId}/bulletin/download`, {
      responseType: 'blob'
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bulletin_souscription_${data.value?.reference_transaction || subscriptionId}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Erreur téléchargement PDF:', err)
    // Repli sur l'impression du navigateur
    window.print()
  }
}

onMounted(async () => {
  try {
    const res = await api.get(`/subscriptions/${subscriptionId}/bulletin-data`)
    data.value = res.data.data
  } catch (err) {
    console.error('Erreur chargement bulletin:', err)
    error.value = err.response?.data?.message || 'Impossible de charger la fiche de souscription.'
  } finally {
    loading.value = false
    setTimeout(adjustScale, 100)
  }

  window.addEventListener('resize', adjustScale)
  window.addEventListener('beforeprint', () => {
    if (cadreRef.value) cadreRef.value.style.setProperty('--s', '1')
  })
  window.addEventListener('afterprint', adjustScale)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', adjustScale)
  window.removeEventListener('afterprint', adjustScale)
})
</script>

<template>
  <div class="ecran">
    <!-- Barre d'outils supérieure (masquée à l'impression) -->
    <div class="barre-outils">
      <button 
        type="button" 
        @click="router.push('/my-subscriptions?tab=transactions')" 
        class="btn-action btn-retour"
      >
        <ArrowLeft class="w-4 h-4" />
        <span>Retour</span>
      </button>

      <div class="flex items-center gap-2">
        <button 
          type="button" 
          @click="downloadPdf" 
          class="btn-action btn-secondaire"
        >
          <Download class="w-4 h-4" />
          <span class="hidden sm:inline">Télécharger PDF</span>
        </button>
        <button 
          type="button" 
          @click="printDocument" 
          class="btn-action btn-imprimer"
        >
          <Printer class="w-4 h-4" />
          <span>Imprimer</span>
        </button>
      </div>
    </div>

    <!-- État de chargement -->
    <div v-if="loading" class="py-24 text-center space-y-4">
      <Loader2 class="w-10 h-10 animate-spin text-primary mx-auto" />
      <p class="text-sm font-bold text-slate-600">Génération du bulletin officiel en cours…</p>
    </div>

    <!-- État d'erreur -->
    <div v-else-if="error" class="py-16 text-center max-w-md mx-auto space-y-4 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
      <AlertCircle class="w-12 h-12 text-rose-500 mx-auto" />
      <h3 class="text-lg font-black text-slate-900">Document indisponible</h3>
      <p class="text-xs text-slate-500 font-medium">{{ error }}</p>
      <button 
        type="button" 
        @click="router.push('/my-subscriptions')" 
        class="bg-primary text-white text-xs font-black py-3 px-6 rounded-2xl"
      >
        Retour à mes souscriptions
      </button>
    </div>

    <!-- Feuille A4 Prête à Imprimer & Présentation Executive -->
    <div v-else class="feuille-cadre" ref="cadreRef">
      <article class="page-a4" ref="pageRef" :aria-label="'Bulletin de souscription ' + data?.fcp_nom">

        <!-- ============================ EN-TÊTE ============================ -->
        <table class="table-header">
          <tr>
            <td class="header-logo">
              <img :src="data?.logo_base64 || '/logo-kori.png'" alt="KORI Asset Management" class="logo-img" />
            </td>
            <td class="header-title-box">
              <div class="titre-bulletin">BULLETIN DE SOUSCRIPTION</div>
              <div class="fcp-nom">{{ data?.fcp_nom }}</div>
              <div class="fcp-agrement">{{ data?.fcp_agrement }}</div>
            </td>
          </tr>
        </table>

        <!-- ===================== I- IDENTIFICATION DU CLIENT ===================== -->
        <div class="section-titre">I- IDENTIFICATION DU CLIENT</div>

        <table class="table-champs">
          <tr>
            <td class="lbl">Nom ou Raison sociale&nbsp;:</td>
            <td class="val-ligne" colspan="3">{{ data?.nom_complet }}</td>
          </tr>
          <tr>
            <td class="lbl">Adresse&nbsp;:</td>
            <td class="val-ligne" colspan="3">{{ data?.adresse }}</td>
          </tr>
          <tr>
            <td class="lbl">Téléphone&nbsp;:</td>
            <td class="val-ligne" style="width: 32%;">{{ data?.telephone }}</td>
            <td class="lbl" style="width: 65px; text-align: right; padding-right: 6px;">E-mail&nbsp;:</td>
            <td class="val-ligne">{{ data?.email }}</td>
          </tr>
          <tr>
            <td class="lbl">Nature du client&nbsp;:</td>
            <td colspan="3" style="padding: 4px 0;">
              <span class="inline-option" style="margin-right: 30px;">
                <span class="box-check" :class="{ checked: data?.is_personne_morale }">
                  {{ data?.is_personne_morale ? '✓' : '' }}
                </span>
                Personne Morale
              </span>
              <span class="inline-option">
                <span class="box-check" :class="{ checked: data?.is_personne_physique }">
                  {{ data?.is_personne_physique ? '✓' : '' }}
                </span>
                <strong>Personne Physique</strong>
              </span>
            </td>
          </tr>
          <tr>
            <td class="lbl">Catégorie du client*&nbsp;:</td>
            <td class="val-ligne" colspan="3">{{ (!data?.is_personne_morale || data?.categorie_client?.toLowerCase().includes('particulier') || data?.categorie_client?.toLowerCase().includes('detail')) ? 'Particulier' : (data?.categorie_client || 'Particulier') }}</td>
          </tr>
          <tr>
            <td class="lbl">Pièce d’identité&nbsp;:</td>
            <td colspan="3" style="padding: 4px 0;">
              <span class="inline-option" style="margin-right: 18px;">
                <span class="box-check" :class="{ checked: data?.is_cni }">{{ data?.is_cni ? '✓' : '' }}</span> CNI
              </span>
              <span class="inline-option" style="margin-right: 18px;">
                <span class="box-check" :class="{ checked: data?.is_passeport }">{{ data?.is_passeport ? '✓' : '' }}</span> Passeport
              </span>
              <span class="inline-option" style="margin-right: 18px;">
                <span class="box-check" :class="{ checked: data?.is_rccm }">{{ data?.is_rccm ? '✓' : '' }}</span> RCCM
              </span>
              <span class="inline-option">
                <span class="box-check" :class="{ checked: data?.is_autre_piece }">{{ data?.is_autre_piece ? '✓' : '' }}</span> Autres (Préciser)&nbsp;:
              </span>
              <span style="border-bottom: 1px solid #8E5E0A; display: inline-block; min-width: 90px; padding: 0 4px; font-weight: bold; color: #3B1300;">
                {{ data?.precision_autre_piece || '—' }}
              </span>
            </td>
          </tr>
          <tr>
            <td class="lbl">Numéro pièce identité&nbsp;:</td>
            <td class="val-ligne" colspan="3">{{ data?.num_piece }}</td>
          </tr>
          <tr>
            <td class="lbl">Compte bancaire N°&nbsp;:</td>
            <td class="val-ligne" colspan="3">{{ data?.compte_bancaire }}</td>
          </tr>
        </table>

        <!-- ========================= II- TYPE D'OPÉRATION ========================= -->
        <div class="section-titre">II- TYPE D’OPÉRATION</div>

        <div class="preambule-texte">
          Demande dans les conditions fixées par la réglementation et la documentation du <strong>{{ data?.fcp_nom }}</strong>, notamment le règlement de gestion et document d’information, l’exécution de la transaction suivante&nbsp;:
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 8.5pt;">
          <tr>
            <td style="width: 38%;">
              <span class="box-check checked">✓</span>
              <strong>Souscription ponctuelle</strong>
            </td>
            <td style="width: 62%; text-align: left;">
              <span>Souscription mensuelle&nbsp;:</span>
              <span style="margin-left: 10px;"><span class="box-check">&nbsp;</span> 05</span>
              <span style="margin-left: 10px;"><span class="box-check">&nbsp;</span> 15</span>
              <span style="margin-left: 10px;"><span class="box-check">&nbsp;</span> 25</span>
            </td>
          </tr>
        </table>

        <!-- Tableau financier officiel -->
        <table class="table-financiere">
          <thead>
            <tr>
              <th style="width: 16%;">Date de<br>valeur</th>
              <th style="width: 15%;">Nombre<br>de part</th>
              <th style="width: 16%;">Valeur<br>liquidative</th>
              <th style="width: 18%;">Taux de souscription<br>appliqué</th>
              <th style="width: 17%;">Frais d'entrée TTC<br><small style="font-weight:normal; font-size: 6.5pt;">(En FCFA)</small></th>
              <th style="width: 18%;">Montant à payer<br><small style="font-weight:normal; font-size: 6.5pt;">(En FCFA)</small></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{{ data?.date_valeur }}</td>
              <td>{{ data?.nb_parts }}</td>
              <td>{{ data?.valeur_liquidative }}</td>
              <td>{{ data?.taux_souscription }}</td>
              <td>{{ data?.montant_frais }}</td>
              <td class="total">{{ data?.montant_total }}</td>
            </tr>
          </tbody>
        </table>

        <table class="table-champs" style="margin-top: 5px;">
          <tr>
            <td class="lbl" style="width: 200px;">Montant à payer (en toutes lettres)&nbsp;:</td>
            <td class="val-ligne">{{ data?.montant_en_lettres }} francs CFA</td>
          </tr>
        </table>

        <table class="table-champs" style="margin-top: 4px;">
          <tr>
            <td class="lbl" style="width: 140px;">Moyen de paiement*&nbsp;:</td>
            <td colspan="3" style="padding: 3px 0;">
              <span class="inline-option" style="margin-right: 14px;">
                <span class="box-check" :class="{ checked: data?.is_cheque }">{{ data?.is_cheque ? '✓' : '' }}</span> Chèque
              </span>
              <span class="inline-option" style="margin-right: 14px;">
                <span class="box-check" :class="{ checked: data?.is_virement }">{{ data?.is_virement ? '✓' : '' }}</span> Virement bancaire
              </span>
              <span class="inline-option" style="margin-right: 14px;">
                <span class="box-check" :class="{ checked: data?.is_mobile }">{{ data?.is_mobile ? '✓' : '' }}</span> <strong>Paiement mobile</strong>
              </span>
              <span class="inline-option" style="margin-right: 14px;">
                <span class="box-check" :class="{ checked: data?.is_apport_titres }">{{ data?.is_apport_titres ? '✓' : '' }}</span> Apport de titres
              </span>
              <span class="inline-option">
                <span class="box-check" :class="{ checked: data?.is_autre_paiement }">{{ data?.is_autre_paiement ? '✓' : '' }}</span> Autres
              </span>
            </td>
          </tr>
        </table>

        <!-- ============================ SIGNATURES ============================ -->
        <table class="table-signatures">
          <tr>
            <td class="signature-cadre">
              <div class="signature-titre">Signature &amp; cachet client&nbsp;:</div>
              <div class="signature-zone">
                <img v-if="data?.signature_client" :src="data.signature_client" alt="Signature Client" />
                <div v-else class="badge-sig-elec">
                  <strong>SIGNATURE ÉLECTRONIQUE CERTIFIÉE</strong><br>
                  {{ data?.nom_complet }}<br>
                  Réf : {{ data?.reference_transaction }} · Date : {{ data?.date_valeur }}
                </div>
              </div>
              <div class="signature-nom">{{ data?.nom_complet }}</div>
            </td>
            <td style="width: 4%;"></td>
            <td class="signature-cadre">
              <div class="signature-titre">Visa KORI Asset Management&nbsp;:</div>
              <div class="signature-zone">
                <div class="badge-kam-visa">
                  <strong style="color: #8E5E0A; font-size: 7.5pt;">KORI ASSET MANAGEMENT</strong><br>
                  <span style="color: #047857; font-weight: bold; font-size: 7.5pt;">✓ TRANSACTION VALIDÉE</span><br>
                  Douala, le {{ data?.date_valeur }}
                </div>
              </div>
              <div class="signature-nom">Société de Gestion agréée COSUMAF</div>
            </td>
          </tr>
        </table>

        <!-- Renvoi -->
        <div class="renvoi-note">
          * Liste catégorie du client et Référence bancaire / compte titres {{ data?.fcp_nom }} disponibles dans la documentation officielle.
        </div>

        <!-- Pied de page officiel -->
        <footer class="pied-page">
          <strong style="color: #E8B008;">KORI ASSET MANAGEMENT S.A.</strong> · Société de Gestion d'OPCVM au capital de 300 000 000 FCFA<br>
          Agrément COSUMAF N° COSUMAF-SGP-02/2021 · Siège social : Douala, Cameroun<br>
          Tél : +237 233 42 00 00 · E-mail : contact@koriassetmanagement.com · Site web : www.koriassetmanagement.com
        </footer>

      </article>
    </div>
  </div>
</template>

<style scoped>
/* ==========================================================================
   KORI ASSET MANAGEMENT · Bulletin officiel de souscription FCP
   Présentation Haute Définition A4 & Impression Native
   ========================================================================== */

.ecran {
  padding: 16px 12px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-height: 100vh;
  background: #ECE6DC;
  font-family: "Cabin", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
}

.barre-outils {
  width: 100%;
  max-width: 210mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  padding: 10px 16px;
  border-radius: 12px;
  transition: all 0.2s;
  cursor: pointer;
}
.btn-retour {
  background: white;
  color: #3B1300;
  border: 1px solid #cbd5e1;
}
.btn-retour:hover { background: #f8fafc; }

.btn-secondaire {
  background: white;
  color: #3B1300;
  border: 1px solid #3B1300;
}
.btn-secondaire:hover { background: #fefce8; }

.btn-imprimer {
  background: #3B1300;
  color: #FBF6EC;
  border: none;
  box-shadow: 0 4px 12px rgba(59, 19, 0, 0.2);
}
.btn-imprimer:hover { opacity: 0.9; }

.feuille-cadre {
  --s: 1;
  width: calc(210mm * var(--s));
  height: calc(297mm * var(--s));
  flex: none;
}

.page-a4 {
  width: 210mm;
  height: 297mm;
  padding: 12mm 14mm;
  background: #FFFFFF;
  color: #2A1406;
  box-shadow: 0 2px 5px rgba(59, 19, 0, 0.08), 0 12px 32px rgba(59, 19, 0, 0.12);
  transform: scale(var(--s));
  transform-origin: top left;
  font-size: 8.5pt;
  line-height: 1.35;
  box-sizing: border-box;
}

/* En-tête */
.table-header {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
}
.header-logo {
  width: 32%;
  vertical-align: middle;
  text-align: left;
}
.logo-img {
  max-height: 52px;
  max-width: 160px;
  object-fit: contain;
}
.header-title-box {
  width: 68%;
  vertical-align: middle;
  text-align: center;
}
.titre-bulletin {
  background: #3B1300;
  color: #FFFFFF;
  font-size: 13pt;
  font-weight: bold;
  letter-spacing: 0.5px;
  padding: 5px 18px;
  display: inline-block;
  border-radius: 2px;
  white-space: nowrap;
}
.fcp-nom {
  font-size: 11pt;
  font-weight: bold;
  color: #3B1300;
  margin-top: 3px;
}
.fcp-agrement {
  font-size: 8pt;
  color: #5E3208;
  margin-top: 1px;
}

/* Titres de section */
.section-titre {
  background: #FBF6EC;
  border-left: 3.5px solid #8E5E0A;
  color: #3B1300;
  font-weight: bold;
  font-size: 9.5pt;
  padding: 3px 8px;
  margin: 8px 0 5px 0;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Tableaux de champs */
.table-champs {
  width: 100%;
  border-collapse: collapse;
  font-size: 8.5pt;
  margin-bottom: 2px;
}
.table-champs td {
  padding: 3px 0;
  vertical-align: middle;
}
.table-champs .lbl {
  color: #2A1406;
  white-space: nowrap;
  width: 175px;
  padding-right: 8px;
}
.table-champs .val-ligne {
  border-bottom: 1px solid #8E5E0A;
  font-weight: bold;
  color: #3B1300;
  padding: 2px 4px;
}

.inline-option {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  vertical-align: middle;
}

/* Cases à cocher */
.box-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border: 1px solid #3B1300;
  background: #FFFFFF;
  font-size: 8pt;
  font-weight: bold;
  color: #3B1300;
  line-height: 1;
  margin-right: 4px;
  vertical-align: middle;
}
.box-check.checked {
  background: #FBF6EC;
  color: #3B1300;
}

.preambule-texte {
  font-size: 7.8pt;
  color: #5E3208;
  margin-bottom: 5px;
  line-height: 1.3;
}

/* Tableau d'opération financière */
.table-financiere {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin: 6px 0 7px 0;
  text-align: center;
  font-size: 8pt;
}
.table-financiere th, .table-financiere td {
  border: 1px solid #3B1300;
  padding: 4px 2px;
  vertical-align: middle;
}
.table-financiere th {
  background: #FBF6EC;
  color: #3B1300;
  font-weight: bold;
  font-size: 8pt;
  line-height: 1.15;
}
.table-financiere td {
  font-weight: bold;
  color: #3B1300;
  font-size: 8.5pt;
  height: 24px;
}
.table-financiere td.total {
  background: #FFF9E6;
  color: #3B1300;
}

/* Signatures */
.table-signatures {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}
.table-signatures td.signature-cadre {
  width: 48%;
  border: 1px solid #8E5E0A;
  background: #FAF7F2;
  padding: 6px 10px;
  vertical-align: top;
  border-radius: 3px;
}
.signature-titre {
  font-weight: bold;
  font-size: 8pt;
  color: #3B1300;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.signature-zone {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.signature-zone img {
  max-height: 48px;
  max-width: 170px;
  object-fit: contain;
}
.signature-nom {
  font-size: 7.5pt;
  color: #5E3208;
  text-align: center;
  margin-top: 3px;
  font-weight: bold;
}

.badge-kam-visa {
  border: 1.5px solid #8E5E0A;
  border-radius: 4px;
  padding: 3px 8px;
  color: #3B1300;
  font-size: 6.8pt;
  line-height: 1.25;
  text-align: center;
  background: #FFFFFF;
}

.badge-sig-elec {
  padding: 4px 8px;
  background: #eff6ff;
  border: 1px dashed #93c5fd;
  border-radius: 4px;
  font-size: 6.8pt;
  color: #1e3a8a;
  line-height: 1.25;
  text-align: center;
}

.renvoi-note {
  font-size: 6.5pt;
  color: #5E3208;
  margin-top: 8px;
  text-align: center;
}

/* Pied de page */
.pied-page {
  margin-top: 12px;
  padding: 5px 8px;
  background: #3B1300;
  color: #FBF6EC;
  text-align: center;
  border-top: 2px solid #E8B008;
  font-size: 6.8pt;
  line-height: 1.35;
}

@media print {
  body {
    background: #FFFFFF !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .ecran {
    background: #FFFFFF !important;
    padding: 0 !important;
    gap: 0 !important;
  }
  .barre-outils {
    display: none !important;
  }
  .feuille-cadre {
    width: 100% !important;
    height: auto !important;
    transform: none !important;
  }
  .page-a4 {
    box-shadow: none !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: auto !important;
    transform: none !important;
  }
}
</style>
