import type { SccaAssessment } from '~/composables/useScca'
import type { SccaCategory } from '~/utils/scca'

/**
 * Upload Excel (the BCM Tools template of the SCCA Tools workbook) and Administration > SCCA
 * migration. The API reads a workbook and says what it holds before anything is saved.
 */

export interface SccaImportProblem {
  level: 'error' | 'warning' | 'info'
  sheet: string
  cell: string | null
  message: string
}

export interface SccaImportLink {
  direction: 'upstream' | 'downstream'
  cell: string
  name: string
  application: { id: number, application_code: string, application_name: string } | null
  status: 'ready' | 'left_out'
  reason: string | null
}

export interface SccaImportPreview {
  file: { name: string | null, size: number }
  version: string
  application: {
    name: string | null
    code: string | null
    matched: { id: number, application_code: string, application_name: string } | null
  }
  header: Record<string, string | boolean | null>
  assessment_reason: string | null
  due_date: string | null
  ratings: { read: number, total: number, missing: string[], unjustified: string[] }
  result: {
    computed_category: SccaCategory
    final_category: SccaCategory
    override_type: string | null
    override_category: SccaCategory | null
    cia_level: number
    poloss_level: number
  } | null
  interdependencies: SccaImportLink[]
  recovery: { kind: string, label: string, filled: number }[]
  problems: SccaImportProblem[]
  errors: number
  warnings: number
  can_import: boolean
}

export interface SccaImportOptions {
  application_id?: number | null
  application_code?: string | null
  application_name?: string | null
  assessment_reason?: string | null
  due_date?: string | null
  contributor_id?: number | null
}

export interface SccaMigrationPerson { id: number, display_name: string | null, email: string }

export interface SccaMigrationItem {
  file: string
  state: 'ready' | 'blocked' | 'skipped' | 'unreadable'
  outcome: 'final' | 'draft' | 'record' | null
  message: string | null
  reasons: string[]
  application: { id: number | null, application_code: string, application_name: string, new: boolean } | null
  assessment_date: string | null
  approved_on: string | null
  due_date: string | null
  assessment_reason: string | null
  assessor: { name: string | null, user: SccaMigrationPerson | null }
  people: { box: number, name: string | null, designation: string | null, user: SccaMigrationPerson | null }[]
  category: SccaCategory | null
  ratings: SccaImportPreview['ratings'] | null
  interdependencies: SccaImportLink[]
  problems: SccaImportProblem[]
}

export interface SccaMigrationCounts {
  total: number
  ready: number
  final: number
  draft: number
  record: number
  blocked: number
  skipped: number
  unreadable: number
  new_applications: number
}

export interface SccaMigrationPlan {
  items: SccaMigrationItem[]
  counts: SccaMigrationCounts
  limits: { files: number, megabytes: number }
}

export interface SccaMigrationRow {
  file: string
  state: 'imported' | 'failed' | 'blocked' | 'skipped' | 'unreadable'
  outcome?: 'final' | 'draft' | 'record'
  message?: string | null
  id?: number
  ref_no?: string
  application_code?: string
  application_created?: boolean
  category?: SccaCategory | null
  reasons?: string[]
  links?: { saved: number, left_out: string[], without_final: string[] }
}

export interface SccaMigrationRun {
  id: number
  created_at: string | null
  created_by: SccaMigrationPerson | null
  imported: number
  skipped: number
  failed: number
  finished: boolean
  undone_at: string | null
  undone_by: SccaMigrationPerson | null
  can_undo: boolean
  undo_until: string | null
  items: SccaMigrationRow[]
}

const MIGRATION = '/api/admin/scca-migration'

function upload(file: File, options?: object) {
  const body = new FormData()
  body.append('file', file)
  if (options) body.append('options', JSON.stringify(options))
  return body
}

function batch(files: File[], manifest: File | null, options?: object) {
  const body = new FormData()
  for (const file of files) body.append('files', file)
  if (manifest) body.append('manifest', manifest)
  body.append('options', JSON.stringify(options ?? {}))
  return body
}

export function sccaTemplateUrl(applicationId?: number | null) {
  return `/api/scca/imports/template${applicationId ? `?application_id=${applicationId}` : ''}`
}

export const SCCA_MANIFEST_URL = `${MIGRATION}/manifest`

export const sccaImportApi = {
  preview: (file: File, options: SccaImportOptions = {}) =>
    $fetch<SccaImportPreview>('/api/scca/imports/preview', { method: 'POST', body: upload(file, options) }),
  create: (file: File, options: SccaImportOptions) =>
    $fetch<SccaAssessment>('/api/scca/imports', { method: 'POST', body: upload(file, options) }),
  previewDraft: (id: number, file: File) =>
    $fetch<SccaImportPreview>(`/api/scca/assessments/${id}/import/preview`, { method: 'POST', body: upload(file) }),
  replaceDraft: (id: number, file: File) =>
    $fetch<SccaAssessment>(`/api/scca/assessments/${id}/import`, { method: 'POST', body: upload(file) }),
}

export const sccaMigrationApi = {
  /** One workbook per call: a proxy in front of the API limits a request's size. */
  preview: (files: File[], manifest: File | null, options?: object) =>
    $fetch<SccaMigrationPlan>(`${MIGRATION}/preview`, { method: 'POST', body: batch(files, manifest, options) }),
  report: (files: File[], manifest: File | null) =>
    $fetch<Blob>(`${MIGRATION}/preview?format=xlsx`, { method: 'POST', body: batch(files, manifest), responseType: 'blob' }),
  start: () => $fetch<SccaMigrationRun>(`${MIGRATION}/runs/start`, { method: 'POST' }),
  add: (run: number, file: File, manifest: File | null, options?: object) =>
    $fetch<{ items: SccaMigrationRow[] }>(`${MIGRATION}/runs/${run}/files`, { method: 'POST', body: batch([file], manifest, options) }),
  finish: (run: number) => $fetch<SccaMigrationRun>(`${MIGRATION}/runs/${run}/finish`, { method: 'POST' }),
  runs: () => $fetch<{ items: SccaMigrationRun[] }>(`${MIGRATION}/runs`),
  undo: (run: number) => $fetch<SccaMigrationRun>(`${MIGRATION}/runs/${run}/undo`, { method: 'POST' }),
}

/** What a refused upload says: the API's own sentences, not "check the fields". */
export function sccaImportError(error: unknown) {
  const { statusCode, data } = (error ?? {}) as { statusCode?: number, data?: { details?: Record<string, string> } }
  if (statusCode === 422 && data?.details) return Object.values(data.details).join(' ')
  if (statusCode === 413) return 'This file is too large to upload.'
  return apiErrorMessage(error)
}

export const SCCA_IMPORT_LEVELS = {
  error: { label: 'Error', color: 'error', icon: 'i-lucide-circle-x' },
  warning: { label: 'Check', color: 'warning', icon: 'i-lucide-triangle-alert' },
  info: { label: 'Note', color: 'neutral', icon: 'i-lucide-info' },
} as const
