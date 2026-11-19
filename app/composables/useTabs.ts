import type { InjectionKey } from 'vue'

/**
 * In-app tabs (docs/tabs.md): the pages a user has open, one tab per page (the route path
 * without the query, utils/tabs.ts `tabKeyOf`). The route guard in plugins/tabs.client.ts opens,
 * switches and retargets tabs; the layout renders each open tab's page kept alive
 * (components/AppTabHost.vue); pages report their title and unsaved edits.
 *
 * Always on for signed-in users.
 */
export interface AppTab {
  /** New for every opening, so a page closed and opened again starts fresh. */
  id: string
  key: string
  /** The tab's last URL, with its query (filters, sort, page, inner tab). */
  url: string
  title: string
  pinned: boolean
  dirty: boolean
  /** When the tab was last shown (least-recently-used tab closes first at the cap). */
  lastSeen: number
  /** When the tab went to the background; null while it is shown. */
  hiddenAt: number | null
  /** Bumped to load the page again (a stale tab coming back). */
  generation: number
}

interface TabsState {
  list: AppTab[]
  active: string | null
}

/** The tab a page belongs to (provided by AppTabHost), or undefined when tabs are off. */
export const tabIdKey: InjectionKey<string> = Symbol('tab-id')

let counter = 0
function newId() {
  counter += 1
  return `${Date.now().toString(36)}${counter.toString(36)}`
}

export function useTabs() {
  const state = useState<TabsState>('tabs', () => ({ list: [], active: null }))
  const { user } = useAuth()
  /** In-app tabs are on whenever someone is signed in (sign-in pages have no tabs). */
  const enabled = computed(() => !!user.value)

  const list = computed(() => state.value.list)
  const activeTab = computed(() => state.value.list.find((tab) => tab.id === state.value.active) ?? null)

  function byId(id: string) {
    return state.value.list.find((tab) => tab.id === id)
  }
  function byKey(key: string) {
    return state.value.list.find((tab) => tab.key === key)
  }

  /** Pinned tabs first, in the order they were pinned; then the rest. */
  function normalize() {
    state.value.list = [...state.value.list.filter((tab) => tab.pinned), ...state.value.list.filter((tab) => !tab.pinned)]
  }

  function open(key: string, url: string, title: string, options: { pinned?: boolean } = {}) {
    const tab: AppTab = {
      id: newId(),
      key,
      url,
      title,
      pinned: !!options.pinned,
      dirty: false,
      lastSeen: Date.now(),
      hiddenAt: null,
      generation: 0,
    }
    // A new tab opens right after the one in front.
    const at = state.value.list.findIndex((item) => item.id === state.value.active)
    const next = [...state.value.list]
    next.splice(at === -1 ? next.length : at + 1, 0, tab)
    state.value.list = next
    normalize()
    return tab
  }

  /** Show a tab: the one in front goes to the background. */
  function activate(id: string, url?: string) {
    const now = Date.now()
    const current = activeTab.value
    if (current && current.id !== id) {
      current.hiddenAt = now
      current.lastSeen = now
    }
    const tab = byId(id)
    if (!tab) return
    if (url) tab.url = url
    tab.lastSeen = now
    state.value.active = id
  }

  /** A page left with replace (a create flow, a redirect) turns its tab into the new page. */
  function retarget(id: string, key: string, url: string) {
    const tab = byId(id)
    if (!tab) return
    tab.key = key
    tab.url = url
    tab.dirty = false
  }

  /** The tab to close to make room for one more, or null when every tab must stay
   *  (pinned, unsaved edits, or the one in front). */
  function evictable(): AppTab | null {
    if (state.value.list.length < TAB_LIMIT) return null
    return [...state.value.list]
      .filter((tab) => !tab.pinned && !tab.dirty && tab.id !== state.value.active)
      .sort((a, b) => a.lastSeen - b.lastSeen)[0] ?? null
  }
  const full = () => state.value.list.length >= TAB_LIMIT && !evictable()

  /** Drop a tab. Returns the URL to show next when it was the one in front. */
  function remove(id: string): string | null {
    const at = state.value.list.findIndex((tab) => tab.id === id)
    if (at === -1) return null
    const wasActive = state.value.active === id
    const next = state.value.list.filter((tab) => tab.id !== id)
    state.value.list = next
    if (!wasActive) return null
    const neighbour = next[at] ?? next[at - 1] ?? null
    state.value.active = neighbour?.id ?? null
    return neighbour?.url ?? '/'
  }

  function setTitle(id: string, title: string) {
    const tab = byId(id)
    if (tab && title && tab.title !== title) tab.title = title
  }
  function setDirty(id: string, dirty: boolean) {
    const tab = byId(id)
    if (tab && tab.dirty !== dirty) tab.dirty = dirty
  }
  function setPinned(id: string, pinned: boolean) {
    const tab = byId(id)
    if (!tab || tab.key === HOME_TAB_KEY) return
    tab.pinned = pinned
    normalize()
  }
  /** Drag and drop: a tab moves among the tabs of its kind (pinned or not). */
  function move(id: string, toId: string) {
    const from = state.value.list.findIndex((tab) => tab.id === id)
    const to = state.value.list.findIndex((tab) => tab.id === toId)
    if (from === -1 || to === -1 || from === to) return
    if (state.value.list[from]!.pinned !== state.value.list[to]!.pinned) return
    const next = [...state.value.list]
    const [tab] = next.splice(from, 1)
    next.splice(to, 0, tab!)
    state.value.list = next
  }
  /** Load a stale tab's page again when it comes back. */
  function reload(id: string) {
    const tab = byId(id)
    if (tab) tab.generation += 1
  }

  function reset() {
    state.value = { list: [], active: null }
  }

  return {
    state,
    enabled,
    list,
    activeTab,
    byId,
    byKey,
    open,
    activate,
    retarget,
    evictable,
    full,
    remove,
    setTitle,
    setDirty,
    setPinned,
    move,
    reload,
    reset,
  }
}

/** The id of the tab this component's page is in (undefined when tabs are off). */
export function useTabId() {
  return inject(tabIdKey, undefined)
}
