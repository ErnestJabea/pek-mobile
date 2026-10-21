<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, User, UserCheck, ChevronDown, ShieldCheck, ShieldAlert, HelpCircle, FileText, FileCheck, CheckCircle2, XCircle, AlertCircle, PenTool, WifiOff, RefreshCw, Loader2, ArrowRight, Camera, Upload, Trash2, X, Clock, Sparkles } from 'lucide-vue-next'
import api from '../api/api'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'

import LanguageSelector from '../components/LanguageSelector.vue'
import {
  getMinExpirationDate,
  getValidExpirationYears,
  getValidExpirationMonths,
  getValidExpirationDays,
  isExpirationDateValid,
  getExpirationErrorMessage,
} from '../utils/idExpiration'

const router = useRouter()
const authStore = useAuthStore()
const languageStore = useLanguageStore()

const currentStep = ref('kyc') // kyc, identity, risk, labft, signature, completed
const loading = ref(true)
const submitting = ref(false)
const stepLoading = ref(false)
const offlineMode = ref(false)
const syncError = ref(null)
const signatureError = ref(null)
const validationErrors = ref({})
const identityRequired = ref(false)
const identityVerification = ref(null)
const identityLoading = ref(false)
const onboardingSessionStatus = ref('in_progress') // 'in_progress' | 'completed' | 'validated' | 'rejected'
const clearError = (field) => {
  if (validationErrors.value[field]) {
    delete validationErrors.value[field]
  }
}

// Error modal state
const showErrorModal = ref(false)
const modalErrorTitle = ref('Attention')
const modalErrorMessage = ref('')

const triggerError = (title, message) => {
  modalErrorTitle.value = title
  modalErrorMessage.value = message
  showErrorModal.value = true
}

// Signature canvas refs
const canvasRef = ref(null)
const isDrawing = ref(false)
const hasSigned = ref(false)
const signatureConfirmed = ref(false)
const dataRetentionConfirmed = ref(false)

// Nationality selection refs & handlers
const selectedNationality = ref('Camerounaise')
const otherNationality = ref('')

const onNationalityChange = () => {
  if (selectedNationality.value !== 'Autre') {
    payload.value.nat = selectedNationality.value
  } else {
    payload.value.nat = otherNationality.value
  }
}

const onOtherNationalityInput = () => {
  payload.value.nat = otherNationality.value
}

// Secteur d'activité refs & handlers
const popularSectors = [
  'Commerce & Distribution',
  'Banque, Finance & Assurance',
  'Technologies, IT & Digital',
  'Santé, Médical & Pharmacie',
  'BTP, Immobilier & Construction',
  'Éducation, Recherche & Formation',
  'Fonction Publique & Administration',
  'Transport, Logistique & Fret',
  'Agriculture & Agro-industrie',
  'Industrie, Énergie & Mines',
  'Services, Hôtellerie & Restauration',
  'Autre'
]
const selectedSecteur = ref('')
const customSecteur = ref('')

const onSecteurChange = () => {
  clearError('secteur')
  if (selectedSecteur.value === 'Autre') {
    payload.value.secteur = customSecteur.value.trim()
  } else {
    payload.value.secteur = selectedSecteur.value
  }
}

const onCustomSecteurInput = () => {
  clearError('secteur')
  payload.value.secteur = customSecteur.value.trim()
}

// Sources de revenus & Déduction intelligente de l'origine des fonds
const availableIncomeSources = [
  { key: 'src_salaire', label: 'Salaire', defaultOrigin: 'Épargne salariale' },
  { key: 'src_pro_liberal', label: 'Prof. Libérale / Honoraires', defaultOrigin: 'Honoraires & activité professionnelle' },
  { key: 'src_foncier', label: 'Revenus Fonciers', defaultOrigin: 'Revenus locatifs & immobiliers' },
  { key: 'src_dividendes', label: 'Dividendes / Placements', defaultOrigin: 'Dividendes & placements financiers' },
  { key: 'src_heritage', label: 'Héritage / Donation', defaultOrigin: 'Succession & héritage familial' },
  { key: 'src_autre_check', label: 'Autre source', defaultOrigin: '' },
]

const isEditingOrigine = ref(false)
const userCustomizedOrigine = ref(false)

const syncOrigineFonds = () => {
  if (userCustomizedOrigine.value) return
  const origins = []
  if (payload.value.src_salaire) origins.push('Épargne salariale')
  if (payload.value.src_pro_liberal) origins.push('Honoraires & activité professionnelle')
  if (payload.value.src_foncier) origins.push('Revenus locatifs & immobiliers')
  if (payload.value.src_dividendes) origins.push('Dividendes & placements financiers')
  if (payload.value.src_heritage) origins.push('Succession & héritage familial')
  if (payload.value.src_autre_check && payload.value.src_autre?.trim()) {
    origins.push(payload.value.src_autre.trim())
  }
  
  payload.value.origine_fonds = origins.join(', ')
  if (payload.value.origine_fonds) {
    clearError('origine_fonds')
  }
}

const toggleSource = (sourceKey) => {
  payload.value[sourceKey] = !payload.value[sourceKey]
  clearError('sources_revenu')
  syncOrigineFonds()
}

const toggleEditOrigine = () => {
  isEditingOrigine.value = !isEditingOrigine.value
  if (!isEditingOrigine.value) {
    userCustomizedOrigine.value = true
  }
}

// Document KYC upload & Prise de photo en temps réel
const showCameraModal = ref(false)
const activeCameraTarget = ref('piece_recto') // 'piece_recto', 'piece_verso', 'selfie_live'
const cameraVideoRef = ref(null)
const mediaStream = ref(null)
const cameraLoading = ref(false)
const cameraError = ref(null)

// Supporting documents configuration (matching Backoffice & KYC requirements)
const dynamicSupportingDocs = computed(() => {
  const pieceType = payload.value.piece || 'CNI'
  
  let idDocs = []
  
  if (pieceType === 'Passeport') {
    idDocs = [
      {
        key: 'doc_piece_identite',
        title: languageStore.isEn() ? "1. Identity Document (Main page with photo)" : "1. Pièce d'identité (Recto / Document principal)",
        hint: languageStore.isEn() ? "Main passport page with photo, signature and MRZ line" : "Page principale du passeport avec photo, signature et bande MRZ",
        emptyLabel: languageStore.isEn() ? "No document provided." : "Aucun document fourni.",
        accept: 'image/*,.pdf',
        allowCamera: true,
        cameraTarget: 'piece_recto',
        required: true,
      },
      {
        key: 'doc_piece_verso',
        title: languageStore.isEn() ? "2. Identity Document (Reverse - not required)" : "2. Pièce d'identité (Verso - non requis)",
        hint: languageStore.isEn() ? "Passports do not have a reverse side" : "Le passeport n'a pas de face arrière",
        emptyLabel: languageStore.isEn() ? "Not required for a passport." : "Non requis pour un passeport.",
        accept: 'image/*,.pdf',
        allowCamera: false,
        cameraTarget: 'piece_verso',
        required: false,
        disabled: true,
      }
    ]
  } else if (pieceType === 'Carte Résident') {
    idDocs = [
      {
        key: 'doc_piece_identite',
        title: languageStore.isEn() ? "1. Residence Permit (Front side)" : "1. Pièce d'identité (Recto / Document principal)",
        hint: languageStore.isEn() ? "Front side of the residence card/permit with photo" : "Face avant du titre de séjour avec photo",
        emptyLabel: languageStore.isEn() ? "No document provided." : "Aucun document fourni.",
        accept: 'image/*,.pdf',
        allowCamera: true,
        cameraTarget: 'piece_recto',
        required: true,
      },
      {
        key: 'doc_piece_verso',
        title: languageStore.isEn() ? "2. Residence Permit (Back side - optional)" : "2. Pièce d'identité (Verso - optionnel)",
        hint: languageStore.isEn() ? "Back side of the residence card/permit" : "Face arrière du titre de séjour",
        emptyLabel: languageStore.isEn() ? "No reverse side provided." : "Aucun verso fourni.",
        accept: 'image/*,.pdf',
        allowCamera: true,
        cameraTarget: 'piece_verso',
        required: false,
      }
    ]
  } else if (pieceType === 'Permis de Conduire') {
    idDocs = [
      {
        key: 'doc_piece_identite',
        title: languageStore.isEn() ? "1. Driver License (Front side)" : "1. Pièce d'identité (Recto / Document principal)",
        hint: languageStore.isEn() ? "Front side of driver license with photo" : "Face avant du permis de conduire avec photo",
        emptyLabel: languageStore.isEn() ? "No document provided." : "Aucun document fourni.",
        accept: 'image/*,.pdf',
        allowCamera: true,
        cameraTarget: 'piece_recto',
        required: true,
      },
      {
        key: 'doc_piece_verso',
        title: languageStore.isEn() ? "2. Driver License (Back side - optional)" : "2. Pièce d'identité (Verso - optionnel)",
        hint: languageStore.isEn() ? "Back side of driver license with categories" : "Face arrière du permis de conduire avec catégories",
        emptyLabel: languageStore.isEn() ? "No reverse side provided." : "Aucun verso fourni.",
        accept: 'image/*,.pdf',
        allowCamera: true,
        cameraTarget: 'piece_verso',
        required: false,
      }
    ]
  } else {
    // CNI par défaut
    idDocs = [
      {
        key: 'doc_piece_identite',
        title: languageStore.isEn() ? "1. Identity Document (Front / Main document)" : "1. Pièce d'identité (Recto / Document principal)",
        hint: languageStore.isEn() ? "Front side of National ID Card with photo" : "Face avant de la Carte Nationale d'Identité avec photo",
        emptyLabel: languageStore.isEn() ? "No document provided." : "Aucun document fourni.",
        accept: 'image/*,.pdf',
        allowCamera: true,
        cameraTarget: 'piece_recto',
        required: true,
      },
      {
        key: 'doc_piece_verso',
        title: languageStore.isEn() ? "2. Identity Document (Back side - optional)" : "2. Pièce d'identité (Verso - optionnel)",
        hint: languageStore.isEn() ? "Back side of National ID Card with MRZ line" : "Face arrière de la Carte Nationale d'Identité avec bande MRZ",
        emptyLabel: languageStore.isEn() ? "No reverse side provided." : "Aucun verso fourni.",
        accept: 'image/*,.pdf',
        allowCamera: true,
        cameraTarget: 'piece_verso',
        required: false,
      }
    ]
  }

  const commonDocs = [
    {
      key: 'doc_photo',
      title: languageStore.isEn() ? "3. Recent Identity Photo / Selfie" : "3. Photo d'identité récente",
      hint: languageStore.isEn() ? "Clear frontal photo or instant camera selfie" : "Photo nette de face ou prise directe par caméra",
      emptyLabel: languageStore.isEn() ? "No photo provided." : "Aucune photo fournie.",
      accept: 'image/*',
      allowCamera: true,
      cameraTarget: 'selfie_live',
      required: false,
    },
    {
      key: 'doc_justificatif_domicile',
      title: languageStore.isEn() ? "4. Proof of Address (< 3 months)" : "4. Justificatif de domicile (< 3 mois)",
      hint: languageStore.isEn() ? "Utility bill (Eneo/water), certificate of residence or bank statement" : "Facture Eneo/Camtap, attestation de résidence ou relevé bancaire",
      emptyLabel: languageStore.isEn() ? "No proof provided." : "Aucun justificatif fourni.",
      accept: 'image/*,.pdf',
      allowCamera: false,
      required: false,
    },
    {
      key: 'doc_origine_fonds',
      title: languageStore.isEn() ? "5. Proof of Origin of Funds" : "5. Justificatif d'origine des fonds",
      hint: languageStore.isEn() ? "Payslip, employer certificate, commercial register or employment contract" : "Fiche de paie, attestation d'employeur ou contrat de travail",
      emptyLabel: languageStore.isEn() ? "No document provided." : "Aucun document fourni.",
      accept: 'image/*,.pdf',
      allowCamera: false,
      required: false,
    }
  ]

  return [...idDocs, ...commonDocs]
})

const onPieceTypeChange = () => {
  clearError('piece')
  if (payload.value.piece === 'Passeport') {
    payload.value.piece_verso = ''
    docFileNames.value.doc_piece_verso = ''
  }
}

const docFileNames = ref({
  doc_piece_identite: '',
  doc_piece_verso: '',
  doc_justificatif_domicile: '',
  doc_photo: '',
  doc_origine_fonds: '',
})

const dragActive = ref({
  doc_piece_identite: false,
  doc_piece_verso: false,
  doc_justificatif_domicile: false,
  doc_photo: false,
  doc_origine_fonds: false,
})

const fileInputRefs = ref({})
const registerFileInput = (el, field) => {
  if (el) fileInputRefs.value[field] = el
}
const triggerBrowse = (field) => {
  if (fileInputRefs.value[field]) {
    fileInputRefs.value[field].click()
  }
}

const syncKYCDocuments = (targetField, dataUrl) => {
  if (targetField === 'doc_piece_identite' || targetField === 'piece_recto') {
    payload.value.piece_recto = dataUrl
    payload.value.doc_piece_identite = dataUrl
    clearError('piece_recto')
    clearError('doc_piece_identite')
    docBlobUrls.value.piece_recto = dataUrl
    docBlobUrls.value.doc_piece_identite = dataUrl
  } else if (targetField === 'doc_piece_verso' || targetField === 'piece_verso') {
    payload.value.piece_verso = dataUrl
    payload.value.doc_piece_verso = dataUrl
    clearError('piece_verso')
    clearError('doc_piece_verso')
    docBlobUrls.value.piece_verso = dataUrl
    docBlobUrls.value.doc_piece_verso = dataUrl
  } else if (targetField === 'doc_photo' || targetField === 'selfie_live') {
    payload.value.selfie_live = dataUrl
    payload.value.doc_photo = dataUrl
    clearError('selfie_live')
    clearError('doc_photo')
    docBlobUrls.value.selfie_live = dataUrl
    docBlobUrls.value.doc_photo = dataUrl
  } else {
    docBlobUrls.value[targetField] = dataUrl
  }

  kycVerificationCompleted.value = false
}

const processFileObject = (file, targetField) => {
  if (!file) return

  if (file.size > 8 * 1024 * 1024) {
    triggerError('Fichier trop volumineux', 'La taille maximale autorisée est de 8 Mo.')
    return
  }

  docFileNames.value[targetField] = file.name

  const reader = new FileReader()
  reader.onload = (event) => {
    const result = event.target.result
    if (file.type === 'application/pdf') {
      payload.value[targetField] = result
      clearError(targetField)
      syncKYCDocuments(targetField, result)
      return
    }

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const MAX_WIDTH = 1200
      const MAX_HEIGHT = 1200
      let width = img.width
      let height = img.height

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width))
          width = MAX_WIDTH
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round(width * (MAX_HEIGHT / height))
          height = MAX_HEIGHT
        }
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      payload.value[targetField] = dataUrl
      clearError(targetField)
      syncKYCDocuments(targetField, dataUrl)
    }
    img.src = result
  }
  reader.readAsDataURL(file)
}

const handleFileDrop = (e, field) => {
  dragActive.value[field] = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    processFileObject(file, field)
  }
}

const handleFileInputChange = (e, field) => {
  const file = e.target.files?.[0]
  if (file) {
    processFileObject(file, field)
  }
  e.target.value = ''
}

const handleFileUpload = (e, targetField) => {
  const file = e.target.files?.[0]
  if (file) {
    processFileObject(file, targetField)
  }
  e.target.value = ''
}

const removeSupportingDoc = (field) => {
  payload.value[field] = ''
  docFileNames.value[field] = ''
  clearError(field)
  if (field === 'doc_piece_identite') {
    removeDocument('piece_recto')
  } else if (field === 'doc_piece_verso') {
    removeDocument('piece_verso')
  } else if (field === 'doc_photo') {
    removeDocument('selfie_live')
  }
}

const docBlobUrls = ref({})
const loadingDocBlobs = ref({})

const loadDocumentBlob = async (key) => {
  if (docBlobUrls.value[key]) return docBlobUrls.value[key]
  if (loadingDocBlobs.value[key]) return null
  loadingDocBlobs.value[key] = true
  try {
    const res = await api.get(`/onboarding/document/${key}`, { responseType: 'blob' })
    if (res.data && res.data.type !== 'application/pdf') {
      const url = URL.createObjectURL(res.data)
      docBlobUrls.value[key] = url
      return url
    }
  } catch (e) {
    // Non bloquant si non existant
  } finally {
    loadingDocBlobs.value[key] = false
  }
  return null
}

const getDocPreviewUrl = (key) => {
  const val = payload.value[key] || ''
  if (!val) return ''
  if (val.startsWith('data:image') || val.startsWith('blob:')) return val
  if (docBlobUrls.value[key]) return docBlobUrls.value[key]
  if (val.startsWith('http://') || val.startsWith('https://')) return val
  if (val.startsWith('secure_onboardings/') || val.includes('/')) {
    loadDocumentBlob(key)
  }
  return ''
}

const openCamera = async (target) => {
  activeCameraTarget.value = target
  cameraError.value = null
  showCameraModal.value = true
  cameraLoading.value = true

  const isSelfie = target === 'selfie_live'
  const constraints = {
    video: {
      facingMode: isSelfie ? 'user' : 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  }

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      mediaStream.value = stream
      setTimeout(async () => {
        if (cameraVideoRef.value) {
          cameraVideoRef.value.srcObject = stream
          try {
            await cameraVideoRef.value.play()
          } catch (playErr) {
            console.warn('Auto play failed', playErr)
          }
        }
      }, 100)
    } else {
      throw new Error('Caméra non disponible sur cet appareil.')
    }
  } catch (err) {
    console.error('Camera access error:', err)
    cameraError.value = "Impossible d'activer la caméra. Vérifiez les autorisations du navigateur ou importez un fichier."
  } finally {
    cameraLoading.value = false
  }
}

const closeCamera = () => {
  if (mediaStream.value) {
    mediaStream.value.getTracks().forEach(track => track.stop())
    mediaStream.value = null
  }
  showCameraModal.value = false
}

const capturePhoto = () => {
  const video = cameraVideoRef.value
  if (!video) return
  
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 480
  const ctx = canvas.getContext('2d')
  
  if (activeCameraTarget.value === 'selfie_live') {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }
  
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
  payload.value[activeCameraTarget.value] = dataUrl
  clearError(activeCameraTarget.value)
  
  if (activeCameraTarget.value === 'piece_recto') {
    docFileNames.value.doc_piece_identite = 'Photo Recto (Caméra directe)'
  } else if (activeCameraTarget.value === 'piece_verso') {
    docFileNames.value.doc_piece_verso = 'Photo Verso (Caméra directe)'
  } else if (activeCameraTarget.value === 'selfie_live') {
    docFileNames.value.doc_photo = 'Selfie Live (Caméra directe)'
  }
  syncKYCDocuments(activeCameraTarget.value, dataUrl)
  
  closeCamera()
}

// KYC Biometric & OCR verification states & Modal
const verifyingKYC = ref(false)
const verificationStatusText = ref('')
const verificationFaceResult = ref(null)
const verificationOCRResult = ref(null)
const kycVerificationAttempted = ref(false)
const kycVerificationCompleted = ref(false)
const showConcordanceModal = ref(false)
const currentActiveDocKey = ref('piece_recto')
const currentActiveDocTitle = ref("Pièce d'identité (Recto)")
const verificationProgressPercent = ref(0)
const verificationFinished = ref(false)
const concordanceSteps = ref([])

const initConcordanceSteps = () => {
  const steps = [
    {
      key: 'piece_recto',
      title: languageStore.isEn() ? "ID Document (Front)" : "Pièce d'identité (Recto)",
      subtitle: languageStore.isEn() ? "Civil identity fields & ID number" : "Mentions d'état civil et N° de pièce",
      status: 'pending',
      statusLabel: languageStore.isEn() ? "Waiting" : "En attente"
    }
  ]

  const verso = payload.value.piece_verso || payload.value.doc_piece_verso
  if (verso) {
    steps.push({
      key: 'piece_verso',
      title: languageStore.isEn() ? "ID Document (Reverse & MRZ)" : "Pièce d'identité (Verso & MRZ)",
      subtitle: languageStore.isEn() ? "Official ICAO 9303 MRZ strip check" : "Bande MRZ officielle ICAO 9303",
      status: 'pending',
      statusLabel: languageStore.isEn() ? "Waiting" : "En attente"
    })
  }

  const selfie = payload.value.selfie_live || payload.value.doc_photo
  if (selfie) {
    steps.push({
      key: 'doc_photo',
      title: languageStore.isEn() ? "Recent Photo / Face Match" : "Photo récente / Comparaison faciale",
      subtitle: languageStore.isEn() ? "Facial biometric matching with ID photo" : "Correspondance faciale avec la pièce",
      status: 'pending',
      statusLabel: languageStore.isEn() ? "Waiting" : "En attente"
    })
  }

  const domicile = payload.value.doc_justificatif_domicile
  if (domicile) {
    steps.push({
      key: 'doc_justificatif_domicile',
      title: languageStore.isEn() ? "Proof of Address" : "Justificatif de domicile",
      subtitle: languageStore.isEn() ? "Residence verification (< 3 months)" : "Conformité du lieu de résidence (< 3 mois)",
      status: 'pending',
      statusLabel: languageStore.isEn() ? "Waiting" : "En attente"
    })
  }

  const fonds = payload.value.doc_origine_fonds
  if (fonds) {
    steps.push({
      key: 'doc_origine_fonds',
      title: languageStore.isEn() ? "Origin of Funds" : "Origine des fonds",
      subtitle: languageStore.isEn() ? "Financial proof verification" : "Justificatif de provenance des fonds",
      status: 'pending',
      statusLabel: languageStore.isEn() ? "Waiting" : "En attente"
    })
  }

  concordanceSteps.value = steps
}

const openConcordanceModalAndStart = async () => {
  initConcordanceSteps()
  showConcordanceModal.value = true
  verificationFinished.value = false
  verificationProgressPercent.value = 5
  await executeKYCVerification(false)
}

const closeConcordanceModal = () => {
  showConcordanceModal.value = false
}

const continueToNextStepAfterModal = async () => {
  showConcordanceModal.value = false
  kycVerificationCompleted.value = true
  stepLoading.value = true
  try {
    const targetStep = identityRequired.value ? 'identity' : 'risk'
    if (!await syncWithServer(targetStep)) return
    currentStep.value = targetStep
    if (targetStep === 'identity') await refreshIdentityStatus()
  } finally {
    stepLoading.value = false
  }
}

const removeDocument = (targetField) => {
  payload.value[targetField] = ''
  delete docBlobUrls.value[targetField]
  if (targetField === 'piece_recto') delete docBlobUrls.value.doc_piece_identite
  if (targetField === 'doc_piece_identite') delete docBlobUrls.value.piece_recto
  if (targetField === 'piece_verso') delete docBlobUrls.value.doc_piece_verso
  if (targetField === 'doc_piece_verso') delete docBlobUrls.value.piece_verso
  if (targetField === 'selfie_live') delete docBlobUrls.value.doc_photo
  if (targetField === 'doc_photo') delete docBlobUrls.value.selfie_live
  kycVerificationCompleted.value = false
  if (targetField === 'piece_recto' || targetField === 'selfie_live' || targetField === 'doc_piece_identite' || targetField === 'doc_photo') {
    verificationFaceResult.value = null
    verificationOCRResult.value = null
    kycVerificationAttempted.value = false
    payload.value.face_match_score = null
    payload.value.face_verified = false
    payload.value.ocr_score = null
    payload.value.ocr_nom_match = null
    payload.value.ocr_prenom_match = null
    payload.value.ocr_dob_match = null
    payload.value.ocr_num_piece_match = null
    payload.value.ocr_expiration_match = null
    payload.value.ocr_doc_type_match = null
    payload.value.ocr_domicile_match = null
    payload.value.ocr_fonds_match = null
    payload.value.ocr_mrz_detected = false
    payload.value.ocr_snippet = ''
    payload.value.verification_timestamp = ''
    payload.value.identity_audit_status = ''
  }
}

const executeKYCVerification = async (silent = false) => {
  const resolveDocSrc = async (key, fallbackKey = null) => {
    let val = payload.value[key] || (fallbackKey ? payload.value[fallbackKey] : null)
    if (!val) return null
    if (val.startsWith('data:') || val.startsWith('blob:')) return val
    if (docBlobUrls.value[key]) return docBlobUrls.value[key]
    if (fallbackKey && docBlobUrls.value[fallbackKey]) return docBlobUrls.value[fallbackKey]
    try {
      const loaded = await loadDocumentBlob(key)
      if (loaded) return loaded
      if (fallbackKey) return await loadDocumentBlob(fallbackKey)
    } catch (e) {
      // non-bloquant
    }
    return val
  }

  const recto = await resolveDocSrc('piece_recto', 'doc_piece_identite')
  const selfie = await resolveDocSrc('selfie_live', 'doc_photo')
  if (!recto) {
    if (!silent) {
      triggerError("Pièce requise", "Veuillez fournir votre pièce d'identité.")
    }
    return false
  }

  if (concordanceSteps.value.length === 0) {
    initConcordanceSteps()
  }

  verifyingKYC.value = true
  kycVerificationAttempted.value = true
  verificationFinished.value = false
  verificationProgressPercent.value = 8
  currentActiveDocKey.value = 'piece_recto'
  currentActiveDocTitle.value = languageStore.isEn() ? "ID Document (Front)" : "Pièce d'identité (Recto)"
  verificationStatusText.value = "Initialisation de l'analyse des pièces fournies..."

  const rectoStep = concordanceSteps.value.find(s => s.key === 'piece_recto')
  if (rectoStep) {
    rectoStep.status = 'running'
    rectoStep.statusLabel = languageStore.isEn() ? 'Analyzing...' : 'Analyse en cours...'
  }

  try {
    const { compareFaces, verifyIDDocumentOCR } = await import('../services/kycVerification')
    
    const verso = await resolveDocSrc('piece_verso', 'doc_piece_verso')
    const domicile = await resolveDocSrc('doc_justificatif_domicile')
    const fonds = await resolveDocSrc('doc_origine_fonds')

    let faceRes = { success: false, score: null, isFallback: true, idOrientation: 0 }

    // 1. OCR text extraction & analyse approfondie de concordance des pièces
    const ocrRes = await verifyIDDocumentOCR(
      recto,
      verso,
      {
        nom: payload.value.nom,
        prenom: payload.value.prenom,
        dob: payload.value.dob,
        num_piece: payload.value.num_piece,
        expiration_piece: payload.value.expiration_piece,
        piece: payload.value.piece,
        adresse: payload.value.adresse,
        employeur: payload.value.employeur
      },
      (statusMsg, meta = {}) => {
        verificationStatusText.value = statusMsg
        if (meta.docKey) {
          currentActiveDocKey.value = meta.docKey
          if (meta.docTitle) currentActiveDocTitle.value = meta.docTitle
          const currentStepItem = concordanceSteps.value.find(s => s.key === meta.docKey)
          if (currentStepItem && currentStepItem.status === 'pending') {
            currentStepItem.status = 'running'
            currentStepItem.statusLabel = languageStore.isEn() ? 'Analyzing...' : 'Analyse en cours...'
          }
        }
        const total = concordanceSteps.value.length || 1
        const idx = Math.max(0, concordanceSteps.value.findIndex(s => s.key === currentActiveDocKey.value))
        const base = (idx / total) * 100
        const stepProgress = ((meta.progress || 20) / 100) * (100 / total)
        verificationProgressPercent.value = Math.min(90, Math.round(base + stepProgress))
      },
      faceRes.idOrientation || 0,
      domicile,
      fonds
    )

    // Mise à jour de l'état de la pièce Recto
    if (rectoStep) {
      const ok = ocrRes.nomMatch && ocrRes.numPieceMatch
      rectoStep.status = ok ? 'success' : 'error'
      rectoStep.statusLabel = ok 
        ? (languageStore.isEn() ? 'Confirmed' : 'Concordant')
        : (languageStore.isEn() ? 'Mismatch' : 'Non concordant')
    }

    // Mise à jour de l'état de la pièce Verso
    const versoStep = concordanceSteps.value.find(s => s.key === 'piece_verso')
    if (versoStep) {
      const ok = ocrRes.mrzDetected || ocrRes.expirationMatch
      versoStep.status = ok ? 'success' : 'error'
      versoStep.statusLabel = ocrRes.mrzDetected
        ? 'MRZ ICAO 9303'
        : (ok ? (languageStore.isEn() ? 'Confirmed' : 'Concordant') : (languageStore.isEn() ? 'To review' : 'À vérifier'))
    }

    // Mise à jour de l'état du justificatif de domicile
    const domStep = concordanceSteps.value.find(s => s.key === 'doc_justificatif_domicile')
    if (domStep) {
      const ok = Boolean(ocrRes.domicileMatch)
      domStep.status = ok ? 'success' : 'error'
      domStep.statusLabel = ok 
        ? (languageStore.isEn() ? 'Confirmed' : 'Adresse confirmée')
        : (languageStore.isEn() ? 'To review' : 'À vérifier')
    }

    // Mise à jour de l'état de l'origine des fonds
    const fondsStep = concordanceSteps.value.find(s => s.key === 'doc_origine_fonds')
    if (fondsStep) {
      const ok = Boolean(ocrRes.fondsMatch)
      fondsStep.status = ok ? 'success' : 'error'
      fondsStep.statusLabel = ok 
        ? (languageStore.isEn() ? 'Validated' : 'Justificatif validé')
        : (languageStore.isEn() ? 'To review' : 'À vérifier')
    }

    // 2. Comparaison faciale si un selfie ou photo est fourni
    if (selfie) {
      currentActiveDocKey.value = 'doc_photo'
      currentActiveDocTitle.value = languageStore.isEn() ? "Recent Photo / Face Match" : "Photo récente / Comparaison faciale"
      verificationStatusText.value = "Comparaison faciale de la pièce avec votre photo..."
      const photoStep = concordanceSteps.value.find(s => s.key === 'doc_photo')
      if (photoStep) {
        photoStep.status = 'running'
        photoStep.statusLabel = languageStore.isEn() ? 'Comparing...' : 'Comparaison faciale...'
      }
      verificationProgressPercent.value = 92
      faceRes = await compareFaces(recto, selfie)
      verificationFaceResult.value = faceRes
      payload.value.face_match_score = faceRes.score
      payload.value.face_verified = faceRes.success
      if (photoStep) {
        photoStep.status = faceRes.success ? 'success' : 'error'
        photoStep.statusLabel = faceRes.success
          ? (languageStore.isEn() ? 'Face Match' : 'Visage certifié')
          : (languageStore.isEn() ? 'Unconfirmed' : 'Non certifié')
      }
    }

    verificationOCRResult.value = ocrRes
    payload.value.ocr_score = ocrRes.ocrConfidence || 0
    payload.value.ocr_nom_match = ocrRes.nomMatch
    payload.value.ocr_prenom_match = ocrRes.prenomMatch
    payload.value.ocr_dob_match = ocrRes.dobMatch
    payload.value.ocr_num_piece_match = ocrRes.numPieceMatch
    payload.value.ocr_expiration_match = ocrRes.expirationMatch
    payload.value.ocr_doc_type_match = ocrRes.docTypeMatch
    payload.value.ocr_domicile_match = ocrRes.domicileMatch
    payload.value.ocr_fonds_match = ocrRes.fondsMatch
    payload.value.ocr_mrz_detected = ocrRes.mrzDetected
    payload.value.ocr_snippet = ocrRes.rawSnippet || ''
    payload.value.verification_timestamp = new Date().toISOString()
    payload.value.identity_audit_status = (faceRes.success && ocrRes.success) ? 'auto_verified' : 'manual_review_required'

    verificationProgressPercent.value = 100
    verificationFinished.value = true
    kycVerificationCompleted.value = true
    verificationStatusText.value = languageStore.isEn() 
      ? "Verification analysis completed."
      : "Analyse de concordance terminée."

    return faceRes.success || faceRes.isFallback === true || ocrRes.success
  } catch (err) {
    console.error("KYC Verification failure:", err)
    if (!silent) {
      triggerError("Erreur d'analyse", "Une erreur est survenue lors de l'analyse. Une vérification manuelle sera effectuée.")
    }
    verificationFinished.value = true
    verificationStatusText.value = "Analyse interrompue. Une revue manuelle sera opérée par la conformité."
    return false
  } finally {
    verifyingKYC.value = false
  }
}

const personnePhysiqueCategories = [
  'Salarié secteur privé',
  'Salarié secteur public',
  'Profession libérale',
  'Commerçant / entrepreneur',
  'Agent des organismes internationaux',
  'Chômeur'
]

const availableClientCategories = computed(() => {
  const list = [...personnePhysiqueCategories]
  const currentCat = payload.value.categorie_client
  if (
    currentCat && 
    currentCat !== 'Personne Morale' && 
    currentCat !== 'Personne Physique' && 
    !list.includes(currentCat)
  ) {
    list.push(currentCat)
  }
  return list
})

const onNatureClientChange = () => {
  payload.value.nature_client = 'personne_physique'
  if (!payload.value.categorie_client || (!personnePhysiqueCategories.includes(payload.value.categorie_client) && payload.value.categorie_client !== 'Particulier')) {
    payload.value.categorie_client = 'Salarié secteur privé'
  }
  if (!payload.value.situation_mat) payload.value.situation_mat = 'Célibataire'
  if (!payload.value.civ) payload.value.civ = 'M.'
  clearError('nature_client')
  clearError('categorie_client')
  if (payload.value.dob) {
    const parts = payload.value.dob.split('-')
    if (parts.length === 3) {
      dobYear.value = parts[0]
      dobMonth.value = String(parseInt(parts[1]))
      dobDay.value = String(parseInt(parts[2]))
    }
  }
}

const formatCategory = (cat) => {
  if (!cat) return ''
  if (!languageStore.isEn()) {
    switch (cat) {
      case 'Salarié secteur privé': return 'Salarié secteur privé'
      case 'Salarié secteur public': return 'Salarié secteur public'
      case 'Profession libérale': return 'Profession libérale'
      case 'Commerçant / entrepreneur': return 'Commerçant / entrepreneur'
      case 'Agent des organismes internationaux': return 'Agent des organismes internationaux'
      case 'Chômeur': return 'Chômeur / Sans emploi'
      case 'Particulier': return 'Particulier'
      default: return cat
    }
  }
  switch (cat) {
    case 'Salarié secteur privé': return 'Private Sector Employee'
    case 'Salarié secteur public': return 'Public Sector Employee'
    case 'Agent des organismes internationaux': return 'International Organization Official'
    case 'Profession libérale': return 'Self-Employed / Liberal Professional'
    case 'Commerçant / entrepreneur': return 'Trader / Entrepreneur'
    case 'Chômeur': return 'Unemployed'
    case 'Particulier': return 'Individual'
    default: return cat
  }
}

const formatSector = (sec) => {
  if (!sec) return ''
  if (!languageStore.isEn()) return sec
  switch (sec) {
    case 'Commerce & Distribution': return 'Commerce & Distribution'
    case 'Banque, Finance & Assurance': return 'Banking, Finance & Insurance'
    case 'Technologies, IT & Digital': return 'Technology, IT & Digital'
    case 'Santé, Médical & Pharmacie': return 'Healthcare & Pharmaceuticals'
    case 'BTP, Immobilier & Construction': return 'Construction & Real Estate'
    case 'Éducation, Recherche & Formation': return 'Education & Research'
    case 'Fonction Publique & Administration': return 'Public Service & Administration'
    case 'Transport, Logistique & Fret': return 'Transport, Logistics & Freight'
    case 'Agriculture & Agro-industrie': return 'Agriculture & Agribusiness'
    case 'Industrie, Énergie & Mines': return 'Industry, Energy & Mining'
    case 'Services, Hôtellerie & Restauration': return 'Services & Hospitality'
    case 'Autre': return 'Other'
    default: return sec
  }
}

const formatIncomeSourceLabel = (key) => {
  if (!languageStore.isEn()) {
    const found = availableIncomeSources.find(s => s.key === key)
    return found ? found.label : ''
  }
  switch (key) {
    case 'src_salaire': return 'Salary'
    case 'src_pro_liberal': return 'Liberal Prof. / Fees'
    case 'src_foncier': return 'Rental / Property Income'
    case 'src_dividendes': return 'Dividends / Investments'
    case 'src_heritage': return 'Inheritance / Donation'
    case 'src_autre_check': return 'Other source'
    default: return ''
  }
}

// Support des compléments d'informations pour les dossiers déjà finalisés / validés
const serverNeedsCategory = ref(false)
const updatingMissingCategory = ref(false)
const missingCategoryValue = ref('Salarié secteur privé')
const missingCategorySuccess = ref(false)

const submitMissingCategory = async () => {
  if (!missingCategoryValue.value) return
  updatingMissingCategory.value = true
  try {
    await api.post('/onboarding/missing-info', {
      categorie_client: missingCategoryValue.value
    })
    authStore.setUser({
      ...authStore.user,
      categorie_client: missingCategoryValue.value,
      needs_category: false
    })
    payload.value.categorie_client = missingCategoryValue.value
    serverNeedsCategory.value = false
    missingCategorySuccess.value = true
  } catch (err) {
    console.error('Erreur lors de l\'enregistrement de la categorie', err)
  } finally {
    updatingMissingCategory.value = false
  }
}

// Payload for all onboarding steps
const payload = ref({
  // KYC Step
  civ: 'M.',
  nature_client: 'personne_physique',
  categorie_client: 'Salarié secteur privé',
  nom: '',
  prenom: '',
  nat: 'Camerounaise',
  dob: '',
  lieu_naiss: '',
  adresse: '',
  ville: '',
  tel: '',
  email: '',
  piece: 'CNI',
  num_piece: '',
  profession: '',
  employeur: '',
  piece_recto: '',
  piece_verso: '',
  selfie_live: '',
  doc_piece_identite: '',
  doc_piece_verso: '',
  doc_justificatif_domicile: '',
  doc_photo: '',
  doc_origine_fonds: '',
  face_match_score: null,
  face_verified: false,
  ocr_score: null,
  ocr_nom_match: null,
  ocr_prenom_match: null,
  ocr_dob_match: null,
  ocr_num_piece_match: null,
  ocr_expiration_match: null,
  ocr_doc_type_match: null,
  ocr_domicile_match: null,
  ocr_fonds_match: null,
  ocr_mrz_detected: false,
  ocr_snippet: '',
  verification_timestamp: '',
  identity_audit_status: '',

  // Risk Profiler Step
  tranche_revenus: '',
  epargne_possible: '',
  niveau_risque: '',
  conscience_risque: '',
  objectif_invest: '',
  horizon_terme: '',
  niveau_perf: '',
  connaissance_marche: '',
  invest_anterieurs: '',

  // LAB-FT Step
  situation_mat: 'Célibataire',
  pays_residence: 'Cameroun',
  expiration_piece: '',
  agent_kam: '',
  secteur: '',
  revenus_annuels: 'moins_5m',
  src_salaire: false,
  src_pro_liberal: false,
  src_foncier: false,
  src_dividendes: false,
  src_heritage: false,
  src_autre_check: false,
  src_autre: '',
  origine_fonds: '',
  banque: '',
  num_compte: '',
  pays_compte: 'Cameroun',
  pays_risque: '',
  secteur_sensible: '',
  ppe: '',
  ppe_detail: '',
  condamnation: '',
  ack_lecture: false,
  ack_donnees: false
})

// Check offline status
const updateOnlineStatus = () => {
  offlineMode.value = !window.navigator.onLine
}

// Initialize session state
const initSession = async () => {
  // No KYC data is persisted in browser storage. The encrypted server draft is authoritative.
  if (authStore.user) {
    if (!payload.value.nom) payload.value.nom = authStore.user.last_name || ''
    if (!payload.value.prenom) payload.value.prenom = authStore.user.first_name || ''
    if (!payload.value.email) payload.value.email = authStore.user.email || ''
    if (!payload.value.tel) payload.value.tel = authStore.user.phone || ''
    if (authStore.user.country) payload.value.pays_residence = authStore.user.country
    if (authStore.user.city) {
      payload.value.ville = authStore.user.city
      if (!payload.value.adresse) payload.value.adresse = authStore.user.city
    }
    payload.value.nature_client = 'personne_physique'
    if (authStore.user.categorie_client && (personnePhysiqueCategories.includes(authStore.user.categorie_client) || authStore.user.categorie_client === 'Particulier')) {
      payload.value.categorie_client = authStore.user.categorie_client
    } else {
      payload.value.categorie_client = 'Salarié secteur privé'
    }
  }

  const mapRevenus = {
    'moins_500k': 'moins_5m',
    '500k_1_5m': '5m_15m',
    'plus_1_5m': 'plus_15m'
  }
  if (payload.value.tranche_revenus && (!payload.value.revenus_annuels || payload.value.revenus_annuels === 'moins_5m')) {
    payload.value.revenus_annuels = mapRevenus[payload.value.tranche_revenus] || 'moins_5m'
  }

  // 2. Load from server if online
  if (window.navigator.onLine) {
    try {
      const response = await api.get('/onboarding/status')
      const serverSession = response.data.session
      identityRequired.value = response.data.identity_verification_required === true
      identityVerification.value = response.data.identity_verification || null
      
      if (serverSession) {
        onboardingSessionStatus.value = serverSession.status || 'in_progress'
        if (['completed', 'validated'].includes(serverSession.status)) {
          currentStep.value = 'completed'
        } else {
          currentStep.value = serverSession.current_step || 'kyc'
          if (serverSession.payload && Object.keys(serverSession.payload).length > 0) {
            payload.value = { ...payload.value, ...serverSession.payload }
            if (payload.value.piece_recto && !payload.value.doc_piece_identite) {
              payload.value.doc_piece_identite = payload.value.piece_recto
            }
            if (payload.value.piece_verso && !payload.value.doc_piece_verso) {
              payload.value.doc_piece_verso = payload.value.piece_verso
            }
            if (payload.value.selfie_live && !payload.value.doc_photo) {
              payload.value.doc_photo = payload.value.selfie_live
            }
            if (serverSession.doc_piece_identite && !payload.value.doc_piece_identite) {
              payload.value.doc_piece_identite = serverSession.doc_piece_identite
            }
            if (serverSession.doc_justificatif_domicile && !payload.value.doc_justificatif_domicile) {
              payload.value.doc_justificatif_domicile = serverSession.doc_justificatif_domicile
            }
            if (serverSession.doc_photo && !payload.value.doc_photo) {
              payload.value.doc_photo = serverSession.doc_photo
            }
            if (serverSession.doc_origine_fonds && !payload.value.doc_origine_fonds) {
              payload.value.doc_origine_fonds = serverSession.doc_origine_fonds
            }
            if (payload.value.doc_piece_identite) docFileNames.value.doc_piece_identite = 'Pièce d’identité (enregistrée)'
            if (payload.value.doc_piece_verso) docFileNames.value.doc_piece_verso = 'Verso de la pièce (enregistré)'
            if (payload.value.doc_justificatif_domicile) docFileNames.value.doc_justificatif_domicile = 'Justificatif de domicile (enregistré)'
            if (payload.value.doc_photo) docFileNames.value.doc_photo = 'Photo récente (enregistrée)'
            if (payload.value.doc_origine_fonds) docFileNames.value.doc_origine_fonds = 'Origine des fonds (enregistré)'

            const preloadDocKeys = ['doc_piece_identite', 'piece_recto', 'doc_piece_verso', 'piece_verso', 'doc_justificatif_domicile', 'doc_photo', 'selfie_live', 'doc_origine_fonds']
            preloadDocKeys.forEach(k => {
              if (payload.value[k] && typeof payload.value[k] === 'string' && !payload.value[k].startsWith('data:')) {
                loadDocumentBlob(k)
              }
            })
            payload.value.nature_client = 'personne_physique'
            if (!payload.value.categorie_client || (!personnePhysiqueCategories.includes(payload.value.categorie_client) && payload.value.categorie_client !== 'Particulier')) {
              payload.value.categorie_client = 'Salarié secteur privé'
            }
          }
        }
        const existingCat = authStore.user?.categorie_client || serverSession?.payload?.categorie_client
        const normalizedCat = (existingCat && (personnePhysiqueCategories.includes(existingCat) || existingCat === 'Particulier')) ? existingCat : 'Salarié secteur privé'
        serverNeedsCategory.value = response.data.needs_category === true || !normalizedCat
        if (normalizedCat) {
          missingCategoryValue.value = normalizedCat
        }
      }
    } catch (e) {
      console.warn('Could not sync with server onboarding status, continuing with local draft', e)
    }
  }
  // Handle selectedNationality initialization based on payload.nat
  const knownNationalities = [
    'Camerounaise', 'Gabonaise', 'Congolaise', 'Tchadienne', 'Centrafricaine', 
    'Équato-guinéenne', 'Ivoirienne', 'Sénégalaise', 'Béninoise', 'Togolaise', 
    'Malienne', 'Burkinabè', 'Nigériane', 'Française', 'Belge', 'Canadienne', 'Américaine'
  ]
  if (payload.value.nat) {
    if (knownNationalities.includes(payload.value.nat)) {
      selectedNationality.value = payload.value.nat
    } else {
      selectedNationality.value = 'Autre'
      otherNationality.value = payload.value.nat
    }
  } else {
    payload.value.nat = 'Camerounaise'
  }

  // Populate split date selects from loaded payload values
  if (payload.value.dob) {
    const parts = payload.value.dob.split('-')
    if (parts.length === 3) {
      dobYear.value = parts[0]
      dobMonth.value = String(parseInt(parts[1]))
      dobDay.value = String(parseInt(parts[2]))
    }
  }
  if (payload.value.expiration_piece) {
    const parts = payload.value.expiration_piece.split('-')
    if (parts.length === 3) {
      expYear.value = parts[0]
      expMonth.value = String(parseInt(parts[1]))
      expDay.value = String(parseInt(parts[2]))
    }
  }

  if (payload.value.secteur) {
    if (popularSectors.includes(payload.value.secteur)) {
      selectedSecteur.value = payload.value.secteur
    } else {
      selectedSecteur.value = 'Autre'
      customSecteur.value = payload.value.secteur
    }
  }

  // If sources are selected but origine_fonds not set, deduce it
  if (!payload.value.origine_fonds) {
    syncOrigineFonds()
  }

  if (currentStep.value === 'identity') {
    await refreshIdentityStatus()
  }

  loading.value = false
}

// KYC drafts are sent only to the authenticated API and are never persisted in browser storage.
const syncWithServer = async (stepName) => {
  if (!window.navigator.onLine) {
    syncError.value = "Connexion requise pour enregistrer ce dossier sensible."
    return false
  }

  try {
    syncError.value = null
    await api.post('/onboarding/save-progress', {
      step: stepName,
      payload: payload.value
    })
    return true
  } catch (e) {
    console.warn('Sync failed', e)
    syncError.value = e.response?.data?.message || "La progression n'a pas pu être enregistrée. Réessayez."
    return false
  }
}

const refreshIdentityStatus = async () => {
  identityLoading.value = true
  try {
    const response = await api.get('/identity-verification/status')
    identityRequired.value = response.data.required === true
    identityVerification.value = response.data.verification || null
    return identityVerification.value?.verified === true
  } catch (error) {
    triggerError('Vérification indisponible', error.response?.data?.message || "Impossible de récupérer le statut de vérification.")
    return false
  } finally {
    identityLoading.value = false
  }
}

const startIdentityVerification = async () => {
  identityLoading.value = true
  try {
    const response = await api.post('/identity-verification/session')
    const sessionUrl = new URL(response.data.session_url)
    const allowedHosts = (import.meta.env.VITE_IDENTITY_ALLOWED_HOSTS || 'ivs.idenfy.com,ui.idenfy.com')
      .split(',')
      .map(host => host.trim().toLowerCase())
      .filter(Boolean)
    if (sessionUrl.protocol !== 'https:' || !allowedHosts.includes(sessionUrl.hostname.toLowerCase())) {
      throw new Error('URL de vérification non sécurisée')
    }
    window.location.assign(sessionUrl.toString())
  } catch (error) {
    triggerError('Démarrage impossible', error.response?.data?.message || "Le contrôle d'identité n'a pas pu démarrer.")
    identityLoading.value = false
  }
}

onMounted(() => {
  updateOnlineStatus()
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  initSession()
})

// Progress step percentages
const progressPercentage = computed(() => {
  switch (currentStep.value) {
    case 'kyc': return 20
    case 'identity': return 40
    case 'risk': return 55
    case 'labft': return 75
    case 'signature': return 95
    case 'completed': return 100
    default: return 0
  }
})

// Local Client-side Scoring (UX only)
const localScore = computed(() => {
  let score = 0
  
  if (payload.value.tranche_revenus === '500k_1_5m') score += 1
  else if (payload.value.tranche_revenus === 'plus_1_5m') score += 2

  if (payload.value.epargne_possible === 'Oui') score += 2

  if (payload.value.niveau_risque === 'faible') score += 1
  else if (payload.value.niveau_risque === 'moyen') score += 2
  else if (payload.value.niveau_risque === 'max') score += 4

  if (payload.value.conscience_risque === 'Oui') score += 1

  if (payload.value.niveau_risque === 'croissance' || payload.value.objectif_invest === 'croissance') score += 2
  else score += 1

  if (payload.value.horizon_terme === 'court_terme') score += 1
  else if (payload.value.horizon_terme === 'moyen_terme') score += 2
  else if (payload.value.horizon_terme === 'long_terme') score += 3

  if (payload.value.niveau_perf === 'moderee' || payload.value.niveau_perf === '2') score += 2
  else if (payload.value.niveau_perf === 'elevee' || payload.value.niveau_perf === '3') score += 4

  if (payload.value.connaissance_marche === 'excellente') score += 2
  if (payload.value.invest_anterieurs === 'Oui') score += 3

  return score
})

const localProfile = computed(() => {
  const s = localScore.value
  if (languageStore.isEn()) {
    if (s <= 10) return 'Conservative'
    if (s <= 19) return 'Moderate'
    return 'Dynamic'
  }
  if (s <= 10) return 'Prudent'
  if (s <= 19) return 'Modéré'
  return 'Dynamique'
})

const maxBirthDate = computed(() => {
  const today = new Date()
  const year = today.getFullYear() - 21
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

const minExpirationDate = computed(() => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

// French / English months array
const frenchMonths = computed(() => [
  { value: '1', label: languageStore.isEn() ? 'January' : 'Janvier' },
  { value: '2', label: languageStore.isEn() ? 'February' : 'Février' },
  { value: '3', label: languageStore.isEn() ? 'March' : 'Mars' },
  { value: '4', label: languageStore.isEn() ? 'April' : 'Avril' },
  { value: '5', label: languageStore.isEn() ? 'May' : 'Mai' },
  { value: '6', label: languageStore.isEn() ? 'June' : 'Juin' },
  { value: '7', label: languageStore.isEn() ? 'July' : 'Juillet' },
  { value: '8', label: languageStore.isEn() ? 'August' : 'Août' },
  { value: '9', label: languageStore.isEn() ? 'September' : 'Septembre' },
  { value: '10', label: languageStore.isEn() ? 'October' : 'Octobre' },
  { value: '11', label: languageStore.isEn() ? 'November' : 'Novembre' },
  { value: '12', label: languageStore.isEn() ? 'December' : 'Décembre' }
])

// Date of birth states
const dobDay = ref('')
const dobMonth = ref('')
const dobYear = ref('')

// Expiration date states
const expDay = ref('')
const expMonth = ref('')
const expYear = ref('')

// Max year for DOB is current year - 21 (natural persons must be >= 21 years old)
const currentYear = new Date().getFullYear()
const dobYearsList = computed(() => {
  const years = []
  const maxYear = currentYear - 21
  const minYear = currentYear - 100
  for (let y = maxYear; y >= minYear; y--) {
    years.push(String(y))
  }
  return years
})

// Expiration years: valid year to valid year + 30
const expYearsList = computed(() => {
  return getValidExpirationYears()
})

const expMonthsList = computed(() => {
  return getValidExpirationMonths(expYear.value, languageStore.isEn())
})

// Helper to get days in month
const getDaysInMonth = (month, year) => {
  if (!month) return 31
  const m = parseInt(month)
  const y = parseInt(year) || 2020 // leap year default if not set
  return new Date(y, m, 0).getDate()
}

// Days lists computed properties
const dobDaysList = computed(() => {
  const maxDay = getDaysInMonth(dobMonth.value, dobYear.value)
  return Array.from({ length: maxDay }, (_, i) => String(i + 1))
})

const expDaysList = computed(() => {
  return getValidExpirationDays(expYear.value, expMonth.value)
})

// Update payload helper functions
const updateDobPayload = () => {
  if (dobDay.value && dobMonth.value && dobYear.value) {
    payload.value.dob = `${dobYear.value}-${String(dobMonth.value).padStart(2, '0')}-${String(dobDay.value).padStart(2, '0')}`
    clearError('dob')
  } else {
    payload.value.dob = ''
  }
}

const updateExpPayload = () => {
  if (expDay.value && expMonth.value && expYear.value) {
    payload.value.expiration_piece = `${expYear.value}-${String(expMonth.value).padStart(2, '0')}-${String(expDay.value).padStart(2, '0')}`
    if (!isExpirationDateValid(payload.value.expiration_piece)) {
      validationErrors.value.expiration_piece = getExpirationErrorMessage(languageStore.isEn())
    } else {
      clearError('expiration_piece')
    }
  } else {
    payload.value.expiration_piece = ''
  }
}

// Watchers for DOB changes
watch([dobMonth, dobYear], () => {
  if (dobDay.value && dobDaysList.value.length < parseInt(dobDay.value)) {
    dobDay.value = String(dobDaysList.value.length)
  }
  updateDobPayload()
})
watch(dobDay, () => {
  updateDobPayload()
})

// Watchers for Expiration changes with auto-clamping
watch(expYear, (newYear) => {
  if (newYear && expMonth.value) {
    const validMonthValues = expMonthsList.value.map(m => m.value)
    if (!validMonthValues.includes(expMonth.value)) {
      expMonth.value = validMonthValues[0] || ''
    }
  }
  updateExpPayload()
})

watch(expMonth, (newMonth) => {
  if (newMonth && expDay.value) {
    const validDays = expDaysList.value
    if (!validDays.includes(expDay.value)) {
      expDay.value = validDays[0] || ''
    }
  }
  updateExpPayload()
})

watch(expDay, () => {
  updateExpPayload()
})

// Form Step Navigations
const nextStep = async () => {
  if (stepLoading.value || submitting.value || verifyingKYC.value) return
  stepLoading.value = true
  validationErrors.value = {}
  try {
  
  if (currentStep.value === 'kyc') {
    if (!payload.value.civ) {
      validationErrors.value.civ = "La civilité est obligatoire."
    }
    if (!payload.value.nom || payload.value.nom.trim() === '') {
      validationErrors.value.nom = "Le nom est obligatoire."
    }
    if (!payload.value.prenom || payload.value.prenom.trim() === '') {
      validationErrors.value.prenom = "Le prénom est obligatoire."
    }
    if (!payload.value.situation_mat) {
      validationErrors.value.situation_mat = "La situation matrimoniale est obligatoire."
    }
    if (!payload.value.dob) {
      validationErrors.value.dob = "La date de naissance est obligatoire."
    }
    if (!payload.value.lieu_naiss || payload.value.lieu_naiss.trim() === '') {
      validationErrors.value.lieu_naiss = "Le lieu de naissance est obligatoire."
    }
    if (!payload.value.nat) {
      validationErrors.value.nat = "La nationalité est obligatoire."
    }
    if (!payload.value.tel || payload.value.tel.trim() === '') {
      validationErrors.value.tel = "Le numéro de téléphone est obligatoire."
    }
    if (!payload.value.email || payload.value.email.trim() === '') {
      validationErrors.value.email = "L'adresse e-mail est obligatoire."
    }
    if (!payload.value.adresse || payload.value.adresse.trim() === '') {
      validationErrors.value.adresse = "L'adresse de résidence est obligatoire."
    }
    if (!payload.value.piece) {
      validationErrors.value.piece = "Le type de pièce est obligatoire."
    }
    if (!payload.value.num_piece || payload.value.num_piece.trim() === '') {
      validationErrors.value.num_piece = "Le numéro de pièce est obligatoire."
    }
    if (!payload.value.expiration_piece) {
      validationErrors.value.expiration_piece = languageStore.isEn()
        ? "Document expiration date is required."
        : "La date d'expiration de la pièce est obligatoire."
    } else if (!isExpirationDateValid(payload.value.expiration_piece)) {
      validationErrors.value.expiration_piece = getExpirationErrorMessage(languageStore.isEn())
    }

    if (Object.keys(validationErrors.value).length > 0) {
      return
    }

    const birthDate = new Date(payload.value.dob)
    const today = new Date()

    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    if (age < 21) {
      validationErrors.value.dob = "Vous devez être âgé d'au moins 21 ans pour procéder à l'onboarding."
      return
    }

    const recto = payload.value.piece_recto || payload.value.doc_piece_identite
    if (!recto) {
      triggerError("Pièce requise", "Veuillez fournir votre pièce d'identité (Recto) avant de continuer.")
      return
    }

    // Déclencher la vérification de concordance des documents via la modale si pas encore validée
    if (!kycVerificationCompleted.value) {
      openConcordanceModalAndStart()
      return
    }

    const targetStep = identityRequired.value ? 'identity' : 'risk'
    if (!await syncWithServer(targetStep)) return
    currentStep.value = targetStep
    if (targetStep === 'identity') await refreshIdentityStatus()
  } 
  else if (currentStep.value === 'identity') {
    if (!await refreshIdentityStatus()) {
      triggerError('Identité non vérifiée', "La vérification stricte doit être approuvée avant de poursuivre.")
      return
    }
    if (!await syncWithServer('risk')) return
    currentStep.value = 'risk'
  }
  else if (currentStep.value === 'risk') {
    const requiredRiskFields = [
      'tranche_revenus', 'epargne_possible', 'niveau_risque', 'conscience_risque',
      'objectif_invest', 'horizon_terme', 'niveau_perf', 'connaissance_marche', 'invest_anterieurs'
    ]
    requiredRiskFields.forEach((field) => {
      if (!payload.value[field]) validationErrors.value[field] = 'Une réponse explicite est obligatoire.'
    })
    if (Object.keys(validationErrors.value).length > 0) {
      triggerError('Questionnaire incomplet', 'Répondez explicitement à chacune des neuf questions de profil investisseur.')
      return
    }
    if (!await syncWithServer('labft')) return
    currentStep.value = 'labft'
  } 
  else if (currentStep.value === 'labft') {
    const hasSourceOfRevenue = 
      payload.value.src_salaire ||
      payload.value.src_pro_liberal ||
      payload.value.src_foncier ||
      payload.value.src_dividendes ||
      payload.value.src_heritage ||
      payload.value.src_autre_check

    if (!payload.value.situation_mat) {
      payload.value.situation_mat = 'Célibataire'
    }
    if (!payload.value.pays_residence || payload.value.pays_residence.trim() === '') {
      payload.value.pays_residence = authStore.user?.country || 'Cameroun'
    }
    if (!payload.value.secteur || payload.value.secteur.trim() === '') {
      validationErrors.value.secteur = "Le secteur d'activité est obligatoire."
    }
    if (!payload.value.revenus_annuels) {
      const mapRevenus = {
        'moins_500k': 'moins_5m',
        '500k_1_5m': '5m_15m',
        'plus_1_5m': 'plus_15m'
      }
      payload.value.revenus_annuels = mapRevenus[payload.value.tranche_revenus] || 'moins_5m'
    }
    if (!hasSourceOfRevenue) {
      validationErrors.value.sources_revenu = "Veuillez cocher au moins une source de revenus."
    }
    if (!payload.value.origine_fonds || payload.value.origine_fonds.trim() === '') {
      syncOrigineFonds()
    }
    if (!payload.value.origine_fonds || payload.value.origine_fonds.trim() === '') {
      validationErrors.value.origine_fonds = "L'origine des fonds est obligatoire."
    }

    if (Object.keys(validationErrors.value).length > 0) {
      return
    }

    if (!payload.value.ack_lecture || !payload.value.ack_donnees) {
      validationErrors.value.consent = "Vous devez accepter les consentements obligatoires."
      return
    }
    if (payload.value.ppe === 'Oui' && !payload.value.ppe_detail) {
      validationErrors.value.ppe = "Veuillez préciser votre fonction politique."
      return
    }
    for (const field of ['pays_risque', 'secteur_sensible', 'ppe', 'condamnation']) {
      if (!payload.value[field]) validationErrors.value[field] = 'Une réponse explicite est obligatoire.'
    }
    if (Object.keys(validationErrors.value).length > 0) {
      triggerError('Déclarations incomplètes', 'Répondez explicitement à toutes les déclarations LAB-FT.')
      return
    }
    if (!await syncWithServer('signature')) return
    currentStep.value = 'signature'
    setTimeout(initCanvas, 100)
  }
  } finally {
    stepLoading.value = false
  }
}

const prevStep = () => {
  if (currentStep.value === 'identity') currentStep.value = 'kyc'
  else if (currentStep.value === 'risk') currentStep.value = identityRequired.value ? 'identity' : 'kyc'
  else if (currentStep.value === 'labft') currentStep.value = 'risk'
  else if (currentStep.value === 'signature') currentStep.value = 'labft'
}

// Permet de modifier le dossier tant qu'il n'est pas validé
const canEditDossier = computed(() => {
  return onboardingSessionStatus.value !== 'validated'
})

const editDossier = async () => {
  loading.value = true
  try {
    // Re-sync with server to get latest state
    const response = await api.get('/onboarding/status')
    const serverSession = response.data.session
    if (serverSession) {
      onboardingSessionStatus.value = serverSession.status
      if (serverSession.status === 'validated') {
        triggerError('Dossier validé', 'Votre dossier a été validé. Il ne peut plus être modifié.')
        return
      }
      currentStep.value = 'kyc'
      validationErrors.value = {}
      signatureError.value = null
    }
  } catch (e) {
    // Fallback: allow edit locally
    currentStep.value = 'kyc'
    validationErrors.value = {}
  } finally {
    loading.value = false
  }
}

// Canvas signature helpers
const initCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  // Set canvas resolution
  canvas.width = canvas.parentElement.clientWidth || 320
  canvas.height = 150
  
  const ctx = canvas.getContext('2d')
  ctx.strokeStyle = '#482010'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  
  // Mouse events
  canvas.addEventListener('mousedown', (e) => {
    isDrawing.value = true
    draw(e.offsetX, e.offsetY)
  })
  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing.value) return
    draw(e.offsetX, e.offsetY)
  })
  window.addEventListener('mouseup', () => {
    isDrawing.value = false
  })

  // Touch events (Mobile)
  canvas.addEventListener('touchstart', (e) => {
    isDrawing.value = true
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    draw(touch.clientX - rect.left, touch.clientY - rect.top)
    // Scroll Lock on touch start
    document.body.style.overflow = 'hidden'
  })

  canvas.addEventListener('touchmove', (e) => {
    if (!isDrawing.value) return
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    draw(touch.clientX - rect.left, touch.clientY - rect.top)
    e.preventDefault()
  })

  canvas.addEventListener('touchend', () => {
    isDrawing.value = false
    // Release scroll lock
    document.body.style.overflow = ''
  })
}

const draw = (x, y) => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  
  if (!hasSigned.value) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    hasSigned.value = true
  } else {
    ctx.lineTo(x, y)
    ctx.stroke()
  }
}

const clearSignature = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  hasSigned.value = false
}

// Final Submit
const submitOnboarding = async () => {
  if (!signatureConfirmed.value) {
    signatureError.value = languageStore.isEn() 
      ? "Please confirm having read the fund regulations." 
      : "Veuillez cocher la case de confirmation du règlement du fonds."
    return
  }

  if (!dataRetentionConfirmed.value) {
    signatureError.value = languageStore.isEn()
      ? "Please authorize the retention of your personal data and documents to finalize."
      : "Veuillez autoriser la conservation de vos informations et pièces justificatives pour finaliser."
    return
  }

  if (!hasSigned.value) {
    signatureError.value = languageStore.isEn()
      ? "Please provide your signature to continue."
      : "Veuillez apposer votre signature pour continuer."
    return
  }

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  
  // Fill background with white (since JPEG doesn't support transparency and defaults to black)
  ctx.save()
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.restore()

  // Compress signature as JPEG with 0.5 quality to save bandwidth (approx 15KB instead of 80KB PNG)
  const signatureData = canvas.toDataURL('image/jpeg', 0.5)

  submitting.value = true
  signatureError.value = null

  try {
    const response = await api.post('/onboarding/finalize', {
      signature: signatureData
    })
    
    if (response.data?.session?.status) {
      onboardingSessionStatus.value = response.data.session.status
    } else {
      onboardingSessionStatus.value = 'completed'
    }
    
    // Fetch updated user to refresh authStore (contains updated onboarding status)
    try {
      const userRes = await api.get('/user')
      authStore.setUser(userRes.data)
    } catch (userErr) {
      console.error('Failed to refresh user after onboarding finalization', userErr)
    }
    
    currentStep.value = 'completed'
  } catch (e) {
    console.error('Finalization failed', e)
    if (e.response && e.response.data) {
      if (e.response.data.errors) {
        validationErrors.value = {}
        const errors = e.response.data.errors
        Object.keys(errors).forEach(key => {
          const err = errors[key]
          const errMsg = Array.isArray(err) ? err[0] : err
          validationErrors.value[key] = errMsg
          
          // Map backend validation keys to frontend display keys
          if (key === 'ack_lecture' || key === 'ack_donnees') {
            validationErrors.value.consent = errMsg
          }
          if (key === 'ppe_detail') {
            validationErrors.value.ppe = errMsg
          }
        })
        
        // Redirect user to the step containing errors
        const kycFields = ['civ', 'nom', 'prenom', 'dob', 'lieu_naiss', 'nat', 'tel', 'email', 'adresse', 'piece', 'num_piece', 'expiration_piece']
        const hasKycError = Object.keys(validationErrors.value).some(key => kycFields.includes(key))
        if (hasKycError) {
          currentStep.value = 'kyc'
        } else {
          currentStep.value = 'labft'
        }
        signatureError.value = e.response.data.message || "Erreur de validation. Veuillez vérifier vos données."
      } else {
        // Autre erreur API (ex: 400 "L'onboarding est déjà finalisé.")
        signatureError.value = e.response.data.message || "Une erreur est survenue lors de la validation de votre dossier."
        triggerError("Attention", signatureError.value)
      }
    } else {
      // Erreur réelle de connexion internet (pas de réponse du serveur)
      signatureError.value = "Une erreur est survenue lors de l'envoi de votre dossier. Veuillez vérifier votre connexion internet et réessayer."
      triggerError("Échec de l'envoi", signatureError.value)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="min-h-screen flex flex-col items-center justify-center space-y-4">
    <Loader2 class="w-10 h-10 text-primary animate-spin" />
    <p class="text-slate-400 font-medium">{{ languageStore.isEn() ? 'Retrieving your file...' : 'Récupération de votre dossier...' }}</p>
  </div>

  <div v-else class="min-h-screen flex flex-col bg-slate-50">
    <!-- Header -->
    <header class="bg-white px-6 py-6 flex flex-col sticky top-0 z-10 border-b border-slate-100">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button v-if="currentStep !== 'completed'" @click="router.back()" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all">
            <ChevronLeft class="w-6 h-6" />
          </button>
          <div>
            <h2 class="text-xl font-black text-slate-900">Onboarding</h2>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Plan d'Épargne Kori</p>
          </div>
        </div>
        <LanguageSelector />
      </div>
      
      <!-- Progress Bar -->
      <div v-if="currentStep !== 'completed'" class="mt-6 space-y-2">
        <div class="flex justify-between items-center text-xs font-bold text-slate-400">
          <span class="uppercase">{{ languageStore.isEn() ? 'Progress' : 'Progression' }}</span>
          <span>{{ progressPercentage }}%</span>
        </div>
        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div :style="{ width: progressPercentage + '%' }" class="bg-primary h-full transition-all duration-500"></div>
        </div>
      </div>

      <!-- Low connectivity warning header -->
      <div v-if="offlineMode || syncError" class="mt-3 flex items-center gap-2 bg-amber-50 text-amber-800 p-2.5 rounded-xl border border-amber-200/50 text-[10px] font-bold">
        <WifiOff class="w-3.5 h-3.5 text-amber-600" />
        <span>{{ syncError || (languageStore.isEn() ? 'Offline mode: inputs secured locally.' : 'Mode hors-ligne : saisies sécurisées localement.') }}</span>
      </div>
    </header>

    <!-- Content Sections -->
    <div class="flex-1 px-6 py-8 pb-36 overflow-y-auto space-y-6">
      
      <!-- STEP 1: KYC FORM -->
      <div v-if="currentStep === 'kyc'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">{{ languageStore.isEn() ? 'Step 1 of ' + (identityRequired ? 5 : 4) : 'Étape 1 sur ' + (identityRequired ? 5 : 4) }}</span>
          <h3 class="text-xl font-black text-slate-900">{{ languageStore.isEn() ? 'Identity & KYC' : 'Identité & KYC' }}</h3>
          <p class="text-slate-500 text-xs font-medium">{{ languageStore.isEn() ? 'Complete your regulatory identity details.' : 'Complétez vos informations réglementaires d\'identité.' }}</p>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <!-- Civilité -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Civility *' : 'Civilité *' }}</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.civ = 'M.'; clearError('civ')" :class="payload.civ === 'M.' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">{{ languageStore.isEn() ? 'Mr.' : 'Monsieur' }}</button>
              <button type="button" @click="payload.civ = 'Mme'; clearError('civ')" :class="payload.civ === 'Mme' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">{{ languageStore.isEn() ? 'Mrs./Ms.' : 'Madame' }}</button>
            </div>
            <p v-if="validationErrors.civ" id="civ-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.civ }}
            </p>
          </div>

          <!-- Catégorie du client -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Client Category *' : 'Catégorie du client *' }}</label>
            <div class="relative">
              <select v-model="payload.categorie_client" @change="clearError('categorie_client')" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:border-primary outline-none transition-all appearance-none cursor-pointer">
                <option v-for="cat in availableClientCategories" :key="cat" :value="cat">{{ formatCategory(cat) }}</option>
              </select>
              <ChevronDown class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <p v-if="validationErrors.categorie_client" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.categorie_client }}
            </p>
          </div>

          <!-- Identité : Nom et Prénom -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
                {{ languageStore.isEn() ? 'Last Name *' : 'Nom *' }}
              </label>
              <input v-model="payload.nom" @blur="clearError('nom')" @input="clearError('nom')" type="text" placeholder="Ex: KAMGA" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.nom ? 'true' : 'false'" :aria-describedby="validationErrors.nom ? 'nom-error' : null">
              <p v-if="validationErrors.nom" id="nom-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.nom }}
              </p>
            </div>
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
                {{ languageStore.isEn() ? 'First Name *' : 'Prénom *' }}
              </label>
              <input v-model="payload.prenom" @blur="clearError('prenom')" @input="clearError('prenom')" type="text" placeholder="Ex: Jean" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.prenom ? 'true' : 'false'" :aria-describedby="validationErrors.prenom ? 'prenom-error' : null">
              <p v-if="validationErrors.prenom" id="prenom-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.prenom }}
              </p>
            </div>
          </div>

          <!-- Situation Matrimoniale -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Marital Status *' : 'Situation Matrimoniale *' }}</label>
            <select v-model="payload.situation_mat" @change="clearError('situation_mat')" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.situation_mat ? 'true' : 'false'" :aria-describedby="validationErrors.situation_mat ? 'situation_mat-error' : null">
              <option value="Célibataire">{{ languageStore.isEn() ? 'Single' : 'Célibataire' }}</option>
              <option value="Marié(e)">{{ languageStore.isEn() ? 'Married' : 'Marié(e)' }}</option>
              <option value="Divorcé(e)">{{ languageStore.isEn() ? 'Divorced' : 'Divorcé(e)' }}</option>
              <option value="Veuf(ve)">{{ languageStore.isEn() ? 'Widowed' : 'Veuf(ve)' }}</option>
            </select>
            <p v-if="validationErrors.situation_mat" id="situation_mat-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.situation_mat }}
            </p>
          </div>

          <!-- Date de naissance et Lieu -->
          <div class="space-y-4">
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
                {{ languageStore.isEn() ? 'Date of Birth *' : 'Date de Naissance *' }}
              </label>
              <div class="grid grid-cols-3 gap-2">
                <!-- Jour -->
                <select v-model="dobDay" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                  <option value="" disabled>{{ languageStore.isEn() ? 'Day' : 'Jour' }}</option>
                  <option v-for="d in dobDaysList" :key="d" :value="d">{{ String(d).padStart(2, '0') }}</option>
                </select>
                <!-- Mois -->
                <select v-model="dobMonth" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                  <option value="" disabled>{{ languageStore.isEn() ? 'Month' : 'Mois' }}</option>
                  <option v-for="m in frenchMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
                </select>
                <!-- Année -->
                <select v-model="dobYear" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                  <option value="" disabled>{{ languageStore.isEn() ? 'Year' : 'Année' }}</option>
                  <option v-for="y in dobYearsList" :key="y" :value="y">{{ y }}</option>
                </select>
              </div>
              <p v-if="validationErrors.dob" id="dob-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.dob }}
              </p>
            </div>
            
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
                {{ languageStore.isEn() ? 'Place of Birth *' : 'Lieu Naissance *' }}
              </label>
              <input v-model="payload.lieu_naiss" @blur="clearError('lieu_naiss')" @input="clearError('lieu_naiss')" type="text" placeholder="Ex: Yaoundé" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.lieu_naiss ? 'true' : 'false'" :aria-describedby="validationErrors.lieu_naiss ? 'lieu_naiss-error' : null">
              <p v-if="validationErrors.lieu_naiss" id="lieu_naiss-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.lieu_naiss }}
              </p>
            </div>
          </div>

          <!-- Nationalité & Résidence -->
          <div class="space-y-4 text-left">
            <div class="space-y-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Nationality *' : 'Nationalité *' }}</label>
              <select v-model="selectedNationality" @change="onNationalityChange(); clearError('nat')" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.nat ? 'true' : 'false'" :aria-describedby="validationErrors.nat ? 'nat-error' : null">
                <option value="Camerounaise">{{ languageStore.isEn() ? 'Cameroonian' : 'Camerounaise' }}</option>
                <option value="Gabonaise">{{ languageStore.isEn() ? 'Gabonese' : 'Gabonaise' }}</option>
                <option value="Congolaise">{{ languageStore.isEn() ? 'Congolese' : 'Congolaise' }}</option>
                <option value="Tchadienne">{{ languageStore.isEn() ? 'Chadian' : 'Tchadienne' }}</option>
                <option value="Centrafricaine">{{ languageStore.isEn() ? 'Central African' : 'Centrafricaine' }}</option>
                <option value="Équato-guinéenne">{{ languageStore.isEn() ? 'Equatorial Guinean' : 'Équato-guinéenne' }}</option>
                <option value="Ivoirienne">{{ languageStore.isEn() ? 'Ivorian' : 'Ivoirienne' }}</option>
                <option value="Sénégalaise">{{ languageStore.isEn() ? 'Senegalese' : 'Sénégalaise' }}</option>
                <option value="Béninoise">{{ languageStore.isEn() ? 'Beninese' : 'Béninoise' }}</option>
                <option value="Togolaise">{{ languageStore.isEn() ? 'Togolese' : 'Togolaise' }}</option>
                <option value="Malienne">{{ languageStore.isEn() ? 'Malian' : 'Malienne' }}</option>
                <option value="Burkinabè">{{ languageStore.isEn() ? 'Burkinabe' : 'Burkinabè' }}</option>
                <option value="Nigériane">{{ languageStore.isEn() ? 'Nigerian' : 'Nigériane' }}</option>
                <option value="Française">{{ languageStore.isEn() ? 'French' : 'Française' }}</option>
                <option value="Belge">{{ languageStore.isEn() ? 'Belgian' : 'Belge' }}</option>
                <option value="Canadienne">{{ languageStore.isEn() ? 'Canadian' : 'Canadienne' }}</option>
                <option value="Américaine">{{ languageStore.isEn() ? 'American' : 'Américaine' }}</option>
                <option value="Autre">{{ languageStore.isEn() ? 'Other (Enter manually)' : 'Autre (Saisir manuellement)' }}</option>
              </select>
              <p v-if="validationErrors.nat" id="nat-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.nat }}
              </p>
            </div>
            
            <div v-if="selectedNationality === 'Autre'" class="space-y-2 animate-in fade-in duration-300">
              <label class="text-[10px] font-black text-slate-400 uppercase pl-1">{{ languageStore.isEn() ? 'Specify your nationality *' : 'Précisez votre nationalité *' }}</label>
              <input v-model="otherNationality" @input="onOtherNationalityInput(); clearError('nat')" type="text" :placeholder="languageStore.isEn() ? 'Ex: Italian' : 'Ex: Italienne'" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
          </div>

          <!-- Contact (Tel, Email) -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Phone *' : 'Téléphone *' }}</label>
            <input v-model="payload.tel" @blur="clearError('tel')" @input="clearError('tel')" type="tel" placeholder="Ex: 699009900" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.tel ? 'true' : 'false'" :aria-describedby="validationErrors.tel ? 'tel-error' : null">
            <p v-if="validationErrors.tel" id="tel-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.tel }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Contact Email *' : 'E-mail de contact *' }}</label>
            <input v-model="payload.email" @blur="clearError('email')" @input="clearError('email')" type="email" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.email ? 'true' : 'false'" :aria-describedby="validationErrors.email ? 'email-error' : null">
            <p v-if="validationErrors.email" id="email-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.email }}
            </p>
          </div>

          <!-- Adresse physique -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Residential Address *' : 'Adresse de résidence *' }}</label>
            <input v-model="payload.adresse" @blur="clearError('adresse')" @input="clearError('adresse')" type="text" :placeholder="languageStore.isEn() ? 'Neighborhood, City' : 'Quartier, Ville'" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.adresse ? 'true' : 'false'" :aria-describedby="validationErrors.adresse ? 'adresse-error' : null">
            <p v-if="validationErrors.adresse" id="adresse-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.adresse }}
            </p>
          </div>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">{{ languageStore.isEn() ? 'Official Documents' : 'Documents Officiels' }}</h4>
          
          <!-- Pièce d'identité -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Document Type *' : 'Type de pièce *' }}</label>
            <select v-model="payload.piece" @change="onPieceTypeChange" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.piece ? 'true' : 'false'" :aria-describedby="validationErrors.piece ? 'piece-error' : null">
              <option value="CNI">{{ languageStore.isEn() ? 'National Identity Card (CNI)' : 'Carte Nationale d\'Identité (CNI)' }}</option>
              <option value="Passeport">{{ languageStore.isEn() ? 'Passport' : 'Passeport' }}</option>
              <option value="Carte Résident">{{ languageStore.isEn() ? 'Residence Permit / Card' : 'Carte de Résident / Titre de Séjour' }}</option>
              <option value="Permis de Conduire">{{ languageStore.isEn() ? 'Driver License' : 'Permis de Conduire' }}</option>
            </select>
            <p v-if="validationErrors.piece" id="piece-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.piece }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Document Number *' : 'Numéro de pièce *' }}</label>
            <input v-model="payload.num_piece" @blur="clearError('num_piece')" @input="clearError('num_piece')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.num_piece ? 'true' : 'false'" :aria-describedby="validationErrors.num_piece ? 'num_piece-error' : null">
            <p v-if="validationErrors.num_piece" id="num_piece-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.num_piece }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Document Expiration Date *' : 'Date d\'expiration de la pièce *' }}</label>
            <div class="grid grid-cols-3 gap-2">
              <!-- Jour -->
              <select v-model="expDay" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                <option value="" disabled>{{ languageStore.isEn() ? 'Day' : 'Jour' }}</option>
                <option v-for="d in expDaysList" :key="d" :value="d">{{ String(d).padStart(2, '0') }}</option>
              </select>
              <!-- Mois -->
              <select v-model="expMonth" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                <option value="" disabled>{{ languageStore.isEn() ? 'Month' : 'Mois' }}</option>
                <option v-for="m in expMonthsList" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <!-- Année -->
              <select v-model="expYear" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                <option value="" disabled>{{ languageStore.isEn() ? 'Year' : 'Année' }}</option>
                <option v-for="y in expYearsList" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
            <p v-if="validationErrors.expiration_piece" id="expiration_piece-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.expiration_piece }}
            </p>
          </div>
        </div>

        <!-- 5 BLOCS DE DOCUMENTS KYC FOURNIS (EXACT DU BACKOFFICE) -->
        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-6 text-left">
          <div class="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <FileText class="w-4 h-4 text-primary" />
                {{ languageStore.isEn() ? 'KYC Supporting Documents' : 'Documents & Justificatifs KYC' }}
              </h4>
              <p class="text-[11px] text-slate-400 font-medium mt-0.5">
                {{ languageStore.isEn() ? 'Import the requested documents into their respective areas (JPG, PNG, PDF).' : 'Importez les pièces demandées dans leurs espaces et blocs respectifs (JPG, PNG, PDF).' }}
              </p>
            </div>
            <!-- <span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary">5 Blocs</span> -->
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div
              v-for="(doc, idx) in dynamicSupportingDocs"
              :key="doc.key"
              class="space-y-2"
              :class="{ 'md:col-span-2': idx === 4 }"
            >
              <!-- Titre et indicateur de statut -->
              <div class="flex items-center justify-between pl-1">
                <label class="text-xs font-black text-slate-800 tracking-tight">
                  {{ doc.title }}
                </label>
                <span
                  class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                  :class="doc.required ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'"
                >
                  {{ doc.required ? (languageStore.isEn() ? 'Required' : 'Requis') : (languageStore.isEn() ? 'Optional' : 'Optionnel') }}
                </span>
              </div>

              <!-- Zone de Dépôt / Drag & Drop -->
              <div
                @dragover.prevent="!doc.disabled && (dragActive[doc.key] = true)"
                @dragleave.prevent="dragActive[doc.key] = false"
                @drop.prevent="!doc.disabled && handleFileDrop($event, doc.key)"
                class="relative border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col items-center justify-center min-h-[140px]"
                :class="[
                  doc.disabled ? 'bg-slate-100/60 border-slate-200 cursor-not-allowed opacity-60' :
                  payload[doc.key] ? 'border-emerald-300 bg-emerald-50/30' :
                  dragActive[doc.key] ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300'
                ]"
              >
                <!-- Input file caché -->
                <input
                  :ref="(el) => registerFileInput(el, doc.key)"
                  type="file"
                  :accept="doc.accept || 'image/*,.pdf'"
                  class="hidden"
                  :disabled="doc.disabled"
                  @change="handleFileInputChange($event, doc.key)"
                />

                <!-- ÉTAT 1 : Document déjà chargé -->
                <div v-if="payload[doc.key]" class="w-full space-y-3">
                  <div class="flex items-center gap-3 bg-white p-3 rounded-xl border border-emerald-100 shadow-sm text-left">
                    <!-- Aperçu Image ou Icône PDF -->
                    <div class="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                      <img
                        v-if="getDocPreviewUrl(doc.key)"
                        :src="getDocPreviewUrl(doc.key)"
                        alt="Aperçu"
                        class="w-full h-full object-cover"
                      />
                      <FileText v-else class="w-6 h-6 text-primary" />
                    </div>

                    <!-- Infos document -->
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-bold text-slate-800 truncate">
                        {{ docFileNames[doc.key] || (languageStore.isEn() ? 'Provided file' : 'Fichier fourni') }}
                      </p>
                      <p class="text-[10px] font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 class="w-3.5 h-3.5" />
                        {{ languageStore.isEn() ? 'Document ready' : 'Document fourni' }}
                      </p>
                    </div>

                    <!-- Bouton Supprimer -->
                    <button
                      type="button"
                      @click="removeSupportingDoc(doc.key)"
                      class="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-all shrink-0 active:scale-95"
                      :title="languageStore.isEn() ? 'Remove document' : 'Supprimer le document'"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>

                  <!-- Actions secondaires de remplacement -->
                  <div class="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      @click="triggerBrowse(doc.key)"
                      class="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Upload class="w-3.5 h-3.5" />
                      {{ languageStore.isEn() ? 'Replace file' : 'Remplacer le fichier' }}
                    </button>
                    <span v-if="doc.allowCamera" class="text-slate-300">•</span>
                    <button
                      v-if="doc.allowCamera"
                      type="button"
                      @click="openCamera(doc.cameraTarget)"
                      class="text-[11px] font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1"
                    >
                      <Camera class="w-3.5 h-3.5" />
                      {{ languageStore.isEn() ? 'Retake photo' : 'Reprendre une photo' }}
                    </button>
                  </div>
                </div>

                <!-- ÉTAT 2 : Aucun document (Faites glisser vos fichiers ou Parcourir) -->
                <div v-else-if="!doc.disabled" class="space-y-3 py-1">
                  <div class="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-sm">
                    <Upload class="w-5 h-5 text-slate-500" />
                  </div>

                  <div class="space-y-1">
                    <p class="text-xs font-semibold text-slate-600">
                      {{ languageStore.isEn() ? 'Drag your files or' : 'Faites glisser vos fichiers ou' }}
                      <button
                        type="button"
                        @click="triggerBrowse(doc.key)"
                        class="text-primary font-bold hover:underline ml-1 cursor-pointer"
                      >
                        {{ languageStore.isEn() ? 'Browse' : 'Parcourir' }}
                      </button>
                    </p>
                    <p class="text-[10px] text-slate-400 font-medium">
                      {{ doc.hint }}
                    </p>
                  </div>

                  <!-- Bouton caméra rapide si autorisé -->
                  <div v-if="doc.allowCamera" class="pt-1">
                    <button
                      type="button"
                      @click="openCamera(doc.cameraTarget)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:border-primary/40 hover:text-primary transition-all shadow-sm active:scale-95"
                    >
                      <Camera class="w-3.5 h-3.5 text-primary" />
                      {{ languageStore.isEn() ? 'Take photo directly' : 'Prendre une photo en direct' }}
                    </button>
                  </div>
                </div>

                <!-- ÉTAT 3 : Désactivé (ex: Verso d'un passeport) -->
                <div v-else class="space-y-1 py-3 text-slate-400">
                  <p class="text-xs font-bold">{{ languageStore.isEn() ? 'No reverse side required' : 'Aucun verso requis pour ce type de pièce' }}</p>
                  <p class="text-[10px]">{{ languageStore.isEn() ? 'The main identity page of the passport is sufficient.' : 'La page principale avec photo et bande MRZ est suffisante.' }}</p>
                </div>
              </div>

              <!-- Statut textuel sous le bloc (Exactement comme dans la capture) -->
              <p class="text-[11px] text-slate-400 font-medium pl-1">
                <span v-if="payload[doc.key]" class="text-emerald-600 font-bold flex items-center gap-1">
                  <span>✓</span> {{ languageStore.isEn() ? 'Document ready for submission.' : 'Document fourni prêt pour l\'envoi.' }}
                </span>
                <span v-else>
                  {{ doc.emptyLabel }}
                </span>
              </p>
            </div>
          </div>
        </div>

        <!-- ENCART DE CONCORDANCE ET VÉRIFICATION AUTOMATISÉE DES DOCUMENTS (PWA) -->
        <div v-if="verificationOCRResult || payload.ocr_nom_match !== null" class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4 text-left">
          <div class="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div class="flex items-center gap-3">
              <!-- <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                :class="payload.ocr_mrz_detected || (payload.ocr_nom_match && payload.ocr_num_piece_match) ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'">
                <ShieldCheck v-if="payload.ocr_mrz_detected || (payload.ocr_nom_match && payload.ocr_num_piece_match)" class="w-5 h-5" />
                <ShieldAlert v-else class="w-5 h-5" />
              </div> -->
              <div>
                <h5 class="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  {{ languageStore.isEn() ? 'Documents Verification' : 'Verification documents' }}
                </h5>
                <p class="text-[11px] text-slate-500 font-medium">
                  {{ payload.ocr_mrz_detected || (payload.ocr_nom_match && payload.ocr_num_piece_match)
                    ? (languageStore.isEn() ? 'Documents verified. Data matches the information provided.' : 'Documents analysés. Les informations correspondent aux pièces fournies.')
                    : (languageStore.isEn() ? 'Discrepancies detected. Manual review will be performed by compliance if needed.' : 'Des non-concordances ont été relevées. Une revue manuelle sera opérée par la conformité si nécessaire.')
                  }}
                </p>
              </div>
            </div>
            <button
              type="button"
              @click="openConcordanceModalAndStart"
              class="text-[10px] font-bold text-primary hover:underline shrink-0 flex items-center gap-1 pt-1 cursor-pointer"
            >
              <RefreshCw class="w-3 h-3" />
              {{ languageStore.isEn() ? 'Re-analyze' : 'Réanalyser' }}
            </button>
          </div>

          <!-- Puces récapitulatives des points de contrôle : Vert si correct, Rouge si non correct -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <!-- Nom / Prénom -->
            <div class="p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all"
              :class="payload.ocr_nom_match ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm' : 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'">
              <CheckCircle2 v-if="payload.ocr_nom_match" class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <XCircle v-else class="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span class="truncate">
                {{ payload.ocr_nom_match 
                  ? (languageStore.isEn() ? 'Name Match' : 'Nom concordant') 
                  : (languageStore.isEn() ? 'Name Mismatch' : 'Nom non concordant') 
                }}
              </span>
            </div>

            <!-- N° Pièce -->
            <div class="p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all"
              :class="payload.ocr_num_piece_match ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm' : 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'">
              <CheckCircle2 v-if="payload.ocr_num_piece_match" class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <XCircle v-else class="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span class="truncate">
                {{ payload.ocr_num_piece_match 
                  ? (languageStore.isEn() ? 'ID Number Match' : 'N° pièce concordant') 
                  : (languageStore.isEn() ? 'ID Number Mismatch' : 'N° pièce non concordant') 
                }}
              </span>
            </div>

            <!-- Validité / Expiration -->
            <div class="p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all"
              :class="payload.ocr_expiration_match ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm' : 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'">
              <CheckCircle2 v-if="payload.ocr_expiration_match" class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <XCircle v-else class="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span class="truncate">
                {{ payload.ocr_expiration_match 
                  ? (languageStore.isEn() ? 'Validity Confirmed' : 'Validité confirmée') 
                  : (languageStore.isEn() ? 'Validity Unconfirmed' : 'Validité non confirmée') 
                }}
              </span>
            </div>

            <!-- Biométrie faciale -->
            <div class="p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all"
              :class="payload.face_verified ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm' : 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'">
              <CheckCircle2 v-if="payload.face_verified" class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <XCircle v-else class="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span class="truncate">
                {{ payload.face_verified 
                  ? (languageStore.isEn() ? 'Facial Match' : 'Visage certifié') 
                  : (languageStore.isEn() ? 'Face Unconfirmed' : 'Visage non certifié') 
                }}
              </span>
            </div>
          </div>

          <!-- Note bienveillante conformité CEMAC -->
          <p class="text-[10px] text-slate-400 leading-relaxed italic">
            {{ languageStore.isEn()
              ? 'Our compliance officers will finalize the validation of your documents during file review.'
              : 'Conformément aux directives COSUMAF, nos officiers de conformité valideront l’exactitude de vos pièces lors de l’examen final de votre dossier.'
            }}
          </p>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">{{ languageStore.isEn() ? 'Occupation' : 'Profession' }}</h4>
          
          <div class="space-y-4">
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Profession (Optional)' : 'Profession (Optionnel)' }}</label>
              <input v-model="payload.profession" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Employer (Optional)' : 'Employeur (Optionnel)' }}</label>
              <input v-model="payload.employeur" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
          </div>
        </div>
      </div>

      <!-- STRICT IDENTITY VERIFICATION -->
      <div v-else-if="currentStep === 'identity'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">{{ languageStore.isEn() ? 'Step 2 of 5' : 'Étape 2 sur 5' }}</span>
          <h3 class="text-xl font-black text-slate-900">{{ languageStore.isEn() ? 'Strict Identity Verification' : 'Vérification stricte de l’identité' }}</h3>
          <p class="text-slate-500 text-xs font-medium">{{ languageStore.isEn() ? 'Document check, facial matching and liveness detection.' : 'Contrôle du document, correspondance faciale et détection de présence réelle.' }}</p>
        </div>

        <section class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5 text-left">
          <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck class="w-7 h-7" />
          </div>

          <div class="space-y-2">
            <h4 class="font-black text-slate-900">{{ languageStore.isEn() ? 'Secure verification by specialized partner' : 'Contrôle sécurisé par un prestataire spécialisé' }}</h4>
            <p class="text-xs text-slate-500 leading-relaxed">
              {{ languageStore.isEn() ? 'Your ID document and facial images are captured in the partner’s secure session. PEK does not store them in the browser, public URLs, or emails.' : 'Les images de votre pièce et de votre visage sont capturées dans la session sécurisée du prestataire. PEK ne les place ni dans le navigateur, ni dans une URL publique, ni dans ses e-mails.' }}
            </p>
          </div>

          <div class="bg-slate-50 rounded-2xl p-4 text-[11px] text-slate-600 leading-relaxed space-y-2">
            <p>{{ languageStore.isEn() ? '• Partner keys remain exclusively on the PEK server.' : '• Les clés du prestataire restent exclusivement sur le serveur PEK.' }}</p>
            <p>{{ languageStore.isEn() ? '• PEK only stores an opaque reference, final status and control flags.' : '• PEK conserve seulement une référence opaque, le statut final et des indicateurs de contrôle.' }}</p>
            <p>{{ languageStore.isEn() ? '• Any subsequent changes to your identity data will invalidate verification and require re-checking.' : '• Toute modification ultérieure de vos données d’identité invalide le contrôle et impose une nouvelle vérification.' }}</p>
          </div>

          <div v-if="identityVerification?.verified" class="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl p-4 text-xs font-bold flex items-center gap-3">
            <CheckCircle2 class="w-5 h-5 shrink-0" />
            {{ languageStore.isEn() ? 'Identity verified and linked to this file.' : 'Identité vérifiée et liée aux informations de ce dossier.' }}
          </div>
          <div v-else-if="identityVerification?.status === 'reviewing' || identityVerification?.status === 'pending'" class="bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl p-4 text-xs font-bold flex items-center gap-3">
            <Loader2 class="w-5 h-5 shrink-0 animate-spin" />
            {{ languageStore.isEn() ? 'Verification received, review in progress. Refresh status in a few moments.' : 'Vérification reçue, examen en cours. Actualisez le statut dans quelques instants.' }}
          </div>
          <div v-else-if="identityVerification && ['denied', 'suspected', 'expired', 'error'].includes(identityVerification.status)" class="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl p-4 text-xs font-bold flex items-center gap-3">
            <AlertCircle class="w-5 h-5 shrink-0" />
            {{ languageStore.isEn() ? 'Verification was not approved. You can start a new session.' : 'Le contrôle n’a pas été approuvé. Vous pouvez lancer une nouvelle session.' }}
          </div>

          <button
            v-if="!identityVerification?.verified"
            type="button"
            @click="startIdentityVerification"
            :disabled="identityLoading"
            class="w-full bg-primary text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:bg-slate-300"
          >
            <Loader2 v-if="identityLoading" class="w-5 h-5 animate-spin" />
            <ShieldCheck v-else class="w-5 h-5" />
            {{ languageStore.isEn() ? 'Start Identity Verification' : 'Démarrer le contrôle d’identité' }}
          </button>

          <button
            type="button"
            @click="refreshIdentityStatus"
            :disabled="identityLoading"
            class="w-full bg-slate-100 text-slate-700 font-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw :class="identityLoading ? 'animate-spin' : ''" class="w-4 h-4" />
            {{ languageStore.isEn() ? 'Refresh Status' : 'Actualiser le statut' }}
          </button>
        </section>
      </div>

      <!-- RISK PROFILER -->
      <div v-else-if="currentStep === 'risk'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">{{ languageStore.isEn() ? 'Step ' + (identityRequired ? 3 : 2) + ' of ' + (identityRequired ? 5 : 4) : 'Étape ' + (identityRequired ? 3 : 2) + ' sur ' + (identityRequired ? 5 : 4) }}</span>
          <h3 class="text-xl font-black text-slate-900">{{ languageStore.isEn() ? 'Investor Profile' : 'Profil d\'Investissement' }}</h3>
          <p class="text-slate-500 text-xs font-medium">{{ languageStore.isEn() ? 'Determine your goals and assess your risk tolerance.' : 'Déterminez vos objectifs et évaluez votre tolérance au risque.' }}</p>
        </div>

        <!-- Dynamic Live Score Card -->
        <div class="bg-primary text-white p-6 rounded-[32px] shadow-lg shadow-primary/15 space-y-3 text-left">
          <div class="space-y-1">
            <span class="text-white/70 text-[10px] font-black uppercase tracking-widest">{{ languageStore.isEn() ? 'Locally Estimated Profile' : 'Profil Estimé localement' }}</span>
            <h4 class="text-2xl font-black text-white leading-none">{{ localProfile }}</h4>
          </div>
        </div>

        <!-- Questionnaire qBlocks -->
        <div class="space-y-6">
          
          <!-- Q1: Revenus -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">{{ languageStore.isEn() ? '1. What is your annual income bracket?' : '1. Quelle est votre tranche de revenus annuels ?' }}</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.tranche_revenus = 'moins_500k'; payload.revenus_annuels = 'moins_5m'" :class="payload.tranche_revenus === 'moins_500k' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Under 500,000 FCFA' : 'Moins de 500 000 FCFA' }}</button>
              <button type="button" @click="payload.tranche_revenus = '500k_1_5m'; payload.revenus_annuels = '5m_15m'" :class="payload.tranche_revenus === '500k_1_5m' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? '500,000 to 1,500,000 FCFA' : 'De 500 000 à 1 500 000 FCFA' }}</button>
              <button type="button" @click="payload.tranche_revenus = 'plus_1_5m'; payload.revenus_annuels = 'plus_15m'" :class="payload.tranche_revenus === 'plus_1_5m' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Over 1,500,000 FCFA' : 'Plus de 1 500 000 FCFA' }}</button>
            </div>
          </div>

          <!-- Q2: Epargne régulière -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">{{ languageStore.isEn() ? '2. Do you have a regular residual savings capacity?' : '2. Avez-vous une capacité d\'épargne résiduelle régulière ?' }}</h4>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" @click="payload.epargne_possible = 'Oui'" :class="payload.epargne_possible === 'Oui' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">{{ languageStore.isEn() ? 'Yes' : 'Oui' }}</button>
              <button type="button" @click="payload.epargne_possible = 'Non'" :class="payload.epargne_possible === 'Non' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">{{ languageStore.isEn() ? 'No' : 'Non' }}</button>
            </div>
          </div>

          <!-- Q3: Niveau de risque accepté -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">{{ languageStore.isEn() ? '3. What level of risk do you accept on your investments?' : '3. Quel niveau de risque acceptez-vous sur vos placements ?' }}</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.niveau_risque = 'faible'" :class="payload.niveau_risque === 'faible' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Low (preservation priority)' : 'Faible (préservation prioritaire)' }}</button>
              <button type="button" @click="payload.niveau_risque = 'moyen'" :class="payload.niveau_risque === 'moyen' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Medium (balanced yield/fluctuation)' : 'Moyen (équilibre rendement/fluctuation)' }}</button>
              <button type="button" @click="payload.niveau_risque = 'max'" :class="payload.niveau_risque === 'max' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Maximum (seeking maximum growth)' : 'Maximum (recherche de croissance à tout prix)' }}</button>
            </div>
          </div>

          <!-- Q4: Conscience risque -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">{{ languageStore.isEn() ? '4. Are you aware that a high potential return comes with a high risk of capital loss?' : '4. Êtes-vous conscient qu\'un rendement potentiel élevé s\'accompagne d\'un risque élevé de perte en capital ?' }}</h4>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" @click="payload.conscience_risque = 'Oui'" :class="payload.conscience_risque === 'Oui' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">{{ languageStore.isEn() ? 'Yes' : 'Oui' }}</button>
              <button type="button" @click="payload.conscience_risque = 'Non'" :class="payload.conscience_risque === 'Non' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">{{ languageStore.isEn() ? 'No' : 'Non' }}</button>
            </div>
          </div>

          <!-- Q5: Objectif investissement -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">{{ languageStore.isEn() ? '5. What is your main investment objective?' : '5. Quel est votre objectif principal d\'investissement ?' }}</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.objectif_invest = 'securite'" :class="payload.objectif_invest === 'securite' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Secure precautionary emergency savings' : 'Sécuriser une épargne de précaution' }}</button>
              <button type="button" @click="payload.objectif_invest = 'equilibre'" :class="payload.objectif_invest === 'equilibre' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Balance wealth between security and growth' : 'Équilibrer mon patrimoine entre sécurité et croissance' }}</button>
              <button type="button" @click="payload.objectif_invest = 'croissance'" :class="payload.objectif_invest === 'croissance' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Grow my capital over the long term' : 'Faire fructifier mon capital à long terme' }}</button>
            </div>
          </div>

          <!-- Q6: Horizon de placement -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">{{ languageStore.isEn() ? '6. What is the horizon / duration of your investment?' : '6. Quelle est la durée (horizon) de votre placement ?' }}</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.horizon_terme = 'court_terme'" :class="payload.horizon_terme === 'court_terme' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Short term - Under 2 years' : 'Court terme - Moins de 2 ans' }}</button>
              <button type="button" @click="payload.horizon_terme = 'moyen_terme'" :class="payload.horizon_terme === 'moyen_terme' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Medium term - 2 to 5 years' : 'Moyen terme - De 2 à 5 ans' }}</button>
              <button type="button" @click="payload.horizon_terme = 'long_terme'" :class="payload.horizon_terme === 'long_terme' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Long term - Over 5 years' : 'Long terme - Plus de 5 ans' }}</button>
            </div>
          </div>

          <!-- Q7: Performance ciblée -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">{{ languageStore.isEn() ? '7. What return do you target, given the associated risks?' : '7. Quelle performance ciblez-vous, sachant les risques induits ?' }}</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.niveau_perf = '1'" :class="payload.niveau_perf === '1' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Steady return, zero / very low loss risk' : 'Rendement régulier, risque de perte nul/très faible' }}</button>
              <button type="button" @click="payload.niveau_perf = 'moderee'" :class="payload.niveau_perf === 'moderee' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Balanced return, slight fluctuations accepted' : 'Rendement équilibré, fluctuations légères acceptées' }}</button>
              <button type="button" @click="payload.niveau_perf = 'elevee'" :class="payload.niveau_perf === 'elevee' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'High growth, large fluctuations accepted' : 'Forte appréciation, fortes fluctuations acceptées' }}</button>
            </div>
          </div>

          <!-- Q8: Connaissance des marchés -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">{{ languageStore.isEn() ? '8. How would you rate your knowledge of financial markets?' : '8. Comment évaluez-vous votre connaissance des marchés financiers ?' }}</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.connaissance_marche = 'nulle'" :class="payload.connaissance_marche === 'nulle' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Low or none' : 'Faible ou inexistante' }}</button>
              <button type="button" @click="payload.connaissance_marche = 'moyenne'" :class="payload.connaissance_marche === 'moyenne' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Average - I know the concept of investment funds' : 'Moyenne - Je connais le concept des fonds d\'investissement' }}</button>
              <button type="button" @click="payload.connaissance_marche = 'excellente'" :class="payload.connaissance_marche === 'excellente' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">{{ languageStore.isEn() ? 'Excellent - I actively trade securities' : 'Excellente - J\'achète activement des valeurs mobilières' }}</button>
            </div>
          </div>

          <!-- Q9: Investissements antérieurs -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">{{ languageStore.isEn() ? '9. Have you previously made financial investments?' : '9. Avez-vous déjà réalisé des investissements financiers dans le passé ?' }}</h4>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" @click="payload.invest_anterieurs = 'Oui'" :class="payload.invest_anterieurs === 'Oui' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">{{ languageStore.isEn() ? 'Yes' : 'Oui' }}</button>
              <button type="button" @click="payload.invest_anterieurs = 'Non'" :class="payload.invest_anterieurs === 'Non' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">{{ languageStore.isEn() ? 'No' : 'Non' }}</button>
            </div>
          </div>

        </div>
      </div>

      <!-- STEP 3: LAB/FT COMPLIANCE -->
      <div v-else-if="currentStep === 'labft'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">{{ languageStore.isEn() ? 'Step ' + (identityRequired ? 4 : 3) + ' of ' + (identityRequired ? 5 : 4) : 'Étape ' + (identityRequired ? 4 : 3) + ' sur ' + (identityRequired ? 5 : 4) }}</span>
          <h3 class="text-xl font-black text-slate-900">{{ languageStore.isEn() ? 'AML/CFT Compliance' : 'Conformité LAB-FT' }}</h3>
          <p class="text-slate-500 text-xs font-medium">{{ languageStore.isEn() ? 'Regulatory declarations for COBAC compliance.' : 'Déclarations réglementaires de conformité COBAC.' }}</p>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">{{ languageStore.isEn() ? 'Economic Profile' : 'Profil Économique' }}</h4>
          
          <!-- Secteur d'Activité -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Activity Sector *' : 'Secteur d\'Activité *' }}</label>
            <select v-model="selectedSecteur" @change="onSecteurChange" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.secteur ? 'true' : 'false'" :aria-describedby="validationErrors.secteur ? 'secteur-error' : null">
              <option value="" disabled>{{ languageStore.isEn() ? 'Select your activity sector' : 'Sélectionnez votre secteur d\'activité' }}</option>
              <option v-for="sec in popularSectors" :key="sec" :value="sec">{{ formatSector(sec) }}</option>
            </select>
            
            <div v-if="selectedSecteur === 'Autre'" class="mt-2 animate-in fade-in duration-200">
              <input v-model="customSecteur" @input="onCustomSecteurInput" type="text" :placeholder="languageStore.isEn() ? 'Specify your activity sector...' : 'Précisez votre secteur d\'activité...'" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
            
            <p v-if="validationErrors.secteur" id="secteur-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.secteur }}
            </p>
          </div>

          <!-- Sources de revenus -->
          <div class="space-y-3 text-left">
            <div class="flex items-center justify-between pl-1">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest">{{ languageStore.isEn() ? 'Income Sources *' : 'Sources des Revenus *' }}</label>
              <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{{ languageStore.isEn() ? 'Multiple selection' : 'Sélection multiple' }}</span>
            </div>
            
            <div class="grid grid-cols-2 gap-2.5">
              <button
                v-for="item in availableIncomeSources"
                :key="item.key"
                type="button"
                @click="toggleSource(item.key)"
                :class="payload[item.key] ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'"
                class="p-3.5 rounded-2xl border text-left text-xs font-bold transition-all flex items-center justify-between gap-2"
              >
                <span class="leading-tight">{{ formatIncomeSourceLabel(item.key) || item.label }}</span>
                <span v-if="payload[item.key]" class="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px] shrink-0 font-black">✓</span>
                <span v-else class="w-4 h-4 rounded-full border border-slate-300 shrink-0"></span>
              </button>
            </div>
            
            <div v-if="payload.src_autre_check" class="mt-2 space-y-1 animate-in fade-in duration-200">
              <input v-model="payload.src_autre" @input="syncOrigineFonds" type="text" :placeholder="languageStore.isEn() ? 'Specify income source...' : 'Précisez la source de revenu...'" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>

            <p v-if="validationErrors.sources_revenu" id="sources_revenu-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.sources_revenu }}
            </p>
          </div>

          <!-- Origine des fonds à investir (Déduite automatiquement) -->
          <div v-if="payload.origine_fonds || isEditingOrigine" class="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 text-left animate-in fade-in duration-200">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">{{ languageStore.isEn() ? 'Origin of funds to invest:' : 'Origine des fonds à investir :' }}</span>
              <button type="button" @click="toggleEditOrigine" class="text-[11px] font-black text-primary hover:underline">
                {{ isEditingOrigine ? (languageStore.isEn() ? 'Done' : 'Terminé') : (languageStore.isEn() ? 'Customize' : 'Personnaliser') }}
              </button>
            </div>
            <p v-if="!isEditingOrigine" class="text-xs font-bold text-slate-800 leading-snug">
              {{ payload.origine_fonds }}
            </p>
            <div v-else class="space-y-1.5 pt-1">
              <input v-model="payload.origine_fonds" @input="clearError('origine_fonds')" type="text" :placeholder="languageStore.isEn() ? 'Ex: Salary savings...' : 'Ex: Épargne salariale...'" class="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 focus:border-primary outline-none">
              <p class="text-[10px] text-slate-400 font-medium">{{ languageStore.isEn() ? 'Automatically deduced from your selected sources above.' : 'Déduit automatiquement d\'après vos sources sélectionnées ci-dessus.' }}</p>
            </div>
            <p v-if="validationErrors.origine_fonds" id="origine_fonds-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.origine_fonds }}
            </p>
          </div>
        </div>



        <!-- LAB-FT Specific Risk Indicators -->
        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">{{ languageStore.isEn() ? 'Risk Declarations' : 'Déclarations de Risques' }}</h4>
          
          <!-- PPE -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Are you a Politically Exposed Person (PEP)? *' : 'Êtes-vous une Personne Politiquement Exposée (PPE) ? *' }}</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.ppe = 'Oui'; clearError('ppe')" :class="payload.ppe === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">{{ languageStore.isEn() ? 'Yes' : 'Oui' }}</button>
              <button type="button" @click="payload.ppe = 'Non'; clearError('ppe')" :class="payload.ppe === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">{{ languageStore.isEn() ? 'No' : 'Non' }}</button>
            </div>
            
            <div v-if="payload.ppe === 'Oui'" class="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-300">
              <label class="text-[10px] font-black text-slate-400 uppercase pl-1">{{ languageStore.isEn() ? 'Specify your public office / mandate *' : 'Précisez votre fonction publique / mandat *' }}</label>
              <input v-model="payload.ppe_detail" @blur="clearError('ppe')" @input="clearError('ppe')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.ppe ? 'true' : 'false'" :aria-describedby="validationErrors.ppe ? 'ppe-error' : null">
              <p v-if="validationErrors.ppe" id="ppe-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.ppe }}
              </p>
            </div>
          </div>

          <!-- Pays à risque -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Is your bank account or residence located in a high-risk or sanctioned country? *' : 'Votre compte bancaire ou résidence est-il situé dans un pays sous sanctions ou à haut risque ? *' }}</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.pays_risque = 'Oui'" :class="payload.pays_risque === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">{{ languageStore.isEn() ? 'Yes' : 'Oui' }}</button>
              <button type="button" @click="payload.pays_risque = 'Non'" :class="payload.pays_risque === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">{{ languageStore.isEn() ? 'No' : 'Non' }}</button>
            </div>
          </div>

          <!-- Secteur sensible -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Do your funds come from a sensitive sector (e.g. weaponry, mining, gambling)? *' : 'Vos fonds proviennent-ils d\'un secteur sensible (ex: armement, minier, jeux d\'argent) ? *' }}</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.secteur_sensible = 'Oui'" :class="payload.secteur_sensible === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">{{ languageStore.isEn() ? 'Yes' : 'Oui' }}</button>
              <button type="button" @click="payload.secteur_sensible = 'Non'" :class="payload.secteur_sensible === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">{{ languageStore.isEn() ? 'No' : 'Non' }}</button>
            </div>
          </div>

          <!-- Condamnation -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Have you been subject to a past conviction related to money laundering or terrorism? *' : 'Avez-vous fait l\'objet d\'une condamnation passée liée au blanchiment ou au terrorisme ? *' }}</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.condamnation = 'Oui'" :class="payload.condamnation === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">{{ languageStore.isEn() ? 'Yes' : 'Oui' }}</button>
              <button type="button" @click="payload.condamnation = 'Non'" :class="payload.condamnation === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">{{ languageStore.isEn() ? 'No' : 'Non' }}</button>
            </div>
          </div>
        </div>

        <!-- Consentements -->
        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4 text-left">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">{{ languageStore.isEn() ? 'Regulatory Consents' : 'Consentements réglementaires' }}</h4>
          
          <label class="flex items-start gap-3 text-xs font-bold text-slate-700 leading-normal">
            <input v-model="payload.ack_lecture" type="checkbox" @change="clearError('consent')" class="w-4 h-4 text-primary rounded border-slate-300 mt-0.5">
            <span>{{ languageStore.isEn() ? 'I declare having read the general regulations and conditions of Kori Asset Management. *' : 'Je declare avoir pris connaissance des règlements généraux et conditions de Kori Asset Management. *' }}</span>
          </label>

          <label class="flex items-start gap-3 text-xs font-bold text-slate-700 leading-normal">
            <input v-model="payload.ack_donnees" type="checkbox" @change="clearError('consent')" class="w-4 h-4 text-primary rounded border-slate-300 mt-0.5">
            <span>{{ languageStore.isEn() ? 'I authorize KORI Asset Management to securely retain and process my personal data and supporting documents in accordance with regulatory compliance (AML/CFT). *' : 'J\'autorise KORI Asset Management à conserver et traiter de manière sécurisée l\'ensemble de mes informations et pièces justificatives dans le cadre de la conformité réglementaire (LAB/FT). *' }}</span>
          </label>
          <p v-if="validationErrors.consent" id="consent-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.consent }}
          </p>
        </div>
      </div>

      <!-- STEP 4: ELECTRONIC SIGNATURE -->
      <div v-else-if="currentStep === 'signature'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">{{ languageStore.isEn() ? 'Step ' + (identityRequired ? 5 : 4) + ' of ' + (identityRequired ? 5 : 4) : 'Étape ' + (identityRequired ? 5 : 4) + ' sur ' + (identityRequired ? 5 : 4) }}</span>
          <h3 class="text-xl font-black text-slate-900">{{ languageStore.isEn() ? 'Electronic Signature' : 'Signature Électronique' }}</h3>
          <p class="text-slate-500 text-xs font-medium">{{ languageStore.isEn() ? 'Draw your signature in the box below to finalize.' : 'Dessinez votre signature dans le cadre ci-dessous pour finaliser.' }}</p>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4 text-left">
         

          <div class="flex justify-between items-center border-b border-slate-100 pb-3">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{{ languageStore.isEn() ? 'Signature trace *' : 'Tracé de signature *' }}</label>
            <button type="button" @click="clearSignature" class="text-[10px] font-black text-rose-500 uppercase hover:text-rose-600 transition-colors">{{ languageStore.isEn() ? 'Clear' : 'Effacer' }}</button>
          </div>

          <div class="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden relative" style="height: 152px;">
            <canvas ref="canvasRef" class="w-full h-full block cursor-crosshair"></canvas>
            <div v-if="!hasSigned" class="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-bold select-none">
              {{ languageStore.isEn() ? 'Sign here with your finger or stylus' : 'Signez ici avec votre doigt ou stylet' }}
            </div>
          </div> 
          <!-- Legal confirmation statement checkbox -->
          <div class="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <label class="flex items-start gap-3 cursor-pointer select-none">
              <input v-model="signatureConfirmed" type="checkbox" class="w-5 h-5 text-primary rounded border-slate-300 mt-0.5 focus:ring-primary cursor-pointer shrink-0">
              <span class="text-slate-700 text-xs font-bold leading-normal">
                {{ languageStore.isEn() ? 'I declare having read the information document and the management regulations of the KORI SERENITE mutual fund *' : 'Je déclare avoir pris connaissance du document d\'information et du règlement de gestion du fonds commun de placement KORI SERENITE *' }}
              </span>
            </label>
          </div>

          <!-- Data retention confirmation statement checkbox -->
          <div class="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <label class="flex items-start gap-3 cursor-pointer select-none">
              <input v-model="dataRetentionConfirmed" type="checkbox" class="w-5 h-5 text-primary rounded border-slate-300 mt-0.5 focus:ring-primary cursor-pointer shrink-0">
              <span class="text-slate-700 text-xs font-bold leading-normal">
                {{ languageStore.isEn() 
                  ? 'I authorize KORI Asset Management to retain all my personal data and identity documents in compliance with applicable laws and privacy policy. *' 
                  : 'J\'autorise KORI Asset Management à conserver l\'ensemble de mes informations personnelles et pièces d\'identité dans le strict respect de la réglementation en vigueur et de sa politique de confidentialité. *' }}
              </span>
            </label>
          </div>

          <!-- <div class="flex items-start gap-2 bg-blue-50 text-blue-900 p-4 rounded-2xl border border-blue-100/50 text-[10px] font-bold mt-2">
            <span>Conformément à la Loi n°2010/012 du Cameroun sur le commerce électronique, cette signature numérique apposée à vos fiches contractuelles fait foi de votre consentement réglementaire.</span>
          </div> -->
        </div>

        <p v-if="signatureError" class="text-rose-500 text-xs font-bold pl-2 flex items-center gap-1.5"><AlertCircle class="w-4 h-4" /> {{ signatureError }}</p>
      </div>

      <!-- COMPLETED SCREEN -->
      <div v-else-if="currentStep === 'completed'" class="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <!-- Icône selon le statut -->
        <div 
          :class="onboardingSessionStatus === 'validated' ? 'bg-emerald-50' : onboardingSessionStatus === 'rejected' ? 'bg-amber-50' : 'bg-blue-50'"
          class="w-20 h-20 rounded-full flex items-center justify-center"
        >
          <CheckCircle2 v-if="onboardingSessionStatus === 'validated'" class="w-10 h-10 text-emerald-500" />
          <AlertCircle v-else-if="onboardingSessionStatus === 'rejected'" class="w-10 h-10 text-amber-500" />
          <Clock v-else class="w-10 h-10 text-blue-500" />
        </div>
        
        <div class="space-y-2">
          <h2 class="text-2xl font-black text-slate-900">
            {{ onboardingSessionStatus === 'validated' ? (languageStore.isEn() ? 'Account Activated!' : 'Compte Activé !') : onboardingSessionStatus === 'rejected' ? (languageStore.isEn() ? 'File needs correction' : 'Dossier à corriger') : (languageStore.isEn() ? 'File Submitted!' : 'Dossier Soumis !') }}
          </h2>
          <p class="text-slate-500 text-xs leading-relaxed max-w-[280px] mx-auto font-medium">
            <template v-if="onboardingSessionStatus === 'validated'">
              {{ languageStore.isEn() ? 'Congratulations! Your account is activated. You can now subscribe to our investment funds.' : 'Félicitations ! Votre compte est activé. Vous pouvez désormais souscrire à nos fonds d\'investissement.' }}
            </template>
            <template v-else-if="onboardingSessionStatus === 'rejected'">
              {{ languageStore.isEn() ? 'Our team identified items needing correction. Please update your file and submit it again.' : 'Notre équipe a relevé des éléments à corriger. Modifiez votre dossier et soumettez-le à nouveau.' }}
            </template>
            <template v-else>
              {{ languageStore.isEn() ? 'Your file has been submitted to the Kori compliance team for review. You will be notified upon approval.' : 'Votre dossier a été transmis à l\'équipe de conformité Kori pour examen. Vous serez notifié dès sa validation.' }}
            </template>
          </p>
        </div>

        <div class="w-full bg-[#FAF6F0] rounded-3xl p-6 space-y-3 border border-[#E8B010]/20 text-left shadow-2xs">
          <div class="flex justify-between items-center text-xs">
            <span class="text-[#8C7A70] font-black uppercase tracking-wider text-[10px]">{{ languageStore.isEn() ? 'Determined profile' : 'Profil déterminé' }}</span>
            <span class="text-[#3A190C] font-black">{{ localProfile }}</span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-[#8C7A70] font-black uppercase tracking-wider text-[10px]">{{ languageStore.isEn() ? 'File Status' : 'Statut Dossier' }}</span>
            <span 
              :class="{
                'bg-emerald-100 text-emerald-800 border border-emerald-200': onboardingSessionStatus === 'validated',
                'bg-rose-100 text-rose-800 border border-rose-200': onboardingSessionStatus === 'rejected',
                'bg-[#E8B010]/15 text-[#482010] border border-[#E8B010]/40': !['validated','rejected'].includes(onboardingSessionStatus)
              }"
              class="px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-2xs"
            >
              {{ onboardingSessionStatus === 'validated' ? (languageStore.isEn() ? '✓ Validated' : '✓ Validé') : onboardingSessionStatus === 'rejected' ? (languageStore.isEn() ? '⚠ Corrections required' : '⚠ Corrections requises') : (languageStore.isEn() ? 'Under review' : 'En cours d\'étude') }}
            </span>
          </div>
          <div v-if="onboardingSessionStatus !== 'validated'" class="flex items-start gap-2 pt-2 border-t border-[#E8B010]/15">
            <span class="text-[10px] text-[#78655B] font-semibold leading-relaxed">
              {{ languageStore.isEn() ? '💡 You can update or correct your information and documents as long as your file is not yet validated.' : '💡 Vous pouvez compléter ou corriger vos informations et documents tant que votre dossier n\'est pas validé.' }}
            </span>
          </div>
        </div>

        <!-- Section complément d'information pour dossier validé ou soumis sans catégorie -->
        <div v-if="serverNeedsCategory || (!authStore.user?.categorie_client && !payload.categorie_client) || missingCategorySuccess" class="w-full bg-white rounded-3xl p-6 space-y-4 border border-amber-200 shadow-lg text-left animate-in fade-in duration-300">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
              <UserCheck class="w-5 h-5" />
            </div>
            <div>
              <h4 class="text-xs font-black uppercase tracking-wider text-slate-900">{{ languageStore.isEn() ? 'Regulatory complement required' : 'Complément réglementaire requis' }}</h4>
              <p class="text-[10px] text-slate-500 font-bold">{{ languageStore.isEn() ? 'Investor category for your subscription bulletins' : 'Catégorie d\'investisseur pour vos bulletins de souscription' }}</p>
            </div>
          </div>

          <div v-if="missingCategorySuccess" class="bg-emerald-50 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border border-emerald-200">
            <CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{{ languageStore.isEn() ? 'Your category has been recorded: ' : 'Votre catégorie a bien été enregistrée : ' }}{{ missingCategoryValue }}</span>
          </div>

          <div v-else class="space-y-3">
            <p class="text-slate-600 text-xs leading-relaxed font-medium">
              {{ languageStore.isEn() ? 'Your file is already approved. You do not need to resubmit your documents. Please specify your client category:' : 'Votre dossier est déjà validé. Vous n\'avez pas besoin de soumettre à nouveau vos pièces. Veuillez simplement préciser votre catégorie de client :' }}
            </p>
            <div class="relative">
              <select v-model="missingCategoryValue" class="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:border-primary outline-none transition-all appearance-none cursor-pointer">
                <option v-for="cat in availableClientCategories" :key="cat" :value="cat">{{ formatCategory(cat) }}</option>
              </select>
              <ChevronDown class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <button 
              type="button"
              @click="submitMissingCategory" 
              :disabled="updatingMissingCategory"
              class="w-full bg-primary hover:bg-slate-800 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Loader2 v-if="updatingMissingCategory" class="w-4 h-4 animate-spin" />
              <span>{{ languageStore.isEn() ? 'Save my category' : 'Enregistrer ma catégorie' }}</span>
            </button>
          </div>
        </div>

        <div class="w-full space-y-3 pt-2">
          <!-- Bouton Modifier — affiché tant que non validé -->
          <button 
            v-if="canEditDossier"
            @click="editDossier"
            :disabled="loading"
            class="w-full border-2 border-primary text-primary font-black py-4 rounded-3xl flex items-center justify-center gap-2 active:scale-95 transition-all text-sm uppercase tracking-wider hover:bg-primary/5"
          >
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
            <PenTool v-else class="w-4 h-4" />
            {{ languageStore.isEn() ? 'Modify my file' : 'Modifier mon dossier' }}
          </button>

          <button @click="router.push('/home')" class="w-full bg-primary text-white font-black py-4 rounded-3xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-sm uppercase tracking-wider">
            {{ languageStore.isEn() ? 'Back to Dashboard' : 'Retour au Tableau de Bord' }}
            <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>

    <!-- Sticky Navigation Buttons (Bottom) -->
    <div v-if="currentStep !== 'completed'" class="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 z-50 flex gap-4 max-width-container mx-auto">
      
      <!-- Back Button -->
      <button 
        v-if="currentStep !== 'kyc'"
        @click="prevStep"
        class="bg-slate-100 text-slate-600 font-black px-6 py-4.5 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider"
      >
        {{ languageStore.isEn() ? 'Back' : 'Retour' }}
      </button>

      <!-- Next / Submit Button -->
      <button 
        type="button"
        @click="currentStep === 'signature' ? submitOnboarding() : nextStep()"
        :disabled="submitting || stepLoading || verifyingKYC"
        class="flex-1 bg-primary text-white font-black py-4.5 rounded-2xl shadow-xl shadow-primary/35 active:scale-95 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-wider"
      >
        <Loader2 v-if="submitting || stepLoading || verifyingKYC" class="w-5 h-5 animate-spin text-white" />
        <span v-else>
          {{ currentStep === 'signature' ? (languageStore.isEn() ? 'Finalize and Sign' : 'Finaliser et Signer') : (languageStore.isEn() ? 'Next step' : 'Étape suivante') }}
        </span>
      </button>
    </div>

    <!-- Error Modal -->
    <Teleport to="body">
      <div v-if="showErrorModal" class="fixed inset-0 z-[10000] flex items-center justify-center p-6 animate-in fade-in duration-300">
        <!-- Dark backdrop -->
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" @click="showErrorModal = false"></div>
        
        <!-- Modal card -->
        <div class="relative bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          <button 
            type="button" 
            @click="showErrorModal = false" 
            class="absolute right-5 top-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            :aria-label="languageStore.isEn() ? 'Close' : 'Fermer'"
          >
            <X class="w-4 h-4" />
          </button>

          <div class="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
            <AlertCircle class="w-8 h-8" />
          </div>
          
          <div class="space-y-2">
            <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest">{{ modalErrorTitle }}</h3>
            <p class="text-slate-500 text-xs font-semibold leading-relaxed">
              {{ modalErrorMessage }}
            </p>
          </div>
          
          <button 
            @click="showErrorModal = false" 
            class="w-full bg-slate-950 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all"
          >
            {{ languageStore.isEn() ? 'Got it' : 'D\'accord' }}
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Camera Capture Modal -->
    <Teleport to="body">
      <div v-if="showCameraModal" class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div class="relative bg-white rounded-[32px] p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 flex flex-col items-center">
          <div class="w-full flex items-center justify-between">
            <h4 class="text-sm font-black text-slate-900">
              {{ activeCameraTarget === 'selfie_live' ? (languageStore.isEn() ? 'Take Selfie' : 'Prendre un selfie') : (languageStore.isEn() ? 'Capture Document' : 'Capturer le document') }}
            </h4>
            <button @click="closeCamera" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="relative w-full aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center">
            <Loader2 v-if="cameraLoading" class="w-8 h-8 text-white animate-spin" />
            <p v-if="cameraError" class="text-rose-400 text-xs text-center p-4 font-semibold">{{ cameraError }}</p>
            <video ref="cameraVideoRef" autoplay playsinline muted class="w-full h-full object-cover"></video>
          </div>

          <div class="w-full flex gap-3">
            <button type="button" @click="closeCamera" class="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase transition-colors">
              {{ languageStore.isEn() ? 'Cancel' : 'Annuler' }}
            </button>
            <button type="button" @click="capturePhoto" :disabled="cameraLoading || Boolean(cameraError)" class="flex-1 py-3 rounded-2xl bg-primary hover:bg-slate-800 text-white font-bold text-xs uppercase flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 disabled:bg-slate-300">
              <Camera class="w-4 h-4" />
              {{ languageStore.isEn() ? 'Capture' : 'Capturer' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal de vérification de concordance des documents -->
    <Teleport to="body">
      <div v-if="showConcordanceModal" class="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
        <!-- Backdrop -->
        <div 
          @click="verifyingKYC ? null : closeConcordanceModal()" 
          class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        ></div>

        <!-- Modal Card -->
        <div class="relative bg-white rounded-[32px] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 space-y-5 text-left z-10 animate-in zoom-in-95 duration-200">
          
          <!-- Close button (disabled during verification) -->
          <button 
            v-if="!verifyingKYC"
            type="button" 
            @click="closeConcordanceModal" 
            class="absolute right-5 top-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            :aria-label="languageStore.isEn() ? 'Close' : 'Fermer'"
          >
            <X class="w-4 h-4" />
          </button>

          <!-- Header -->
          <div class="flex items-start gap-3.5 pr-8">
            <!-- <div 
              class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
              :class="verifyingKYC ? 'bg-blue-50 text-blue-600 animate-pulse' : (payload.ocr_mrz_detected || (payload.ocr_nom_match && payload.ocr_num_piece_match) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')"
            >
              <Loader2 v-if="verifyingKYC" class="w-6 h-6 animate-spin text-primary" />
              <ShieldCheck v-else-if="payload.ocr_mrz_detected || (payload.ocr_nom_match && payload.ocr_num_piece_match)" class="w-6 h-6" />
              <ShieldAlert v-else class="w-6 h-6" />
            </div> -->
            <div>
              <span class="text-[10px] font-black uppercase tracking-widest text-primary">
                {{ verifyingKYC ? (languageStore.isEn() ? 'Automated Verification' : 'Vérification automatisée') : (languageStore.isEn() ? 'Analysis Completed' : 'Contrôle documentaire') }}
              </span>
              <h3 class="text-base font-black text-slate-900">
                {{ verifyingKYC 
                  ? (languageStore.isEn() ? 'Checking your documents...' : 'Vérification de vos pièces en cours...') 
                  : (languageStore.isEn() ? 'Consistency check completed' : 'Analyse des documents soumis') 
                }}
              </h3>
              <p class="text-xs text-slate-500 font-medium">
                {{ verifyingKYC 
                  ? (languageStore.isEn() ? 'AI OCR & biometric analysis of each document provided.' : 'Analyse OCR & biométrique des justificatifs fournis.') 
                  : (languageStore.isEn() ? 'Summary of the verification of the documents provided.' : 'Synthèse des analyses des documents fournis.') 
                }}
              </p>
            </div>
          </div>

          <!-- Document en cours d'analyse (Bannière vivante) -->
          <div v-if="verifyingKYC" class="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-2.5">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-blue-900 flex items-center gap-2">
                <Sparkles class="w-4 h-4 text-primary animate-pulse" />
                {{ languageStore.isEn() ? 'Document being verified:' : 'Document en cours d\'analyse :' }}
              </span>
              <span class="font-black text-primary px-2.5 py-0.5 rounded-full bg-white text-[10px] shadow-2xs">
                {{ verificationProgressPercent }}%
              </span>
            </div>
            <p class="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <span>📄</span> {{ currentActiveDocTitle }}
            </p>
            <p class="text-[11px] text-blue-700 font-medium leading-relaxed">
              {{ verificationStatusText }}
            </p>

            <!-- Global Progress Bar -->
            <div class="w-full bg-blue-100/60 h-2 rounded-full overflow-hidden">
              <div 
                :style="{ width: verificationProgressPercent + '%' }" 
                class="bg-primary h-full transition-all duration-300 rounded-full"
              ></div>
            </div>
          </div>

          <!-- Liste des documents avec suivi en direct -->
          <div class="space-y-2">
            <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">
              {{ languageStore.isEn() ? 'Documents & Status' : 'Pièces et état du contrôle' }}
            </h4>
            
            <div class="space-y-2">
              <div 
                v-for="step in concordanceSteps" 
                :key="step.key" 
                class="p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-left"
                :class="{
                  'border-blue-400 bg-blue-50/40 shadow-xs ring-1 ring-blue-300': step.status === 'running',
                  'border-emerald-200 bg-emerald-50/30': step.status === 'success',
                  'border-rose-200 bg-rose-50/30': step.status === 'error',
                  'border-slate-100 bg-slate-50/60': step.status === 'pending'
                }"
              >
                <div class="space-y-0.5 min-w-0">
                  <p class="text-xs font-black text-slate-900 truncate">
                    {{ step.title }}
                  </p>
                  <p class="text-[10px] text-slate-500 font-medium truncate">
                    {{ step.subtitle }}
                  </p>
                </div>

                <!-- Badge statut à droite -->
                <div class="shrink-0 flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider"
                  :class="{
                    'bg-blue-100 text-blue-800 border border-blue-200': step.status === 'running',
                    'bg-emerald-100 text-emerald-800 border border-emerald-200': step.status === 'success',
                    'bg-rose-100 text-rose-800 border border-rose-200': step.status === 'error',
                    'bg-slate-200 text-slate-600': step.status === 'pending'
                  }"
                >
                  <Loader2 v-if="step.status === 'running'" class="w-3 h-3 animate-spin text-blue-600" />
                  <CheckCircle2 v-else-if="step.status === 'success'" class="w-3 h-3 text-emerald-600" />
                  <XCircle v-else-if="step.status === 'error'" class="w-3 h-3 text-rose-600" />
                  <Clock v-else class="w-3 h-3 text-slate-400" />
                  <span>{{ step.statusLabel }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Résultat final et points de concordance (affiché quand terminé) -->
          <div v-if="verificationFinished" class="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in duration-300">
            <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">
              {{ languageStore.isEn() ? 'Consistency Summary' : 'Points de concordance vérifiés' }}
            </h4>

            <div class="grid grid-cols-2 gap-2">
              <!-- Nom & Prénom -->
              <div 
                class="p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5"
                :class="payload.ocr_nom_match ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'"
              >
                <CheckCircle2 v-if="payload.ocr_nom_match" class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <XCircle v-else class="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span class="truncate">
                  {{ payload.ocr_nom_match 
                    ? (languageStore.isEn() ? 'Name Match' : 'Nom concordant') 
                    : (languageStore.isEn() ? 'Name Mismatch' : 'Nom non concordant') 
                  }}
                </span>
              </div>

              <!-- Numéro de pièce -->
              <div 
                class="p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5"
                :class="payload.ocr_num_piece_match ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'"
              >
                <CheckCircle2 v-if="payload.ocr_num_piece_match" class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <XCircle v-else class="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span class="truncate">
                  {{ payload.ocr_num_piece_match 
                    ? (languageStore.isEn() ? 'ID Number Match' : 'N° pièce concordant') 
                    : (languageStore.isEn() ? 'ID Number Mismatch' : 'N° pièce non concordant') 
                  }}
                </span>
              </div>

              <!-- Validité temporelle -->
              <div 
                class="p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5"
                :class="payload.ocr_expiration_match ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'"
              >
                <CheckCircle2 v-if="payload.ocr_expiration_match" class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <XCircle v-else class="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span class="truncate">
                  {{ payload.ocr_expiration_match 
                    ? (languageStore.isEn() ? 'Validity Confirmed' : 'Validité confirmée') 
                    : (languageStore.isEn() ? 'Validity Unconfirmed' : 'Validité non confirmée') 
                  }}
                </span>
              </div>

              <!-- Biométrie faciale ou Bande MRZ -->
              <div 
                v-if="payload.piece_verso || payload.doc_piece_verso"
                class="p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5"
                :class="payload.ocr_mrz_detected ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'"
              >
                <CheckCircle2 v-if="payload.ocr_mrz_detected" class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <AlertCircle v-else class="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span class="truncate">
                  {{ payload.ocr_mrz_detected 
                    ? 'MRZ ICAO 9303' 
                    : (languageStore.isEn() ? 'Standard reverse' : 'Verso standard') 
                  }}
                </span>
              </div>

              <div 
                v-if="payload.selfie_live || payload.doc_photo"
                class="p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5"
                :class="payload.face_verified ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'"
              >
                <CheckCircle2 v-if="payload.face_verified" class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <AlertCircle v-else class="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span class="truncate">
                  {{ payload.face_verified 
                    ? (languageStore.isEn() ? 'Facial Match' : 'Visage certifié') 
                    : (languageStore.isEn() ? 'Manual Review' : 'Revue visage') 
                  }}
                </span>
              </div>
            </div>

            <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] text-slate-500 font-medium leading-relaxed">
              {{ languageStore.isEn() 
                ? 'Note: All non-concordant or unconfirmed items will be reviewed and validated manually by our compliance team before account activation.' 
                : 'Note réglementaire : Les éléments signalés comme non concordants feront l’objet d’un examen manuel bienveillant par notre équipe de conformité lors de la validation finale.' 
              }}
            </div>
          </div>

          <!-- Actions de la modale -->
          <div class="space-y-2 pt-2">
            <!-- Bouton quand en cours d'analyse -->
            <button 
              v-if="verifyingKYC"
              type="button"
              disabled
              class="w-full bg-slate-200 text-slate-500 font-black py-4 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <Loader2 class="w-4 h-4 animate-spin text-slate-500" />
              <span>{{ languageStore.isEn() ? 'Analyzing documents in progress...' : 'Analyse des documents en cours...' }}</span>
            </button>

            <!-- Boutons quand analyse terminée -->
            <template v-else-if="verificationFinished">
              <button 
                type="button"
                @click="continueToNextStepAfterModal"
                :disabled="stepLoading"
                class="w-full bg-primary hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Loader2 v-if="stepLoading" class="w-4 h-4 animate-spin text-white" />
                <template v-else>
                  <span>{{ languageStore.isEn() ? 'Continue to next step' : 'Passer à l\'étape suivante' }}</span>
                  <ArrowRight class="w-4 h-4" />
                </template>
              </button>

              <button 
                type="button"
                @click="closeConcordanceModal"
                class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all"
              >
                {{ languageStore.isEn() ? 'Review or modify documents' : 'Revoir ou modifier mes pièces' }}
              </button>
            </template>
          </div>

        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.max-width-container {
  max-width: 480px;
}
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
