/**
 * Task Management across every module (SCCA, RA HO, RA Branch, Location): what waits for the
 * user (`scope: 'mine'`) or, for BCM, everything waiting, stuck or overdue in the modules they
 * oversee (`scope: 'all'`). The Home overview reads the counts (`useTaskSummary`).
 */
export type TaskModule = 'scca' | 'ra' | 'ra_branch' | 'location'
export type TaskType = 'signoff' | 'renewal' | 'building' | 'incident'
export type TaskLevel = 'ok' | 'reminder' | 'escalated' | 'overdue' | 'due_30' | 'due_90'
export type TaskScope = 'mine' | 'all'
/** The quick filters: stuck sign-offs, overdue or due renewals. */
export type TaskLevelFilter = 'stuck' | 'overdue' | 'due'
export type TaskRemind = 'scca_signoff' | 'ra_signoff' | 'building' | 'incident'

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
  /** A building or incident the user asked for: someone else decides. */
  own?: boolean
  url: string
  can_remind: boolean
  remind: TaskRemind | null
}

export interface TaskQuery {
  scope?: TaskScope
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
  scope: TaskScope
  counts: Record<'total' | TaskType | TaskModule, number>
  can_see_all: boolean
  modules: TaskModule[]
}

export interface TaskSummary {
  mine: Record<'total' | TaskType | 'overdue_renewals', number>
  all: null | {
    total: number
    in_approval: number
    stuck: number
    overdue_renewals: number
    due_renewals: number
    building: number
    incident: number
  }
  modules: TaskModule[]
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

export const taskApi = {
  remind: (task: Pick<Task, 'remind' | 'id'>) =>
    $fetch<{ sent: boolean }>(`/api/tasks/${task.remind}/${task.id}/remind`, { method: 'POST' }),
}

export const TASK_MODULES: Record<TaskModule, string> = {
  scca: 'SCCA',
  ra: 'RA HO',
  ra_branch: 'RA Branch',
  location: 'Location',
}

/** Each kind of task, as a badge (`StatusBadge`). */
export const taskType = defineStatusScale<TaskType>({
  signoff: { label: 'Sign-off', color: 'info', icon: 'i-lucide-badge-check' },
  renewal: { label: 'Renewal', color: 'neutral', icon: 'i-lucide-calendar-clock' },
  building: { label: 'Building', color: 'warning', icon: 'i-lucide-building' },
  incident: { label: 'Incident', color: 'error', icon: 'i-lucide-siren' },
})
