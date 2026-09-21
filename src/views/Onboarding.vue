<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, User, ShieldCheck, HelpCircle, FileText, CheckCircle2, AlertCircle, PenTool, WifiOff, RefreshCw, Loader2, ArrowRight, Camera, Upload, Trash2, X } from 'lucide-vue-next'
import api from '../api/api'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'
import { compareFaces, verifyIDDocumentOCR } from '../services/kycVerification'
import LanguageSelector from '../components/LanguageSelector.vue'

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
        title: "Passeport — Page d'identité avec photo",
        hint: "Page principale du passeport avec photo, signature et bande MRZ",
        accept: 'image/*,.pdf',
        allowCamera: true,
        cameraTarget: 'piece_recto',
        required: false,
      }
    ]
  } else if (pieceType === 'Carte Résident') {
    idDocs = [
      {
        key: 'doc_piece_identite',
        title: "Titre de séjour — Recto (Face avant)",
        hint: "Face avant de la carte / titre de séjour avec photo",
        accept: 'image/*,.pdf',
        allowCamera: true,
        cameraTarget: 'piece_recto',
        required: false,
      },
      {
        key: 'doc_piece_verso',
        title: "Titre de séjour — Verso (Face arrière)",
        hint: "Face arrière de la carte / titre de séjour",
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
        title: "Permis de conduire — Recto (Face avant)",
        hint: "Face avant du permis de conduire avec photo",
        accept: 'image/*,.pdf',
        allowCamera: true,
        cameraTarget: 'piece_recto',
        required: false,
      },
      {
        key: 'doc_piece_verso',
        title: "Permis de conduire — Verso (Face arrière)",
        hint: "Face arrière du permis de conduire avec catégories",
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
        title: "CNI — Recto (Face avant avec photo)",
        hint: "Face avant de la Carte Nationale d'Identité",
        accept: 'image/*,.pdf',
        allowCamera: true,
        cameraTarget: 'piece_recto',
        required: false,
      },
      {
        key: 'doc_piece_verso',
        title: "CNI — Verso (Face arrière)",
        hint: "Face arrière de la Carte Nationale d'Identité avec bande MRZ",
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
      title: "Photo d'identité récente / Selfie",
      hint: "Photo nette de face ou prise directe par caméra",
      accept: 'image/*',
      allowCamera: true,
      cameraTarget: 'selfie_live',
      required: false,
    },
    {
      key: 'doc_justificatif_domicile',
      title: "Justificatif de domicile (< 3 mois)",
      hint: "Facture Eneo/Camtap, attestation de résidence ou relevé bancaire",
      accept: 'image/*,.pdf',
      allowCamera: false,
      required: false,
    },
    {
      key: 'doc_origine_fonds',
      title: "Justificatif d'origine des fonds",
      hint: "Fiche de paie, attestation d'employeur ou contrat de travail",
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
  if (targetField === 'doc_piece_identite') {
    payload.value.piece_recto = dataUrl
    clearError('piece_recto')
  } else if (targetField === 'piece_recto') {
    payload.value.doc_piece_identite = dataUrl
    clearError('doc_piece_identite')
  } else if (targetField === 'doc_piece_verso') {
    payload.value.piece_verso = dataUrl
    clearError('piece_verso')
  } else if (targetField === 'piece_verso') {
    payload.value.doc_piece_verso = dataUrl
    clearError('doc_piece_verso')
  } else if (targetField === 'doc_photo') {
    payload.value.selfie_live = dataUrl
    clearError('selfie_live')
  } else if (targetField === 'selfie_live') {
    payload.value.doc_photo = dataUrl
    clearError('doc_photo')
  }

  const hasID = payload.value.piece_recto || payload.value.doc_piece_identite
  const hasSelfie = payload.value.selfie_live || payload.value.doc_photo
  if (hasID && hasSelfie && !verifyingKYC.value) {
    executeKYCVerification()
  }
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

// KYC Biometric & OCR verification states
const verifyingKYC = ref(false)
const verificationStatusText = ref('')
const verificationFaceResult = ref(null)
const verificationOCRResult = ref(null)
const kycVerificationAttempted = ref(false)

const removeDocument = (targetField) => {
  payload.value[targetField] = ''
  if (targetField === 'piece_recto' || targetField === 'selfie_live') {
    verificationFaceResult.value = null
    verificationOCRResult.value = null
    kycVerificationAttempted.value = false
    payload.value.face_match_score = null
    payload.value.face_verified = false
    payload.value.ocr_score = null
  }
}

const executeKYCVerification = async () => {
  const recto = payload.value.piece_recto || payload.value.doc_piece_identite
  const selfie = payload.value.selfie_live || payload.value.doc_photo
  if (!recto) {
    triggerError("Pièce requise", "Veuillez téléverser votre pièce d'identité.")
    return false
  }
  if (!selfie) {
    triggerError("Photo requise", "Veuillez téléverser votre photo d'identité ou prendre un selfie.")
    return false
  }

  verifyingKYC.value = true
  kycVerificationAttempted.value = true
  verificationStatusText.value = "Initialisation de l'analyse biométrique..."

  try {
    // 1. Comparaison faciale (Pièce d'identité vs Selfie en direct)
    verificationStatusText.value = "Comparaison du visage de la pièce avec votre photo..."
    const faceRes = await compareFaces(recto, selfie)
    verificationFaceResult.value = faceRes
    payload.value.face_match_score = faceRes.score
    payload.value.face_verified = faceRes.success

    // 2. OCR text extraction & comparison (Nom, Prénom, Date de Naissance, N° de pièce)
    verificationStatusText.value = "Lecture des informations de la pièce (OCR)..."
    const ocrRes = await verifyIDDocumentOCR(
      recto,
      payload.value.piece_verso || null,
      {
        nom: payload.value.nom,
        prenom: payload.value.prenom,
        dob: payload.value.dob,
        num_piece: payload.value.num_piece
      },
      (statusMsg) => {
        verificationStatusText.value = statusMsg
      },
      faceRes.idOrientation || 0
    )
    verificationOCRResult.value = ocrRes
    payload.value.ocr_score = ocrRes.ocrConfidence || 0
    payload.value.ocr_nom_match = ocrRes.nomMatch
    payload.value.ocr_prenom_match = ocrRes.prenomMatch
    payload.value.ocr_dob_match = ocrRes.dobMatch
    payload.value.ocr_num_piece_match = ocrRes.numPieceMatch
    payload.value.ocr_snippet = ocrRes.rawSnippet || ''
    payload.value.verification_timestamp = new Date().toISOString()
    payload.value.identity_audit_status = (faceRes.success && ocrRes.success) ? 'auto_verified' : 'manual_review_required'

    return faceRes.success
  } catch (err) {
    console.error("KYC Verification failure:", err)
    triggerError("Erreur d'analyse", "Une erreur est survenue lors de l'analyse. Une vérification manuelle sera effectuée.")
    return false
  } finally {
    verifyingKYC.value = false
    verificationStatusText.value = ''
  }
}

// Payload for all onboarding steps
const payload = ref({
  // KYC Step
  civ: 'M.',
  nom: '',
  prenom: '',
  nat: 'Camerounaise',
  dob: '',
  lieu_naiss: '',
  adresse: '',
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
            if (payload.value.selfie_live && !payload.value.doc_photo) {
              payload.value.doc_photo = payload.value.selfie_live
            }
            if (payload.value.doc_piece_identite) docFileNames.value.doc_piece_identite = 'Pièce d’identité (enregistrée)'
            if (payload.value.doc_justificatif_domicile) docFileNames.value.doc_justificatif_domicile = 'Justificatif de domicile (enregistré)'
            if (payload.value.doc_photo) docFileNames.value.doc_photo = 'Photo récente (enregistrée)'
            if (payload.value.doc_origine_fonds) docFileNames.value.doc_origine_fonds = 'Origine des fonds (enregistré)'
          }
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

// French months array
const frenchMonths = [
  { value: '1', label: 'Janvier' },
  { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' },
  { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' },
  { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' },
  { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' }
]

// Date of birth states
const dobDay = ref('')
const dobMonth = ref('')
const dobYear = ref('')

// Expiration date states
const expDay = ref('')
const expMonth = ref('')
const expYear = ref('')

// Max year for DOB is current year - 21 (and let's go back 100 years)
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

// Expiration years: current year to current year + 30
const expYearsList = computed(() => {
  const years = []
  for (let y = currentYear; y <= currentYear + 30; y++) {
    years.push(String(y))
  }
  return years
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
  const maxDay = getDaysInMonth(expMonth.value, expYear.value)
  return Array.from({ length: maxDay }, (_, i) => String(i + 1))
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
    clearError('expiration_piece')
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

// Watchers for Expiration changes
watch([expMonth, expYear], () => {
  if (expDay.value && expDaysList.value.length < parseInt(expDay.value)) {
    expDay.value = String(expDaysList.value.length)
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
      validationErrors.value.expiration_piece = "La date d'expiration de la pièce est obligatoire."
    } else {
      const expDate = new Date(payload.value.expiration_piece)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (expDate <= today) {
        validationErrors.value.expiration_piece = "La date d'expiration doit être supérieure à la date du jour."
      }
    }

    // Les pièces justificatives KYC sont facultatives pour fluidifier l'onboarding
    // Le backoffice pourra demander les documents manquants lors de la revue manuelle

    if (Object.keys(validationErrors.value).length > 0) {
      return
    }

    // Check age >= 21
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

    // Analyse biométrique uniquement si les deux documents sont fournis
    const hasIDDoc = payload.value.piece_recto || payload.value.doc_piece_identite
    const hasSelfie = payload.value.selfie_live || payload.value.doc_photo
    if (hasIDDoc && hasSelfie) {
      if (!kycVerificationAttempted.value || !verificationFaceResult.value) {
        const verified = await executeKYCVerification()
        if (!verified && verificationFaceResult.value && !verificationFaceResult.value.success) {
          triggerError(
            "Divergence Faciale Détectée",
            verificationFaceResult.value.message || "Le visage sur le selfie ne correspond pas à la photo de la pièce d'identité."
          )
          return
        }
      } else if (verificationFaceResult.value && !verificationFaceResult.value.success) {
        triggerError(
          "Divergence Faciale Détectée",
          verificationFaceResult.value.message || "Veuillez reprendre une photo nette face à la caméra pour continuer."
        )
        return
      }
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
    signatureError.value = "Veuillez cocher la case de confirmation légale."
    return
  }

  if (!hasSigned.value) {
    signatureError.value = "Veuillez apposer votre signature pour continuer."
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
    <p class="text-slate-400 font-medium">Récupération de votre dossier...</p>
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
          <span class="uppercase">Progression</span>
          <span>{{ progressPercentage }}%</span>
        </div>
        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div :style="{ width: progressPercentage + '%' }" class="bg-primary h-full transition-all duration-500"></div>
        </div>
      </div>

      <!-- Low connectivity warning header -->
      <div v-if="offlineMode || syncError" class="mt-3 flex items-center gap-2 bg-amber-50 text-amber-800 p-2.5 rounded-xl border border-amber-200/50 text-[10px] font-bold">
        <WifiOff class="w-3.5 h-3.5 text-amber-600" />
        <span>{{ syncError || "Mode hors-ligne : saisies sécurisées localement." }}</span>
      </div>
    </header>

    <!-- Content Sections -->
    <div class="flex-1 px-6 py-8 pb-36 overflow-y-auto space-y-6">
      
      <!-- STEP 1: KYC FORM -->
      <div v-if="currentStep === 'kyc'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Étape 1 sur {{ identityRequired ? 5 : 4 }}</span>
          <h3 class="text-xl font-black text-slate-900">Identité & KYC</h3>
          <p class="text-slate-500 text-xs font-medium">Complétez vos informations réglementaires d'identité.</p>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <!-- Civilité -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Civilité *</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.civ = 'M.'; clearError('civ')" :class="payload.civ === 'M.' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Monsieur</button>
              <button type="button" @click="payload.civ = 'Mme'; clearError('civ')" :class="payload.civ === 'Mme' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Madame</button>
            </div>
            <p v-if="validationErrors.civ" id="civ-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.civ }}
            </p>
          </div>

          <!-- Nom et Prénom -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Nom *</label>
              <input v-model="payload.nom" @blur="clearError('nom')" @input="clearError('nom')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.nom ? 'true' : 'false'" :aria-describedby="validationErrors.nom ? 'nom-error' : null">
              <p v-if="validationErrors.nom" id="nom-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.nom }}
              </p>
            </div>
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Prénom *</label>
              <input v-model="payload.prenom" @blur="clearError('prenom')" @input="clearError('prenom')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.prenom ? 'true' : 'false'" :aria-describedby="validationErrors.prenom ? 'prenom-error' : null">
              <p v-if="validationErrors.prenom" id="prenom-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.prenom }}
              </p>
            </div>
          </div>

          <!-- Situation Matrimoniale -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Situation Matrimoniale *</label>
            <select v-model="payload.situation_mat" @change="clearError('situation_mat')" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.situation_mat ? 'true' : 'false'" :aria-describedby="validationErrors.situation_mat ? 'situation_mat-error' : null">
              <option>Célibataire</option>
              <option>Marié(e)</option>
              <option>Divorcé(e)</option>
              <option>Veuf(ve)</option>
            </select>
            <p v-if="validationErrors.situation_mat" id="situation_mat-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.situation_mat }}
            </p>
          </div>

          <!-- Date de naissance et Lieu -->
          <div class="space-y-4">
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Date de Naissance *</label>
              <div class="grid grid-cols-3 gap-2">
                <!-- Jour -->
                <select v-model="dobDay" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                  <option value="" disabled>Jour</option>
                  <option v-for="d in dobDaysList" :key="d" :value="d">{{ String(d).padStart(2, '0') }}</option>
                </select>
                <!-- Mois -->
                <select v-model="dobMonth" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                  <option value="" disabled>Mois</option>
                  <option v-for="m in frenchMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
                </select>
                <!-- Année -->
                <select v-model="dobYear" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                  <option value="" disabled>Année</option>
                  <option v-for="y in dobYearsList" :key="y" :value="y">{{ y }}</option>
                </select>
              </div>
              <p v-if="validationErrors.dob" id="dob-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.dob }}
              </p>
            </div>
            
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Lieu Naissance *</label>
              <input v-model="payload.lieu_naiss" @blur="clearError('lieu_naiss')" @input="clearError('lieu_naiss')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.lieu_naiss ? 'true' : 'false'" :aria-describedby="validationErrors.lieu_naiss ? 'lieu_naiss-error' : null">
              <p v-if="validationErrors.lieu_naiss" id="lieu_naiss-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.lieu_naiss }}
              </p>
            </div>
          </div>

          <!-- Nationalité & Résidence -->
          <div class="space-y-4 text-left">
            <div class="space-y-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Nationalité *</label>
              <select v-model="selectedNationality" @change="onNationalityChange(); clearError('nat')" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.nat ? 'true' : 'false'" :aria-describedby="validationErrors.nat ? 'nat-error' : null">
                <option value="Camerounaise">Camerounaise</option>
                <option value="Gabonaise">Gabonaise</option>
                <option value="Congolaise">Congolaise</option>
                <option value="Tchadienne">Tchadienne</option>
                <option value="Centrafricaine">Centrafricaine</option>
                <option value="Équato-guinéenne">Équato-guinéenne</option>
                <option value="Ivoirienne">Ivoirienne</option>
                <option value="Sénégalaise">Sénégalaise</option>
                <option value="Béninoise">Béninoise</option>
                <option value="Togolaise">Togolaise</option>
                <option value="Malienne">Malienne</option>
                <option value="Burkinabè">Burkinabè</option>
                <option value="Nigériane">Nigériane</option>
                <option value="Française">Française</option>
                <option value="Belge">Belge</option>
                <option value="Canadienne">Canadienne</option>
                <option value="Américaine">Américaine</option>
                <option value="Autre">Autre (Saisir manuellement)</option>
              </select>
              <p v-if="validationErrors.nat" id="nat-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.nat }}
              </p>
            </div>
            
            <div v-if="selectedNationality === 'Autre'" class="space-y-2 animate-in fade-in duration-300">
              <label class="text-[10px] font-black text-slate-400 uppercase pl-1">Précisez votre nationalité *</label>
              <input v-model="otherNationality" @input="onOtherNationalityInput(); clearError('nat')" type="text" placeholder="Ex: Italienne" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
          </div>

          <!-- Contact (Tel, Email) -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Téléphone *</label>
            <input v-model="payload.tel" @blur="clearError('tel')" @input="clearError('tel')" type="tel" placeholder="Ex: 699009900" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.tel ? 'true' : 'false'" :aria-describedby="validationErrors.tel ? 'tel-error' : null">
            <p v-if="validationErrors.tel" id="tel-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.tel }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">E-mail de contact *</label>
            <input v-model="payload.email" @blur="clearError('email')" @input="clearError('email')" type="email" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.email ? 'true' : 'false'" :aria-describedby="validationErrors.email ? 'email-error' : null">
            <p v-if="validationErrors.email" id="email-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.email }}
            </p>
          </div>

          <!-- Adresse physique -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Adresse de résidence *</label>
            <input v-model="payload.adresse" @blur="clearError('adresse')" @input="clearError('adresse')" type="text" placeholder="Quartier, Ville" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.adresse ? 'true' : 'false'" :aria-describedby="validationErrors.adresse ? 'adresse-error' : null">
            <p v-if="validationErrors.adresse" id="adresse-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.adresse }}
            </p>
          </div>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Documents Officiels</h4>
          
          <!-- Pièce d'identité -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Type de pièce *</label>
            <select v-model="payload.piece" @change="onPieceTypeChange" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.piece ? 'true' : 'false'" :aria-describedby="validationErrors.piece ? 'piece-error' : null">
              <option value="CNI">Carte Nationale d'Identité (CNI)</option>
              <option value="Passeport">Passeport</option>
              <option value="Carte Résident">Carte de Résident / Titre de Séjour</option>
              <option value="Permis de Conduire">Permis de Conduire</option>
            </select>
            <p v-if="validationErrors.piece" id="piece-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.piece }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Numéro de pièce *</label>
            <input v-model="payload.num_piece" @blur="clearError('num_piece')" @input="clearError('num_piece')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.num_piece ? 'true' : 'false'" :aria-describedby="validationErrors.num_piece ? 'num_piece-error' : null">
            <p v-if="validationErrors.num_piece" id="num_piece-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.num_piece }}
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Date d'expiration de la pièce *</label>
            <div class="grid grid-cols-3 gap-2">
              <!-- Jour -->
              <select v-model="expDay" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                <option value="" disabled>Jour</option>
                <option v-for="d in expDaysList" :key="d" :value="d">{{ String(d).padStart(2, '0') }}</option>
              </select>
              <!-- Mois -->
              <select v-model="expMonth" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                <option value="" disabled>Mois</option>
                <option v-for="m in frenchMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <!-- Année -->
              <select v-model="expYear" class="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all text-center">
                <option value="" disabled>Année</option>
                <option v-for="y in expYearsList" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
            <p v-if="validationErrors.expiration_piece" id="expiration_piece-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.expiration_piece }}
            </p>
          </div>

          <!-- Pièces justificatives (optionnelles) -->
          <div class="pt-5 border-t border-slate-100 space-y-4">
            <div class="text-left space-y-1">
              <div class="flex items-center gap-2">
                <h5 class="text-xs font-black text-slate-900 uppercase tracking-wider">Pièces justificatives</h5>
                <span class="text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full uppercase tracking-wider">Facultatif</span>
              </div>
              <p class="text-[11px] text-slate-500 font-medium leading-relaxed">
                Vous pouvez téléverser vos documents maintenant ou plus tard. Ils seront demandés lors de la revue de votre dossier (JPG, PNG ou PDF, max. 8 Mo).
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div v-for="doc in dynamicSupportingDocs" :key="doc.key" class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-slate-800 tracking-wide">
                    {{ doc.title }}
                  </label>
                  <span v-if="doc.allowCamera && !payload[doc.key]" class="text-[10px] text-slate-400 font-medium">
                    Fichier ou Caméra
                  </span>
                </div>

                <!-- Si aucun document n'est téléversé : Boîte de dépôt style Filament / PEK -->
                <div
                  v-if="!payload[doc.key]"
                  @dragover.prevent="dragActive[doc.key] = true"
                  @dragleave.prevent="dragActive[doc.key] = false"
                  @drop.prevent="handleFileDrop($event, doc.key)"
                  @click="triggerBrowse(doc.key)"
                  :class="[
                    dragActive[doc.key] ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/80',
                    validationErrors[doc.key] ? 'border-rose-400 bg-rose-50/30' : ''
                  ]"
                  class="border border-dashed rounded-2xl py-5 px-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[92px] group"
                >
                  <input
                    :ref="el => registerFileInput(el, doc.key)"
                    type="file"
                    :accept="doc.accept"
                    @change="e => handleFileInputChange(e, doc.key)"
                    class="hidden"
                  />
                  <p class="text-xs text-slate-500 font-medium select-none">
                    Faites glisser votre fichier ou <span class="text-primary font-bold group-hover:underline">Parcourir</span>
                  </p>
                  <p v-if="doc.hint" class="text-[10px] text-slate-400 font-normal mt-0.5 select-none">
                    {{ doc.hint }}
                  </p>
                </div>

                <!-- Si le document est téléversé : Carte de confirmation et actions -->
                <div
                  v-else
                  class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <img 
                      v-if="payload[doc.key] && payload[doc.key].startsWith('data:image')" 
                      :src="payload[doc.key]" 
                      alt="Aperçu" 
                      class="w-12 h-10 object-cover rounded-lg border border-emerald-200 shadow-xs shrink-0"
                    />
                    <div v-else class="w-10 h-10 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                      <FileText class="w-5 h-5" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-xs font-bold text-slate-800 truncate" :title="docFileNames[doc.key] || 'Document téléversé'">
                        {{ docFileNames[doc.key] || 'Document téléversé' }}
                      </p>
                      <span class="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 class="w-3 h-3 text-emerald-600" /> Document prêt
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-1 shrink-0">
                    <button 
                      v-if="doc.allowCamera"
                      type="button" 
                      @click="openCamera(doc.cameraTarget)"
                      class="p-1.5 text-slate-600 hover:text-primary hover:bg-white rounded-lg transition-colors" 
                      title="Reprendre photo"
                    >
                      <Camera class="w-3.5 h-3.5" />
                    </button>
                    <button 
                      type="button" 
                      @click="triggerBrowse(doc.key)" 
                      class="p-1.5 text-slate-600 hover:text-primary hover:bg-white rounded-lg transition-colors" 
                      title="Remplacer le fichier"
                    >
                      <Upload class="w-3.5 h-3.5" />
                    </button>
                    <button 
                      type="button" 
                      @click="removeSupportingDoc(doc.key)" 
                      class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors" 
                      title="Supprimer"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <!-- Texte d'aide sous la boîte -->
                <div class="flex items-center justify-between pl-1">
                  <p v-if="validationErrors[doc.key]" class="text-[11px] text-rose-500 font-semibold">
                    {{ validationErrors[doc.key] }}
                  </p>
                  <p v-else-if="!payload[doc.key]" class="text-[11px] text-slate-400 font-normal">
                    Optionnel — peut être fourni plus tard
                  </p>
                  <p v-else class="text-[11px] text-emerald-600 font-medium">
                    Fichier validé
                  </p>

                  <!-- Raccourci caméra si applicable et non encore téléversé -->
                  <button 
                    v-if="doc.allowCamera && !payload[doc.key]"
                    type="button" 
                    @click="openCamera(doc.cameraTarget)"
                    class="text-[11px] font-bold text-primary hover:text-primary-dark inline-flex items-center gap-1 transition-colors"
                  >
                    <Camera class="w-3 h-3" />
                    <span>Prendre photo</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

            <!-- CONTRÔLE DE CONFORMITÉ BIOMÉTRIQUE & CNI (OCR) -->
            <div v-if="(payload.piece_recto || payload.doc_piece_identite) && (payload.selfie_live || payload.doc_photo)" class="pt-5 border-t border-slate-100 space-y-3 text-left">
              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <h5 class="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    
                    <span>Contrôle de conformité de l'identité</span>
                  </h5>
                  <p class="text-[11px] text-slate-500 font-medium">Comparaison faciale et vérification des informations CNI.</p>
                </div>
              </div>

              <!-- En cours d'analyse -->
              <div v-if="verifyingKYC" class="bg-slate-50 border border-primary/30 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center">
                <Loader2 class="w-6 h-6 text-primary animate-spin" />
                <p class="text-xs font-bold text-slate-800">{{ verificationStatusText || "Analyse biométrique et lecture CNI en cours..." }}</p>
                <p class="text-[10px] text-slate-400 font-medium">Vérification instantanée sur votre appareil</p>
              </div>

              <!-- Résultats de l'analyse -->
              <div v-else-if="verificationFaceResult" class="space-y-3">
                <!-- 1. Reconnaissance faciale -->
                <div 
                  :class="verificationFaceResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'"
                  class="border rounded-2xl p-3.5 space-y-2 transition-all"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-black uppercase tracking-wider" :class="verificationFaceResult.success ? 'text-emerald-800' : 'text-rose-800'">
                      Correspondance faciale
                    </span>
                    <span 
                      :class="verificationFaceResult.success ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'"
                      class="text-[10px] font-black px-2 py-0.5 rounded-full"
                    >
                      {{ verificationFaceResult.score }}%
                    </span>
                  </div>
                  <p class="text-xs font-semibold leading-relaxed" :class="verificationFaceResult.success ? 'text-emerald-700' : 'text-rose-700'">
                    {{ verificationFaceResult.message }}
                  </p>
                </div>

                <!-- 2. OCR text extraction & comparison s'exécute en arrière-plan pour l'audit admin -->

                <!-- Bouton de ré-analyse si besoin -->
                <button
                  type="button"
                  @click="executeKYCVerification"
                  class="w-full py-2.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <RefreshCw class="w-3.5 h-3.5 text-slate-500" />
                  <span>Relancer la vérification</span>
                </button>
              </div>

              <!-- Pas encore analysé : bouton d'action -->
              <div v-else class="space-y-2">
                <button
                  type="button"
                  @click="executeKYCVerification"
                  class="w-full bg-primary hover:bg-primary-dark text-white font-black py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all text-xs uppercase tracking-wider"
                >
                  <ShieldCheck class="w-4 h-4 text-white" />
                  <span>Vérifier la conformité de ma pièce</span>
                </button>
                <p class="text-[10px] text-slate-400 text-center font-medium">
                  L'analyse biométrique et textuelle compare votre selfie et les informations de votre CNI.
                </p>
              </div>
            </div>
          </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Profession</h4>
          
          <div class="space-y-4">
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Profession (Optionnel)</label>
              <input v-model="payload.profession" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
            <div class="space-y-2 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Employeur (Optionnel)</label>
              <input v-model="payload.employeur" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
          </div>
        </div>
      </div>

      <!-- STRICT IDENTITY VERIFICATION -->
      <div v-else-if="currentStep === 'identity'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Étape 2 sur 5</span>
          <h3 class="text-xl font-black text-slate-900">Vérification stricte de l’identité</h3>
          <p class="text-slate-500 text-xs font-medium">Contrôle du document, correspondance faciale et détection de présence réelle.</p>
        </div>

        <section class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5 text-left">
          <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck class="w-7 h-7" />
          </div>

          <div class="space-y-2">
            <h4 class="font-black text-slate-900">Contrôle sécurisé par un prestataire spécialisé</h4>
            <p class="text-xs text-slate-500 leading-relaxed">
              Les images de votre pièce et de votre visage sont capturées dans la session sécurisée du prestataire. PEK ne les place ni dans le navigateur, ni dans une URL publique, ni dans ses e-mails.
            </p>
          </div>

          <div class="bg-slate-50 rounded-2xl p-4 text-[11px] text-slate-600 leading-relaxed space-y-2">
            <p>• Les clés du prestataire restent exclusivement sur le serveur PEK.</p>
            <p>• PEK conserve seulement une référence opaque, le statut final et des indicateurs de contrôle.</p>
            <p>• Toute modification ultérieure de vos données d’identité invalide le contrôle et impose une nouvelle vérification.</p>
          </div>

          <div v-if="identityVerification?.verified" class="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl p-4 text-xs font-bold flex items-center gap-3">
            <CheckCircle2 class="w-5 h-5 shrink-0" />
            Identité vérifiée et liée aux informations de ce dossier.
          </div>
          <div v-else-if="identityVerification?.status === 'reviewing' || identityVerification?.status === 'pending'" class="bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl p-4 text-xs font-bold flex items-center gap-3">
            <Loader2 class="w-5 h-5 shrink-0 animate-spin" />
            Vérification reçue, examen en cours. Actualisez le statut dans quelques instants.
          </div>
          <div v-else-if="identityVerification && ['denied', 'suspected', 'expired', 'error'].includes(identityVerification.status)" class="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl p-4 text-xs font-bold flex items-center gap-3">
            <AlertCircle class="w-5 h-5 shrink-0" />
            Le contrôle n’a pas été approuvé. Vous pouvez lancer une nouvelle session.
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
            Démarrer le contrôle d’identité
          </button>

          <button
            type="button"
            @click="refreshIdentityStatus"
            :disabled="identityLoading"
            class="w-full bg-slate-100 text-slate-700 font-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw :class="identityLoading ? 'animate-spin' : ''" class="w-4 h-4" />
            Actualiser le statut
          </button>
        </section>
      </div>

      <!-- RISK PROFILER -->
      <div v-else-if="currentStep === 'risk'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Étape {{ identityRequired ? 3 : 2 }} sur {{ identityRequired ? 5 : 4 }}</span>
          <h3 class="text-xl font-black text-slate-900">Profil d'Investissement</h3>
          <p class="text-slate-500 text-xs font-medium">Déterminez vos objectifs et évaluez votre tolérance au risque.</p>
        </div>

        <!-- Dynamic Live Score Card -->
        <div class="bg-primary text-white p-6 rounded-[32px] shadow-lg shadow-primary/15 space-y-3 text-left">
          <div class="space-y-1">
            <span class="text-white/70 text-[10px] font-black uppercase tracking-widest">Profil Estimé localement</span>
            <h4 class="text-2xl font-black text-white leading-none">{{ localProfile }}</h4>
          </div>
        </div>

        <!-- Questionnaire qBlocks -->
        <div class="space-y-6">
          
          <!-- Q1: Revenus -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">1. Quelle est votre tranche de revenus annuels ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.tranche_revenus = 'moins_500k'; payload.revenus_annuels = 'moins_5m'" :class="payload.tranche_revenus === 'moins_500k' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Moins de 500 000 FCFA</button>
              <button type="button" @click="payload.tranche_revenus = '500k_1_5m'; payload.revenus_annuels = '5m_15m'" :class="payload.tranche_revenus === '500k_1_5m' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">De 500 000 à 1 500 000 FCFA</button>
              <button type="button" @click="payload.tranche_revenus = 'plus_1_5m'; payload.revenus_annuels = 'plus_15m'" :class="payload.tranche_revenus === 'plus_1_5m' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Plus de 1 500 000 FCFA</button>
            </div>
          </div>

          <!-- Q2: Epargne régulière -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">2. Avez-vous une capacité d'épargne résiduelle régulière ?</h4>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" @click="payload.epargne_possible = 'Oui'" :class="payload.epargne_possible === 'Oui' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Oui</button>
              <button type="button" @click="payload.epargne_possible = 'Non'" :class="payload.epargne_possible === 'Non' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Non</button>
            </div>
          </div>

          <!-- Q3: Niveau de risque accepté -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">3. Quel niveau de risque acceptez-vous sur vos placements ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.niveau_risque = 'faible'" :class="payload.niveau_risque === 'faible' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Faible (préservation prioritaire)</button>
              <button type="button" @click="payload.niveau_risque = 'moyen'" :class="payload.niveau_risque === 'moyen' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Moyen (équilibre rendement/fluctuation)</button>
              <button type="button" @click="payload.niveau_risque = 'max'" :class="payload.niveau_risque === 'max' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Maximum (recherche de croissance à tout prix)</button>
            </div>
          </div>

          <!-- Q4: Conscience risque -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">4. Êtes-vous conscient qu'un rendement potentiel élevé s'accompagne d'un risque élevé de perte en capital ?</h4>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" @click="payload.conscience_risque = 'Oui'" :class="payload.conscience_risque === 'Oui' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Oui</button>
              <button type="button" @click="payload.conscience_risque = 'Non'" :class="payload.conscience_risque === 'Non' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Non</button>
            </div>
          </div>

          <!-- Q5: Objectif investissement -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">5. Quel est votre objectif principal d'investissement ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.objectif_invest = 'securite'" :class="payload.objectif_invest === 'securite' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Sécuriser une épargne de précaution</button>
              <button type="button" @click="payload.objectif_invest = 'equilibre'" :class="payload.objectif_invest === 'equilibre' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Équilibrer mon patrimoine entre sécurité et croissance</button>
              <button type="button" @click="payload.objectif_invest = 'croissance'" :class="payload.objectif_invest === 'croissance' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Faire fructifier mon capital à long terme</button>
            </div>
          </div>

          <!-- Q6: Horizon de placement -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">6. Quelle est la durée (horizon) de votre placement ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.horizon_terme = 'court_terme'" :class="payload.horizon_terme === 'court_terme' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Court terme - Moins de 2 ans</button>
              <button type="button" @click="payload.horizon_terme = 'moyen_terme'" :class="payload.horizon_terme === 'moyen_terme' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Moyen terme - De 2 à 5 ans</button>
              <button type="button" @click="payload.horizon_terme = 'long_terme'" :class="payload.horizon_terme === 'long_terme' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Long terme - Plus de 5 ans</button>
            </div>
          </div>

          <!-- Q7: Performance ciblée -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">7. Quelle performance ciblez-vous, sachant les risques induits ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.niveau_perf = '1'" :class="payload.niveau_perf === '1' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Rendement régulier, risque de perte nul/très faible</button>
              <button type="button" @click="payload.niveau_perf = 'moderee'" :class="payload.niveau_perf === 'moderee' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Rendement équilibré, fluctuations légères acceptées</button>
              <button type="button" @click="payload.niveau_perf = 'elevee'" :class="payload.niveau_perf === 'elevee' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Forte appréciation, fortes fluctuations acceptées</button>
            </div>
          </div>

          <!-- Q8: Connaissance des marchés -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">8. Comment évaluez-vous votre connaissance des marchés financiers ?</h4>
            <div class="space-y-2">
              <button type="button" @click="payload.connaissance_marche = 'nulle'" :class="payload.connaissance_marche === 'nulle' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Faible ou inexistante</button>
              <button type="button" @click="payload.connaissance_marche = 'moyenne'" :class="payload.connaissance_marche === 'moyenne' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Moyenne - Je connais le concept des fonds d'investissement</button>
              <button type="button" @click="payload.connaissance_marche = 'excellente'" :class="payload.connaissance_marche === 'excellente' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all">Excellente - J'achète activement des valeurs mobilières</button>
            </div>
          </div>

          <!-- Q9: Investissements antérieurs -->
          <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
            <h4 class="text-sm font-black text-slate-900 leading-tight">9. Avez-vous déjà réalisé des investissements financiers dans le passé ?</h4>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" @click="payload.invest_anterieurs = 'Oui'" :class="payload.invest_anterieurs === 'Oui' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Oui</button>
              <button type="button" @click="payload.invest_anterieurs = 'Non'" :class="payload.invest_anterieurs === 'Non' ? 'border-primary bg-primary text-white' : 'border-slate-100 bg-slate-50 text-slate-600'" class="p-4 rounded-2xl border-2 font-bold text-xs text-center transition-all">Non</button>
            </div>
          </div>

        </div>
      </div>

      <!-- STEP 3: LAB/FT COMPLIANCE -->
      <div v-else-if="currentStep === 'labft'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Étape {{ identityRequired ? 4 : 3 }} sur {{ identityRequired ? 5 : 4 }}</span>
          <h3 class="text-xl font-black text-slate-900">Conformité LAB-FT</h3>
          <p class="text-slate-500 text-xs font-medium">Déclarations réglementaires de conformité COBAC.</p>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Profil Économique</h4>
          
          <!-- Secteur d'Activité -->
          <div class="space-y-2 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Secteur d'Activité *</label>
            <select v-model="selectedSecteur" @change="onSecteurChange" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.secteur ? 'true' : 'false'" :aria-describedby="validationErrors.secteur ? 'secteur-error' : null">
              <option value="" disabled>Sélectionnez votre secteur d'activité</option>
              <option v-for="sec in popularSectors" :key="sec" :value="sec">{{ sec }}</option>
            </select>
            
            <div v-if="selectedSecteur === 'Autre'" class="mt-2 animate-in fade-in duration-200">
              <input v-model="customSecteur" @input="onCustomSecteurInput" type="text" placeholder="Précisez votre secteur d'activité..." class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>
            
            <p v-if="validationErrors.secteur" id="secteur-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.secteur }}
            </p>
          </div>

          <!-- Sources de revenus -->
          <div class="space-y-3 text-left">
            <div class="flex items-center justify-between pl-1">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Sources des Revenus *</label>
              <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sélection multiple</span>
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
                <span class="leading-tight">{{ item.label }}</span>
                <span v-if="payload[item.key]" class="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px] shrink-0 font-black">✓</span>
                <span v-else class="w-4 h-4 rounded-full border border-slate-300 shrink-0"></span>
              </button>
            </div>
            
            <div v-if="payload.src_autre_check" class="mt-2 space-y-1 animate-in fade-in duration-200">
              <input v-model="payload.src_autre" @input="syncOrigineFonds" type="text" placeholder="Précisez la source de revenu..." class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all">
            </div>

            <p v-if="validationErrors.sources_revenu" id="sources_revenu-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.sources_revenu }}
            </p>
          </div>

          <!-- Origine des fonds à investir (Déduite automatiquement) -->
          <div v-if="payload.origine_fonds || isEditingOrigine" class="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 text-left animate-in fade-in duration-200">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Origine des fonds à investir :</span>
              <button type="button" @click="toggleEditOrigine" class="text-[11px] font-black text-primary hover:underline">
                {{ isEditingOrigine ? 'Terminé' : 'Personnaliser' }}
              </button>
            </div>
            <p v-if="!isEditingOrigine" class="text-xs font-bold text-slate-800 leading-snug">
              {{ payload.origine_fonds }}
            </p>
            <div v-else class="space-y-1.5 pt-1">
              <input v-model="payload.origine_fonds" @input="clearError('origine_fonds')" type="text" placeholder="Ex: Épargne salariale..." class="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 focus:border-primary outline-none">
              <p class="text-[10px] text-slate-400 font-medium">Déduit automatiquement d'après vos sources sélectionnées ci-dessus.</p>
            </div>
            <p v-if="validationErrors.origine_fonds" id="origine_fonds-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
              {{ validationErrors.origine_fonds }}
            </p>
          </div>
        </div>



        <!-- LAB-FT Specific Risk Indicators -->
        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-5">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Déclarations de Risques</h4>
          
          <!-- PPE -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Êtes-vous une Personne Politiquement Exposée (PPE) ? *</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.ppe = 'Oui'; clearError('ppe')" :class="payload.ppe === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Oui</button>
              <button type="button" @click="payload.ppe = 'Non'; clearError('ppe')" :class="payload.ppe === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Non</button>
            </div>
            
            <div v-if="payload.ppe === 'Oui'" class="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-300">
              <label class="text-[10px] font-black text-slate-400 uppercase pl-1">Précisez votre fonction publique / mandat *</label>
              <input v-model="payload.ppe_detail" @blur="clearError('ppe')" @input="clearError('ppe')" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:border-primary outline-none transition-all" :aria-invalid="validationErrors.ppe ? 'true' : 'false'" :aria-describedby="validationErrors.ppe ? 'ppe-error' : null">
              <p v-if="validationErrors.ppe" id="ppe-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
                {{ validationErrors.ppe }}
              </p>
            </div>
          </div>

          <!-- Pays à risque -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Votre compte bancaire ou résidence est-il situé dans un pays sous sanctions ou à haut risque ? *</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.pays_risque = 'Oui'" :class="payload.pays_risque === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Oui</button>
              <button type="button" @click="payload.pays_risque = 'Non'" :class="payload.pays_risque === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Non</button>
            </div>
          </div>

          <!-- Secteur sensible -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Vos fonds proviennent-ils d'un secteur sensible (ex: armement, minier, jeux d'argent) ? *</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.secteur_sensible = 'Oui'" :class="payload.secteur_sensible === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Oui</button>
              <button type="button" @click="payload.secteur_sensible = 'Non'" :class="payload.secteur_sensible === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Non</button>
            </div>
          </div>

          <!-- Condamnation -->
          <div class="space-y-3 text-left">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Avez-vous fait l'objet d'une condamnation passée liée au blanchiment ou au terrorisme ? *</label>
            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button type="button" @click="payload.condamnation = 'Oui'" :class="payload.condamnation === 'Oui' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Oui</button>
              <button type="button" @click="payload.condamnation = 'Non'" :class="payload.condamnation === 'Non' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'" class="flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all">Non</button>
            </div>
          </div>
        </div>

        <!-- Consentements -->
        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4 text-left">
          <h4 class="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Consentements réglementaires</h4>
          
          <label class="flex items-start gap-3 text-xs font-bold text-slate-700 leading-normal">
            <input v-model="payload.ack_lecture" type="checkbox" @change="clearError('consent')" class="w-4 h-4 text-primary rounded border-slate-300 mt-0.5">
            <span>Je declare avoir pris connaissance des règlements généraux et conditions de Kori Asset Management. *</span>
          </label>

          <label class="flex items-start gap-3 text-xs font-bold text-slate-700 leading-normal">
            <input v-model="payload.ack_donnees" type="checkbox" @change="clearError('consent')" class="w-4 h-4 text-primary rounded border-slate-300 mt-0.5">
            <span>J'autorise le traitement informatique sécurisé de mes données dans le cadre de la conformité LAB-FT. *</span>
          </label>
          <p v-if="validationErrors.consent" id="consent-error" role="alert" class="text-rose-500 text-xs mt-1 ml-1 font-semibold">
            {{ validationErrors.consent }}
          </p>
        </div>
      </div>

      <!-- STEP 4: ELECTRONIC SIGNATURE -->
      <div v-else-if="currentStep === 'signature'" class="space-y-6 animate-in fade-in duration-300">
        <div class="space-y-1">
          <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Étape {{ identityRequired ? 5 : 4 }} sur {{ identityRequired ? 5 : 4 }}</span>
          <h3 class="text-xl font-black text-slate-900">Signature Électronique</h3>
          <p class="text-slate-500 text-xs font-medium">Dessinez votre signature dans le cadre ci-dessous pour finaliser.</p>
        </div>

        <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4 text-left">
         

          <div class="flex justify-between items-center border-b border-slate-100 pb-3">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Tracé de signature *</label>
            <button type="button" @click="clearSignature" class="text-[10px] font-black text-rose-500 uppercase hover:text-rose-600 transition-colors">Effacer</button>
          </div>

          <div class="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden relative" style="height: 152px;">
            <canvas ref="canvasRef" class="w-full h-full block cursor-crosshair"></canvas>
            <div v-if="!hasSigned" class="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-bold select-none">
              Signez ici avec votre doigt ou stylet
            </div>
          </div> 
          <!-- Legal confirmation statement checkbox -->
          <div class="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <label class="flex items-start gap-3 cursor-pointer select-none">
              <input v-model="signatureConfirmed" type="checkbox" class="w-5 h-5 text-primary rounded border-slate-300 mt-0.5 focus:ring-primary">
              <span class="text-slate-700 text-xs font-bold leading-normal">
                <!-- Je, soussigné(e) <span class="text-primary font-black">{{ payload.prenom }} {{ payload.nom }}</span>, certifie sur l'honneur l'exactitude de toutes les informations fournies dans ce dossier d'onboarding. 
                Je déclare accepter expressément les règlements du PEK et reconnais de manière irrévocable que la signature électronique ci-dessous constituera la preuve de mon engagement contractuel et aura la même valeur juridique qu'une signature manuscrite. -->
                Je déclare avoir pris connaissance du document d'information et du règlement de gestion du fonds commun de placement KORI SERENITE
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
          <Loader2 v-else class="w-10 h-10 text-blue-400 animate-spin" />
        </div>
        
        <div class="space-y-2">
          <h2 class="text-2xl font-black text-slate-900">
            {{ onboardingSessionStatus === 'validated' ? 'Compte Activé !' : onboardingSessionStatus === 'rejected' ? 'Dossier à corriger' : 'Dossier Soumis !' }}
          </h2>
          <p class="text-slate-500 text-xs leading-relaxed max-w-[280px] mx-auto font-medium">
            <template v-if="onboardingSessionStatus === 'validated'">
              Félicitations ! Votre compte est activé. Vous pouvez désormais souscrire à nos fonds d'investissement.
            </template>
            <template v-else-if="onboardingSessionStatus === 'rejected'">
              Notre équipe a relevé des éléments à corriger. Modifiez votre dossier et soumettez-le à nouveau.
            </template>
            <template v-else>
              Votre dossier a été transmis à l'équipe de conformité Kori pour examen. Vous serez notifié dès sa validation.
            </template>
          </p>
        </div>

        <div class="w-full bg-[#FAF6F0] rounded-3xl p-6 space-y-3 border border-[#E8B010]/20 text-left shadow-2xs">
          <div class="flex justify-between items-center text-xs">
            <span class="text-[#8C7A70] font-black uppercase tracking-wider text-[10px]">Profil déterminé</span>
            <span class="text-[#3A190C] font-black">{{ localProfile }}</span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-[#8C7A70] font-black uppercase tracking-wider text-[10px]">Statut Dossier</span>
            <span 
              :class="{
                'bg-emerald-100 text-emerald-800 border border-emerald-200': onboardingSessionStatus === 'validated',
                'bg-rose-100 text-rose-800 border border-rose-200': onboardingSessionStatus === 'rejected',
                'bg-[#E8B010]/15 text-[#482010] border border-[#E8B010]/40': !['validated','rejected'].includes(onboardingSessionStatus)
              }"
              class="px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-2xs"
            >
              {{ onboardingSessionStatus === 'validated' ? '✓ Validé' : onboardingSessionStatus === 'rejected' ? '⚠ Corrections requises' : 'En cours d\'étude' }}
            </span>
          </div>
          <div v-if="onboardingSessionStatus !== 'validated'" class="flex items-start gap-2 pt-2 border-t border-[#E8B010]/15">
            <span class="text-[10px] text-[#78655B] font-semibold leading-relaxed">
              💡 Vous pouvez compléter ou corriger vos informations et documents tant que votre dossier n'est pas validé.
            </span>
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
            Modifier mon dossier
          </button>

          <button @click="router.push('/home')" class="w-full bg-primary text-white font-black py-4 rounded-3xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-sm uppercase tracking-wider">
            Retour au Tableau de Bord
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
        Retour
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
          {{ currentStep === 'signature' ? 'Finaliser et Signer' : 'Étape suivante' }}
        </span>
      </button>
    </div>

    <!-- Error Modal -->
    <div v-if="showErrorModal" class="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <!-- Dark backdrop -->
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="showErrorModal = false"></div>
      
      <!-- Modal card -->
      <div class="relative bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
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
          D'accord
        </button>
      </div>
    </div>
    <!-- Real-time Live Camera Modal -->
    <div v-if="showCameraModal" class="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-6 animate-in fade-in duration-200">
      <!-- Top header bar -->
      <div class="w-full max-w-md flex items-center justify-between text-white pt-2">
        <div class="space-y-0.5 text-left">
          <h4 class="text-sm font-black tracking-wide">
            {{ activeCameraTarget === 'selfie_live' ? 'Vérification faciale en direct' : (activeCameraTarget === 'piece_recto' ? 'Photo de la pièce (Recto)' : 'Photo de la pièce (Verso)') }}
          </h4>
          <p class="text-[11px] text-slate-400">Positionnez votre document ou visage au centre</p>
        </div>
        <button type="button" @click="closeCamera" class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Camera Viewport with framing overlay -->
      <div class="relative w-full max-w-md aspect-[3/4] sm:aspect-[4/3] rounded-3xl overflow-hidden bg-black flex items-center justify-center border-2 border-white/20 shadow-2xl my-auto">
        <div v-if="cameraLoading" class="flex flex-col items-center gap-3 text-white p-6">
          <Loader2 class="w-8 h-8 animate-spin text-primary" />
          <p class="text-xs font-bold">Initialisation de la caméra en cours...</p>
        </div>

        <div v-else-if="cameraError" class="p-6 text-center text-rose-300 space-y-3">
          <AlertCircle class="w-10 h-10 mx-auto text-rose-400" />
          <p class="text-xs font-medium leading-relaxed">{{ cameraError }}</p>
          <button type="button" @click="closeCamera" class="px-4 py-2 bg-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/20 transition-all">
            Fermer
          </button>
        </div>

        <video
          v-show="!cameraLoading && !cameraError"
          ref="cameraVideoRef"
          autoplay
          playsinline
          muted
          class="w-full h-full object-cover"
        ></video>

        <!-- Framing guides overlay -->
        <div v-if="!cameraLoading && !cameraError" class="absolute inset-0 pointer-events-none flex items-center justify-center">
          <!-- Oval guide for selfie -->
          <div v-if="activeCameraTarget === 'selfie_live'" class="w-52 h-72 border-2 border-white/70 border-dashed rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"></div>
          <!-- Rectangle guide for document -->
          <div v-else class="w-80 h-52 border-2 border-white/70 border-dashed rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"></div>
        </div>
      </div>

      <!-- Bottom controls bar -->
      <div class="w-full max-w-md pb-4 flex items-center justify-between px-4">
        <button type="button" @click="closeCamera" class="text-xs font-bold text-white/70 hover:text-white px-3 py-2">
          Annuler
        </button>

        <!-- Big Shutter Button -->
        <button
          v-if="!cameraLoading && !cameraError"
          type="button"
          @click="capturePhoto"
          class="w-20 h-20 rounded-full border-4 border-white p-1.5 flex items-center justify-center active:scale-95 transition-transform"
          title="Prendre la photo"
        >
          <div class="w-full h-full rounded-full bg-white hover:bg-slate-100 shadow-lg"></div>
        </button>

        <div class="w-16"></div>
      </div>
    </div>
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
