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

export const biancaApprovalApi = {
  approve: (id: number, note?: string | null) =>
    $fetch<BiancaAssessment>(`/api/bianca/assessments/${id}/approve`, { method: 'POST', body: { note: note || null } }),
  reject: (id: number, note: string) =>
    $fetch<BiancaAssessment>(`/api/bianca/assessments/${id}/reject`, { method: 'POST', body: { note } }),
}

export function biancaApprovalPath(id?: number) {
  return id === undefined ? '/bianca/approval' : `/bianca/approval/${id}`
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
