/** SCCA Monitoring, the Approval menu (inbox, history, BCM board) and the SCCA reminder rules
 * (SCCA configuration > Reminders and escalation). */
import type { SccaPage } from '~/composables/useScca'

export interface SccaMonitoringFilters {
  from?: string
  to?: string
  /** Comma-separated categories. */
  category?: string
  status?: SccaStatus
  department?: string
  q?: string
  page?: number
  per_page?: number
}

/** A short reference to an SCCA inside a Monitoring row. */
export interface SccaMonitorRef {
  id: number
  ref_no: string | null
  status: SccaStatus
  category: SccaCategory | null
  assessment_date: string | null
  finalised_at: string | null
  due_date: string | null
  pending_role: SccaSignoffRole | null
  pending_step: string | null
}

export interface SccaOverview {
  cards: {
    applications_assessed: number
    in_approval: number
    drafts: number
    overdue_renewals: number
    due_in_90_days: number
    stuck_approvals: number
  }
  by_category: { category: SccaCategory, applications: number }[]
  finalised_per_month: { month: string, sccas: number }[]
}

export type SccaRenewalBucket = 'overdue' | 'due_30' | 'due_90'

export interface SccaRenewalRow {
  key: string
  application_name: string
  application_code: string | null
  department: string | null
  category: SccaCategory | null
  last_final: SccaMonitorRef
  renewal_date: string
  days_left: number
  bucket: SccaRenewalBucket
  assessor: string | null
  owner: string | null
  renewal: SccaMonitorRef | null
  renewal_status: 'not_started' | 'draft' | 'in_approval'
}

export interface SccaRegisterRow {
  key: string
  application_name: string
  application_code: string | null
  department: string | null
  category: SccaCategory | null
  latest_final: SccaMonitorRef | null
  renewal_date: string | null
  open: SccaMonitorRef | null
  latest_status: SccaStatus
  assessor: string | null
  owner: string | null
  it_support: string | null
  scca_count: number
  history: SccaMonitorRef[]
}

export type SccaWaitLevel = 'ok' | 'reminder' | 'escalated'

export interface SccaBottleneckRow {
  id: number
  ref_no: string | null
  application_name: string
  application_code: string | null
  department: string | null
  category: SccaCategory | null
  step: SccaSignoffRole
  step_title: string
  approver: string | null
  approver_email: string | null
  approver_id: number | null
  waiting_since: string | null
  working_days_waiting: number
  level: SccaWaitLevel
  reminders_sent: number
  escalated_at: string | null
  submitted_at: string | null
  working_days_in_approval: number
  /** Board only: false on SCCAs the signed-in BCM user assesses or contributes to. */
  can_act?: boolean
}

export interface SccaStepAverage {
  step: SccaSignoffRole
  step_title: string
  approvals: number
  average_working_days: number | null
}

export interface SccaInboxRow {
  id: number
  ref_no: string | null
  application_name: string
  application_code: string | null
  category: SccaCategory | null
  step: SccaSignoffRole
  step_title: string
  submitted_by: string | null
  submitted_at: string | null
  waiting_since: string | null
  working_days_waiting: number
  level: SccaWaitLevel
  reminders_sent: number
}

export interface SccaUpcomingRow {
  id: number
  ref_no: string | null
  application_name: string
  category: SccaCategory | null
  my_step: SccaSignoffRole
  my_step_title: string
  current_step: SccaSignoffRole
  current_step_title: string
  steps_before_mine: number
}

export type SccaHistoryKind = 'approved' | 'rejected' | 'approved_on_behalf' | 'reassigned' | 'comment'

export interface SccaHistoryRow {
  kind: SccaHistoryKind
  decision: string
  by: string | null
  at: string | null
  id: number
  ref_no: string | null
  application_name: string
  step: string | null
  step_title: string | null
  note: string | null
  tab?: SccaTab
  status_now: SccaStatus
}

export interface SccaSettings {
  reminders_enabled: boolean
  reminder_after_days: number
  reminder_every_days: number
  escalate_after_days: number
  extra_escalation_emails: string[]
  renewal_notice_days: number[]
  overdue_repeat_days: number
  window_start_hour: number
  window_end_hour: number
  updated_at?: string | null
  updated_by?: string | null
}

type Paged<T> = SccaPage<T>

const MONITOR = '/api/scca/monitoring'

function clean<T extends object>(query: T) {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== '')) as T
}

export function useSccaOverview(filters: MaybeRefOrGetter<SccaMonitoringFilters>) {
  return useFetch<SccaOverview>(`${MONITOR}/overview`, { query: computed(() => clean(toValue(filters))) })
}

export function useSccaRenewals(filters: MaybeRefOrGetter<SccaMonitoringFilters>) {
  return useFetch<Paged<SccaRenewalRow> & { counts: Record<SccaRenewalBucket, number> }>(`${MONITOR}/renewals`, {
    query: computed(() => clean(toValue(filters))),
  })
}

export function useSccaRegister(filters: MaybeRefOrGetter<SccaMonitoringFilters>) {
  return useFetch<Paged<SccaRegisterRow>>(`${MONITOR}/register`, { query: computed(() => clean(toValue(filters))) })
}

export function useSccaBottlenecks(filters: MaybeRefOrGetter<SccaMonitoringFilters>) {
  return useFetch<Paged<SccaBottleneckRow> & { step_averages: SccaStepAverage[] }>(`${MONITOR}/bottlenecks`, {
    query: computed(() => clean(toValue(filters))),
  })
}

export function useSccaDepartments() {
  return useFetch<{ items: string[] }>(`${MONITOR}/departments`, { key: 'scca-departments' })
}

/** The Excel download of a Monitoring view, with the same filters (all rows). */
export function sccaExportUrl(view: 'register' | 'renewals' | 'bottlenecks', filters: SccaMonitoringFilters) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(clean({ ...filters, page: undefined, per_page: undefined }))) {
    query.set(key, String(value))
  }
  const text = query.toString()
  return `${MONITOR}/${view}.xlsx${text ? `?${text}` : ''}`
}

/** Every approval list is server-paginated: `page` and `per_page` go to the API. */
type PageQuery = { page?: number, per_page?: number }

export function useSccaInbox(query: MaybeRefOrGetter<PageQuery> = {}) {
  return useFetch<Paged<SccaInboxRow>>('/api/scca/approvals/inbox', {
    key: 'scca-inbox',
    query: computed(() => clean(toValue(query))),
  })
}

export function useSccaUpcoming(query: MaybeRefOrGetter<PageQuery> = {}) {
  return useFetch<Paged<SccaUpcomingRow>>('/api/scca/approvals/upcoming', {
    key: 'scca-upcoming',
    query: computed(() => clean(toValue(query))),
  })
}

export function useSccaHistory(query: MaybeRefOrGetter<{ decision?: SccaHistoryKind } & PageQuery>) {
  return useFetch<Paged<SccaHistoryRow>>('/api/scca/approvals/history', {
    query: computed(() => clean(toValue(query))),
  })
}

export function useSccaBoard(query: MaybeRefOrGetter<SccaMonitoringFilters & { step?: SccaSignoffRole } & PageQuery>) {
  return useFetch<Paged<SccaBottleneckRow>>('/api/scca/approvals/board', {
    query: computed(() => clean(toValue(query))),
  })
}

export const sccaSettingsApi = {
  get: () => $fetch<SccaSettings>('/api/admin/settings/scca'),
  save: (body: SccaSettings) => $fetch<SccaSettings>('/api/admin/settings/scca', { method: 'PUT', body }),
}

export const sccaWaitLevel = defineStatusScale<SccaWaitLevel>({
  ok: { label: 'On time', color: 'neutral', icon: 'i-lucide-clock' },
  reminder: { label: 'Reminder due', color: 'warning', icon: 'i-lucide-bell-ring' },
  escalated: { label: 'Escalated', color: 'error', icon: 'i-lucide-siren' },
})

export const sccaRenewalBucket = defineStatusScale<SccaRenewalBucket>({
  overdue: { label: 'Overdue', color: 'error', icon: 'i-lucide-circle-alert' },
  due_30: { label: 'Due in 30 days', color: 'warning', icon: 'i-lucide-calendar-clock' },
  due_90: { label: 'Due in 31–90 days', color: 'info', icon: 'i-lucide-calendar' },
})

/** "3 working days", "1 working day". */
export function workingDays(count: number) {
  return `${count} working day${count === 1 ? '' : 's'}`
}
