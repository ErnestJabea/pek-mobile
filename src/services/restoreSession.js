export async function restoreSession(api, authStore) {
  if (!authStore.token) return 'anonymous'
  try {
    const response = await api.get('/user')
    authStore.setUser(response.data)
    return 'authenticated'
  } catch (error) {
    if ([401, 419].includes(error.response?.status)) {
      authStore.clearAuth()
      return 'expired'
    }
    return 'unavailable'
  }
}
