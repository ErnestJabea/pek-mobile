import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
const Home = () => import('../views/Home.vue')
const Catalog = () => import('../views/Catalog.vue')
const Login = () => import('../views/Login.vue')
const Register = () => import('../views/Register.vue')
const ForgotPassword = () => import('../views/ForgotPassword.vue')
const Subscription = () => import('../views/Subscription.vue')

const SplashScreen = () => import('../views/SplashScreen.vue')
const Profile = () => import('../views/Profile.vue')
const Notifications = () => import('../views/Notifications.vue')
const MySubscriptions = () => import('../views/MySubscriptions.vue')
const History = () => import('../views/History.vue')
const Onboarding = () => import('../views/Onboarding.vue')
const Welcome = () => import('../views/Welcome.vue')
const ResetTempPassword = () => import('../views/ResetTempPassword.vue')
const ResetPassword = () => import('../views/ResetPassword.vue')
const PaymentReturn = () => import('../views/PaymentReturn.vue')
const SubscriptionBulletin = () => import('../views/SubscriptionBulletin.vue')


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
    path: '/subscriptions/:id/bulletin',
    name: 'subscription-bulletin',
    component: SubscriptionBulletin,
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
