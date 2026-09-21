import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Home from '../views/Home.vue'
import Catalog from '../views/Catalog.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import ForgotPassword from '../views/ForgotPassword.vue'
import Subscription from '../views/Subscription.vue'

import SplashScreen from '../views/SplashScreen.vue'
import Profile from '../views/Profile.vue'
import Notifications from '../views/Notifications.vue'
import MySubscriptions from '../views/MySubscriptions.vue'
import History from '../views/History.vue'
import Onboarding from '../views/Onboarding.vue'
import Welcome from '../views/Welcome.vue'
import ResetTempPassword from '../views/ResetTempPassword.vue'
import ResetPassword from '../views/ResetPassword.vue'
import PaymentReturn from '../views/PaymentReturn.vue'


const routes = [
  {
    path: '/',
    name: 'splash',
    component: SplashScreen
  },
  {
    path: '/home',
    name: 'home',
    component: Home,
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: Profile,
    meta: { requiresAuth: true }
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: Notifications,
    meta: { requiresAuth: true }
  },
  {
    path: '/my-subscriptions',
    name: 'my-subscriptions',
    component: MySubscriptions,
    meta: { requiresAuth: true }
  },
  {
    path: '/history',
    name: 'history',
    component: History,
    meta: { requiresAuth: true }
  },
  {
    path: '/catalog',
    name: 'catalog',
    component: Catalog
  },
  {
    path: '/login',
    name: 'login',
    component: Login
  },
  {
    path: '/register',
    name: 'register',
    component: Register
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: ForgotPassword
  },
  {
    path: '/subscribe/:id',
    name: 'subscribe',
    component: Subscription,
    meta: { requiresAuth: true }
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: Onboarding,
    meta: { requiresAuth: true }
  },
  {
    path: '/welcome',
    name: 'welcome',
    component: Welcome
  },
  {
    path: '/reset-temp-password',
    name: 'reset-temp-password',
    component: ResetTempPassword,
    meta: { requiresAuth: true }
  },
  {
    path: '/password-reset/:token',
    name: 'password-reset',
    component: ResetPassword
  },
  {
    path: '/payment/return/:reference?',
    name: 'payment-return',
    component: PaymentReturn
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Redirect to login if trying to access auth routes without active session
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  const user = authStore.user

  // Force change of temporary password if flag is true
  if (authStore.isAuthenticated && (user?.has_temp_password === true || user?.has_temp_password == 1) && to.path !== '/reset-temp-password') {
    return '/reset-temp-password'
  }
})

export default router
