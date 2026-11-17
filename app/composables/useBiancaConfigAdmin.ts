export interface BiancaGrade {
  code: string
  label: string
  min_level: number | null
  max_level: number | null
  active: boolean
  requires_note: boolean
}

export interface BiancaStep {
  code: string
  title: string
  required: boolean
  signer_mode: 'creator' | 'chosen' | 'default' | 'fixed'
  user_id: number | null
}

export interface BiancaSigner {
  id: number
  display_name: string | null
  email: string | null
  job_title: string | null
  department: string | null
}

export type BiancaListKey = 'periods' | 'suggested_mtd' | 'dependency_mtd' | 'percentages'
  | 'upstream_capacity' | 'yes_no' | 'system_usage' | 'alt_site_strategies' | 'frequencies'

export type BiancaConfigPayload = Record<BiancaListKey, string[]> & {
  expected_mtd: { value: string, category: string }[]
  scores: number[]
  loss_alert_idr: number
  score_alert: number
  hours_per_day: number
  days_per_week: number
  max_functions: number
  it_slots: number
  dependency_slots: number
  staff_grades: BiancaGrade[]
  signoff_steps: BiancaStep[]
  guides: Record<string, string>
}

export interface BiancaListItem {
  code: string
  label: string
  text: string | null
  active: boolean
}

export type BiancaListItems = Record<BiancaListKey, BiancaListItem[]>

export interface BiancaConfigVersion {
  list_items?: Partial<BiancaListItems>
  signer_profiles?: Record<string, BiancaSigner>
  id: number
  code: string
  name: string
  notes: string | null
  status: 'draft' | 'active' | 'retired'
  revision: number
  requested_by_id: number | null
  requested_at: string | null
  published_at: string | null
  used_by: number
  payload: BiancaConfigPayload
  changes: { part: string, before: unknown, after: unknown }[]
}

const BIA_CONFIG = '/api/admin/bianca-config/versions'
export const biancaConfigApi = {
  start: () => $fetch<BiancaConfigVersion>(BIA_CONFIG, { method: 'POST' }),
  save: (id: number, body: { revision: number, name: string, notes: string | null, payload: BiancaConfigPayload, list_items: BiancaListItems }) =>
    $fetch<BiancaConfigVersion>(`${BIA_CONFIG}/${id}`, { method: 'PUT', body }),
  action: (id: number, revision: number, action: 'request-publish' | 'withdraw' | 'publish') =>
    $fetch<BiancaConfigVersion>(`${BIA_CONFIG}/${id}/${action}`, { method: 'POST', body: { revision } }),
  discard: (id: number, revision: number) => $fetch(`${BIA_CONFIG}/${id}`, { method: 'DELETE', body: { revision } }),
}

export function biancaConfigError(error: unknown): string {
  const data = (error as { data?: { details?: Record<string, string>, message?: string } })?.data
  return data?.details ? Object.values(data.details).join(' ') : data?.message ?? apiErrorMessage(error)
}

export function biancaGradeLabel(grade: BiancaGrade) {
  return grade.min_level == null ? grade.label : `${grade.label} (U${grade.min_level}–U${grade.max_level})`
}
