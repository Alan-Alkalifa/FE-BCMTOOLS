import type { FormError } from '@nuxt/ui'
import type { InjectionKey } from 'vue'

export interface SccaOption {
  rating: number
  label: string
  guidance: string | null
}

export interface SccaQuestion {
  code: string
  dimension: SccaDimension
  component: string
  label: string
  question: string
  options: SccaOption[]
}

export interface SccaFormula {
  code: string
  name: string
  categories: SccaCategory[]
  questions: SccaQuestion[]
  thresholds: { kind: 'CIA' | 'POLOSS', level: number, min_score: number }[]
  matrix: { cia_level: number, poloss_level: number, category: SccaCategory }[]
}

export interface SccaRecoveryStandard {
  category: SccaCategory
  mtd: string | null
  rto: string | null
  uptime: string | null
}

export interface SccaScores {
  confidentiality_score: number | null
  confidentiality_weight_set: string | null
  integrity_score: number | null
  availability_score: number | null
  cia_score: number | null
  cia_level: number | null
  poloss_score: number | null
  poloss_weight_set: string | null
  poloss_level: number | null
}

export interface SccaPreview {
  result: (SccaScores & { category: SccaCategory }) | null
  missing: string[]
}

export interface SccaAnswer {
  code: string
  rating: number
  justification: string | null
}

export interface SccaInterdependency {
  direction: SccaDirection
  seq?: number
  system_name: string
  criticality_category: SccaCategory | null
  rto: string | null
  rpo: string | null
  dr_capacity: string | null
  processing_mode: string | null
  dependency: SccaDependency | null
  workaround: string | null
  gaps: string | null
}

export type SccaRecoveryValue = { kind: SccaRecoveryKind } & Record<SccaRecoveryField, string | null>

export interface SccaSignoff {
  role: SccaSignoffRole
  name: string | null
  designation: string | null
  sub_dir: string | null
}

export interface SccaAssessmentFields {
  ref_no?: string | null
  application_code: string | null
  application_name: string
  application_description: string | null
  assessment_reason: SccaReason | null
  assessment_date: string | null
  due_date: string | null
  application_owner: string | null
  it_support: string | null
  business_stakeholders: string | null
  assessor: string | null
  country: string | null
  vendor_name: string | null
  deployment_model: string | null
  customer_facing: boolean | null
  business_days: string | null
  business_hours: string | null
  override_type: SccaOverrideType | null
  override_category: SccaCategory | null
  justification: string | null
  cim_ref_no: string | null
}

export interface SccaAssessment extends SccaAssessmentFields {
  id: number
  can_delete?: boolean
  formula_version: string
  answers: SccaAnswer[]
  missing_answers: string[]
  result: SccaScores & {
    computed_category: SccaCategory | null
    final_category: SccaCategory | null
    calculated_at: string | null
  }
  interdependencies: SccaInterdependency[]
  recovery_values: SccaRecoveryValue[]
  signoffs: SccaSignoff[]
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface SccaAssessmentSummary {
  id: number
  ref_no: string | null
  application_code: string | null
  application_name: string
  assessment_reason: SccaReason | null
  application_owner: string | null
  assessment_date: string | null
  due_date: string | null
  computed_category: SccaCategory | null
  final_category: SccaCategory | null
  is_complete: boolean
  created_by: string | null
  updated_at: string
}

export interface SccaPage<T> {
  items: T[]
  page: number
  per_page: number
  total: number
  pages: number
}

export interface SccaListQuery {
  q?: string
  category?: SccaCategory
  page: number
  per_page: number
}

export type SccaAssessmentUpdate = Partial<SccaAssessmentFields> & {
  recovery_values?: SccaRecoveryValue[]
  signoffs?: SccaSignoff[]
}

export type SccaAssessmentCreate = SccaAssessmentUpdate & { application_name: string }

export const sccaDirtyKey: InjectionKey<Ref<boolean>> = Symbol('scca-dirty')
export const sccaLivePreviewKey: InjectionKey<Ref<SccaPreview | null>> = Symbol('scca-live-preview')

export function useSccaDirty() {
  return inject(sccaDirtyKey, undefined)
}

export function useSccaLivePreview() {
  return inject(sccaLivePreviewKey, undefined)
}

export function useSccaFormula() {
  return useFetch<SccaFormula>('/api/scca/formula', {
    key: 'scca-formula',
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key],
  })
}

export function useSccaRecoveryStandards() {
  return useFetch<{ items: SccaRecoveryStandard[] }>('/api/scca/recovery-standards', {
    key: 'scca-recovery-standards',
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key],
  })
}

/** One page of assessments; the server filters and paginates, and it refetches when `query` changes. */
export function useSccaAssessments(query: MaybeRefOrGetter<SccaListQuery>) {
  return useFetch<SccaPage<SccaAssessmentSummary>>('/api/scca/assessments', {
    query: computed(() => toValue(query)),
  })
}

export function useSccaAssessment(id: MaybeRefOrGetter<number>) {
  return useFetch<SccaAssessment>(() => `/api/scca/assessments/${toValue(id)}`, {
    key: computed(() => `scca-assessment-${toValue(id)}`),
  })
}

const BASE = '/api/scca/assessments'

export const sccaApi = {
  calculate: (ratings: Record<string, number>) =>
    $fetch<SccaPreview>('/api/scca/calculate', { method: 'POST', body: { ratings } }),
  create: (body: SccaAssessmentCreate) => $fetch<SccaAssessment>(BASE, { method: 'POST', body }),
  update: (id: number, body: SccaAssessmentUpdate) =>
    $fetch<SccaAssessment>(`${BASE}/${id}`, { method: 'PUT', body }),
  setAnswers: (id: number, answers: Partial<SccaAnswer>[]) =>
    $fetch<SccaAssessment>(`${BASE}/${id}/answers`, { method: 'PUT', body: { answers } }),
  setInterdependencies: (id: number, interdependencies: SccaInterdependency[]) =>
    $fetch<SccaAssessment>(`${BASE}/${id}/interdependencies`, {
      method: 'PUT',
      body: { interdependencies },
    }),
  remove: (id: number) => $fetch(`${BASE}/${id}`, { method: 'DELETE' }),
}

interface ApiError {
  statusCode?: number
  data?: { error?: string, details?: Record<string, string> }
}

/** Field errors from a 422 response, keyed by the API's field path (e.g. `answers.C1`). */
export function apiFieldErrors(error: unknown): FormError[] {
  const { statusCode, data } = (error ?? {}) as ApiError
  if (statusCode !== 422 || !data?.details) return []
  return Object.entries(data.details).map(([name, message]) => ({ name, message }))
}

export function apiErrorMessage(error: unknown) {
  const { statusCode } = (error ?? {}) as ApiError
  if (statusCode === 422) return 'Some fields need attention. Check the messages below each field.'
  if (statusCode === 401) return 'Your session has expired. Sign in again to continue.'
  if (statusCode === 403) return 'You don\'t have permission to do this.'
  if (statusCode === 404) return 'This assessment no longer exists.'
  return 'Couldn\'t reach the server. Check your connection and try again.'
}

/** Empty strings become null, so cleared inputs clear the saved value. */
export function blankToNull<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, typeof value === 'string' && value.trim() === '' ? null : value]),
  ) as T
}
