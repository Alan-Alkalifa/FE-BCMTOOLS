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

export interface SccaRecoveryStandard extends SccaConfigStandard {
  category: SccaCategory
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
  /** The upstream/downstream application in the application master. */
  application_id: number | null
  /** The application's name as saved on this SCCA. */
  system_name: string
  criticality_category: SccaCategory | null
  rto: string | null
  rpo: string | null
  dr_capacity: string | null
  processing_mode: string | null
  dependency: SccaDependency | null
  workaround: string | null
  /** Worked out by the app. */
  gaps: string | null
  /** The assessor's own gap notes. */
  gaps_note: string | null
}

export type SccaRecoveryValue = { kind: SccaRecoveryKind } & Record<SccaRecoveryField, string | null>

export interface SccaPerson {
  id: number
  display_name: string | null
  email: string | null
  job_title: string | null
  department: string | null
}

/** What the API accepts: a user for a sign-off step (null clears it). */
export interface SccaSignoffInput {
  role: SccaSignoffRole
  user_id: number | null
}

/** A sign-off step as saved: the picked user's profile snapshot and the decision. */
export interface SccaSignoff extends SccaSignoffInput {
  name: string | null
  designation: string | null
  sub_dir: string | null
  email: string | null
  status: SccaSignoffStatus | null
  decided_at: string | null
  decision_note: string | null
  /** When the step became pending (the reminder clock). */
  pending_since?: string | null
  /** BCM approved this step on the approver's behalf. */
  on_behalf_by?: string | null
  /** An optional step nobody signs: skipped at Submit ("Not required"). */
  skipped?: boolean
  attachment?: SccaAttachment | null
}

/** Evidence kept with an SCCA (approval on behalf). */
export interface SccaAttachment {
  id: number
  filename: string
  content_type: string
  size: number
  url: string
}

export interface SccaRef {
  id: number
  ref_no: string | null
  status: SccaStatus
  finalised_at?: string | null
}

export interface SccaComment {
  id: number
  tab: SccaTab
  body: string
  author: string | null
  author_role: string | null
  created_at: string
}

export type SccaApprovalAction
  = | 'submitted'
    | 'approved'
    | 'rejected'
    | 'recalled'
    | 'finalised'
    | 'reassigned'
    | 'approved_on_behalf'
    | 'nudged'
    | 'reminded'
    | 'escalated'

export interface SccaApprovalEvent {
  action: SccaApprovalAction
  role: string | null
  actor: string | null
  note: string | null
  from_user?: string | null
  to_user?: string | null
  attachment?: SccaAttachment | null
  created_at: string
}

export interface SccaPermissions {
  can_view: boolean
  can_edit: boolean
  can_set_contributor: boolean
  can_submit: boolean
  can_decide: boolean
  comment_tabs: SccaTab[]
}

export interface SccaAssessmentFields {
  ref_no?: string | null
  /** The application master row (Annual review, System change pick it). */
  application_id?: number | null
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
  contributor_id: number | null
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

/** An active application of the master, with the header of its latest SCCA if it has one
 * (GET /api/scca/applications). */
export interface SccaApplication {
  application_id: number
  category: string | null
  rto_hours: string | null
  rpo: string | null
  characteristics: ApplicationCharacteristics
  application_code: string | null
  application_name: string
  application_description: string | null
  application_owner: string | null
  it_support: string | null
  business_stakeholders: string | null
  country: string | null
  vendor_name: string | null
  deployment_model: string | null
  customer_facing: boolean | null
  business_days: string | null
  business_hours: string | null
  directorate?: string | null
  /** With `reason`: whether the reason rules let it be picked, and why not. */
  available?: boolean
  problem?: string | null
  renewal_status?: 'overdue' | 'due_30' | 'due_90' | 'active' | null
  last_final?: { id: number, ref_no: string | null, finalised_at: string | null, due_date: string | null } | null
  last_assessment: {
    id: number
    ref_no: string | null
    status: SccaStatus
    assessment_date: string | null
    due_date: string | null
  } | null
}

export interface SccaAssessment extends SccaAssessmentFields {
  id: number
  permissions: SccaPermissions
  status: SccaStatus
  pending_role: SccaSignoffRole | null
  submitted_at: string | null
  finalised_at: string | null
  assessor_user: SccaPerson | null
  contributor: SccaPerson | null
  comments: SccaComment[]
  events: SccaApprovalEvent[]
  formula_version: string
  /** The active configuration version; a draft on an older one can move to it. */
  latest_version?: string | null
  can_move_version?: boolean
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
  /** The signed-in user's part in it: they edit drafts, and only read once it is submitted. */
  my_role?: 'assessor' | 'contributor' | null
  /** The final SCCA this draft renews, and the renewal started from this one. */
  renewal_of?: SccaRef | null
  renewal?: SccaRef | null
  /** The application's latest final SCCA other than this one. */
  previous_final?: SccaRef | null
  renewal_opens_on?: string | null
  can_renew?: boolean
}

export interface SccaAssessmentSummary {
  id: number
  ref_no: string | null
  application_id?: number | null
  application_code: string | null
  application_name: string
  assessment_reason: SccaReason | null
  application_owner: string | null
  assessment_date: string | null
  due_date: string | null
  computed_category: SccaCategory | null
  final_category: SccaCategory | null
  is_complete: boolean
  status: SccaStatus
  pending_role: SccaSignoffRole | null
  pending_step: string | null
  waiting_for_me: boolean
  created_by: string | null
  updated_at: string
  /** The assessor's name. */
  assessor?: string | null
  /** With `mine=1` (Manage). `directorate`: a generated annual review of the user's directorate,
   * read-only (SCCA configuration > Access scope). */
  my_role?: 'assessor' | 'contributor' | 'directorate' | null
  next_step?: string | null
  renewal_of?: SccaRef | null
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
  reason?: string
  status?: SccaStatus
  /** "1": only assessments waiting for the signed-in user's approval. */
  waiting?: '1'
  /** "1": only the SCCAs I assess or contribute to (Manage). */
  mine?: '1'
  /** "1": drafts and renewals due within 90 days. */
  needs_action?: '1'
  page: number
  per_page: number
}

export type SccaAssessmentUpdate = Partial<SccaAssessmentFields> & {
  recovery_values?: SccaRecoveryValue[]
  signoffs?: SccaSignoffInput[]
}

/** Approval actions answer with the assessment and whether the notification email went out. */
export type SccaApprovalResult = SccaAssessment & { email_sent: boolean }

export type SccaAssessmentCreate = SccaAssessmentUpdate & { application_name: string }

export const sccaDirtyKey: InjectionKey<Ref<boolean>> = Symbol('scca-dirty')
export const sccaLivePreviewKey: InjectionKey<Ref<SccaPreview | null>> = Symbol('scca-live-preview')
/** True while the open tab's form saves; the record page's Save button (top bar) shows it. */
export const sccaSavingKey: InjectionKey<Ref<boolean>> = Symbol('scca-saving')

export function useSccaDirty() {
  return inject(sccaDirtyKey, undefined)
}

export function useSccaSaving() {
  return inject(sccaSavingKey, undefined)
}

export function useSccaLivePreview() {
  return inject(sccaLivePreviewKey, undefined)
}

/** The configuration of the SCCA's own version (choice lists, steps, notes); the active
 * version when `version` is empty (a new SCCA). */
export const sccaConfigKey: InjectionKey<Ref<SccaConfig | null | undefined>> = Symbol('scca-config')

export function useSccaConfig(version?: MaybeRefOrGetter<string | null | undefined>) {
  const code = computed(() => toValue(version) || '')
  const fetched = useFetch<SccaConfig>('/api/scca/config', {
    key: computed(() => `scca-config-${code.value || 'active'}`),
    query: computed(() => (code.value ? { version: code.value } : {})),
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key],
  })
  watch(fetched.data, (value) => rememberSccaConfig(value), { immediate: true })
  return fetched
}

/** The configuration a record page provided (SccaRecord), for the tab forms. */
export function useSccaConfigContext() {
  return inject(sccaConfigKey, ref(null))
}

export function useSccaFormula(version?: MaybeRefOrGetter<string | null | undefined>) {
  const code = computed(() => toValue(version) || '')
  return useFetch<SccaFormula>('/api/scca/formula', {
    key: computed(() => `scca-formula-${code.value || 'active'}`),
    query: computed(() => (code.value ? { version: code.value } : {})),
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key],
  })
}

export function useSccaRecoveryStandards(version?: MaybeRefOrGetter<string | null | undefined>) {
  const code = computed(() => toValue(version) || '')
  return useFetch<{ items: SccaRecoveryStandard[] }>('/api/scca/recovery-standards', {
    key: computed(() => `scca-recovery-standards-${code.value || 'active'}`),
    query: computed(() => (code.value ? { version: code.value } : {})),
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
  /** With `reason`, an Annual review or a System change lists what the access scope opens,
   * each with `available` and `problem` (the reason rules). */
  applications: (q: string, reason?: string | null, assessmentId?: number | null) =>
    $fetch<{ items: SccaApplication[], scope_message?: string | null }>('/api/scca/applications', {
      query: { q, ...(reason ? { reason } : {}), ...(assessmentId ? { assessment_id: assessmentId } : {}) },
    }),
  calculate: (ratings: Record<string, number>, version?: string | null) =>
    $fetch<SccaPreview>('/api/scca/calculate', {
      method: 'POST',
      body: { ratings },
      query: version ? { version } : {},
    }),
  moveVersion: (id: number) =>
    $fetch<SccaAssessment & { cleared: string[] }>(`${BASE}/${id}/move-version`, { method: 'POST' }),
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
  submit: (id: number) => $fetch<SccaApprovalResult>(`${BASE}/${id}/submit`, { method: 'POST' }),
  approve: (id: number, note: string | null) =>
    $fetch<SccaApprovalResult>(`${BASE}/${id}/approve`, { method: 'POST', body: { note } }),
  reject: (id: number, note: string) =>
    $fetch<SccaApprovalResult>(`${BASE}/${id}/reject`, { method: 'POST', body: { note } }),
  comment: (id: number, tab: SccaTab, body: string) =>
    $fetch<SccaAssessment>(`${BASE}/${id}/comments`, { method: 'POST', body: { tab, body } }),
  renew: (id: number) => $fetch<SccaAssessment>(`${BASE}/${id}/renew`, { method: 'POST' }),
  nudge: (id: number) => $fetch<SccaApprovalResult>(`${BASE}/${id}/nudge`, { method: 'POST' }),
  reassign: (id: number, userId: number, reason: string) =>
    $fetch<SccaApprovalResult>(`${BASE}/${id}/reassign`, {
      method: 'POST',
      body: { user_id: userId, reason },
    }),
  approveOnBehalf: (id: number, reason: string, file: File) => {
    const form = new FormData()
    form.append('reason', reason)
    form.append('file', file)
    return $fetch<SccaApprovalResult>(`${BASE}/${id}/approve-on-behalf`, { method: 'POST', body: form })
  },
}

export type SccaReportFormat = 'pdf' | 'xlsx'

/** Download link for the PDF report or the filled SCCA Tools workbook. */
export function sccaReportUrl(id: number, format: SccaReportFormat) {
  return `${BASE}/${id}/report.${format}`
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
  if (statusCode === 409) return 'The assessment changed state (submitted, approved or rejected). Reload to see it.'
  return 'Couldn\'t reach the server. Check your connection and try again.'
}

const FIELD_LABELS: Record<string, string> = {
  application_code: 'Application code',
  application_name: 'Application name',
  assessment_reason: 'Reason',
  assessment_date: 'Assessment date',
  due_date: 'Renewal due date',
  application_owner: 'Application owner',
  it_support: 'IT support',
  business_stakeholders: 'Business stakeholder',
  deployment_model: 'Deployment model',
  customer_facing: 'Customer facing',
  business_days: 'Business days',
  business_hours: 'Business hours',
  contributor_id: 'Contributor',
  override_category: 'New category',
  justification: 'Justification',
  cim_ref_no: 'CIM / MKK / RA ref. no.',
  signoffs: 'Sign-off',
}

/** A readable name for an API field path, e.g. `recovery_values.1.rto` → "Business requirements · RTO". */
export function apiFieldLabel(path: string): string {
  const recovery = path.match(/^recovery_values\.(\d+)\.(\w+)$/)
  if (recovery) {
    const kind = SCCA_RECOVERY_KINDS[Number(recovery[1])]?.label ?? 'Recovery'
    const field = SCCA_RECOVERY_FIELDS.find((item) => item.key === recovery[2])?.label ?? recovery[2]
    return `${kind} · ${field}`
  }
  const inter = path.match(/^interdependencies\.(\d+)\.(\w+)$/)
  if (inter) return `Interdependency row ${Number(inter[1]) + 1} · ${inter[2]!.replaceAll('_', ' ')}`
  const signoff = path.match(/^signoffs\.(\d+)\.\w+$/)
  if (signoff) {
    const order = registeredStepOrder()
    const code = order.length ? order[Number(signoff[1])] : SCCA_SIGNOFF_ROLES[Number(signoff[1])]?.value
    return `Sign-off · ${code ? signoffRoleLabel(code) : 'step'}`
  }
  const answer = path.match(/^answers\.(\w+)$/)
  if (answer) return `Rating ${answer[1]}`
  return FIELD_LABELS[path] ?? path.replaceAll('_', ' ')
}

/**
 * The error summary for a form: the general message plus every field message from a 422,
 * so problems on fields that this tab doesn't show are never hidden.
 */
export function apiErrorText(error: unknown): string {
  const lines = apiFieldErrors(error).map((item) => `• ${apiFieldLabel(item.name ?? '')}: ${item.message}`)
  return [apiErrorMessage(error), ...lines].join('\n')
}

/** Empty strings become null, so cleared inputs clear the saved value. */
export function blankToNull<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, typeof value === 'string' && value.trim() === '' ? null : value]),
  ) as T
}
