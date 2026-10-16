export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.public) return

  const { user, fetchUser } = useAuth()
  if (!user.value && !(await fetchUser())) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
