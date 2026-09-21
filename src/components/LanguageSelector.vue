<script setup>
import { useLanguageStore } from '../stores/language'

const languageStore = useLanguageStore()

const selectLang = (lang) => {
  if (languageStore.currentLang !== lang) {
    languageStore.setLanguage(lang)
    window.location.reload()
  }
}
</script>

<template>
  <div class="inline-flex items-center bg-slate-100/90 backdrop-blur-md p-1 rounded-full border border-slate-200/80 shadow-xs z-50">
    <button 
      type="button"
      @click="selectLang('fr')" 
      :class="languageStore.currentLang === 'fr' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500 hover:text-slate-700 font-bold'"
      class="px-2.5 py-1 rounded-full text-[11px] transition-all uppercase tracking-wider"
      aria-label="Français"
    >
      FR
    </button>
    <button 
      type="button"
      @click="selectLang('en')" 
      :class="languageStore.currentLang === 'en' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500 hover:text-slate-700 font-bold'"
      class="px-2.5 py-1 rounded-full text-[11px] transition-all uppercase tracking-wider"
      aria-label="English"
    >
      EN
    </button>
  </div>
</template>
