import type { RouteLocationNormalizedLoaded } from 'vue-router'

/** Most tabs open at once (docs/tabs.md). At the cap, opening another closes the longest-unused
 *  tab that is not pinned and has no unsaved edits. */
export const TAB_LIMIT = 10
/** A tab hidden longer than this is loaded again when it comes back (unless it has unsaved edits). */
export const TAB_STALE_MS = 2 * 60 * 1000
export const HOME_TAB_KEY = '/'

type TabRoute = Pick<RouteLocationNormalizedLoaded, 'path' | 'meta' | 'matched'>

/**
 * The tab a route opens in: its path without the query, so a page is open once whatever its
 * filters. A record's report (`…/12/report`) opens inside the record's tab. Null for pages that
 * never get a tab: no layout (sign-in), `definePageMeta({ tab: false })`, not found.
 */
export function tabKeyOf(route: TabRoute): string | null {
  if (!route.matched.length) return null
  if (route.meta.tab === false || route.meta.layout === false || route.meta.public) return null
  if (route.path === '/forbidden') return null
  const path = route.path.length > 1 ? route.path.replace(/\/+$/, '') : route.path
  return path.replace(/\/report$/, '')
}
