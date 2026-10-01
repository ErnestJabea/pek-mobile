/**
 * Résout une URL de document (dépliant, DICI, etc.) vers la bonne URL accessible.
 * - Si VITE_API_URL pointe vers un domaine distant (ex: https://pek-api-v2.koriassetmanagement.com),
 *   les chemins relatifs /storage/... sont résolus avec l'origine de l'API.
 * - En développement local avec proxy Vite, les chemins relatifs passent par le serveur de dev.
 */
export const getFrontendDocumentUrl = (url) => {
  if (!url) return ''

  // Si c'est déjà une URL absolue http(s)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const apiUrl = import.meta.env.VITE_API_URL || ''
    if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
      try {
        const apiOrigin = new URL(apiUrl).origin
        const parsed = new URL(url)
        // Si l'URL retournée par le backend pointe vers localhost/127.0.0.1 alors qu'on utilise une API distante
        if (parsed.origin !== apiOrigin && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')) {
          return `${apiOrigin}${parsed.pathname}${parsed.search}`
        }
      } catch (e) {
        // Ignorer l'erreur de parsing
      }
    }
    return url
  }

  // Si c'est un chemin relatif (ex: /storage/... ou /api/...)
  const apiUrl = import.meta.env.VITE_API_URL || ''
  if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
    try {
      const apiOrigin = new URL(apiUrl).origin
      return `${apiOrigin}${url.startsWith('/') ? url : `/${url}`}`
    } catch (e) {
      // Ignorer
    }
  }

  return url.startsWith('/') ? url : `/${url}`
}

/**
 * Télécharge un document de manière programmatique et fiable (Blob + download anchor)
 * Fonctionne parfaitement sur PC, Mac, navigateurs mobiles et applications PWA.
 * 
 * @param {string} url - URL du fichier ou endpoint de téléchargement (/api/v1/products/1/download/depliant)
 * @param {string} fallbackFilename - Nom du fichier de secours (ex: depliant-fcp-kori.pdf)
 * @returns {Promise<boolean>}
 */
export const downloadDocument = async (url, fallbackFilename = 'document.pdf') => {
  if (!url) return false

  const targetUrl = getFrontendDocumentUrl(url)

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      credentials: 'omit',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)

    // Extraire le nom de fichier officiel depuis le header Content-Disposition si disponible
    let filename = fallbackFilename
    const disposition = response.headers.get('content-disposition')
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '').trim()
      }
    }

    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl)
    }, 2000)

    return true
  } catch (error) {
    console.warn('Téléchargement direct Blob impossible, tentative d\'ouverture directe :', error)
    // Repli de secours : ouverture dans un nouvel onglet ou navigation directe
    window.open(targetUrl, '_blank')
    return false
  }
}
