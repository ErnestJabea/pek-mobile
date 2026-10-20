import * as faceapi from '@vladmandic/face-api'
import { createWorker } from 'tesseract.js'

let modelsLoaded = false

/**
 * Load face-api lightweight models from /models
 */
export async function loadFaceModels() {
  if (modelsLoaded) return true
  try {
    const MODEL_URL = '/models'
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ])
    modelsLoaded = true
    return true
  } catch (err) {
    console.error('Erreur chargement modèles face-api:', err)
    return false
  }
}

/**
 * Helper to convert Base64 or URL to HTMLImageElement
 */
function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(new Error("Impossible de charger l'image pour l'analyse."))
    img.src = src
  })
}

/**
 * Rotate an image element to a canvas by 0, 90, 180, 270 degrees
 */
export function rotateImageToCanvas(imgElement, angleDegrees = 0) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const angle = (angleDegrees % 360 + 360) % 360

  const width = imgElement.naturalWidth || imgElement.width || 640
  const height = imgElement.naturalHeight || imgElement.height || 480

  if (angle === 90 || angle === 270) {
    canvas.width = height
    canvas.height = width
  } else {
    canvas.width = width
    canvas.height = height
  }

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((angle * Math.PI) / 180)
  ctx.drawImage(imgElement, -width / 2, -height / 2)
  return canvas
}

/**
 * Calibrate euclidean distance to human-readable similarity percentage
 */
function distanceToSimilarity(distance) {
  if (distance <= 0.35) return Math.min(100, Math.round(95 + (0.35 - distance) * 20))
  if (distance <= 0.50) return Math.round(80 + ((0.50 - distance) / 0.15) * 15)
  if (distance <= 0.62) return Math.round(60 + ((0.62 - distance) / 0.12) * 20)
  if (distance <= 0.72) return Math.round(40 + ((0.72 - distance) / 0.10) * 20)
  return Math.max(10, Math.round(40 - (distance - 0.72) * 40))
}

/**
 * Multi-angle face detection: checks 0°, 90°, 270°, 180° to handle sideways ID cards
 */
async function detectFaceWithAutoOrientation(imgElement, detectorOptions) {
  const angles = [0, 90, 270, 180]
  let bestFace = null
  let bestScore = -1
  let bestOrientation = 0
  let bestCanvas = null

  for (const angle of angles) {
    const canvas = angle === 0 ? rotateImageToCanvas(imgElement, 0) : rotateImageToCanvas(imgElement, angle)
    try {
      const result = await faceapi
        .detectSingleFace(canvas, detectorOptions)
        .withFaceLandmarks(true)
        .withFaceDescriptor()

      if (result && result.detection && result.detection.score > bestScore) {
        bestFace = result
        bestScore = result.detection.score
        bestOrientation = angle
        bestCanvas = canvas
      }

      // Early break if high confidence face found
      if (bestScore > 0.75) break
    } catch (e) {
      console.warn(`Face detection failed at ${angle}°:`, e)
    }
  }

  return {
    face: bestFace,
    orientation: bestOrientation,
    canvas: bestCanvas || rotateImageToCanvas(imgElement, 0)
  }
}

/**
 * Compare face between ID card (piece_recto) and real-time live selfie
 */
export async function compareFaces(idCardBase64, selfieBase64) {
  if (!idCardBase64 || !selfieBase64) {
    return {
      success: false,
      score: 0,
      distance: 1,
      message: "Pièce d'identité et selfie requis."
    }
  }

  const loaded = await loadFaceModels()
  if (!loaded) {
    return {
      success: false,
      score: 0,
      distance: null,
      isFallback: true,
      message: "Modèle d'IA non disponible sur ce navigateur. Contrôle manuel délégué."
    }
  }

  try {
    const [idImg, selfieImg] = await Promise.all([
      loadImageElement(idCardBase64),
      loadImageElement(selfieBase64)
    ])

    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.25
    })

    // 1. Detect on ID card with auto-rotation (0°, 90°, 270°, 180°)
    const { face: idResult, orientation: idOrientation, canvas: idAlignedCanvas } = 
      await detectFaceWithAutoOrientation(idImg, detectorOptions)

    if (!idResult) {
      return {
        success: false,
        score: 0,
        distance: 1,
        message: "Aucun visage net détecté sur la pièce d'identité. Veillez à ce que la photo d'identité soit bien éclairée et sans reflet."
      }
    }

    // 2. Detect on Selfie (usually upright, but check 0° and 90° if needed)
    let selfieResult = await faceapi
      .detectSingleFace(selfieImg, detectorOptions)
      .withFaceLandmarks(true)
      .withFaceDescriptor()

    if (!selfieResult) {
      // Try auto-rotation for selfie in case mobile device captured sideways
      const selfieAuto = await detectFaceWithAutoOrientation(selfieImg, detectorOptions)
      selfieResult = selfieAuto.face
    }

    if (!selfieResult) {
      return {
        success: false,
        score: 0,
        distance: 1,
        message: "Aucun visage net détecté sur le selfie temps réel. Placez votre visage bien au centre face à la caméra."
      }
    }

    // 3. Compute Euclidean Distance
    const distance = faceapi.euclideanDistance(idResult.descriptor, selfieResult.descriptor)
    const similarity = distanceToSimilarity(distance)
    const isMatch = distance <= 0.62 && similarity >= 55

    return {
      success: isMatch,
      score: similarity,
      distance: parseFloat(distance.toFixed(4)),
      idOrientation,
      alignedIdCanvas: idAlignedCanvas,
      message: isMatch
        ? `Correspondance faciale confirmée (${similarity}% de ressemblance).`
        : `Ressemblance insuffisante (${similarity}%). Assurez-vous d'un éclairage uniforme sans reflets.`
    }
  } catch (err) {
    console.error('Erreur lors de la comparaison faciale:', err)
    return {
      success: false,
      score: 0,
      distance: 1,
      error: err.message,
      message: "Erreur technique lors de la comparaison faciale."
    }
  }
}

/**
 * Text normalization (strips accents, uppercase, keeps alphanumeric)
 */
function normalizeStr(str) {
  if (!str) return ''
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Check if target token or word matches anywhere in text with fuzzy tolerance
 */
function tokenMatchesInText(targetStr, fullText) {
  const cleanTarget = normalizeStr(targetStr)
  const cleanFull = normalizeStr(fullText)
  if (!cleanTarget || !cleanFull) return false

  // Exact substring check
  if (cleanFull.includes(cleanTarget)) return true

  // Split target words (e.g. "EYIDI JABEA" or "ESSOME ERNEST")
  const tokens = cleanTarget.split(' ').filter(t => t.length >= 3)
  if (tokens.length === 0) return false

  for (const token of tokens) {
    if (cleanFull.includes(token)) return true

    // Levenshtein fuzzy match for OCR character confusion (e.g. O/0, I/1, S/5)
    const words = cleanFull.split(' ')
    for (const w of words) {
      if (Math.abs(w.length - token.length) <= 1) {
        if (levenshteinDistance(token, w) <= 1) return true
      }
    }
  }

  return false
}

function levenshteinDistance(a, b) {
  const m = a.length
  const n = b.length
  const d = []
  for (let i = 0; i <= m; i++) d[i] = [i]
  for (let j = 0; j <= n; j++) d[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        d[i][j] = d[i - 1][j - 1]
      } else {
        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + 1
        )
      }
    }
  }
  return d[m][n]
}

/**
 * Run OCR with auto-rotation (0°, 90°, 270°) to ensure text is read horizontally
 */
async function recognizeWithRotations(worker, imageSource, knownOrientation = 0, onProgress = null) {
  const anglesToTry = knownOrientation !== 0 ? [knownOrientation, 0] : [0, 90, 270]
  let combinedText = ''

  const img = await loadImageElement(imageSource)

  for (const angle of anglesToTry) {
    const canvas = rotateImageToCanvas(img, angle)
    try {
      const ret = await worker.recognize(canvas)
      const text = ret?.data?.text || ''
      combinedText += '\n' + text

      // If we found key Cameroon CNI anchor keywords, this orientation is optimal!
      const norm = normalizeStr(text)
      if (
        norm.includes('CAMEROUN') || 
        norm.includes('IDENTITE') || 
        norm.includes('REPUBLIQUE') ||
        norm.includes('NATIONAL') ||
        norm.includes('SURNAME') ||
        norm.includes('GIVEN') ||
        norm.includes('DELIVRANCE')
      ) {
        break
      }
    } catch (e) {
      console.warn(`OCR failed at ${angle}°:`, e)
    }
  }

  return combinedText
}

/**
 * Parse Machine Readable Zone (MRZ) - ICAO 9303 standard
 * Handles TD1 (3 lines of 30 characters - ID card) and TD3 (2 lines of 44 characters - Passport)
 */
export function parseMRZ(rawText) {
  if (!rawText) return null

  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.toUpperCase().replace(/[^A-Z0-9<]/g, '').trim())
    .filter(line => line.includes('<<') || (line.length >= 28 && line.includes('<')))

  // 1. TD3 : Passeport (2 lignes de ~44 caractères)
  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = lines[i]
    const l2 = lines[i + 1]

    if ((l1.startsWith('P<') || l1.startsWith('P')) && l1.length >= 38 && l2.length >= 38) {
      const docType = 'P'
      const issuingCountry = l1.substring(2, 5).replace(/</g, '')
      const nameSection = l1.substring(5).split('<<')
      const surname = (nameSection[0] || '').replace(/</g, ' ').trim()
      const givenNames = (nameSection[1] || '').replace(/</g, ' ').trim()

      const docNumber = l2.substring(0, 9).replace(/</g, '')
      const nationality = l2.substring(10, 13).replace(/</g, '')
      const dob = l2.substring(13, 19).replace(/</g, '') // YYMMDD
      const sex = l2.charAt(20)
      const expirationDate = l2.substring(21, 27).replace(/</g, '') // YYMMDD

      return {
        format: 'TD3',
        docType,
        issuingCountry,
        surname,
        givenNames,
        docNumber,
        nationality,
        dob,
        sex,
        expirationDate,
        rawLines: [l1, l2]
      }
    }
  }

  // 2. TD1 : Carte Nationale d'Identité / Titre de Séjour (3 lignes de ~30 caractères)
  for (let i = 0; i < lines.length - 2; i++) {
    const l1 = lines[i]
    const l2 = lines[i + 1]
    const l3 = lines[i + 2]

    if ((l1.startsWith('I') || l1.startsWith('A') || l1.startsWith('C')) && l1.length >= 26 && l2.length >= 26 && l3.length >= 26) {
      const docType = 'I'
      const issuingCountry = l1.substring(2, 5).replace(/</g, '')
      const docNumber = l1.substring(5, 14).replace(/</g, '')

      const dob = l2.substring(0, 6).replace(/</g, '') // YYMMDD
      const sex = l2.charAt(7)
      const expirationDate = l2.substring(8, 14).replace(/</g, '') // YYMMDD
      const nationality = l2.substring(15, 18).replace(/</g, '')

      const nameSection = l3.split('<<')
      const surname = (nameSection[0] || '').replace(/</g, ' ').trim()
      const givenNames = (nameSection[1] || '').replace(/</g, ' ').trim()

      return {
        format: 'TD1',
        docType,
        issuingCountry,
        surname,
        givenNames,
        docNumber,
        nationality,
        dob,
        sex,
        expirationDate,
        rawLines: [l1, l2, l3]
      }
    }
  }

  return null
}

const MONTH_NAMES = {
  '01': ['JANVIER', 'JAN', 'JANUARY'],
  '02': ['FEVRIER', 'FEV', 'FEBRUARY', 'FEB'],
  '03': ['MARS', 'MAR', 'MARCH'],
  '04': ['AVRIL', 'AVR', 'APRIL', 'APR'],
  '05': ['MAI', 'MAY'],
  '06': ['JUIN', 'JUN', 'JUNE'],
  '07': ['JUILLET', 'JUIL', 'JULY', 'JUL'],
  '08': ['AOUT', 'AUG', 'AUGUST'],
  '09': ['SEPTEMBRE', 'SEP', 'SEPTEMBER'],
  '10': ['OCTOBRE', 'OCT', 'OCTOBER'],
  '11': ['NOVEMBRE', 'NOV', 'NOVEMBER'],
  '12': ['DECEMBRE', 'DEC', 'DECEMBER']
}

function matchDateInText(dateYYYYMMDD, text, mrzYYMMDD = null, isExpiration = false) {
  if (!dateYYYYMMDD) return null
  const cleanOcr = normalizeStr(text)

  // 1. Comparaison avec la bande MRZ si présente (Exactitude maximale)
  if (mrzYYMMDD && mrzYYMMDD.length === 6) {
    const parts = dateYYYYMMDD.split('-')
    if (parts.length === 3) {
      const userYYMMDD = parts[0].slice(-2) + parts[1] + parts[2]
      if (userYYMMDD === mrzYYMMDD) {
        return true
      }
    }
  }

  const parts = dateYYYYMMDD.split('-')
  if (parts.length !== 3) return false
  const [year, month, day] = parts
  const shortYear = year.slice(-2)

  // 2. Variations directes
  const variations = [
    `${day} ${month} ${year}`,
    `${day}/${month}/${year}`,
    `${day}.${month}.${year}`,
    `${day}-${month}-${year}`,
    `${year}-${month}-${day}`,
    `${year}/${month}/${day}`,
    `${year}.${month}.${day}`,
    `${day}${month}${year}`,
    `${year}${month}${day}`,
    `${day} ${month} ${shortYear}`,
    `${day}/${month}/${shortYear}`,
    `${day}.${month}.${shortYear}`,
    `${day}-${month}-${shortYear}`
  ]

  for (const v of variations) {
    if (cleanOcr.includes(normalizeStr(v))) {
      return true
    }
  }

  // 3. Mois en toutes lettres (Français / Anglais)
  const monthNames = MONTH_NAMES[month] || []
  for (const mName of monthNames) {
    if (cleanOcr.includes(mName)) {
      if (cleanOcr.includes(year) || cleanOcr.includes(day)) {
        return true
      }
    }
  }

  // 4. Proximité année et jour/mois
  const hasYear = cleanOcr.includes(year)
  const hasDay = cleanOcr.includes(day)
  const hasMonth = cleanOcr.includes(month)
  if (hasYear && (hasDay || hasMonth)) {
    return true
  }

  return false
}

function matchDocumentType(claimedType, text, mrzData = null) {
  if (!claimedType) return null
  const norm = normalizeStr(text)

  if (mrzData) {
    if (claimedType === 'Passeport' && mrzData.docType === 'P') return true
    if (claimedType === 'CNI' && mrzData.docType === 'I') return true
  }

  if (claimedType === 'Passeport') {
    return norm.includes('PASSEPORT') || norm.includes('PASSPORT') || norm.includes('REPUBLIQUE')
  }

  if (claimedType === 'CNI') {
    return norm.includes('CARTE NATIONALE') || norm.includes('IDENTITE') || norm.includes('IDENTITY') || norm.includes('CAMEROUN') || norm.includes('CMR') || norm.includes('NATIONAL')
  }

  if (claimedType === 'Carte Résident') {
    return norm.includes('RESIDENT') || norm.includes('SEJOUR') || norm.includes('TITRE')
  }

  if (claimedType === 'Permis de Conduire') {
    return norm.includes('PERMIS') || norm.includes('CONDUIRE') || norm.includes('DRIVING')
  }

  return true
}

/**
 * Run OCR on ID card (Recto + Verso) and compare extracted text with user fields
 * @param {string} rectoBase64 
 * @param {string} versoBase64 
 * @param {Object} fields - { nom, prenom, dob, num_piece, expiration_piece, piece, adresse, employeur }
 * @param {Function} onProgress - status callback
 * @param {number} knownOrientation - orientation from face detector (if known)
 * @param {string} domicileBase64 - optional proof of address
 * @param {string} fondsBase64 - optional proof of funds
 */
export async function verifyIDDocumentOCR(
  rectoBase64,
  versoBase64 = null,
  fields = {},
  onProgress = null,
  knownOrientation = 0,
  domicileBase64 = null,
  fondsBase64 = null
) {
  if (!rectoBase64 && !versoBase64) {
    return {
      success: false,
      message: "Aucune image de pièce fournie pour l'analyse OCR.",
      results: {}
    }
  }

  let worker = null
  try {
    if (onProgress) onProgress("Initialisation de la reconnaissance de texte (OCR)...")

    worker = await createWorker(['fra', 'eng'], 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/core',
      langPath: '/ocr/lang',
      workerBlobURL: false,
      logger: m => {
        if (onProgress && m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100)
          onProgress(`Lecture des mentions de la pièce... ${pct}%`)
        }
      }
    })

    let rawText = ''

    // 1. Scan Recto
    if (rectoBase64) {
      const rectoText = await recognizeWithRotations(worker, rectoBase64, knownOrientation, onProgress)
      rawText += '\n' + rectoText
    }

    // 2. Scan Verso (often contains unique ID, expiration date and MRZ line)
    if (versoBase64) {
      const versoText = await recognizeWithRotations(worker, versoBase64, knownOrientation, onProgress)
      rawText += '\n' + versoText
    }

    const cleanOcr = normalizeStr(rawText)

    // 3. Détection de bande MRZ officielle (ICAO 9303)
    const mrzData = parseMRZ(rawText)

    // 4. Concordance Nom & Prénom (avec gestion des inversions et du MRZ)
    let nomMatch = false
    let prenomMatch = false

    if (mrzData && mrzData.surname) {
      nomMatch = Boolean(
        fields.nom && (
          tokenMatchesInText(fields.nom, mrzData.surname) ||
          tokenMatchesInText(fields.nom, mrzData.givenNames)
        )
      )
      prenomMatch = Boolean(
        fields.prenom && (
          tokenMatchesInText(fields.prenom, mrzData.givenNames) ||
          tokenMatchesInText(fields.prenom, mrzData.surname)
        )
      )
    }

    if (!nomMatch && fields.nom) {
      nomMatch = Boolean(
        tokenMatchesInText(fields.nom, cleanOcr) ||
        (fields.prenom && tokenMatchesInText(fields.nom + ' ' + fields.prenom, cleanOcr))
      )
    }

    if (!prenomMatch && fields.prenom) {
      prenomMatch = Boolean(
        tokenMatchesInText(fields.prenom, cleanOcr) ||
        (fields.nom && tokenMatchesInText(fields.prenom + ' ' + fields.nom, cleanOcr))
      )
    }

    // 5. Concordance Numéro de pièce
    let numPieceMatch = false
    if (fields.num_piece) {
      const cleanNum = normalizeStr(fields.num_piece).replace(/\s+/g, '')
      const compactOcr = cleanOcr.replace(/\s+/g, '')

      if (mrzData && mrzData.docNumber) {
        const cleanMrzNum = normalizeStr(mrzData.docNumber).replace(/\s+/g, '')
        numPieceMatch = cleanNum.includes(cleanMrzNum) || cleanMrzNum.includes(cleanNum)
      }

      if (!numPieceMatch) {
        numPieceMatch = cleanNum.length >= 4 && (compactOcr.includes(cleanNum) || tokenMatchesInText(cleanNum, compactOcr))
      }
    }

    // 6. Concordance Date de Naissance
    const dobMatch = Boolean(fields.dob && matchDateInText(fields.dob, cleanOcr, mrzData?.dob, false))

    // 7. Concordance Date d'expiration
    let expirationMatch = null
    if (fields.expiration_piece) {
      expirationMatch = Boolean(matchDateInText(fields.expiration_piece, cleanOcr, mrzData?.expirationDate, true))
    }

    // 8. Concordance Type de document
    const docTypeMatch = Boolean(matchDocumentType(fields.piece, cleanOcr, mrzData))

    // 9. Vérification facultative du justificatif de domicile (Bloc 4)
    let domicileMatch = null
    if (domicileBase64) {
      try {
        if (onProgress) onProgress("Vérification du justificatif de domicile...")
        const domText = await recognizeWithRotations(worker, domicileBase64, 0)
        const domNorm = normalizeStr(domText)
        const nomInDom = Boolean(fields.nom && tokenMatchesInText(fields.nom, domNorm))
        const prenomInDom = Boolean(fields.prenom && tokenMatchesInText(fields.prenom, domNorm))
        const cityInDom = Boolean(fields.adresse && tokenMatchesInText(fields.adresse, domNorm))
        const isUtilityBill = domNorm.includes('ENEO') || domNorm.includes('CAMWATER') || domNorm.includes('FACTURE') || domNorm.includes('EAU') || domNorm.includes('ELECTRICITE') || domNorm.includes('RESIDENCE') || domNorm.includes('CERTIFICAT') || domNorm.includes('DOMICILE') || domNorm.includes('RELEVE')

        domicileMatch = (nomInDom || prenomInDom) || (cityInDom && isUtilityBill) || isUtilityBill
      } catch (domErr) {
        console.warn('Erreur OCR justificatif domicile:', domErr)
      }
    }

    // 10. Vérification facultative du justificatif d'origine des fonds (Bloc 5)
    let fondsMatch = null
    if (fondsBase64) {
      try {
        if (onProgress) onProgress("Vérification du justificatif d'origine des fonds...")
        const fondsText = await recognizeWithRotations(worker, fondsBase64, 0)
        const fondsNorm = normalizeStr(fondsText)
        const nomInFonds = Boolean(fields.nom && tokenMatchesInText(fields.nom, fondsNorm))
        const employerInFonds = Boolean(fields.employeur && tokenMatchesInText(fields.employeur, fondsNorm))
        const isFinancialDoc = fondsNorm.includes('SALAIRE') || fondsNorm.includes('BULLETIN') || fondsNorm.includes('PAIE') || fondsNorm.includes('VIREMENT') || fondsNorm.includes('CONTRAT') || fondsNorm.includes('REVENU') || fondsNorm.includes('IMPOT') || fondsNorm.includes('RCCM') || fondsNorm.includes('HONORAIRE') || fondsNorm.includes('ATTESTATION') || fondsNorm.includes('EMPLOYEUR') || fondsNorm.includes('BANQUE')

        fondsMatch = (nomInFonds && isFinancialDoc) || (employerInFonds && isFinancialDoc) || isFinancialDoc
      } catch (fondsErr) {
        console.warn('Erreur OCR justificatif fonds:', fondsErr)
      }
    }

    // Calcul du score de conformité
    let matchesCount = 0
    let totalChecked = 0
    if (fields.nom) { totalChecked++; if (nomMatch) matchesCount++ }
    if (fields.prenom) { totalChecked++; if (prenomMatch) matchesCount++ }
    if (fields.num_piece) { totalChecked++; if (numPieceMatch) matchesCount++ }
    if (fields.dob) { totalChecked++; if (dobMatch) matchesCount++ }
    if (fields.expiration_piece) { totalChecked++; if (expirationMatch) matchesCount++ }
    if (fields.piece) { totalChecked++; if (docTypeMatch) matchesCount++ }

    const ocrConfidence = totalChecked > 0 ? Math.round((matchesCount / totalChecked) * 100) : 0
    const isValid = (mrzData !== null && (nomMatch || numPieceMatch)) || (nomMatch && (prenomMatch || dobMatch || numPieceMatch)) || ocrConfidence >= 60

    return {
      success: isValid,
      ocrConfidence,
      matchesCount,
      totalChecked,
      nomMatch,
      prenomMatch,
      dobMatch,
      numPieceMatch,
      expirationMatch,
      docTypeMatch,
      domicileMatch,
      fondsMatch,
      mrzDetected: Boolean(mrzData),
      mrzData,
      rawSnippet: rawText.slice(0, 450),
      message: isValid
        ? `Informations fournies concordantes avec vos documents (${ocrConfidence}% de correspondance).`
        : `Certaines informations fournies ne correspondent pas exactement aux mentions détectées (${ocrConfidence}%). Vérifiez votre saisie.`
    }
  } catch (err) {
    console.error('Erreur analyse OCR:', err)
    return {
      success: false,
      isFallback: true,
      ocrConfidence: 0,
      nomMatch: false,
      prenomMatch: false,
      dobMatch: false,
      numPieceMatch: false,
      expirationMatch: false,
      docTypeMatch: false,
      domicileMatch: null,
      fondsMatch: null,
      mrzDetected: false,
      mrzData: null,
      message: "Analyse OCR déléguée à la vérification humaine."
    }
  } finally {
    if (worker) {
      try {
        await worker.terminate()
      } catch (e) {
        // ignore
      }
    }
  }
}

/**
 * Helper to parse dates and numbers from raw OCR text
 */
function extractDetectedInfoFromText(cleanText) {
  const dates = cleanText.match(/\b\d{2}[.\/-]\d{2}[.\/-]\d{4}\b/g) || []
  const longNumbers = cleanText.match(/\b\d{9,18}\b/g) || []
  return {
    dates,
    longNumbers
  }
}
