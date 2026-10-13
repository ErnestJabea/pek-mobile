import { defineStore } from 'pinia'
import { ref } from 'vue'
import { translations } from '../locales/translations'

import api from '../api/api'

export const useLanguageStore = defineStore('language', () => {
  const currentLang = ref(localStorage.getItem('lang') || 'fr')

  const setLanguage = async (lang) => {
    if (['fr', 'en'].includes(lang)) {
      currentLang.value = lang
      localStorage.setItem('lang', lang)

      const token = localStorage.getItem('token')
      if (token && token !== 'cookie_session') {
        try {
          await api.post('/user/locale', { locale: lang })
        } catch {
          // Erreur réseau ou non-bloquant
        }
      }
    }
  }

  const isEn = () => currentLang.value === 'en'

  const t = (key, defaultText = null) => {
    const langDict = translations[currentLang.value] || translations.fr || {}
    const res = langDict[key] ?? translations.fr?.[key]
    if (res !== undefined && res !== null) return res
    if (defaultText !== null && defaultText !== undefined) return defaultText
    return key
  }

  return {
    currentLang,
    setLanguage,
    isEn,
    t
  }
})
