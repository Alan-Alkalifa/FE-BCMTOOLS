/**
 * Business Impact Analysis (BIA): assesses a Group's business functions, their Maximum Tolerable
 * Downtime (MTD), criticality category, IT and non-IT dependencies, recovery strategies and
 * critical timings (Template_BIA_Ver2.4).
 */

export const BIA_CATEGORIES = ['Business Critical', 'Important', 'Others'] as const
export type BiaCategory = (typeof BIA_CATEGORIES)[number]

/** Ordered severity (design system: neutral → info → warning → error). Never brand red. */
export const biaCategory = defineStatusScale<BiaCategory | 'na'>({
  'Others': { label: 'Others', color: 'info', icon: 'i-lucide-circle-dot' },
  'Important': { label: 'Important', color: 'warning', icon: 'i-lucide-triangle-alert' },
  'Business Critical': { label: 'Business Critical', color: 'error', icon: 'i-lucide-octagon-alert' },
  'na': { label: 'Not rated', color: 'neutral', icon: 'i-lucide-circle-minus' },
})

/** A BIA's status, in SCCA and RA's words and colours: Draft, Need revision, In revision, In approval, Final. */
export type BiaStatus = 'draft' | 'in_signoff' | 'approved'
export const BIA_STATUSES: BiaStatus[] = ['draft', 'in_signoff', 'approved']
export type BiaRevisionState = 'need_revision' | 'in_revision'
export type BiaStatusKey = BiaStatus | BiaRevisionState

export const biaStatus = defineStatusScale<BiaStatusKey>({
  draft: { label: 'Draft', color: 'neutral', icon: 'i-lucide-file-pen' },
  need_revision: { label: 'Need revision', color: 'error', icon: 'i-lucide-undo-2' },
  in_revision: { label: 'In revision', color: 'warning', icon: 'i-lucide-pencil-line' },
  in_signoff: { label: 'In approval', color: 'warning', icon: 'i-lucide-hourglass' },
  approved: { label: 'Final', color: 'success', icon: 'i-lucide-badge-check' },
})

export function biaStatusKey(item: { status: BiaStatus, is_returned?: boolean, revision_state?: BiaRevisionState | null }): BiaStatusKey {
  if (item.status !== 'draft') return item.status
  return item.revision_state ?? (item.is_returned ? 'in_revision' : 'draft')
}

export type BiaGroupStatusKey = BiaStatusKey | 'overdue' | 'due_soon' | 'renewal_due' | 'not_started'
export const biaGroupStatus = defineStatusScale<BiaGroupStatusKey>({
  approved: { label: 'Final', color: 'success', icon: 'i-lucide-badge-check' },
  overdue: { label: 'Overdue', color: 'error', icon: 'i-lucide-circle-alert' },
  due_soon: { label: 'Due soon', color: 'warning', icon: 'i-lucide-calendar-clock' },
  renewal_due: { label: 'Renewal due', color: 'info', icon: 'i-lucide-calendar' },
  in_signoff: { label: 'In approval', color: 'warning', icon: 'i-lucide-hourglass' },
  need_revision: { label: 'Need revision', color: 'error', icon: 'i-lucide-undo-2' },
  in_revision: { label: 'In revision', color: 'warning', icon: 'i-lucide-pencil-line' },
  draft: { label: 'Draft', color: 'neutral', icon: 'i-lucide-file-pen' },
  not_started: { label: 'Not started', color: 'neutral', icon: 'i-lucide-circle-dashed' },
})

export function biaGroupStatusKey(row: {
  approved: { status: BiaStatus } | null
  open: { status: BiaStatus, is_returned?: boolean, revision_state?: BiaRevisionState | null } | null
  bucket?: 'overdue' | 'due_30' | 'due_90' | 'later' | null
}): BiaGroupStatusKey {
  if (row.open) return biaStatusKey(row.open)
  if (row.approved) {
    if (row.bucket === 'overdue') return 'overdue'
    if (row.bucket === 'due_30') return 'due_soon'
    if (row.bucket === 'due_90') return 'renewal_due'
    return 'approved'
  }
  return 'not_started'
}

export const BIA_STATUS_COLUMN = { class: { th: 'text-center', td: 'text-center' } }

export type BiaReason = 'annual_review' | 'new_group' | 'org_change'
export const BIA_REASONS: { value: BiaReason, label: string, description: string }[] = [
  { value: 'annual_review', label: 'Annual review', description: 'Renews the last final BIA.' },
  { value: 'new_group', label: 'Initial assessment', description: 'The first BIA of this group.' },
  { value: 'org_change', label: 'Organizational change', description: 'The group, its business functions or its IT systems changed.' },
]

export function biaReasonLabel(value: string | null | undefined) {
  return BIA_REASONS.find((reason) => reason.value === value)?.label ?? null
}

/** Sign Off Page rows 44–46: 4 sign-off steps (matches backend constants.SIGNOFF_ROLES). */
export const BIA_SIGNOFF_ROLES = [
  { value: 'bcm_coordinator', label: 'Prepared by', hint: 'BCM Coordinator / RTF' },
  { value: 'group_head', label: 'Acknowledged by', hint: 'Group Head / IMT' },
  { value: 'head_of', label: 'Approved by', hint: 'Head of Sub-Directorate / Directorate' },
  { value: 'bcm_head', label: 'Received by', hint: 'Business Continuity Management Head' },
  { value: 'prepared_by', label: 'Prepared by', hint: 'BCM Coordinator / RTF' },
  { value: 'acknowledged_by_group', label: 'Acknowledged by', hint: 'Group Head / IMT' },
  { value: 'approved_by', label: 'Approved by', hint: 'Head of Sub-Directorate / Directorate' },
  { value: 'received_by_bcm', label: 'Received by', hint: 'Business Continuity Management Head' },
] as const

export type BiaSignoffRole = (typeof BIA_SIGNOFF_ROLES)[number]['value'] | string

export function biaStepTitle(role: string | null | undefined, customTitle?: string | null) {
  if (customTitle) return customTitle
  return BIA_SIGNOFF_ROLES.find((item) => item.value === role)?.hint ?? role ?? '—'
}

export function biaWaiting(days: number) {
  if (days <= 0) return 'Today'
  return `${days} working ${days === 1 ? 'day' : 'days'}`
}

export const biaRenewalBucket = defineStatusScale<'overdue' | 'due_30' | 'due_90' | 'later'>({
  overdue: { label: 'Overdue', color: 'error', icon: 'i-lucide-circle-alert' },
  due_30: { label: 'Due in 30 days', color: 'warning', icon: 'i-lucide-calendar-clock' },
  due_90: { label: 'Due in 31–90 days', color: 'info', icon: 'i-lucide-calendar' },
  later: { label: 'Not due yet', color: 'neutral', icon: 'i-lucide-calendar-check' },
})

export type BiaWaitLevel = 'ok' | 'reminder' | 'escalated'
export const biaWaitLevel = defineStatusScale<BiaWaitLevel>({
  ok: { label: 'On track', color: 'success', icon: 'i-lucide-circle-check' },
  reminder: { label: 'Reminder due', color: 'warning', icon: 'i-lucide-bell' },
  escalated: { label: 'Escalated', color: 'error', icon: 'i-lucide-siren' },
})

export type BiaSection = 'monitoring' | 'manage' | 'approval'

export function biaPath(section: BiaSection, id?: number | 'new') {
  return `/bianca/${section}${id === undefined ? '' : `/${id}`}`
}
