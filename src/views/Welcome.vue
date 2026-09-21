<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { TrendingUp, ShieldCheck, Wallet, ChevronRight, ChevronLeft } from 'lucide-vue-next'
import { useLanguageStore } from '../stores/language'
import LanguageSelector from '../components/LanguageSelector.vue'

const router = useRouter()
const languageStore = useLanguageStore()
const currentSlide = ref(0)

const slides = computed(() => [
  {
    icon: TrendingUp,
    title: languageStore.t('slide1_title'),
    description: languageStore.t('slide1_desc'),
    color: "text-blue-600 bg-blue-50"
  },
  {
    icon: ShieldCheck,
    title: languageStore.t('slide2_title'),
    description: languageStore.t('slide2_desc'),
    color: "text-emerald-600 bg-emerald-50"
  },
  {
    icon: Wallet,
    title: languageStore.t('slide3_title'),
    description: languageStore.t('slide3_desc'),
    color: "text-amber-600 bg-amber-50"
  }
])

const nextSlide = () => {
  if (currentSlide.value < slides.value.length - 1) {
    currentSlide.value++
  }
}

const prevSlide = () => {
  if (currentSlide.value > 0) {
    currentSlide.value--
  }
}

const finishOnboarding = () => {
  localStorage.setItem('pek_welcome_seen', 'true')
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-white flex flex-col justify-between p-6 max-width-container mx-auto relative">
    <!-- Top Bar with Language Selector and Skip Button -->
    <div class="flex items-center justify-between pt-4">
      <LanguageSelector />

      <button 
        v-if="currentSlide < slides.length - 1"
        @click="finishOnboarding" 
        class="text-slate-400 hover:text-slate-600 text-xs font-black uppercase tracking-wider transition-colors px-2 py-1"
      >
        {{ languageStore.t('skip') }}
      </button>
      <div v-else class="h-4"></div>
    </div>

    <!-- Slide Content -->
    <div class="flex-1 flex flex-col items-center justify-center my-8">
      <!-- Animated Slide transition-like reactive display -->
      <div 
        :key="currentSlide + '-' + languageStore.currentLang" 
        class="space-y-8 text-center animate-in fade-in slide-in-from-bottom-6 duration-500 flex flex-col items-center max-w-sm"
      >
        <!-- Large Floating Icon Container -->
        <div :class="[slides[currentSlide].color, 'w-24 h-24 rounded-[32px] flex items-center justify-center shadow-xl shadow-slate-100 transition-all duration-300']">
          <component :is="slides[currentSlide].icon" class="w-12 h-12" />
        </div>

        <div class="space-y-4">
          <h2 class="text-2xl font-black text-slate-900 leading-tight">
            {{ slides[currentSlide].title }}
          </h2>
          <p class="text-slate-500 text-sm leading-relaxed px-4 font-medium">
            {{ slides[currentSlide].description }}
          </p>
        </div>
      </div>
    </div>

    <!-- Bottom Controls -->
    <div class="space-y-8 pb-8 flex flex-col items-center">
      <!-- Slide Indicator Dots -->
      <div class="flex gap-2">
        <button 
          v-for="(slide, index) in slides" 
          :key="index"
          @click="currentSlide = index"
          :class="[
            'h-2 rounded-full transition-all duration-300',
            currentSlide === index ? 'bg-primary w-6' : 'bg-slate-200 w-2'
          ]"
          :aria-label="'Slide ' + (index + 1)"
        ></button>
      </div>

      <!-- Action Buttons -->
      <div class="w-full flex items-center gap-4">
        <!-- Back Button -->
        <button 
          v-if="currentSlide > 0"
          @click="prevSlide"
          class="flex-1 bg-slate-100 text-slate-600 font-black py-4.5 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2"
        >
          <ChevronLeft class="w-4 h-4" />
          {{ languageStore.t('prev') }}
        </button>

        <!-- Next / Start Button -->
        <button 
          @click="currentSlide === slides.length - 1 ? finishOnboarding() : nextSlide()"
          class="flex-1 bg-primary text-white font-black py-4.5 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          <span>
            {{ currentSlide === slides.length - 1 ? languageStore.t('start') : languageStore.t('next') }}
          </span>
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.max-width-container {
  max-width: 480px;
}
</style>
