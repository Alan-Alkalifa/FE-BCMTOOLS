/** BCP › Manage: the drafts, the Groups waiting to start, and one BCP saved tab by tab. */
import type { BcpStatus } from '~/utils/bcp-sections'

export interface BcpPlanSummary {
  id: number
  ref_no: string
  name: string
  status: BcpStatus
  org_group: string | null
  directorate: string | null
  sub_directorate: string | null
  bia_ref_no: string | null
  critical: number
  coordinator: string | null
  config_code: string
  next_step: string
  /** The Group's latest final BIA has no business critical function any more (D39). */
  no_longer_required: boolean
  updated_at: string | null
}

export interface BcpEligible {
  bia_id: number
  bia_ref_no: string | null
  finalised_at: string | null
  directorate: string | null
  sub_directorate: string | null
  org_group: string | null
  functions: number
  critical: number
}

export interface BcpPerson { id: number, name: string | null, nik: string | null, phone: string | null, email: string | null }
export interface BcpApp { application_id: number | null, name: string, rto: string | null, rto_hours: number | null, is_other: boolean }
export interface BcpFunction {
  id: number
  seq: number
  name: string
  category: string | null
  expected_mtd: string | null
  apps: BcpApp[]
  /** null when it can't be worked out (no application, unreadable RTO or MTD). */
  rto_over_mtd: boolean | null
  critical: boolean
  in_bia: boolean
  fields: Record<string, Record<string, string>>
}
export interface BcpWorkaroundRow {
  id: number | null
  scenario_code: string | null
  scenario_name: string
  procedure_code?: string | null
  procedure: string
  form: string
  pic: string
  /** 'all': every business critical function; else the function ids it covers. */
  functions: 'all' | number[]
}
export interface BcpCondition {
  code: string
  title: string
  intro: string
  columns: { code: string, label: string, example: string, active: boolean }[]
  show_pandemic_levels: boolean
  rows: BcpWorkaroundRow[]
}

/** A sign-off step of the BCP's configuration, with the signer the coordinator picked (D46). */
export interface BcpStep {
  code: string
  group: string
  title: string
  signer_mode: 'plan_role' | 'fixed' | 'chosen'
  required: boolean
  /** A fixed step's signer, as the configuration prints it. */
  name: string | null
  position: string | null
  /** Ketua RTF/IMT and chosen steps: the coordinator picks the signer. */
  pickable: boolean
  user: { id: number, display_name: string | null, email: string | null, job_title: string | null } | null
}
/** A sign-off step as Submit recorded it; the approval module records the decisions. */
export interface BcpSignoff {
  code: string
  title: string
  signer_mode: string
  user_id: number | null
  name: string | null
  position: string | null
  required: boolean
  status: 'pending' | 'approved' | 'rejected' | 'closed' | null
  pending_since: string | null
  decided_at: string | null
}
export interface BcpEventRow { id: number, action: string, actor: string | null, detail: Record<string, string>, at: string | null }
export interface BcpAttachmentInfo { filename: string, content_type: string, size: number, uploaded_by: string | null, uploaded_at: string | null }

export interface BcpPlan {
  id: number
  ref_no: string
  name: string
  status: BcpStatus
  doc_version: number
  revision: number
  group: { directorate: string | null, sub_directorate: string | null, org_group: string | null, description: string | null }
  bia: { id: number | null, ref_no: string | null, finalised_at: string | null, version: number | null }
  config: { version_id: number | null, code: string, latest_code: string | null }
  coordinator: BcpPerson | null
  alternate: BcpPerson | null
  functions: BcpFunction[]
  conditions: BcpCondition[]
  pandemic_levels: { code: string, phase: string, level: string, description: string }[]
  permissions: { can_edit: boolean, can_view: boolean }
  steps: BcpStep[]
  /** What each tab still misses before Submit ("summary" and each condition code). */
  missing: Record<string, string[]>
  can_submit: boolean
  signoffs: BcpSignoff[]
  pending_step: string | null
  submitted_at: string | null
  invalid_reason: string | null
  no_longer_required: { bia_ref_no: string | null, finalised_at: string | null } | null
  attachment: BcpAttachmentInfo | null
  events: BcpEventRow[]
  created_at: string | null
  updated_at: string | null
}

export interface BcpListQuery {
  q?: string
  directorate?: string
  page: number
  per_page: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export function useBcpPlans(query: MaybeRefOrGetter<BcpListQuery>) {
  return useFetch<{ items: BcpPlanSummary[], total: number, page: number, per_page: number }>('/api/bcp/plans', {
    query: computed(() => toValue(query)),
  })
}

export function useBcpEligible() {
  return useFetch<{ items: BcpEligible[] }>('/api/bcp/eligible', { key: 'bcp-eligible' })
}

export function useBcpPlan(id: MaybeRefOrGetter<number>) {
  return useFetch<BcpPlan>(() => `/api/bcp/plans/${toValue(id)}`, {
    key: computed(() => `bcp-plan-${toValue(id)}`),
  })
}

export const bcpApi = {
  create: (biaId: number) => $fetch<BcpPlan>('/api/bcp/plans', { method: 'POST', body: { bia_id: biaId } }),
  saveSummary: (id: number, body: { revision: number, name: string, signoff_users?: Record<string, number | null> }) =>
    $fetch<BcpPlan>(`/api/bcp/plans/${id}/summary`, { method: 'PUT', body }),
  saveCondition: (id: number, code: string, body: { revision: number, rows: BcpWorkaroundRow[], fields: { function_id: number, values: Record<string, string> }[] }) =>
    $fetch<BcpPlan>(`/api/bcp/plans/${id}/conditions/${code}`, { method: 'PUT', body }),
  uploadAttachment: (id: number, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return $fetch<BcpPlan>(`/api/bcp/plans/${id}/attachment`, { method: 'POST', body })
  },
  removeAttachment: (id: number) => $fetch<BcpPlan>(`/api/bcp/plans/${id}/attachment`, { method: 'DELETE' }),
  submit: (id: number, revision: number) => $fetch<BcpPlan>(`/api/bcp/plans/${id}/submit`, { method: 'POST', body: { revision } }),
}

/**
 * What went wrong, in the server's own words where it gives them (a 409 or 403 says why, a 422
 * lists the fields); apiErrorMessage's wording is SCCA's, so it is only the fallback.
 */
export function bcpErrorText(error: unknown): string {
  const { statusCode, data } = (error ?? {}) as { statusCode?: number, data?: { message?: string, details?: Record<string, string> } }
  if (data?.message) return data.message
  const details = Object.values(data?.details ?? {})
  if (statusCode === 422 && details.length) return details.join(' ')
  if (statusCode === 404) return 'This BCP no longer exists.'
  if (statusCode === 409) return 'This BCP changed. Reload it before continuing.'
  return apiErrorMessage(error)
}
