import type { BiancaAssessment, BiancaPage } from '~/composables/useBianca'
import type { BiancaStatus } from '~/utils/bianca'

/** A BIA in approval, as the inbox and Coming up list it. */
export interface BiancaWaiting {
  id: number
  ref_no: string | null
  directorate: string | null
  sub_directorate: string | null
  org_group: string | null
  functions: number
  highest_category: string | null
  /** The step it waits on now, and who signs it. */
  step: string | null
  step_title: string | null
  signer: string | null
  /** The signed-in user's own step (in Coming up: a later one). */
  my_step: string | null
  my_step_title: string | null
  submitted_by: string | null
  submitted_at: string | null
  pending_since: string | null
  working_days_waiting: number | null
}

export type BiancaHistoryAction = 'submitted' | 'approved' | 'rejected'

export interface BiancaHistoryRow {
  id: number
  action: BiancaHistoryAction
  role: string | null
  role_title: string | null
  note: string | null
  at: string | null
  assessment: {
    id: number
    ref_no: string | null
    org_group: string | null
    directorate: string | null
    status: BiancaStatus
    pending_role: string | null
    in_revision: boolean
  }
}

/** One sign-off box of a submitted BIA, in the order of its approval template. */
export interface BiancaSignoffRow {
  role: string
  title: string
  name: string | null
  designation: string | null
  user_id: number | null
  status: 'pending' | 'approved' | 'rejected' | null
  /** The step the BIA waits on now. */
  current: boolean
  decided_at: string | null
  decision_note: string | null
  pending_since: string | null
  on_behalf_by?: string | null
}

export type BiancaWaitLevel = 'ok' | 'reminder' | 'escalated'

export interface BiancaBoardRow {
  id: number
  ref_no: string | null
  org_group: string | null
  sub_directorate: string | null
  directorate: string | null
  functions: number
  highest_category: string | null
  step: string | null
  step_title: string | null
  approver: string | null
  approver_id: number | null
  waiting_since: string | null
  working_days_waiting: number
  reminders_sent: number
  escalated_at: string | null
  level: BiancaWaitLevel
  can_act: boolean
}

export type BiancaBoardResult = BiancaAssessment & { email_sent: boolean }

export interface BiancaBulkNudgeResult {
  sent: Array<{ id: number, ref_no: string | null }>
  skipped: Array<{ id: number, ref_no?: string | null, reason: string }>
  failed: Array<{ id: number, ref_no: string | null }>
}

export interface BiancaEvent {
  id: number
  action: string
  role: string | null
  role_title: string | null
  actor: string | null
  note: string | null
  /** What the activity log says. */
  label?: string
  created_at: string | null
}

interface PageQuery { page?: number, per_page?: number }

export function useBiancaInbox(query: MaybeRefOrGetter<PageQuery>) {
  return useFetch<BiancaPage<BiancaWaiting>>('/api/bianca/approvals/inbox', {
    key: 'bianca-approvals-inbox',
    query: computed(() => toValue(query)),
  })
}

export function useBiancaUpcoming(query: MaybeRefOrGetter<PageQuery>) {
  return useFetch<BiancaPage<BiancaWaiting>>('/api/bianca/approvals/upcoming', {
    key: 'bianca-approvals-upcoming',
    query: computed(() => toValue(query)),
  })
}

export function useBiancaApprovalHistory(query: MaybeRefOrGetter<PageQuery & { action?: BiancaHistoryAction, q?: string }>) {
  return useFetch<BiancaPage<BiancaHistoryRow>>('/api/bianca/approvals/history', {
    key: 'bianca-approvals-history',
    query: computed(() => toValue(query)),
  })
}

export interface BiancaBoardQuery extends PageQuery {
  step?: string
  level?: BiancaWaitLevel
  category?: string
  approver_id?: number
  q?: string
  sort?: string
  direction?: 'asc' | 'desc'
}

export function useBiancaBoard(query: MaybeRefOrGetter<BiancaBoardQuery>) {
  return useFetch<BiancaPage<BiancaBoardRow>>('/api/bianca/approvals/board', {
    key: 'bianca-approvals-board',
    query: computed(() => toValue(query)),
  })
}

export const biancaApprovalApi = {
  approve: (id: number, note?: string | null) =>
    $fetch<BiancaAssessment>(`/api/bianca/assessments/${id}/approve`, { method: 'POST', body: { note: note || null } }),
  reject: (id: number, note: string) =>
    $fetch<BiancaAssessment>(`/api/bianca/assessments/${id}/reject`, { method: 'POST', body: { note } }),
}

export const biancaBoardApi = {
  nudge: (id: number) =>
    $fetch<BiancaBoardResult>(`/api/bianca/assessments/${id}/nudge`, { method: 'POST' }),
  nudgeMany: (assessmentIds: number[]) =>
    $fetch<BiancaBulkNudgeResult>('/api/bianca/approvals/nudge', {
      method: 'POST',
      body: { assessment_ids: assessmentIds },
    }),
  reassign: (id: number, userId: number, reason: string) =>
    $fetch<BiancaBoardResult>(`/api/bianca/assessments/${id}/reassign`, {
      method: 'POST',
      body: { user_id: userId, reason },
    }),
  approveOnBehalf: (id: number, reason: string, file: File) => {
    const body = new FormData()
    body.append('reason', reason)
    body.append('file', file)
    return $fetch<BiancaBoardResult>(`/api/bianca/assessments/${id}/approve-on-behalf`, {
      method: 'POST',
      body,
    })
  },
}

export const biancaWaitLevel = defineStatusScale<BiancaWaitLevel>({
  ok: { label: 'On track', color: 'neutral', icon: 'i-lucide-clock' },
  reminder: { label: 'Reminder due', color: 'warning', icon: 'i-lucide-bell' },
  escalated: { label: 'Escalated', color: 'error', icon: 'i-lucide-triangle-alert' },
})

export function biancaApprovalPath(id?: number) {
  return id === undefined ? '/bianca/approval' : `/bianca/approval/${id}`
}

export function biancaApprovalExportUrl(
  view: 'inbox' | 'history' | 'board',
  filters: Record<string, string | number | undefined> = {},
) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return `/api/bianca/approvals/${view}.xlsx${text ? `?${text}` : ''}`
}

/** "Today", "1 working day", "4 working days". */
export function biancaWaiting(days: number | null | undefined) {
  if (days == null) return '—'
  if (days <= 0) return 'Today'
  return `${days} working ${days === 1 ? 'day' : 'days'}`
}

export const biancaHistoryAction = defineStatusScale<BiancaHistoryAction>({
  submitted: { label: 'Submitted', color: 'info', icon: 'i-lucide-send' },
  approved: { label: 'Approved', color: 'success', icon: 'i-lucide-badge-check' },
  rejected: { label: 'Returned', color: 'warning', icon: 'i-lucide-undo-2' },
})

export const biancaSignoffStatus = defineStatusScale<'pending' | 'approved' | 'rejected' | 'waiting' | 'skipped'>({
  pending: { label: 'Waiting for sign-off', color: 'warning', icon: 'i-lucide-hourglass' },
  approved: { label: 'Approved', color: 'success', icon: 'i-lucide-badge-check' },
  rejected: { label: 'Returned', color: 'error', icon: 'i-lucide-undo-2' },
  waiting: { label: 'Not yet', color: 'neutral', icon: 'i-lucide-clock' },
  skipped: { label: 'No signer', color: 'neutral', icon: 'i-lucide-minus' },
})

/** A sign-off box's badge: the current step waits, a later one hasn't had its turn yet. */
export function biancaSignoffKey(row: BiancaSignoffRow) {
  if (row.status === 'pending') return row.current ? 'pending' : 'waiting'
  if (row.status === 'approved' || row.status === 'rejected') return row.status
  return row.user_id ? 'waiting' : 'skipped'
}
