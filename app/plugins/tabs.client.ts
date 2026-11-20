import type { RouteLocationNormalized } from 'vue-router'
import type { MenuNode } from '~/composables/useAuth'
import type { AppTab } from '~/composables/useTabs'

/**
 * In-app tabs: the route guard (docs/tabs.md). Every navigation either switches to the tab
 * already showing that page, retargets the current tab (a navigation with replace: a create
 * flow or a redirect), or opens a new tab right after the current one. A page is open once.
 *
 * Signed-out pages (sign-in) have no tabs: nothing here changes their navigation.
 */
const STORE_PREFIX = 'bcm.tabs.'

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const tabs = useTabs()
  const { user, menu } = useAuth()

  // A navigation with replace turns the current tab into the new page instead of opening one.
  let replacing = false
  const replace = router.replace.bind(router)
  router.replace = (to) => {
    replacing = true
    return replace(to).finally(() => {
      replacing = false
    })
  }
  // A click on a tab is a switch the user asked for: no "already open" notice.
  let fromTabBar = false

  // --- the tab list follows the user, saved in this browser tab (survives a reload) ----------

  function storeKey() {
    return user.value ? `${STORE_PREFIX}${user.value.id}` : null
  }
  watch(() => user.value?.id, (id) => {
    tabs.reset()
    const key = storeKey()
    if (!key || !id) return
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null') as { list: AppTab[], active: string | null } | null
      if (saved?.list?.length) {
        tabs.state.value = {
          list: saved.list.slice(0, TAB_LIMIT).map((tab) => ({ ...tab, dirty: false, hiddenAt: null, generation: 0 })),
          active: saved.active,
        }
      }
    } catch {
      // Nothing saved, or storage blocked: start with Home.
    }
    // Sync: the list is back before the first navigation's afterEach places its page.
  }, { immediate: true, flush: 'sync' })

  watch(tabs.state, (value) => {
    const key = storeKey()
    if (!key || !tabs.enabled.value) return
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage full or blocked: tabs last until the page is reloaded.
    }
  }, { deep: true })

  // --- titles before the page reports its own -------------------------------------------------

  function menuLabel(path: string, nodes: MenuNode[] | null): string | null {
    let best: { route: string, label: string } | null = null
    const walk = (items: MenuNode[]) => {
      for (const node of items) {
        if (node.route && (path === node.route || (node.route !== '/' && path.startsWith(`${node.route}/`)))) {
          if (!best || node.route.length > best.route.length) best = { route: node.route, label: node.label }
        }
        walk(node.children)
      }
    }
    walk(nodes ?? [])
    return (best as { label: string } | null)?.label ?? null
  }
  function guessTitle(key: string) {
    if (key === HOME_TAB_KEY) return 'Home'
    return menuLabel(key, menu.value) ?? 'Loading…'
  }

  function ensureHome() {
    if (tabs.byKey(HOME_TAB_KEY)) return
    const home = tabs.open(HOME_TAB_KEY, HOME_TAB_KEY, 'Home', { pinned: true })
    // Home sits first and is not the tab in front unless the user is on it.
    tabs.state.value.list = [home, ...tabs.state.value.list.filter((tab) => tab.id !== home.id)]
  }

  // Signed in: the page on screen becomes the first tab after Home.
  watch(tabs.enabled, (on) => {
    if (!on) return
    ensureHome()
    const route = router.currentRoute.value
    const key = tabKeyOf(route)
    if (!key) return
    let tab = tabs.byKey(key)
    if (!tab) {
      const victim = tabs.evictable()
      if (victim) tabs.remove(victim.id)
      tab = tabs.open(key, route.fullPath, guessTitle(key))
    }
    tabs.activate(tab.id, route.fullPath)
  })

  // --- the guard ------------------------------------------------------------------------------

  /** A navigation with replace that leaves the page in the tab in front: that tab becomes the
   *  new page. A replace from a page without a tab (a resolver, a redirect stub) opens one. */
  function retargets(from: RouteLocationNormalized, current: AppTab | null) {
    return replacing && !!current && !current.pinned && tabKeyOf(from) === current.key
  }

  router.beforeEach((to, from) => {
    if (!tabs.enabled.value) return
    const key = tabKeyOf(to)
    if (!key) return
    const current = tabs.activeTab.value
    if (current?.key === key) return
    const existing = tabs.byKey(key)
    if (existing) {
      // A menu link to an open page brings back its filters and sort.
      const bare = !Object.keys(to.query).length && !to.hash
      const sameRoute = existing.url.split(/[?#]/)[0] === to.path
      if (bare && sameRoute && existing.url !== to.fullPath && !replacing) return existing.url
      return
    }
    if (retargets(from, current)) return
    if (tabs.full()) {
      useToast().add({
        title: 'Too many tabs open',
        description: `${TAB_LIMIT} tabs are open and each has unsaved edits or is pinned. Close one first.`,
        color: 'warning',
        icon: 'i-lucide-panels-top-left',
      })
      return false
    }
  })

  router.afterEach((to: RouteLocationNormalized, from: RouteLocationNormalized, failure) => {
    const clicked = fromTabBar
    fromTabBar = false
    if (failure || !tabs.enabled.value) return
    // Nuxt moves the route seen outside pages (the layout's sidebar) when a page finishes loading;
    // with the pages kept in tabs there is no such moment, so move it here.
    void nextTick(() => (nuxtApp._route as { sync?: () => void }).sync?.())
    ensureHome()

    // A tab the user may no longer open: the auth middleware sent it to Forbidden.
    if (to.path === '/forbidden' && typeof to.query.from === 'string') {
      const lost = tabKeyOf(router.resolve(to.query.from))
      const tab = lost ? tabs.byKey(lost) : undefined
      if (tab && !tab.pinned) tabs.remove(tab.id)
      return
    }

    const key = tabKeyOf(to)
    if (!key) return
    const current = tabs.activeTab.value
    if (current?.key === key) {
      current.url = to.fullPath
      return
    }
    const existing = tabs.byKey(key)
    if (existing) {
      // Replace into a page that is already open: the page left behind closes.
      if (retargets(from, current) && current!.id !== existing.id) tabs.remove(current!.id)
      tabs.activate(existing.id, to.fullPath)
      if (!clicked && from.matched.length && !replacing) {
        useToast().add({
          title: `${existing.title} is already open`,
          description: 'Switched to that tab.',
          icon: 'i-lucide-panels-top-left',
          duration: 2500,
        })
      }
      return
    }
    if (retargets(from, current)) {
      tabs.retarget(current!.id, key, to.fullPath)
      tabs.setTitle(current!.id, guessTitle(key))
      return
    }
    const victim = tabs.evictable()
    if (victim) tabs.remove(victim.id)
    const tab = tabs.open(key, to.fullPath, guessTitle(key), { pinned: key === HOME_TAB_KEY })
    tabs.activate(tab.id)
  })

  return {
    provide: {
      tabNav: {
        /** The current navigation keeps the page it leaves alive in its tab. */
        keepsAlive(to: RouteLocationNormalized, from: RouteLocationNormalized) {
          if (!tabs.enabled.value || replacing) return false
          const fromKey = tabKeyOf(from)
          const toKey = tabKeyOf(to)
          return !!fromKey && !!toKey && fromKey !== toKey
        },
        /** Show a tab (a click in the tab bar or the switcher). */
        show(tab: AppTab) {
          if (tab.id === tabs.activeTab.value?.id) return
          fromTabBar = true
          return navigateTo(tab.url)
        },
      },
    },
  }
})
