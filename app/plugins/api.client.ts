/**
 * Adds the session's CSRF token to every write sent to the backend, and reacts to the
 * backend's session answers: signed out → sign-in page, new password required → that page.
 *
 * Nuxt's `$fetch` is created before plugins run, but it calls `window.fetch` for every
 * request, so wrapping `window.fetch` covers `$fetch`, `useFetch` and plain `fetch` alike.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password']

function apiPath(input: RequestInfo | URL): string | null {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const url = new URL(raw, window.location.origin)
  return url.origin === window.location.origin && url.pathname.startsWith('/api/') ? url.pathname : null
}

export default defineNuxtPlugin(() => {
  const csrf = useState<string | null>('csrf', () => null)
  const router = useRouter()
  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = apiPath(input)
    if (!path) return nativeFetch(input, init)

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (!SAFE_METHODS.has(method) && csrf.value) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      headers.set('X-CSRF-Token', csrf.value)
      init = { ...init, headers }
    }

    const response = await nativeFetch(input, init)
    const route = router.currentRoute.value
    if (response.status === 401 && !path.startsWith('/api/auth/') && path !== '/api/me' && !PUBLIC_PATHS.includes(route.path)) {
      useState('user').value = null
      void navigateTo({ path: '/login', query: { redirect: route.fullPath, expired: '1' } })
    } else if (response.status === 403 && route.path !== '/account/password') {
      const body = await response.clone().json().catch(() => null) as { error?: string } | null
      if (body?.error === 'password_change_required') void navigateTo('/account/password')
    }
    return response
  }
})
