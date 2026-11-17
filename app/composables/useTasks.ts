/**
 * Task Management: one tab per module the user's roles open (SCCA, RA HO, RA Branch, Location).
 * The module's BCM sees every task of it (`oversees`), everyone else what waits for them. The
 * Home overview shows each module at a glance (`useTaskSummary`). It sends no reminders.
 */
export type TaskModule = 'scca' | 'ra' | 'ra_branch' | 'sites'
export type TaskType = 'signoff' | 'renewal' | 'building' | 'disaster' | 'incident'
export type TaskLevel = 'ok' | 'reminder' | 'escalated' | 'overdue' | 'due_30' | 'due_90'
/** The quick filters: stuck sign-offs, overdue or due renewals. */
export type TaskLevelFilter = 'stuck' | 'overdue' | 'due'

export interface Task {
  key: string
  module: TaskModule
  type: TaskType
  id: number | null
  title: string
  ref: string | null
  /** The step, the renewal state, the hazard or the building task. */
  detail: string | null
  kind?: RaKind | null
  action?: 'register' | 'deactivate' | 'declare'
  /** Who must act. */
  assignee: string | null
  requested_by: string | null
  since: string | null
  working_days_waiting: number | null
  hours_waiting: number | null
  due_date: string | null
  days_left: number | null
  reminders_sent: number
  escalated: boolean
  level: TaskLevel
  /** It waits for the user. */
  mine: boolean
  /** A building or disaster the user asked for: someone else decides. */
  own?: boolean
  url: string
}

export interface TaskQuery {
  module?: TaskModule
  type?: TaskType
  level?: TaskLevelFilter
  q?: string
  page: number
  per_page?: number
}

export interface TaskPage {
  items: Task[]
  page: number
  per_page: number
  total: number
  pages: number
  /** The tab shown (null when the user's roles open none). */
  module: TaskModule | null
  /** The modules the user's roles open, with how many tasks each has. */
  tabs: { module: TaskModule, total: number }[]
  /** The user sees every task of this module (its BCM). */
  oversees: boolean
  counts: Record<'total' | TaskType, number>
}

/** One module at a glance on Home. Sign-off modules count `mine` … `due_renewals` (every one
 *  for its BCM, `oversees`; otherwise the user's own), RA HO and RA Branch also `building`;
 *  Sites counts `disaster` and `incident`. */
export interface TaskGlance {
  module: TaskModule
  oversees: boolean
  mine?: number
  in_approval?: number
  stuck?: number
  overdue_renewals?: number
  due_renewals?: number
  building?: number
  disaster?: number
  incident?: number
}

export interface TaskSummary {
  modules: TaskGlance[]
}

export function useTasks(query: MaybeRefOrGetter<TaskQuery>) {
  return useFetch<TaskPage>('/api/tasks', {
    key: computed(() => `tasks-${JSON.stringify(toValue(query))}`),
    query: computed(() => toValue(query)),
  })
}

export function useTaskSummary() {
  return useFetch<TaskSummary>('/api/tasks/summary', { key: 'tasks-summary' })
}

export const TASK_MODULES: Record<TaskModule, string> = {
  scca: 'SCCA',
  ra: 'RA HO',
  ra_branch: 'RA Branch',
  sites: 'Sites',
}

export const TASK_MODULE_ICONS: Record<TaskModule, string> = {
  scca: 'i-lucide-shield-check',
  ra: 'i-lucide-building-2',
  ra_branch: 'i-lucide-landmark',
  sites: 'i-lucide-map-pinned',
}

/** The task types each module's tab has. */
export const TASK_MODULE_TYPES: Record<TaskModule, TaskType[]> = {
  scca: ['signoff', 'renewal'],
  ra: ['signoff', 'renewal', 'building'],
  ra_branch: ['signoff', 'renewal', 'building'],
  sites: ['disaster', 'incident'],
}

/** Each kind of task, as a badge (`StatusBadge`). */
export const taskType = defineStatusScale<TaskType>({
  signoff: { label: 'Sign-off', color: 'info', icon: 'i-lucide-badge-check' },
  renewal: { label: 'Renewal', color: 'neutral', icon: 'i-lucide-calendar-clock' },
  building: { label: 'Building', color: 'warning', icon: 'i-lucide-building' },
  disaster: { label: 'Disaster', color: 'error', icon: 'i-lucide-siren' },
  incident: { label: 'Incident', color: 'error', icon: 'i-lucide-triangle-alert' },
})
