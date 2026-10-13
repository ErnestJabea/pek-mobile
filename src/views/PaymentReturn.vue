<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-vue-next'
import api from '../api/api'
import { isS3pPayment, mobileRetryMode, verifyMobileRetry } from '../services/mobilePaymentStatus'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const languageStore = useLanguageStore()
const subscriptionId = ref(Number.parseInt(String(route.query.subscription_id || ''), 10))
const providerReference = String(route.params.reference || '')
const checkoutSessionId = String(route.query.checkout_session_id || '')
const state = ref(route.query.canceled === '1' ? 'canceled' : 'checking')
const message = ref(route.query.canceled === '1'
  ? languageStore.t('payment_return_msg_canceled')
  : languageStore.t('payment_return_msg_checking'))
const attempts = ref(0)
const redirecting = ref(false)
const dashboardRedirectSeconds = ref(4)
const actionAdvice = ref('')
const canRetry = ref(false)
const mobilePayment = ref(false)
const errorLabel = ref('')
let timer = null
let dashboardTimer = null

const pageTitle = computed(() => {
  switch (state.value) {
    case 'paid': return languageStore.t('payment_return_paid')
    case 'checking': return languageStore.t('payment_return_checking')
    case 'canceled': return languageStore.t('payment_return_canceled')
    case 'failed': return languageStore.t('payment_return_failed')
    default: return languageStore.t('payment_return_pending')
  }
})

const validSubscription = computed(() => Number.isInteger(subscriptionId.value) && subscriptionId.value > 0)
const validProviderReference = computed(() => /^[A-Za-z0-9._:-]{1,36}$/.test(providerReference))
const validCheckoutSession = computed(() => /^cs_(?:test|live)_[A-Za-z0-9_]+$/.test(checkoutSessionId))

const allowedCheckoutHosts = (import.meta.env.VITE_PAYMENT_ALLOWED_HOSTS || 'checkout.stripe.com')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean)

const redirectToCheckout = (checkoutUrl) => {
  const url = new URL(checkoutUrl)
  if (url.protocol !== 'https:' || !allowedCheckoutHosts.includes(url.hostname.toLowerCase())) {
    throw new Error('URL de paiement non autorisée.')
  }
  window.location.assign(url.toString())
}

const goToDashboard = async () => {
  if (dashboardTimer) {
    window.clearInterval(dashboardTimer)
    dashboardTimer = null
  }

  if (authStore.isAuthenticated) {
    await router.replace('/home')
    return
  }

  await router.replace({ path: '/login', query: { redirect: '/home' } })
}

const scheduleDashboardRedirect = () => {
  if (dashboardTimer) return

  dashboardRedirectSeconds.value = 4
  dashboardTimer = window.setInterval(() => {
    dashboardRedirectSeconds.value -= 1
    if (dashboardRedirectSeconds.value <= 0) {
      goToDashboard()
    }
  }, 1000)
}

const confirmPayment = (confirmationMessage) => {
  state.value = 'paid'
  message.value = confirmationMessage || languageStore.t('payment_return_msg_paid')
  window.dispatchEvent(new Event('pek:notifications-refresh'))
  scheduleDashboardRedirect()
}

const checkStatus = async () => {
  if (timer) window.clearTimeout(timer)
  const canUseAuthenticatedStatus = authStore.isAuthenticated
    && (validSubscription.value || validProviderReference.value)

  if (!validCheckoutSession.value && !canUseAuthenticatedStatus) {
    state.value = 'failed'
    message.value = languageStore.t('payment_return_msg_invalid')
    return
  }

  try {
    const response = validCheckoutSession.value
      ? await api.post('/stripe/checkout-return', { session_id: checkoutSessionId })
      : await api.get(validSubscription.value
        ? `/subscriptions/${subscriptionId.value}/payment-status`
        : `/subscriptions/reference/${encodeURIComponent(providerReference)}/payment-status`)

    if (response.data.subscription?.id) {
      subscriptionId.value = Number(response.data.subscription.id)
    }
    attempts.value += 1
    message.value = response.data.message
    actionAdvice.value = response.data.action_advice || ''
    mobilePayment.value = isS3pPayment(response.data)
    const knownCheckout = validCheckoutSession.value || ['card', 'stripe', 'mobile_money'].includes(response.data.subscription?.moyen_paiement)
    canRetry.value = mobilePayment.value ? Boolean(mobileRetryMode(response.data)) : knownCheckout && response.data.can_retry !== false
    errorLabel.value = response.data.payment?.error_label || ''

    if (response.data.status === 'paid') {
      confirmPayment(response.data.message)
      return
    }
    if (response.data.status === 'failed') {
      state.value = 'failed'
      return
    }

    state.value = attempts.value >= 20 ? 'pending' : 'checking'
    if (state.value === 'checking') {
      timer = window.setTimeout(checkStatus, 2000)
    }
  } catch (error) {
    canRetry.value = false
    actionAdvice.value = ''
    errorLabel.value = ''
    const terminalError = [404, 409, 422].includes(error.response?.status)
    state.value = terminalError ? 'failed' : 'pending'
    message.value = error.response?.data?.message || languageStore.t('payment_return_msg_unavailable')
  }
}

const resumePayment = async () => {
  if (!authStore.isAuthenticated) {
    await router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  if (!validSubscription.value || redirecting.value) return
  redirecting.value = true
  try {
    if (mobilePayment.value) {
      const { data, mode } = await verifyMobileRetry(api, subscriptionId.value)
      mobilePayment.value = true
      canRetry.value = Boolean(mode)
      if (mode === 'new') {
        await router.push('/my-subscriptions')
        return
      }
      if (mode === 'resume') await api.post(`/subscriptions/${subscriptionId.value}/payment-session`)
      attempts.value = 0
      await checkStatus()
      return
    }
    const response = await api.post(`/subscriptions/${subscriptionId.value}/payment-session`)
    if (response.data.payment?.status === 'paid') {
      confirmPayment(languageStore.t('payment_return_msg_paid'))
      return
    }
    if (isS3pPayment(response.data)) {
      mobilePayment.value = true
      await checkStatus()
      return
    }
    redirectToCheckout(response.data.payment?.checkout_url)
  } catch (error) {
    state.value = 'failed'
    message.value = error.response?.data?.message || error.message || languageStore.t('payment_return_msg_unavailable')
  } finally {
    redirecting.value = false
  }
}

const openSubscriptions = () => {
  if (authStore.isAuthenticated) {
    return router.push('/my-subscriptions')
  }

  return router.push({ path: '/login', query: { redirect: '/my-subscriptions' } })
}

onMounted(() => {
  checkStatus()
})

onUnmounted(() => {
  if (timer) window.clearTimeout(timer)
  if (dashboardTimer) window.clearInterval(dashboardTimer)
})
</script>

<template>
  <main class="min-h-[80vh] px-6 py-12 flex flex-col justify-center text-center space-y-8">
    <div class="space-y-5">
      <div class="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
        :class="state === 'paid' ? 'bg-emerald-50 text-emerald-500' : state === 'failed' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'">
        <CheckCircle2 v-if="state === 'paid'" class="w-10 h-10" />
        <AlertCircle v-else-if="state === 'failed'" class="w-10 h-10" />
        <Loader2 v-else-if="state === 'checking'" class="w-10 h-10 animate-spin" />
        <Clock v-else class="w-10 h-10" />
      </div>
      <div class="space-y-2">
        <span v-if="errorLabel && state === 'failed'" class="inline-block text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
          {{ errorLabel }}
        </span>
        <h1 class="text-2xl font-black text-slate-900">
          {{ pageTitle }}
        </h1>
        <p class="text-sm text-slate-500 leading-relaxed">{{ message }}</p>
        <div v-if="actionAdvice && state === 'failed'" class="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-left text-xs text-amber-900 font-medium flex items-start gap-2 max-w-sm mx-auto">
          <span class="text-base shrink-0">💡</span>
          <span class="leading-snug">{{ actionAdvice }}</span>
        </div>
        <p v-if="state === 'paid'" class="text-xs font-bold text-emerald-600">
          {{ authStore.isAuthenticated
            ? (languageStore.isEn() ? `Redirecting to dashboard in ${dashboardRedirectSeconds} s.` : `Redirection vers le tableau de bord dans ${dashboardRedirectSeconds} s.`)
            : (languageStore.isEn() ? `Redirecting to secure login in ${dashboardRedirectSeconds} s.` : `Redirection vers la connexion sécurisée dans ${dashboardRedirectSeconds} s.`) }}
        </p>
      </div>
    </div>

    <div class="space-y-3">
      <button v-if="['canceled', 'failed', 'pending'].includes(state) && canRetry" @click="resumePayment" :disabled="redirecting"
        class="w-full bg-primary text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:bg-slate-300">
        <Loader2 v-if="redirecting" class="w-5 h-5 animate-spin" />
        <RefreshCw v-else class="w-5 h-5" />
        {{ authStore.isAuthenticated
          ? (mobilePayment ? (languageStore.isEn() ? 'Continue after verification' : 'Continuer après vérification') : (languageStore.isEn() ? 'Resume payment' : 'Reprendre le paiement'))
          : (languageStore.isEn() ? 'Sign in to resume' : 'Se connecter pour reprendre') }}
      </button>
      <button v-if="state === 'pending' || (mobilePayment && state === 'failed')" @click="checkStatus" class="w-full bg-slate-100 text-slate-700 font-bold py-4 rounded-2xl">
        {{ languageStore.isEn() ? 'Check again' : 'Vérifier à nouveau' }}
      </button>
      <button v-if="state === 'paid'" @click="goToDashboard" class="w-full bg-primary text-white font-black py-4 rounded-2xl">
        {{ languageStore.isEn() ? 'Go to dashboard' : 'Accéder au tableau de bord' }}
      </button>
      <button v-else @click="openSubscriptions" class="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl">
        {{ authStore.isAuthenticated ? (languageStore.isEn() ? 'View my investments' : 'Voir mes souscriptions') : (languageStore.isEn() ? 'Sign in' : 'Se connecter') }}
      </button>
    </div>
  </main>
</template>
