import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api/api'
import { useLanguageStore } from './language'
import { translations } from '../locales/translations'

export const useAppContentStore = defineStore('appContent', () => {
  const languageStore = useLanguageStore()
  const contents = ref(JSON.parse(localStorage.getItem('pek_app_contents') || '{}'))
  const loading = ref(false)
  const isLoaded = ref(false)

  // Fetch dynamic contents from API with silent fallback
  const fetchContents = async () => {
    loading.value = true
    try {
      const response = await api.get('/app-contents')
      if (response.data && typeof response.data === 'object') {
        contents.value = response.data
        localStorage.setItem('pek_app_contents', JSON.stringify(response.data))
        isLoaded.value = true
      }
    } catch {
      // Endpoint may not be deployed yet or device is offline - silently preserve local cache or defaults
    } finally {
      loading.value = false
    }
  }

  // Get dynamic content item with fallback
  const getItem = (key) => {
    return contents.value[key] || null
  }

  // Get localized text for a key with fallback to static translation or default text
  const t = (key, fallbackKey = null, defaultText = '') => {
    const item = contents.value[key]
    const isEn = languageStore.isEn()
    if (item) {
      if (isEn && item.body_en) return item.body_en
      if (!isEn && item.body_fr) return item.body_fr
      if (isEn && item.title_en) return item.title_en
      if (!isEn && item.title_fr) return item.title_fr
    }
    const currentDict = translations[languageStore.currentLang] || translations.fr || {}
    if (fallbackKey && currentDict[fallbackKey]) return currentDict[fallbackKey]
    if (fallbackKey && translations.fr?.[fallbackKey]) return translations.fr[fallbackKey]
    return defaultText || languageStore.t(fallbackKey || key, defaultText)
  }

  // Get localized title for a key
  const getTitle = (key, fallbackKey = null, defaultText = '') => {
    const item = contents.value[key]
    const isEn = languageStore.isEn()
    if (item) {
      if (isEn && item.title_en) return item.title_en
      if (!isEn && item.title_fr) return item.title_fr
    }
    const currentDict = translations[languageStore.currentLang] || translations.fr || {}
    if (fallbackKey && currentDict[fallbackKey]) return currentDict[fallbackKey]
    if (fallbackKey && translations.fr?.[fallbackKey]) return translations.fr[fallbackKey]
    return defaultText || languageStore.t(fallbackKey || key, defaultText)
  }

  // Get localized banner with title, body, image, and metadata
  const getBanner = (key, defaultTitle = '', defaultBody = '') => {
    const item = contents.value[key]
    const isEn = languageStore.isEn()
    if (!item) {
      return {
        title: defaultTitle,
        body: defaultBody,
        image_url: null,
        metadata: {}
      }
    }
    const meta = item.metadata || {}
    const button_text = isEn 
      ? (meta.button_text_en || meta.button_text_fr || meta.button_text || '') 
      : (meta.button_text_fr || meta.button_text || '')
    return {
      title: isEn ? (item.title_en || item.title_fr || defaultTitle) : (item.title_fr || defaultTitle),
      body: isEn ? (item.body_en || item.body_fr || defaultBody) : (item.body_fr || defaultBody),
      image_url: item.image_url || item.image_path || null,
      metadata: { ...meta, button_text }
    }
  }

  return {
    contents,
    loading,
    isLoaded,
    fetchContents,
    getItem,
    t,
    getTitle,
    getBanner
  }
})
