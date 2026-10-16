export interface CurrentUser {
  id: string
  name: string | null
  email: string | null
  roles: string[]
}

export function useAuth() {
  const user = useState<CurrentUser | null>('user', () => null)

  async function fetchUser() {
    try {
      user.value = await $fetch<CurrentUser>('/api/me')
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 401) throw error
      user.value = null
    }
    return user.value
  }

  function hasRole(...roles: string[]) {
    return !!user.value && roles.some((role) => user.value!.roles.includes(role))
  }

  return { user, fetchUser, hasRole }
}
