import type { BiancaLocationLabels } from './useBianca'
import type { BcmOperationalRole } from '~/utils/bianca-bcm-roles'

export interface BiancaGrade {
  code: string
  label: string
  min_level: number | null
  max_level: number | null
  active: boolean
  requires_note: boolean
}

export interface BiancaStep {
  bcm_role?: BcmOperationalRole | null
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
  | 'generic_values' | 'downstream_capacity' | 'expected_support_capacity'

export interface BiancaMtdOption {
  code: string
  value: string
  label: string
  category: string | null
  description: string | null
  use_it: boolean
  use_non_it: boolean
  active: boolean
}

export type BiancaConfigPayload = Record<BiancaListKey, string[]> & {
  expected_mtd: { value: string, category: string }[]
  mtd_options?: BiancaMtdOption[] | null
  suggested_mtd_by_period?: Record<string, string>
  suggested_mtd_fallback?: string | null
  office_location_labels?: BiancaLocationLabels
  scores: number[]
  loss_alert_idr: number
  score_alert: number
  hours_per_day: number
  days_per_week: number
  max_functions: number
  it_slots: number
  dependency_slots: number
  /** How long a final BIA stays valid before it is due for review, in months (12 by default). */
  review_period_months: number
  staff_grades: BiancaGrade[]
  signoff_steps: BiancaStep[]
  guides: Record<string, string>
  alternate_site_by_category?: Record<string, string[]>
  /** min_idr/max_idr: optional bounds; Very High has no maximum and its minimum is loss_alert_idr. */
  financial_bands: { code: string, label: string, description: string, min_idr?: number | null, max_idr?: number | null }[]
  impact_matrix: { score: number, regulatory: string, customer: string }[]
}

export interface BiancaListItem {
  id?: string | null
  value?: string | null
  data_type?: 'string'
  code: string
  label: string
  text: string | null
  active: boolean
}

export type BiancaListItems = Record<BiancaListKey, BiancaListItem[]>

export interface BiancaReferenceItem {
  id: string
  value: string | number
  data_type: 'string' | 'integer'
  active: boolean
  detail: string
}

export interface BiancaConfigVersion {
  previous_version?: string | null
  current_version?: string
  reference_guides?: Record<string, string>
  reference_lists?: { expected_mtd: BiancaReferenceItem[], scores: BiancaReferenceItem[] }
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
  changes: { part: string, path?: string[], change?: 'added' | 'removed' | 'changed', before: unknown, after: unknown, previous_version?: string | null, previous_value?: unknown, current_version?: string, current_value?: unknown }[]
}

const BIA_CONFIG = '/api/admin/bianca-config/versions'
export const biancaConfigApi = {
  start: () => $fetch<BiancaConfigVersion>(BIA_CONFIG, { method: 'POST' }),
  save: (id: number, body: { revision: number, name: string, notes: string | null, payload: BiancaConfigPayload, list_items: Partial<BiancaListItems> }) =>
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
