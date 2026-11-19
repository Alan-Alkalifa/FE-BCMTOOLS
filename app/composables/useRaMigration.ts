/**
 * Administration › RA migration (`/api/admin/ra-migration/*`): signed RA and RA Branch
 * workbooks brought into BCM Tools in one run, as SCCA migration.
 */

export interface RaMigrationPerson {
  id: number
  display_name: string | null
  email: string
}

export interface RaMigrationItem {
  file: string
  state: 'ready' | 'blocked' | 'skipped' | 'unreadable'
  outcome: 'final' | 'draft' | null
  message: string | null
  reasons: string[]
  kind: RaKind | null
  kind_label: string | null
  template: string | null
  building: {
    id: number | null
    code: string | null
    name: string
    kind: RaKind | null
    new: boolean
    province?: string | null
    city?: string | null
    district?: string | null
    zip_code?: string | null
    region?: string | null
  } | null
  assessment_date: string | null
  approved_on: string | null
  due_date: string | null
  period_year: number | null
  reason: RaReason | null
  lic: { name: string | null, user: RaMigrationPerson | null }
  licom: { name: string | null, user: RaMigrationPerson | null }
  people: { box: number, heading: string | null, name: string, designation: string | null, signed_on: string | null, user: RaMigrationPerson | null }[]
  ratings: { total: number, rated: number, counts: { gross: Partial<Record<RaLevel, number>>, residual: Partial<Record<RaLevel, number>> } } | null
  problems: { sheet: string, cell: string | null, message: string }[]
}

export interface RaMigrationCounts {
  total: number
  ready: number
  final: number
  draft: number
  blocked: number
  skipped: number
  unreadable: number
  new_buildings: number
}

export interface RaMigrationPlan {
  items: RaMigrationItem[]
  counts: RaMigrationCounts
  limits: { files: number, megabytes: number }
}

export interface RaMigrationRow {
  file: string
  state: 'imported' | 'failed' | 'blocked' | 'skipped' | 'unreadable'
  outcome?: 'final' | 'draft'
  message?: string | null
  id?: number
  kind?: RaKind
  ref_no?: string
  location_id?: number
  location_code?: string
  location_name?: string
  location_created?: boolean
  reasons?: string[]
}

export interface RaMigrationRun {
  id: number
  created_at: string | null
  created_by: RaMigrationPerson | null
  imported: number
  skipped: number
  failed: number
  finished: boolean
  undone_at: string | null
  undone_by: RaMigrationPerson | null
  can_undo: boolean
  undo_until: string | null
  items: RaMigrationRow[]
}

const MIGRATION = '/api/admin/ra-migration'

export const RA_MANIFEST_URL = `${MIGRATION}/manifest`

function batch(files: File[], manifest: File | null, options?: object) {
  const body = new FormData()
  for (const file of files) body.append('files', file)
  if (manifest) body.append('manifest', manifest)
  body.append('options', JSON.stringify(options ?? {}))
  return body
}

export const raMigrationApi = {
  /** One workbook per call: a proxy in front of the API limits a request's size. */
  preview: (files: File[], manifest: File | null, options?: object) =>
    $fetch<RaMigrationPlan>(`${MIGRATION}/preview`, { method: 'POST', body: batch(files, manifest, options) }),
  start: () => $fetch<RaMigrationRun>(`${MIGRATION}/runs/start`, { method: 'POST' }),
  add: (run: number, file: File, manifest: File | null, options?: object) =>
    $fetch<{ items: RaMigrationRow[] }>(`${MIGRATION}/runs/${run}/files`, { method: 'POST', body: batch([file], manifest, options) }),
  finish: (run: number) => $fetch<RaMigrationRun>(`${MIGRATION}/runs/${run}/finish`, { method: 'POST' }),
  runs: () => $fetch<{ items: RaMigrationRun[] }>(`${MIGRATION}/runs`),
  undo: (run: number) => $fetch<RaMigrationRun>(`${MIGRATION}/runs/${run}/undo`, { method: 'POST' }),
}
