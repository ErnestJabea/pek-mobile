<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-vue-next'
import api from '../api/api'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const subscriptionId = ref(Number.parseInt(String(route.query.subscription_id || ''), 10))
const providerReference = String(route.params.reference || '')
const checkoutSessionId = String(route.query.checkout_session_id || '')
const state = ref(route.query.canceled === '1' ? 'canceled' : 'checking')
const message = ref(route.query.canceled === '1'
  ? 'Le paiement a été annulé. Votre demande est conservée.'
  : 'Nous vérifions la confirmation sécurisée du paiement.')
const attempts = ref(0)
const redirecting = ref(false)
const dashboardRedirectSeconds = ref(4)
let timer = null
let dashboardTimer = null

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
  message.value = confirmationMessage || 'Paiement confirmé. Vos parts sont créditées.'
  window.dispatchEvent(new Event('pek:notifications-refresh'))
  scheduleDashboardRedirect()
}

const checkStatus = async () => {
  const canUseAuthenticatedStatus = authStore.isAuthenticated
    && (validSubscription.value || validProviderReference.value)

  if (!validCheckoutSession.value && !canUseAuthenticatedStatus) {
    state.value = 'failed'
    message.value = 'Référence de paiement invalide ou session expirée.'
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
    const terminalError = [404, 409, 422].includes(error.response?.status)
    state.value = terminalError ? 'failed' : 'pending'
    message.value = error.response?.data?.message || 'La vérification est momentanément indisponible.'
  }
}

const resumePayment = async () => {
  if (!authStore.isAuthenticated) {
    await router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  if (!validSubscription.value) return
  redirecting.value = true
  try {
    const response = await api.post(`/subscriptions/${subscriptionId.value}/payment-session`)
    if (response.data.payment?.status === 'paid') {
      confirmPayment('Paiement confirmé. Vos parts sont créditées.')
      return
    }
    redirectToCheckout(response.data.payment?.checkout_url)
  } catch (error) {
    state.value = 'failed'
    message.value = error.response?.data?.message || error.message || 'Impossible de reprendre le paiement.'
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
  if (state.value !== 'canceled') checkStatus()
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
        <h1 class="text-2xl font-black text-slate-900">
          {{ state === 'paid' ? 'Paiement confirmé !' : state === 'checking' ? 'Confirmation en cours' : state === 'canceled' ? 'Paiement annulé' : state === 'failed' ? 'Paiement non abouti' : 'Paiement en attente' }}
        </h1>
        <p class="text-sm text-slate-500 leading-relaxed">{{ message }}</p>
        <p v-if="state === 'paid'" class="text-xs font-bold text-emerald-600">
          {{ authStore.isAuthenticated
            ? `Redirection vers le tableau de bord dans ${dashboardRedirectSeconds} s.`
            : `Redirection vers la connexion sécurisée dans ${dashboardRedirectSeconds} s.` }}
        </p>
      </div>
    </div>

    <div class="space-y-3">
      <button v-if="['canceled', 'failed', 'pending'].includes(state)" @click="resumePayment" :disabled="redirecting"
        class="w-full bg-primary text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:bg-slate-300">
        <Loader2 v-if="redirecting" class="w-5 h-5 animate-spin" />
        <RefreshCw v-else class="w-5 h-5" />
        {{ authStore.isAuthenticated ? 'Reprendre le paiement' : 'Se connecter pour reprendre' }}
      </button>
      <button v-if="state === 'pending'" @click="checkStatus" class="w-full bg-slate-100 text-slate-700 font-bold py-4 rounded-2xl">
        Vérifier à nouveau
      </button>
      <button v-if="state === 'paid'" @click="goToDashboard" class="w-full bg-primary text-white font-black py-4 rounded-2xl">
        Accéder au tableau de bord
      </button>
      <button v-else @click="openSubscriptions" class="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl">
        {{ authStore.isAuthenticated ? 'Voir mes souscriptions' : 'Se connecter' }}
      </button>
    </div>
  </main>
</template>
