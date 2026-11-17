import type { BiancaStatus } from '~/utils/bianca'

/** One workbook cell the upload reader or the completeness check names. */
export interface BiancaProblem {
  level: 'error' | 'warning'
  message: string
  sheet: string | null
  cell: string | null
}

export interface BiancaImportResult {
  is_template: boolean
  can_import: boolean
  functions: number
  problems: BiancaProblem[]
  errors: number
  warnings: number
}

export interface BiancaItDependency {
  application_id?: number
  application_name?: string
  is_other?: boolean
  rto?: string
  rpo?: string
  workaround?: 'Yes' | 'No' | undefined
  backlog_hours?: number
  system_usage?: string
  gaps?: string
  /** Read only: worked out by the app. */
  daat_hours?: number
  daat_warnings?: string[]
}

export interface BiancaDependency {
  up_name?: string
  up_capacity?: string
  up_mtd?: string
  up_sla?: string
  up_outsourced?: 'Yes' | 'No' | undefined
  up_material?: 'Yes' | 'No' | undefined
  down_name?: string
  down_capacity?: string
  down_mtd?: string
  down_sla?: string
  down_outsourced?: 'Yes' | 'No' | undefined
  down_material?: 'Yes' | 'No' | undefined
}

export interface BiancaFunction {
  name: string
  /** Eight values each, one per period (lookups.periods). */
  loss: (number | undefined)[] | undefined
  regulatory_scores: (number | undefined)[] | undefined
  customer_scores: (number | undefined)[] | undefined
  suggested_mtd: string | undefined
  expected_mtd: string | undefined
  planned_capacity: string | undefined
  it_dependencies: BiancaItDependency[]
  dependencies: BiancaDependency[]
  total_staff: number | undefined
  staff_required: number | undefined
  recovery_level: string | undefined
  prioritization_strategy: string | undefined
  outstanding_strategy: string | undefined
  alt_site_strategy: string | undefined
  seats_current: number | undefined
  seats_required: number | undefined
  res_pc: number | undefined
  res_phone: number | undefined
  res_fax: number | undefined
  res_copier: number | undefined
  res_others: string | undefined
  vital_record: string | undefined
  vital_record_location: string | undefined
  description: string | undefined
  frequency: string | undefined
  critical_timings: string | undefined
  critical_activity: string | undefined
  /** Read only. */
  category?: string
  within_suggested_mtd?: boolean | undefined
}

export const BIANCA_HEADER_TEXT = [
  'group_description', 'main_floor', 'alt_floor', 'recovery_strategy',
  'bcm_coordinator', 'bcm_coordinator_nik', 'bcm_coordinator_phone', 'bcm_coordinator_email',
  'bcm_alternate', 'bcm_alternate_nik', 'bcm_alternate_phone', 'bcm_alternate_email',
  'ra_tools', 'ra_justification', 'staff_others_note',
  'loss_formula', 'justification_regulatory', 'justification_customer', 'justification_rto', 'justification_dependency',
] as const
export const BIANCA_HEADER_BOOL = ['ra_considers_bc', 'ra_controls_included', 'ra_completed'] as const
export const BIANCA_STAFF = ['staff_senior', 'staff_middle', 'staff_manager', 'staff_non_staff', 'staff_others'] as const

export type BiancaHeader
  = { [K in typeof BIANCA_HEADER_TEXT[number]]: string | undefined }
    & { [K in typeof BIANCA_HEADER_BOOL[number]]: boolean | undefined }
    & { [K in typeof BIANCA_STAFF[number]]: number | undefined }
    & { main_location_id: number | undefined, alt_location_id: number | undefined }

export interface BiancaSummary {
  id: number
  ref_no: string | null
  directorate: string | null
  sub_directorate: string | null
  org_group: string | null
  status: BiancaStatus
  pending_role: string | null
  in_revision: boolean
  input_method: 'web' | 'excel'
  functions: number
  updated_at: string | null
  created_by: string | null
}

export interface BiancaAssessment extends Omit<BiancaSummary, 'functions'>, BiancaHeader {
  main_location: BiancaPlace | null
  alt_location: BiancaPlace | null
  total_staff: number
  loss_totals: number[]
  loss_alerts: boolean[]
  functions: BiancaFunction[]
  /** What still blocks Submit (every required cell must be filled). */
  problems: string[]
  warnings: string[]
  can_edit: boolean
  can_delete: boolean
}

export interface BiancaPlace { id: number, code: string | null, name: string, label: string, kind?: string, city?: string | null }
export interface BiancaApplication { id: number, code: string, name: string, label: string, category: string | null, rto: string | null, rpo: string | null }

export interface BiancaLookups {
  periods: string[]
  suggested_mtd: string[]
  expected_mtd: { value: string, category: string }[]
  dependency_mtd: string[]
  percentages: string[]
  upstream_capacity: string[]
  yes_no: string[]
  system_usage: string[]
  alt_site_strategies: string[]
  frequencies: string[]
  staff_grades: Record<string, string>
  scores: number[]
  max_functions: number
  it_slots: number
  dependency_slots: number
  loss_alert_idr: number
  signoff_roles: { code: string, title: string }[]
  organisation: { directorate: string | null, sub_directorate: string | null, org_group: string | null }
}

export interface BiancaPreview {
  functions: {
    category: string | null
    within_suggested_mtd: boolean | null
    it_dependencies: { daat_hours: number | null, warnings: string[], rto_reaches_mtd: boolean | null, gaps_required: boolean }[]
  }[]
  total_staff: number
  loss_totals: number[]
  loss_alerts: boolean[]
}

export interface BiancaPage<T> { items: T[], page: number, per_page: number, total: number, pages: number }

export interface BiancaListQuery {
  q?: string
  status?: BiancaStatus
  mine?: '1'
  page?: number
  per_page?: number
}

/** What the API accepts: every field optional, `functions` replaces the whole list. */
export type BiancaInput = Partial<BiancaHeader> & { functions?: Omit<BiancaFunction, 'category' | 'within_suggested_mtd'>[] }

export function useBiancaAssessments(query: MaybeRefOrGetter<BiancaListQuery>) {
  return useFetch<BiancaPage<BiancaSummary>>('/api/bianca/assessments', {
    query: computed(() => toValue(query)),
  })
}

export function useBiancaAssessment(id: MaybeRefOrGetter<number>) {
  return useFetch<BiancaAssessment>(() => `/api/bianca/assessments/${toValue(id)}`, {
    key: computed(() => `bianca-assessment-${toValue(id)}`),
  })
}

export function useBiancaLookups() {
  return useFetch<BiancaLookups>('/api/bianca/lookups', { key: 'bianca-lookups' })
}

function upload(file: File) {
  const body = new FormData()
  body.append('file', file)
  return body
}

const BASE = '/api/bianca/assessments'

export const BIANCA_TEMPLATE_URL = '/api/bianca/imports/template'

export const biancaApi = {
  applications: (q: string) => $fetch<{ items: BiancaApplication[] }>('/api/bianca/applications', { query: { q } }),
  locations: (q: string) => $fetch<{ items: BiancaPlace[] }>('/api/bianca/locations', { query: { q } }),
  calculate: (body: BiancaInput) => $fetch<BiancaPreview>('/api/bianca/calculate', { method: 'POST', body }),
  create: (body: BiancaInput) => $fetch<BiancaAssessment>(BASE, { method: 'POST', body }),
  update: (id: number, body: BiancaInput) => $fetch<BiancaAssessment>(`${BASE}/${id}`, { method: 'PUT', body }),
  remove: (id: number) => $fetch(`${BASE}/${id}`, { method: 'DELETE' }),
  submit: (id: number) => $fetch<BiancaAssessment>(`${BASE}/${id}/submit`, { method: 'POST' }),
  importPreview: (file: File) => $fetch<BiancaImportResult>('/api/bianca/imports/preview', { method: 'POST', body: upload(file) }),
  importCreate: (file: File) => $fetch<BiancaAssessment>('/api/bianca/imports', { method: 'POST', body: upload(file) }),
  importPreviewDraft: (id: number, file: File) => $fetch<BiancaImportResult>(`${BASE}/${id}/import/preview`, { method: 'POST', body: upload(file) }),
  importReplace: (id: number, file: File) => $fetch<BiancaAssessment>(`${BASE}/${id}/import`, { method: 'POST', body: upload(file) }),
}

/** A refused upload answers 422 with the list of problems (import_failed), a bad file with `details`. */
export function biancaImportFailure(error: unknown): { message: string, result: BiancaImportResult | null } {
  const { statusCode, data } = (error ?? {}) as {
    statusCode?: number
    data?: Partial<BiancaImportResult> & { details?: Record<string, string> }
  }
  if (statusCode === 422 && data?.problems) {
    return { message: 'The workbook has problems. Fix them in Excel and choose the file again.', result: data as BiancaImportResult }
  }
  if (statusCode === 422 && data?.details) return { message: Object.values(data.details).join(' '), result: null }
  if (statusCode === 413) return { message: 'This file is too large to upload.', result: null }
  return { message: apiErrorMessage(error), result: null }
}

/** Blank draft content for a new business function. */
export function emptyBiancaFunction(periods: number): BiancaFunction {
  const blank = () => Array.from({ length: periods }, () => undefined)
  return {
    name: '',
    loss: blank(),
    regulatory_scores: blank(),
    customer_scores: blank(),
    suggested_mtd: undefined,
    expected_mtd: undefined,
    planned_capacity: undefined,
    it_dependencies: [{}],
    dependencies: [{}],
    total_staff: undefined,
    staff_required: undefined,
    recovery_level: undefined,
    prioritization_strategy: undefined,
    outstanding_strategy: undefined,
    alt_site_strategy: undefined,
    seats_current: undefined,
    seats_required: undefined,
    res_pc: undefined,
    res_phone: undefined,
    res_fax: undefined,
    res_copier: undefined,
    res_others: undefined,
    vital_record: undefined,
    vital_record_location: undefined,
    description: undefined,
    frequency: undefined,
    critical_timings: undefined,
    critical_activity: undefined,
  }
}

/** The API answers null for an empty value; the form's inputs take undefined. */
export function nullToUndefined<T>(value: T): T {
  if (value === null) return undefined as T
  if (Array.isArray(value)) return value.map(nullToUndefined) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, nullToUndefined(item)])) as T
  }
  return value
}
