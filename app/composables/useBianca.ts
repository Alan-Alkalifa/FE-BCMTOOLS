import type { BiancaListItems, BiancaGrade, BiancaSigner, BiancaStep } from '~/composables/useBiancaConfigAdmin'

import type { BiancaEvent, BiancaSignoffRow } from '~/composables/useBiancaApproval'
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
  /** Why a lower capacity or a longer MTD than the function's is accepted. */
  up_justification?: string
  down_justification?: string
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
  'bcm_coordinator', 'bcm_coordinator_nik', 'bcm_coordinator_phone', 'bcm_coordinator_phone_2', 'bcm_coordinator_email',
  'bcm_alternate', 'bcm_alternate_nik', 'bcm_alternate_phone', 'bcm_alternate_phone_2', 'bcm_alternate_email',
  'ra_tools', 'ra_justification', 'staff_others_note',
  'loss_formula', 'justification_regulatory', 'justification_customer', 'justification_rto', 'justification_dependency',
] as const
export const BIANCA_HEADER_BOOL = ['ra_considers_bc', 'ra_controls_included', 'ra_completed'] as const
export const BIANCA_STAFF = ['staff_senior', 'staff_middle', 'staff_manager', 'staff_non_staff', 'staff_others'] as const

export type BiancaLocationMode = 'work_from_home' | 'hyspace'
export type BiancaLocationLabels = Record<BiancaLocationMode, string>

export type BiancaHeader
  = { [K in typeof BIANCA_HEADER_TEXT[number]]: string | undefined }
    & { [K in typeof BIANCA_HEADER_BOOL[number]]: boolean | undefined }
    & { [K in typeof BIANCA_STAFF[number]]: number | undefined }
    & {
      main_location_id: number | undefined
      main_location_mode: BiancaLocationMode | undefined
      alt_location_id: number | undefined
      alt_location_mode: BiancaLocationMode | undefined
      bcm_coordinator_id: number | undefined
      bcm_alternate_id: number | undefined
      personnel_counts: Record<string, number | undefined>
      personnel_notes: Record<string, string | undefined>
      signoff_users: Record<string, number | null>
    }

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
  created_by_id?: number | null
  /** The final BIA this draft renews. */
  renewal_of?: { id: number, ref_no: string | null } | null
  /** Manage list: owner, or someone of the BIA's Group (read only). */
  my_role?: 'owner' | 'group' | null
  /** Manage list: when the BIA it renews is due for review. */
  due_date?: string | null
  next_step?: string
  next_tone?: 'error' | 'warning' | 'neutral'
}

/** A review comment on one tab, written by an approver while the BIA is in approval. */
export interface BiancaComment {
  id: number
  tab: BiancaCommentTab
  role: string | null
  role_title: string | null
  author: string | null
  author_id: number | null
  body: string
  created_at: string | null
}
export type BiancaCommentTab = 'sign' | 'ra' | 'functions' | 'appendix' | 'approval'

export interface BiancaAssessment extends Omit<BiancaSummary, 'functions'>, BiancaHeader {
  config_version_id: number | null
  config_version: string
  approval_problems: string[]
  signoffs: BiancaSignoffRow[]
  events: BiancaEvent[]
  comments?: BiancaComment[]
  can_comment?: boolean
  /** A final BIA: when it is due for review, whether the reader may start its renewal, and the
   * renewal started from it. */
  renewal_due?: string | null
  can_renew?: boolean
  renewal?: { id: number, ref_no: string | null, status: BiancaStatus } | null
  submitted_at: string | null
  finalised_at: string | null
  /** The signed-in user signs the step the BIA waits on now. */
  can_decide: boolean
  main_location: BiancaPlace | null
  /** The BCM Coordinator / Alternate as the user directory has them; null when typed. */
  bcm_coordinator_user: BiancaPerson | null
  bcm_alternate_user: BiancaPerson | null
  /** The Alternate BCM Coordinators (none, one or more). */
  bcm_alternates?: BiancaAlternate[]
  alt_location: BiancaPlace | null
  total_staff: number
  loss_totals: number[]
  loss_alerts: boolean[]
  functions: BiancaFunction[]
  /** What still blocks Submit (every required cell must be filled). */
  problems: string[]
  warnings: string[]
  can_edit: boolean
  /** The Group's organisation structure, attached on the RA Questionnaire. */
  org_structure: BiancaAttachment | null
  can_delete: boolean
}

export interface BiancaPlace { id: number, code: string | null, name: string, label: string, kind?: string, city?: string | null, address?: string | null }
export interface BiancaApplication { id: number, code: string, name: string, label: string, category: string | null, rto: string | null, rpo: string | null }

export interface BiancaLookups {
  office_location_labels?: BiancaLocationLabels
  list_items?: BiancaListItems
  signer_profiles?: Record<string, BiancaSigner>
  config_version_id: number | null
  config_version: string
  personnel_grades: BiancaGrade[]
  signoff_steps: BiancaStep[]
  guides: Record<string, string>
  score_alert: number
  periods: string[]
  suggested_mtd: string[]
  expected_mtd: { value: string, category: string | null }[]
  mtd_options?: { value: string, label: string }[] | null
  dependency_mtd: string[]
  percentages: string[]
  upstream_capacity: string[]
  expected_support_capacity?: string[]
  alternate_site_by_category?: Record<string, string[]>
  financial_bands: { code: string, label: string, description: string }[]
  impact_matrix: { score: number, regulatory: string, customer: string }[]
  downstream_capacity?: string[]
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
  /** Whether the user picks the Group of a BIA (BCM Admin); the others' BIA is their own Group's. */
  can_pick_group?: boolean
  /** Part 2b's upstream / downstream names: the Groups of Master data > Organization structure. */
  org_groups?: string[]
}

export interface BiancaPreview {
  functions: {
    category: string | null
    within_suggested_mtd: boolean | null
    recommended_suggested_mtd?: string | null
    it_dependencies: { daat_hours: number | null, warnings: string[], rto_reaches_mtd: boolean | null, gaps_required: boolean }[]
    /** Part 2b: why each upstream / downstream needs a justification (empty: it doesn't). */
    dependencies?: { up: string[], down: string[] }[]
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
  /** Manage: your drafts and your Group's. */
  scope?: 'manage'
  role?: 'owner' | 'group'
  state?: 'new' | 'renewal' | 'returned'
  input_method?: 'web' | 'excel'
  sort?: string
  dir?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

/** What the API accepts: every field optional, `functions` replaces the whole list. */
/** Directorate > Sub Directorate > Group, picked from the organisation in the database. */
export interface BiancaOrg {
  directorate: string | undefined
  sub_directorate: string | undefined
  org_group: string | undefined
}

export interface BiancaOrgOptions {
  directorates: string[]
  sub_directorates: string[]
  groups: string[]
}

/** Someone to pick as BCM Coordinator, with what the form fills from them. */
export interface BiancaPerson {
  id: number
  name: string
  nik: string | null
  email: string | null
  phone: string | null
  job_title: string | null
  org_group: string | null
  label: string
}

export interface BiancaMainLocation {
  location: BiancaPlace | null
  floor: string | null
  /** Where it was found: the location's own Group, the building's occupants, or the Group's people. */
  source: 'location' | 'occupants' | 'people' | null
}

/** An Alternate BCM Coordinator as sent: a user picked from the directory, or named in Excel. */
export interface BiancaAlternateInput {
  user_id?: number | null
  name?: string | null
  nik?: string | null
  phone?: string | null
  phone_2?: string | null
  email?: string | null
}
/** An Alternate BCM Coordinator of a BIA, with its directory user (for the picker). */
export interface BiancaAlternate extends BiancaAlternateInput {
  user?: BiancaPerson | null
}

export type BiancaInput = Partial<BiancaHeader> & Partial<BiancaOrg> & {
  config_version_id?: number | null
  functions?: Omit<BiancaFunction, 'category' | 'within_suggested_mtd'>[]
  /** Optional, as many as the Group names (MoM 26 Nov). */
  bcm_alternates?: BiancaAlternateInput[]
}

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

export function useBiancaLookups(assessmentId?: MaybeRefOrGetter<number | undefined>) {
  return useFetch<BiancaLookups>('/api/bianca/lookups', {
    key: computed(() => `bianca-lookups-${toValue(assessmentId) ?? 'active'}`),
    query: computed(() => ({ assessment_id: toValue(assessmentId) })),
  })
}

export function useBiancaOrgRevision() {
  return useState('bianca-organization-revision', () => 0)
}

function upload(file: File) {
  const body = new FormData()
  body.append('file', file)
  return body
}

const BASE = '/api/bianca/assessments'

/** A file kept with a BIA. */
export interface BiancaAttachment {
  id: number
  filename: string
  content_type: string
  size: number
  uploaded_by: string | null
  uploaded_at: string | null
  /** Downloads it. */
  url: string
}

export const BIANCA_TEMPLATE_URL = '/api/bianca/imports/template'

/** The template for a Group; without one, the signed-in user's own Group. */
export function biancaTemplateUrl(org?: Partial<Record<keyof BiancaOrg, string | null | undefined>> | null) {
  if (!org?.org_group || !org.directorate || !org.sub_directorate) return BIANCA_TEMPLATE_URL
  const query = new URLSearchParams({
    directorate: org.directorate,
    sub_directorate: org.sub_directorate,
    org_group: org.org_group,
  })
  return `${BIANCA_TEMPLATE_URL}?${query}`
}

export const biancaApi = {
  applications: (q: string) => $fetch<{ items: BiancaApplication[] }>('/api/bianca/applications', { query: { q } }),
  locations: (q: string) => $fetch<{ items: BiancaPlace[] }>('/api/bianca/locations', { query: { q } }),
  orgOptions: (directorate?: string, subDirectorate?: string) => $fetch<BiancaOrgOptions>('/api/bianca/org-options', {
    query: { directorate: directorate || undefined, sub_directorate: subDirectorate || undefined },
  }),
  orgUnit: (org: BiancaOrg) => $fetch<{ description: string | null }>('/api/bianca/org-unit', { query: { ...org } }),
  mainLocation: (org: BiancaOrg) => $fetch<BiancaMainLocation>('/api/bianca/main-location', { query: { ...org } }),
  people: (q: string, orgGroup?: string) => $fetch<{ items: BiancaPerson[] }>('/api/bianca/people', {
    query: { q: q || undefined, org_group: orgGroup || undefined },
  }),
  calculate: (body: BiancaInput, assessmentId?: number) => $fetch<BiancaPreview>('/api/bianca/calculate', { method: 'POST', body, query: { assessment_id: assessmentId } }),
  create: (body: BiancaInput) => $fetch<BiancaAssessment>(BASE, { method: 'POST', body }),
  update: (id: number, body: BiancaInput) => $fetch<BiancaAssessment>(`${BASE}/${id}`, { method: 'PUT', body }),
  remove: (id: number) => $fetch(`${BASE}/${id}`, { method: 'DELETE' }),
  submit: (id: number) => $fetch<BiancaAssessment>(`${BASE}/${id}/submit`, { method: 'POST' }),
  uploadOrgStructure: (id: number, file: File) => $fetch<BiancaAssessment>(`${BASE}/${id}/org-structure`, { method: 'POST', body: upload(file) }),
  removeOrgStructure: (id: number) => $fetch<BiancaAssessment>(`${BASE}/${id}/org-structure`, { method: 'DELETE' }),
  importPreview: (file: File) => $fetch<BiancaImportResult>('/api/bianca/imports/preview', { method: 'POST', body: upload(file) }),
  importCreate: (file: File) => $fetch<BiancaAssessment>('/api/bianca/imports', { method: 'POST', body: upload(file) }),
  importPreviewDraft: (id: number, file: File) => $fetch<BiancaImportResult>(`${BASE}/${id}/import/preview`, { method: 'POST', body: upload(file) }),
  importReplace: (id: number, file: File) => $fetch<BiancaAssessment>(`${BASE}/${id}/import`, { method: 'POST', body: upload(file) }),
  renew: (id: number) => $fetch<BiancaAssessment>(`${BASE}/${id}/renew`, { method: 'POST' }),
  addComment: (id: number, tab: BiancaCommentTab, body: string) => $fetch<{ items: BiancaComment[], can_comment: boolean }>(`${BASE}/${id}/comments`, { method: 'POST', body: { tab, body } }),
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
    // IT systems, upstreams and downstreams are optional: added when there are any.
    it_dependencies: [],
    dependencies: [],
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

/**
 * Export a BIA to the BIA workbook (all its functions, or those numbered, 1-based) and save the
 * file the server names; a refusal is shown as a toast.
 */
/** Download a file from the API and save it under the name the server gives; a refusal is
 * shown as a toast. */
export function useBiancaDownload() {
  const toast = useToast()
  const busy = ref(false)
  async function download(url: string, fallback: string, done: string) {
    busy.value = true
    try {
      const response = await $fetch.raw<Blob>(url, { responseType: 'blob' })
      const disposition = response.headers.get('content-disposition') ?? ''
      const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1]
      const href = URL.createObjectURL(response._data!)
      const link = document.createElement('a')
      link.href = href
      link.download = name ? decodeURIComponent(name) : fallback
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(href), 10_000)
      toast.add({ title: done, color: 'success', icon: 'i-lucide-download' })
    } catch (failure) {
      // The error comes back as a Blob: read its JSON for the message.
      let message = 'Could not download the file.'
      const data = (failure as { data?: unknown }).data
      try {
        const body = data instanceof Blob ? JSON.parse(await data.text()) : data
        const details = (body as { details?: Record<string, string> })?.details
        message = (details && Object.values(details)[0]) || (body as { message?: string })?.message || message
      } catch { /* keep the general message */ }
      toast.add({ title: 'Download failed', description: message, color: 'error', icon: 'i-lucide-circle-alert' })
    } finally {
      busy.value = false
    }
  }
  return { busy, download }
}

/** Export a BIA to the BIA workbook (all its functions, or those numbered, 1-based). */
export function useBiancaExport() {
  const { busy, download } = useBiancaDownload()
  return { busy, run: (id: number, functions?: number[]) => download(biancaExportUrl(id, functions), `BIA-${id}.xlsx`, 'Excel file downloaded') }
}

/** The whole BIA as a PDF report. */
export function useBiancaPdf() {
  const { busy, download } = useBiancaDownload()
  return { busy, run: (id: number) => download(`/api/bianca/assessments/${id}/report.pdf`, `BIA-${id}.pdf`, 'PDF report downloaded') }
}

/** A part of the form shown in "Is this correct?" (BiancaReviewDialog). */
export interface BiancaReviewSection {
  title: string
  rows: { label: string, value: string | null | undefined }[]
}
