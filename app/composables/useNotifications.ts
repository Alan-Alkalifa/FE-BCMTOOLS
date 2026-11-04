/**
 * In-app notifications: a placeholder for future development.
 *
 * The bell in the top bar already reads from here. Nothing produces notifications yet, so the
 * list is always empty and the bell shows "Coming soon". To make it real:
 *   1. Backend: a `notifications` table (user_id, kind, title, body, link, read_at, created_at),
 *      rows written next to the SCCA approval emails, and
 *      `GET /api/me/notifications` + `POST /api/me/notifications/read`.
 *   2. Here: fetch in `refresh()` (and on an interval or a server push), set `available` to
 *      true, and send the read call in `markAllRead()`.
 * The menu, the unread dot and the empty state need no change.
 */

export type NotificationKind = 'approval' | 'comment' | 'system'

export interface AppNotification {
  id: number
  kind: NotificationKind
  title: string
  body?: string
  /** A page in the app, e.g. /scca/12?tab=result */
  link?: string
  created_at: string
  read_at: string | null
}

export const NOTIFICATION_ICONS: Record<NotificationKind, string> = {
  approval: 'i-lucide-badge-check',
  comment: 'i-lucide-message-square',
  system: 'i-lucide-info',
}

export function useNotifications() {
  const items = useState<AppNotification[]>('notifications', () => [])
  /** False until the backend serves notifications. */
  const available = useState('notifications-available', () => false)
  const unread = computed(() => items.value.filter((item) => !item.read_at).length)

  async function refresh() {
    // Future: items.value = (await $fetch<{ items: AppNotification[] }>('/api/me/notifications')).items
  }

  async function markAllRead() {
    const now = new Date().toISOString()
    items.value = items.value.map((item) => ({ ...item, read_at: item.read_at ?? now }))
    // Future: await $fetch('/api/me/notifications/read', { method: 'POST' })
  }

  return { items, unread, available, refresh, markAllRead }
}
