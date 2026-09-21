<script setup>
import { computed } from 'vue'
import { Check, ShieldAlert, ShieldCheck } from 'lucide-vue-next'
import { useLanguageStore } from '../stores/language'

const props = defineProps({
  password: {
    type: String,
    default: ''
  },
  confirmation: {
    type: String,
    default: ''
  },
  showConfirmationCriteria: {
    type: Boolean,
    default: true
  }
})

const languageStore = useLanguageStore()

const criteria = computed(() => {
  const pwd = props.password || ''
  const conf = props.confirmation || ''

  const list = [
    {
      id: 'length',
      label: languageStore.t('pwd_crit_min_length'),
      valid: pwd.length >= 12
    },
    {
      id: 'uppercase',
      label: languageStore.t('pwd_crit_uppercase'),
      valid: /[A-Z]/.test(pwd)
    },
    {
      id: 'lowercase',
      label: languageStore.t('pwd_crit_lowercase'),
      valid: /[a-z]/.test(pwd)
    },
    {
      id: 'number',
      label: languageStore.t('pwd_crit_number'),
      valid: /[0-9]/.test(pwd)
    },
    {
      id: 'special',
      label: languageStore.t('pwd_crit_special'),
      valid: /[^A-Za-z0-9]/.test(pwd)
    }
  ]

  if (props.showConfirmationCriteria) {
    list.push({
      id: 'match',
      label: languageStore.t('pwd_crit_match'),
      valid: Boolean(pwd.length > 0 && conf.length > 0 && pwd === conf)
    })
  }

  return list
})

// Strength calculation (based only on the password itself)
const passwordScore = computed(() => {
  const pwd = props.password || ''
  if (!pwd) return 0

  let score = 0
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++

  return score // 0 to 4
})

const strengthMeta = computed(() => {
  const score = passwordScore.value
  const hasInput = (props.password || '').length > 0

  if (!hasInput) {
    return {
      level: 0,
      label: '',
      colorBg: 'bg-slate-200',
      colorText: 'text-slate-400'
    }
  }

  if (score <= 1) {
    return {
      level: 1,
      label: languageStore.t('pwd_strength_weak'),
      colorBg: 'bg-rose-500',
      colorText: 'text-rose-500'
    }
  }

  if (score === 2) {
    return {
      level: 2,
      label: languageStore.t('pwd_strength_medium'),
      colorBg: 'bg-amber-500',
      colorText: 'text-amber-600'
    }
  }

  if (score === 3) {
    return {
      level: 3,
      label: languageStore.t('pwd_strength_strong'),
      colorBg: 'bg-blue-500',
      colorText: 'text-blue-600'
    }
  }

  return {
    level: 4,
    label: languageStore.t('pwd_strength_very_secure'),
    colorBg: 'bg-emerald-500',
    colorText: 'text-emerald-600'
  }
})
</script>

<template>
  <div class="bg-slate-50/80 border border-slate-100 rounded-2xl p-3.5 space-y-3 transition-all duration-300">
    <!-- Header with strength indicator -->
    <div class="flex items-center justify-between text-xs">
      <div class="flex items-center gap-1.5 font-bold text-slate-700">
        <component :is="passwordScore >= 4 ? ShieldCheck : ShieldAlert" class="w-4 h-4" :class="passwordScore >= 4 ? 'text-emerald-500' : 'text-slate-400'" />
        <span>{{ languageStore.t('password_security_title') }}</span>
      </div>
      <span v-if="strengthMeta.label" class="font-extrabold text-[11px] uppercase tracking-wider transition-colors duration-300" :class="strengthMeta.colorText">
        {{ strengthMeta.label }}
      </span>
    </div>

    <!-- Segmented Strength Bar -->
    <div class="grid grid-cols-4 gap-1.5 h-1.5 w-full">
      <div 
        v-for="index in 4" 
        :key="index"
        class="h-full rounded-full transition-all duration-300"
        :class="index <= strengthMeta.level ? strengthMeta.colorBg : 'bg-slate-200/70'"
      />
    </div>

    <!-- Criteria list -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1.5 pt-1">
      <div 
        v-for="item in criteria" 
        :key="item.id"
        class="flex items-center gap-2 text-xs transition-colors duration-200"
        :class="item.valid ? 'text-emerald-700 font-semibold' : 'text-slate-400 font-normal'"
      >
        <div 
          class="w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0"
          :class="item.valid ? 'bg-emerald-500 text-white shadow-xs' : 'bg-slate-200 text-transparent'"
        >
          <Check class="w-2.5 h-2.5 stroke-[3]" />
        </div>
        <span class="text-[11px] leading-tight">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>
