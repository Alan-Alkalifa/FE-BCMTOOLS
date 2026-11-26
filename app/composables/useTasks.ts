/**
 * Task Management: one tab per module the user's roles open (SCCA, RA HO, RA Branch, BIA,
 * Sites). The module's BCM sees every task of it (`oversees`), everyone else what waits for them
 * and what they started. Home shows the same cards per module (`useTaskSummary`, `taskCards`).
 * It sends no reminders.
 */
export type TaskModule = 'scca' | 'ra' | 'ra_branch' | 'bia' | 'sites'
export type TaskType = 'signoff' | 'renewal' | 'building' | 'disaster' | 'incident'
export type TaskLevel = 'ok' | 'reminder' | 'escalated' | 'overdue' | 'due_30' | 'due_90'
/** The quick filters: stuck sign-offs, overdue or due renewals. */
export type TaskLevelFilter = 'stuck' | 'overdue' | 'due'
/** The cards' lists: Waiting for me (`mine`) and In approval (`approval`). */
export type TaskView = 'mine' | 'approval'

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
  /** It waits for the user (Waiting for me). */
  mine: boolean
  /** The user started it or is responsible for it (an SCCA or BIA they created, an RA where
   *  they are the LIC, the LICOM or its creator). */
  involved?: boolean
  /** A building or disaster the user asked for: someone else decides. */
  own?: boolean
  url: string
}

export interface TaskQuery {
  module?: TaskModule
  view?: TaskView
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
  /** Per type, and the cards (`TaskCounts`), the same as on Home. */
  counts: Record<'total' | TaskType, number> & TaskCounts
}

/** The cards of a module: Waiting for me and In approval for everyone; for its BCM the admin
 *  tasks (stuck sign-offs, overdue and due renewals, and in RA HO and RA Branch the buildings
 *  waiting, only for who opens Master building). */
export interface TaskCounts {
  mine?: number
  in_approval?: number
  stuck?: number
  overdue_renewals?: number
  due_renewals?: number
  building?: number
}

/** One module on Home: the same cards as its Task Management tab. */
export interface TaskGlance extends TaskCounts {
  module: TaskModule
  oversees: boolean
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
  bia: 'BIA',
  sites: 'Sites',
}

export const TASK_MODULE_ICONS: Record<TaskModule, string> = {
  scca: 'i-lucide-shield-check',
  ra: 'i-lucide-building-2',
  ra_branch: 'i-lucide-landmark',
  bia: 'i-lucide-file-spreadsheet',
  sites: 'i-lucide-map-pinned',
}

/** The task types each module's tab has. */
export const TASK_MODULE_TYPES: Record<TaskModule, TaskType[]> = {
  scca: ['signoff', 'renewal'],
  ra: ['signoff', 'renewal', 'building'],
  ra_branch: ['signoff', 'renewal', 'building'],
  bia: ['signoff', 'renewal'],
  sites: ['disaster', 'incident'],
}

/** What a card opens in Task Management. */
export interface TaskCardFilter { view?: TaskView, type?: TaskType, level?: TaskLevelFilter }

export interface TaskCard {
  key: 'mine' | 'in_approval' | 'stuck' | 'overdue' | 'building'
  label: string
  value: number
  hint: string
  icon: string
  tone: 'neutral' | 'warning' | 'error' | 'info'
  filter: TaskCardFilter
}

const RECORD: Record<TaskModule, string> = { scca: 'SCCA', ra: 'RA', ra_branch: 'RA', bia: 'BIA', sites: 'disaster and incident' }

/**
 * A module's cards, the same on Home and in Task Management. `basic` for everyone (Waiting for
 * me, In approval); `admin` for its BCM (`oversees`): stuck sign-offs, overdue renewals and, in
 * RA HO and RA Branch, the buildings waiting (the API sends `building` only for who opens
 * Master building). Shown as Overview Administrator on Home and Admin tasks in Task Management.
 */
export function taskCards(module: TaskModule, counts: TaskCounts | null | undefined, oversees: boolean) {
  const what = RECORD[module]
  const sites = module === 'sites'
  const basic: TaskCard[] = [
    {
      key: 'mine',
      label: 'Waiting for me',
      value: counts?.mine ?? 0,
      hint: sites ? 'Disasters and incidents for you to decide.' : module === 'ra' || module === 'ra_branch' ? 'RA approvals for you.' : `${what} approvals for you.`,
      icon: 'i-lucide-user-check',
      tone: 'warning',
      filter: { view: 'mine' },
    },
    {
      key: 'in_approval',
      label: 'In approval',
      value: counts?.in_approval ?? 0,
      hint: sites
        ? 'Every disaster and incident waiting for approval.'
        : oversees ? `Every ${what} waiting for a signer.` : `What you sign or started, waiting for a signer.`,
      icon: 'i-lucide-hourglass',
      tone: 'info',
      filter: { view: 'approval' },
    },
  ]
  if (!oversees) return { basic, admin: [] as TaskCard[] }
  const admin: TaskCard[] = [{
    key: 'stuck',
    label: sites ? 'Escalated approvals' : 'Stuck sign-offs',
    value: counts?.stuck ?? 0,
    hint: sites ? 'Waiting past the escalation to BCM.' : 'Waiting past the escalation.',
    icon: 'i-lucide-siren',
    tone: 'error',
    filter: { level: 'stuck' },
  }]
  if (!sites) {
    admin.push({
      key: 'overdue',
      label: 'Overdue renewals',
      value: counts?.overdue_renewals ?? 0,
      hint: `${counts?.due_renewals ?? 0} more due within 90 days.`,
      icon: 'i-lucide-circle-alert',
      tone: 'error',
      filter: { type: 'renewal', level: 'overdue' },
    })
  }
  if ((module === 'ra' || module === 'ra_branch') && counts?.building !== undefined) {
    admin.push({
      key: 'building',
      label: 'Buildings waiting',
      value: counts.building,
      hint: 'New, or to make inactive, waiting for approval.',
      icon: 'i-lucide-building',
      tone: 'warning',
      filter: { type: 'building' },
    })
  }
  return { basic, admin }
}

/** Each kind of task, as a badge (`StatusBadge`). */
export const taskType = defineStatusScale<TaskType>({
  signoff: { label: 'Sign-off', color: 'info', icon: 'i-lucide-badge-check' },
  renewal: { label: 'Renewal', color: 'neutral', icon: 'i-lucide-calendar-clock' },
  building: { label: 'Building', color: 'warning', icon: 'i-lucide-building' },
  disaster: { label: 'Disaster', color: 'error', icon: 'i-lucide-siren' },
  incident: { label: 'Incident', color: 'error', icon: 'i-lucide-triangle-alert' },
})
