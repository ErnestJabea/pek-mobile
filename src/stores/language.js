import { defineStore } from 'pinia'
import { ref } from 'vue'
import { translations } from '../locales/translations'

export const useLanguageStore = defineStore('language', () => {
  const currentLang = ref(localStorage.getItem('lang') || 'fr')

  const setLanguage = (lang) => {
    if (['fr', 'en'].includes(lang)) {
      currentLang.value = lang
      localStorage.setItem('lang', lang)
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
