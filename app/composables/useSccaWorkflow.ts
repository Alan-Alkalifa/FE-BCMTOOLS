/** SCCA Monitoring, the Approval menu (inbox, history, BCM board) and the SCCA reminder rules
 * (SCCA configuration > Reminders and escalation). */
import type { SccaListQuery, SccaPage } from '~/composables/useScca'

export type SccaMonitoringStatus = SccaStatus | 'need_revision' | 'in_revision'

export interface SccaMonitoringFilters {
  from?: string
  to?: string
  /** Comma-separated categories. */
  category?: string
  status?: SccaMonitoringStatus
  department?: string
  directorate?: string
  sub_directorate?: string
  division?: string
  q?: string
  /** Renewals: only this bucket. */
  bucket?: 'overdue' | 'due_30' | 'due_90'
  page?: number
  per_page?: number
  sort?: string
  dir?: 'asc' | 'desc'
}

/** A short reference to an SCCA inside a Monitoring row. */
export interface SccaMonitorRef {
  id: number
  ref_no: string | null
  status: SccaStatus
  /** A draft a signer rejected, not resubmitted yet: shown as In revision. */
  in_revision?: boolean
  /** In revision, with no edit saved since the latest rejection. */
  need_revision?: boolean
  /** Brought in by Administration > SCCA migration. */
  migrated?: boolean
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
    need_revision: number
    in_revision: number
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
  application_id: number | null
  department: string | null
  directorate: string | null
  sub_directorate: string | null
  category: SccaCategory | null
  last_final: SccaMonitorRef
  renewal_date: string
  days_left: number
  bucket: SccaRenewalBucket
  assessor: string | null
  contributor: string | null
  contributor_id: number | null
  owner: string | null
  renewal: SccaMonitorRef | null
  renewal_status: 'not_started' | 'draft' | 'in_revision' | 'in_approval'
  /** Generate annual review is allowed on this row (access scope, no open SCCA). */
  can_generate: boolean
}

export interface SccaRegisterRow {
  key: string
  application_name: string
  application_code: string | null
  application_id: number | null
  department: string | null
  directorate: string | null
  sub_directorate: string | null
  contributor: string | null
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
  reason?: string | null
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
  application_code?: string | null
  category?: SccaCategory | null
  reason?: string | null
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
  /** Escalations also email the approver's direct supervisor. */
  escalate_to_supervisor: boolean
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
  return useFetch<Paged<SccaRenewalRow> & { counts: Record<SccaRenewalBucket, number>, contributor_levels: string[] }>(`${MONITOR}/renewals`, {
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

export interface SccaOrgValues {
  directorates: string[]
  sub_directorates: string[]
  divisions: string[]
  departments: string[]
}

/** The directorates, sub directorates, divisions and departments of the SCCAs in view. */
export function useSccaOrgValues() {
  return useFetch<SccaOrgValues>(`${MONITOR}/org-values`, { key: 'scca-org-values' })
}

/** Register > SCCA(s): one application's SCCAs, newest first. */
export interface SccaHistoryItem extends SccaMonitorRef {
  application_name: string
  application_code: string | null
  reason: string | null
  assessor: string | null
  contributor: string | null
  renews: SccaMonitorRef | null
  mark: 'current' | 'replaced' | null
}

export function useSccaApplicationHistory(query: MaybeRefOrGetter<{ key: string, page: number, per_page: number }>) {
  return useFetch<Paged<SccaHistoryItem>>(`${MONITOR}/application-sccas`, {
    query: computed(() => toValue(query)),
    watch: [() => toValue(query)],
  })
}

export function sccaApplicationHistoryExportUrl(key: string) {
  return `${MONITOR}/application-sccas.xlsx?${new URLSearchParams({ key })}`
}

export interface SccaContributorOption {
  id: number
  display_name: string
  email: string
  job_title: string | null
  division: string | null
  directorate: string | null
  org_level: string | null
}

export interface SccaGenerateResult {
  created: { id: number, ref_no: string, renews: string, application_name: string }[]
  skipped: { id: number, ref_no: string, open_id: number, open_ref_no: string, reason: string }[]
  refused: { id: number, ref_no?: string, reason: string }[]
}

export const sccaRenewalsApi = {
  contributors: (q: string) =>
    $fetch<{ levels: string[], items: SccaContributorOption[] }>(`${MONITOR}/renewals/contributors`, { query: { q } }),
  generate: (assessmentIds: number[], contributorId: number | null) =>
    $fetch<SccaGenerateResult>(`${MONITOR}/renewals/generate`, {
      method: 'POST',
      body: { assessment_ids: assessmentIds, contributor_id: contributorId },
    }),
}

export interface SccaBulkNudgeResult {
  sent: { id: number, ref_no: string }[]
  skipped: { id: number, ref_no?: string, reason: string }[]
  failed: { id: number, ref_no: string }[]
}

/** BCM board > Send reminder (n). */
export function sccaNudgeMany(assessmentIds: number[]) {
  return $fetch<SccaBulkNudgeResult>('/api/scca/approvals/nudge', { method: 'POST', body: { assessment_ids: assessmentIds } })
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

export function sccaManageExportUrl(filters: SccaListQuery | Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(clean({ ...filters, page: undefined, per_page: undefined }))) {
    query.set(key, String(value))
  }
  const text = query.toString()
  return `/api/scca/assessments/export.xlsx${text ? `?${text}` : ''}`
}

export function sccaApprovalExportUrl(view: 'inbox' | 'history' | 'board', filters: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(clean({ ...filters, page: undefined, per_page: undefined }))) {
    query.set(key, String(value))
  }
  const text = query.toString()
  return `/api/scca/approvals/${view}.xlsx${text ? `?${text}` : ''}`
}

/** Every approval list is server-paginated: `page` and `per_page` go to the API. */
type PageQuery = { page?: number, per_page?: number, sort?: string, dir?: 'asc' | 'desc' }

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

export interface SccaHistoryQuery {
  decision?: SccaHistoryKind
  step?: string
  category?: string
  reason?: string
  q?: string
  from?: string
  to?: string
}

export function useSccaHistory(query: MaybeRefOrGetter<SccaHistoryQuery & PageQuery>) {
  return useFetch<Paged<SccaHistoryRow>>('/api/scca/approvals/history', {
    query: computed(() => clean(toValue(query))),
  })
}

export function useSccaBoard(query: MaybeRefOrGetter<SccaMonitoringFilters & {
  step?: SccaSignoffRole
  level?: SccaWaitLevel
  reason?: string
  approver_id?: number
} & PageQuery>) {
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
