/**
 * Universal clipboard copy helper for Web & PWA (Desktop, Android, iOS Safari)
 * Supports modern navigator.clipboard with robust textarea fallback for
 * non-secure contexts, webviews, and restrictive browser permissions.
 *
 * @param {string} text - Text to copy to clipboard
 * @returns {Promise<boolean>} - True if text was copied successfully
 */
export const copyTextToClipboard = async (text) => {
  if (!text) return false

  // 1. Try modern asynchronous Clipboard API if available and permitted
  if (navigator?.clipboard?.writeText && (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, falling back to execCommand:', err)
    }
  }

  // 2. Cross-browser fallback using temporary textarea
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text

    // Ensure element is off-screen without causing page layout jumps
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.setAttribute('readonly', '')

    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    // Required for mobile iOS Safari compatibility
    textArea.setSelectionRange(0, text.length)

    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch (err) {
    console.error('execCommand copy failed:', err)
    return false
  }
}
