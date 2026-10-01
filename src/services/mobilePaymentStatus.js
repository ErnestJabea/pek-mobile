// A local timeout or a missing API field never authorizes another debit.
const retryableCodes = new Set(['703201', '703202', '703203', '703107', '702102'])
export const isS3pPayment = (data) => data?.payment?.provider === 's3p' || Boolean(data?.subscription?.mobile_provider)
export const mobileRetryMode = (data) => {
  if (data?.status !== 'failed' || data?.can_retry !== true || data?.subscription?.statut === 'Succès') return null
  const state = data?.payment?.status ?? data?.subscription?.mobile_state
  if (state === 'quote_failed') return 'resume'
  if (state === 'errored' && retryableCodes.has(String(data?.payment?.error_code ?? data?.subscription?.s3p_error_code ?? ''))) return 'new'
  return null
}
export const verifyMobileRetry = async (api, id) => {
  const { data } = await api.get(`/subscriptions/${id}/payment-status`)
  return { data, mode: mobileRetryMode(data) }
}
