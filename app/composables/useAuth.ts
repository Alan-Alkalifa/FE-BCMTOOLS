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

  function setUser(value: CurrentUser | null) {
    user.value = value
    useState<string | null>('csrf').value = value?.csrf_token ?? null
    if (!value) menu.value = null
  }

  async function fetchUser() {
    try {
      setUser(await $fetch<CurrentUser>('/api/me'))
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
    const signedIn = await $fetch<CurrentUser>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    setUser(signedIn)
    menu.value = null
    return signedIn
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      clearNuxtData()
    }
  }

  async function changePassword(currentPassword: string, password: string) {
    setUser(await $fetch<CurrentUser>('/api/auth/password', {
      method: 'POST',
      body: { current_password: currentPassword, password },
    }))
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
