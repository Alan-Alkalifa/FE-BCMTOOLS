export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.public) return

  const { user, fetchUser, can, setUser } = useAuth()
  if (!user.value) {
    try {
      await fetchUser()
    } catch {
      setUser(null)
    }
  }
  if (!user.value) {
    const redirect = to.fullPath
    return navigateTo(
      redirect && redirect !== '/'
        ? { path: '/login', query: { redirect } }
        : '/login',
    )
  }
  if (user.value.must_change_password && to.path !== '/account/password') {
    return navigateTo('/account/password')
  }
  const needed = to.meta.permission
  if (needed && !can(...(Array.isArray(needed) ? needed : [needed]))) {
    return navigateTo({ path: '/forbidden', query: { from: to.fullPath } }, { replace: true })
  }
})
