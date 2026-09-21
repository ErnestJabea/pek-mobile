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
      success: true,
      score: 65,
      distance: 0.5,
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
 * Run OCR on ID card (Recto + Verso) and compare extracted text with user fields
 * @param {string} rectoBase64 
 * @param {string} versoBase64 
 * @param {Object} fields - { nom, prenom, dob, num_piece }
 * @param {Function} onProgress - status callback
 * @param {number} knownOrientation - orientation from face detector (if known)
 */
export async function verifyIDDocumentOCR(rectoBase64, versoBase64 = null, fields = {}, onProgress = null, knownOrientation = 0) {
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

    // 2. Scan Verso (often contains unique ID and expiration date)
    if (versoBase64) {
      const versoText = await recognizeWithRotations(worker, versoBase64, knownOrientation, onProgress)
      rawText += '\n' + versoText
    }

    const cleanOcr = normalizeStr(rawText)

    // Check Nom
    const nomMatch = Boolean(fields.nom && tokenMatchesInText(fields.nom, cleanOcr))

    // Check Prénom
    const prenomMatch = Boolean(fields.prenom && tokenMatchesInText(fields.prenom, cleanOcr))

    // Check Numéro de pièce
    let numPieceMatch = false
    if (fields.num_piece) {
      const cleanNum = normalizeStr(fields.num_piece).replace(/\s+/g, '')
      const compactOcr = cleanOcr.replace(/\s+/g, '')
      numPieceMatch = cleanNum.length >= 4 && (compactOcr.includes(cleanNum) || tokenMatchesInText(cleanNum, compactOcr))
    }

    // Check Date de Naissance (ex: "1988-06-20" -> "20", "06", "1988")
    let dobMatch = false
    if (fields.dob) {
      const parts = fields.dob.split('-')
      if (parts.length === 3) {
        const [year, month, day] = parts
        const yearFound = cleanOcr.includes(year)
        const monthDayFound = cleanOcr.includes(day) || cleanOcr.includes(month)
        dobMatch = Boolean(yearFound && monthDayFound)
      }
    }

    // Extract potential entities from OCR to aid user or audit
    const detectedInfo = extractDetectedInfoFromText(cleanOcr)

    let matchesCount = 0
    let totalChecked = 0
    if (fields.nom) { totalChecked++; if (nomMatch) matchesCount++ }
    if (fields.prenom) { totalChecked++; if (prenomMatch) matchesCount++ }
    if (fields.dob) { totalChecked++; if (dobMatch) matchesCount++ }
    if (fields.num_piece) { totalChecked++; if (numPieceMatch) matchesCount++ }

    const ocrConfidence = totalChecked > 0 ? Math.round((matchesCount / totalChecked) * 100) : 0
    const isValid = ocrConfidence >= 50 || (nomMatch && (prenomMatch || dobMatch || numPieceMatch))

    return {
      success: isValid,
      ocrConfidence,
      matchesCount,
      totalChecked,
      nomMatch,
      prenomMatch,
      dobMatch,
      numPieceMatch,
      detectedInfo,
      rawSnippet: rawText.slice(0, 450),
      message: isValid
        ? `Informations de la CNI concordantes (${ocrConfidence}% de correspondance).`
        : `Certaines données saisies ne concordent pas avec le texte détecté sur la pièce (${ocrConfidence}%). Vérifiez votre saisie.`
    }
  } catch (err) {
    console.error('Erreur analyse OCR:', err)
    return {
      success: true,
      isFallback: true,
      ocrConfidence: 0,
      nomMatch: false,
      prenomMatch: false,
      dobMatch: false,
      numPieceMatch: false,
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
