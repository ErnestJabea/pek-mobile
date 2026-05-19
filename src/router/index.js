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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Redirect to register if trying to subscribe without account
    next({ path: '/register', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

export default router
