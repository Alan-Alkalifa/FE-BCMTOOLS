export interface UserRole {
  code: string
  name: string
}

export interface CurrentUser {
  id: number
  username: string
  name: string
  email: string | null
  job_title: string | null
  department: string | null
  has_photo: boolean
  roles: UserRole[]
  permissions: string[]
  must_change_password: boolean
  csrf_token: string | null
}

export interface MenuNode {
  id: number
  code: string
  label: string
  icon: string | null
  route: string | null
  children: MenuNode[]
}

/** The signed-in user, their permissions and the CSRF token sent on every write. */
export function useAuth() {
  const user = useState<CurrentUser | null>('user', () => null)
  const menu = useState<MenuNode[] | null>('menu', () => null)
  const { $posthog } = useNuxtApp()

  function identifyUser(value: CurrentUser) {
    $posthog?.identify(String(value.id), {
      ...(value.email ? { email: value.email } : {}),
      name: value.name,
      role_codes: value.roles.map((role) => role.code),
    })
  }

  function setUser(value: CurrentUser | null) {
    user.value = value
    useState<string | null>('csrf').value = value?.csrf_token ?? null
    if (!value) menu.value = null
  }

  async function fetchUser() {
    try {
      // A timeout, because the route middleware awaits this before anything renders: a backend
      // that is down or hanging would otherwise leave the page blank instead of showing sign-in.
      const currentUser = await $fetch<CurrentUser>('/api/me', { timeout: 8000 })
      setUser(currentUser)
      // Restore identity after a page refresh; posthog-js then attributes errors and events to it.
      identifyUser(currentUser)
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 401) throw error
      setUser(null)
    }
    return user.value
  }

  async function fetchMenu() {
    try {
      menu.value = (await $fetch<{ items: MenuNode[] }>('/api/me/menu')).items
    } catch {
      menu.value = []
    }
    return menu.value
  }

  async function login(username: string, password: string) {
    // The ID and password travel sealed (utils/seal.ts), never as readable JSON.
    const signedIn = await sealedFetch<CurrentUser>('/api/auth/login', 'login', { username, password })
    if (user.value && user.value.id !== signedIn.id) $posthog?.reset()
    setUser(signedIn)
    // The backend returns the stable primary key in CurrentUser.id, not merely the login email.
    identifyUser(signedIn)
    $posthog?.capture('user_logged_in')
    $posthog?.logger.info('user login succeeded', { role_count: signedIn.roles.length })
    menu.value = null
    return signedIn
  }

  async function logout() {
    // In-app tabs (useTabs) are kept per user in this browser tab: signing out forgets them.
    try {
      if (user.value) sessionStorage.removeItem(`bcm.tabs.${user.value.id}`)
    } catch {
      // Storage blocked: nothing was saved.
    }
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      if (user.value) {
        $posthog?.capture('user_logged_out')
        $posthog?.logger.info('user logout requested')
        $posthog?.reset()
      }
      setUser(null)
      clearNuxtData()
    }
  }

  async function changePassword(currentPassword: string, password: string) {
    const updatedUser = await sealedFetch<CurrentUser>('/api/auth/password', 'change_password', {
      current_password: currentPassword,
      password,
    })
    setUser(updatedUser)
    $posthog?.capture('password_changed')
    $posthog?.logger.info('password changed')
  }

  /** True if the user holds any of the permission codes. */
  function can(...codes: string[]) {
    return !!user.value && codes.some((code) => user.value!.permissions.includes(code))
  }

  function hasRole(...codes: string[]) {
    return !!user.value && user.value.roles.some((role) => codes.includes(role.code))
  }

  return { user, menu, fetchUser, fetchMenu, login, logout, changePassword, can, hasRole, setUser }
}
