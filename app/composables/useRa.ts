import type { InjectionKey } from 'vue'

export interface RaHazard {
  code: string
  no: number
  short_name: string
  name: string
}

export interface RaCategory {
  code: string
  name: string
  label: string
  hazards: RaHazard[]
}

export interface RaGuide {
  rating: number
  label: string | null
  guidance: string
}

/** A sign-off step as RA configuration sets it: "Prepared by" signed by the "Location
 *  Incident Coordinator (LIC)", in approval order. `role` repeats `code`. */
export interface RaSignoffStep {
  code: RaSignoffRole
  role?: RaSignoffRole
  label: string
  title: string
  mandatory: boolean
  signer_mode: RaSignerMode
  signer_roles: string[]
  /** Its box on the Excel report (1–4, RA Branch 1–3), or null when it is not on the form. */
  report_box: number | null
}

export interface RaFormula {
  code: string
  kind: RaKind
  name: string
  status?: 'draft' | 'active' | 'retired'
  /** The rating inputs of this kind, in questionnaire order. */
  inputs: RaRatingField[]
  signoff_roles: RaSignoffRole[]
  signoff_steps?: RaSignoffStep[]
  levels: RaLevel[]
  signoff_statement_en?: string | null
  risk_summary_note_en?: string | null
  hazard_intro?: string | null
  type_description?: string | null
  categories: RaCategory[]
  guides: Record<RaGuideScale, RaGuide[]>
  matrix: { probability: number, impact: number, level: RaLevel }[]
  mitigation_examples: { area: string, example: string }[]
}

export type RaRatingInputs = Record<RaRatingField, RaRatingValue>

export interface RaRatingTexts {
  mitigation: string | null
  action_plan: string | null
}

export interface RaRating extends RaRatingInputs, RaRatingTexts {
  code: string
  result: RaHazardResult
  issues: RaIssue[]
  warnings: RaIssue[]
}

export interface RaHeatMapCell {
  probability: number
  impact: number
  level: RaLevel
  hazards: string[]
}

export type RaLevelCounts = Record<RaLevel | 'not_applicable' | 'unrated', number>

/** `gross` is missing for RA Branch, which rates one (residual) risk. */
export interface RaSummary {
  total: number
  rated: number
  complete: boolean
  counts: { gross?: RaLevelCounts, residual: RaLevelCounts }
  highest_gross_level: RaLevel | null
  highest_residual_level: RaLevel | null
  heat_maps: { gross?: RaHeatMapCell[], residual: RaHeatMapCell[] }
}

export interface RaContact {
  kind: RaContactKind
  seq?: number
  name: string
  phone: string | null
  group_name: string | null
  floor: string | null
  address: string | null
}

export interface RaUserRef {
  id: number
  name: string | null
  email: string | null
  job_title: string | null
  /** From the user directory search only. */
  mobile_phone?: string | null
}

/** Assigning a signer (draft only). Approvals go through raApi.approve. */
export interface RaSignoffInput {
  role: RaSignoffRole
  signer_id?: number | null
}

export interface RaSignoff {
  role: RaSignoffRole
  signer: RaUserRef | null
  /** The signer's name as assigned (older sign-offs may have a name without a signer). */
  name: string | null
  designation: string | null
  signed_on: string | null
  approved_at: string | null
  approved_by: string | null
  comment: string | null
  /** Approved on the signer's behalf: the evidence (their email or memo). */
  evidence?: RaAttachmentRef | null
}

/** A file kept with an RA: the evidence of an approval on the signer's behalf. */
export interface RaAttachmentRef {
  id: number
  filename: string
  size: number
  url: string
}

export interface RaSignoffEvent {
  /** `reassigned`: BCM changed the signer of the waiting step. */
  action: 'submitted' | 'approved' | 'returned' | 'reassigned'
  role: RaSignoffRole | null
  /** Who acted (BCM, for an approval on behalf or a signer change). */
  user: string | null
  comment: string | null
  at: string
  /** An approval BCM gave for `for_user`, with the evidence in `attachment`. */
  on_behalf?: boolean
  /** The signer approved for, or the signer the step was taken from. */
  for_user?: string | null
  /** The new signer of a `reassigned` step. */
  to_user?: string | null
  attachment?: RaAttachmentRef | null
}

export interface RaWorkflow {
  status: RaStatus
  current_signoff_role: RaSignoffRole | null
  awaiting_signer: RaUserRef | null
  can_edit: boolean
  can_submit: boolean
  /** False while the building waits for approval (or was rejected): it can't be submitted. */
  location_approved?: boolean
  can_approve: boolean
  can_return: boolean
  /** BCM (ra.manage): change the signer of the waiting step or approve it on their behalf. */
  can_act_for_signer?: boolean
  submitted_at: string | null
  submitted_by: string | null
  approved_at: string | null
  returned_at: string | null
  returned_by: string | null
  returned_comment: string | null
  signoff_history: RaSignoffEvent[]
}

export interface RaOccupant {
  seq?: number
  /** Picked from the division list: the name and MTD follow the division. */
  division_id?: number | null
  /** The division's critical rating (read only). */
  critical_rating?: string | null
  floor: string | null
  directorate: string | null
  unit_name: string
  company: string | null
  employee_count: number | null
  disabled_count: number | null
  pregnant_count: number | null
  pregnant_due_dates: string | null
  shift_work: boolean | null
  shift_times: string | null
  mtd: string | null
  has_bcp: boolean | null
  alternate_site: boolean | null
  remarks: string | null
}

export interface RaOccupantSummary {
  units: number
  employees: number
  disabled: number
  pregnant: number
  with_bcp: number
  with_alternate_site: number
}

export interface RaRecoveryTeamMember {
  seq?: number
  team: RaRecoveryTeam
  role: string | null
  name: string
  mobile: string | null
  home_phone: string | null
}

export interface RaCallTreeEntry {
  seq?: number
  level: RaCallTreeLevel
  caller: string | null
  contact_name: string
  division: string | null
  mobile: string | null
  home_phone: string | null
}

export interface RaLocationRef {
  id: number
  /** The building's permanent ID: RA-HQ-0001 (head office) or RA-BR-0001 (branch). */
  code?: string | null
  kind: RaKind
  name: string
  region: string | null
  /** A branch's area (the Group of its region) in the Network organisation. */
  area?: string | null
  /** The organization it belongs to (the user master's HR fields), as SCCA's application
   *  owner. A branch's Directorate and Sub Directorate follow its region. */
  directorate?: string | null
  sub_directorate?: string | null
  division?: string | null
  department?: string | null
}

/** Directorates, sub directorates, divisions and departments (building form, Monitoring). */
export interface RaOrgValues {
  directorates: string[]
  sub_directorates: string[]
  divisions: string[]
  departments: string[]
}

/** A map pin (WGS 84). */
export interface RaPin {
  lat: number
  lng: number
}

export interface RaMapMarker extends RaPin {
  id: number
  label: string
  /** Pin colour: the latest highest residual level, "na", or "none" without an assessment. */
  level?: RaLevel | 'na' | 'none' | null
  /** A head office building (pin), a branch (square), or an incident point (siren). */
  variant?: 'location' | 'branch' | 'crisis'
  /** An incident waiting for approval: its point is orange. */
  pending?: boolean
}

export interface RaMapCircle extends RaPin {
  id: number
  radiusM: number
  active?: boolean
  /** An incident's affected area (error colour) rather than a distance ring. */
  crisis?: boolean
  /** An incident waiting for approval: its area is orange and dashed. */
  pending?: boolean
}

/** A pinned building or branch on the location map. */
export interface RaPlace {
  id: number
  kind: RaKind
  name: string
  region: string | null
  address: string | null
  latitude: number
  longitude: number
}

export interface RaMapPlace extends RaPlace {
  latest: { id: number, ref_no: string | null, period_year: number, status: RaStatus, highest_residual_level: RaLevel | null } | null
}

export interface RaHazardRef {
  code: string
  no: number | null
  short_name: string
  name: string
  category: { code: string, label: string } | null
}

/** pending: declared, waiting for someone else's approval; rejected: not confirmed. */
export type RaCrisisStatus = 'pending' | 'open' | 'closed' | 'rejected'

/** What the current user can do with a pending approval (building or incident). */
export interface RaApprovalCan {
  approve: boolean
  reject: boolean
  withdraw?: boolean
  resubmit?: boolean
  /** The current user asked for it, so someone else decides. */
  own?: boolean
}
export type RaPlaybookPhase = 'immediate' | 'stabilise' | 'recover'

export interface RaPlaybookSteps {
  reviewed: boolean
  steps: Record<RaPlaybookPhase, string[]>
  updated_at: string | null
  updated_by: string | null
}

export type RaPlaybookEntry = RaHazardRef & RaPlaybookSteps

export interface RaCrisisSummary {
  id: number
  ref_no: string
  hazard_code: string
  hazard: RaHazardRef
  location: { id: number, kind: RaKind, name: string } | null
  latitude: number
  longitude: number
  radius_m: number
  description: string | null
  started_at: string
  status: RaCrisisStatus
  closed_at: string | null
  affected_count: number
  declared_by: string | null
  approval_can?: RaApprovalCan
  decided_by?: string | null
  decided_at?: string | null
  decision_note?: string | null
}

export interface RaCrisisPlace {
  location: RaPlace
  distance_m: number
  assessment: {
    id: number
    kind: RaKind
    ref_no: string | null
    period_year: number
    status: RaStatus
    rating: {
      gross_level: RaLevel | null
      residual_probability: number | null
      residual_impact: number | null
      residual_level: RaLevel | null
      mitigation: string | null
      action_plan: string | null
    } | null
  } | null
  contacts: RaContact[]
  call_tree: RaCallTreeEntry[]
  recovery_team: RaRecoveryTeamMember[]
  alternates: { location: RaPlace, distance_m: number }[]
}

export interface RaCrisis extends RaCrisisSummary {
  closing_note: string | null
  closed_by: string | null
  updated_at: string
  can_manage: boolean
  can_delete: boolean
  playbook: RaPlaybookSteps
  affected: RaCrisisPlace[]
  history: { action: 'declared' | 'approved' | 'rejected' | 'updated' | 'note' | 'closed' | 'reopened', note: string | null, user: string | null, at: string }[]
}

export interface RaMapData {
  places: RaMapPlace[]
  unpinned: Record<RaKind, number>
  crises: RaCrisisSummary[]
  can_declare: boolean
}

export interface RaCrisisInput {
  hazard_code?: string
  location_id?: number | null
  latitude?: number | null
  longitude?: number | null
  radius_m?: number
  started_at?: string
  description?: string | null
  note?: string | null
}

export interface RaMapSettings {
  tile_url: string
  attribution: string
  max_zoom: number
}

export interface RaLocation extends RaLocationRef {
  address: string | null
  province?: string | null
  city?: string | null
  district?: string | null
  zip_code?: string | null
  latitude: number | null
  longitude: number | null
  is_active: boolean
  /** Four-eyes approval: a new building and its deactivation wait for someone else. */
  approval?: RaLocationApproval
  approval_can?: RaApprovalCan
  assessment_count: number
  latest_assessment: RaAssessmentSummary | null
  /** Its last final RA: Annual review renews it. */
  final_assessment?: RaAssessmentSummary | null
  updated_at: string
}

export type RaLocationApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface RaLocationApproval {
  status: RaLocationApprovalStatus
  /** What waits: a new building (register) or making it inactive (deactivate). */
  action: 'register' | 'deactivate' | null
  requested_by: string | null
  requested_at: string | null
  decided_by: string | null
  decided_at: string | null
  note: string | null
}

/** A location with its building profile, shared by all of its RA cycles. */
export interface RaLocationDetail extends RaLocation {
  can_delete: boolean
  assessments: RaAssessmentSummary[]
  contacts: RaContact[]
  occupants: RaOccupant[]
  occupant_summary: RaOccupantSummary
  recovery_team: RaRecoveryTeamMember[]
  call_tree: RaCallTreeEntry[]
  created_by: string | null
  updated_by: string | null
}

export interface RaAssessmentFields {
  period_year: number
  assessment_date: string
  due_date: string | null
  /** Why the RA is made (left out on a new RA: Annual review or New building, whichever fits). */
  reason?: RaReason | null
  lic_phone: string | null
  licom_phone: string | null
}

/** The location incident team as sent: a user from the directory each (names come from it). */
export interface RaTeamInput {
  lic_user_id?: number
  licom_user_id?: number
}

export interface RaAssessmentSummary {
  id: number
  ref_no: string | null
  period_year: number
  assessment_date: string | null
  due_date: string | null
  reason?: RaReason | null
  location: RaLocationRef
  rated_count: number
  hazard_count: number
  highest_gross_level: RaLevel | null
  highest_residual_level: RaLevel | null
  is_complete: boolean
  status: RaStatus
  current_signoff_role: RaSignoffRole | null
  /** Who signs the current step, e.g. "Location Incident Coordinator (LIC)". */
  current_step_title?: string | null
  is_returned: boolean
  approved_at?: string | null
  /** An approved RA's renewal date (its due date, or a year after it was assessed). */
  renewal_date?: string | null
  created_by: string | null
  updated_at: string
}

export interface RaAssessment extends RaAssessmentFields, RaWorkflow {
  id: number
  ref_no: string | null
  kind: RaKind
  formula_version: string
  can_delete: boolean
  /** The LIC and LICOM: picked users (null on assessments from before), names as stored. */
  lic_user: RaUserRef | null
  lic_name: string | null
  licom_user: RaUserRef | null
  licom_name: string | null
  location: RaLocationRef & {
    address: string | null
    latitude: number | null
    longitude: number | null
    is_active: boolean
  }
  ratings: RaRating[]
  summary: RaSummary
  signoffs: RaSignoff[]
  is_complete: boolean
  calculated_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface RaListQuery {
  kind: RaKind
  q?: string
  location_id?: number
  year?: number
  level?: RaLevel
  reason?: RaReason
  status?: RaStatus
  awaiting?: 'me'
  /** Only the assessments the user created (Manage). */
  mine?: '1'
  page: number
  per_page: number
}

export interface RaPage<T> {
  items: T[]
  page: number
  per_page: number
  total: number
  pages: number
}

export type RaRatingUpdate = { code: string } & Partial<RaRatingInputs & RaRatingTexts>
export type RaAssessmentUpdate = Partial<RaAssessmentFields> & RaTeamInput & { signoffs?: RaSignoffInput[] }
export type RaAssessmentCreate = Partial<RaAssessmentFields> & RaTeamInput & {
  location_id: number
  period_year: number
  assessment_date: string
  copy_from_id?: number | null
}
export interface RaLocationInput {
  /** On create only. */
  kind?: RaKind
  name?: string
  address?: string | null
  province?: string | null
  city?: string | null
  district?: string | null
  zip_code?: string | null
  region?: string | null
  directorate?: string | null
  sub_directorate?: string | null
  division?: string | null
  department?: string | null
  latitude?: number | null
  longitude?: number | null
  is_active?: boolean
}

const BASE = '/api/ra/assessments'
const LOCATIONS = '/api/ra/locations'

export const raDirtyKey: InjectionKey<Ref<boolean>> = Symbol('ra-dirty')

export function useRaDirty() {
  return inject(raDirtyKey, undefined)
}

/** The kind a page works on when the route doesn't say it: a location's own kind on its
 *  profile (/locations/12), or the type chosen when adding a location. */
export const raKindKey: InjectionKey<Ref<RaKind | null>> = Symbol('ra-kind')

/** RA or RA Branch: the kind provided by an enclosing page (`raKindKey`), otherwise the route
 *  (`/ra/…` or `/ra-branch/…`). */
export function useRaModule() {
  const route = useRoute()
  const provided = inject(raKindKey, null)
  return computed(() => {
    const kind = provided?.value
    if (kind) return RA_MODULES[kind]
    return route.path === '/ra-branch' || route.path.startsWith('/ra-branch/')
      ? RA_MODULES.branch
      : RA_MODULES.head_office
  })
}

/** The kinds (head office, branch) the user holds `level` on: RA (ra.*) and RA Branch
 *  (ra_branch.*) are granted separately. */
export function useRaKinds(level: 'access' | 'edit' | 'manage' = 'access') {
  const { can } = useAuth()
  return computed(() => (Object.keys(RA_MODULES) as RaKind[]).filter((kind) => can(RA_MODULES[kind].perm[level])))
}

/** Tile server for the maps, set per environment on the backend. */
export function useRaMapSettings() {
  return useFetch<RaMapSettings>('/api/ra/map-settings', {
    key: 'ra-map-settings',
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key],
  })
}

/** The location's pin, or null without coordinates. */
export function raPin(location: { latitude?: number | null, longitude?: number | null } | null | undefined): RaPin | null {
  if (typeof location?.latitude !== 'number' || typeof location.longitude !== 'number') return null
  return { lat: Number(location.latitude), lng: Number(location.longitude) }
}

/** The active configuration of a kind or, with `version`, the version an assessment was
 *  created on (assessments keep their version). */
export function useRaFormula(kind: MaybeRefOrGetter<RaKind>, version?: MaybeRefOrGetter<string | null | undefined>) {
  return useFetch<RaFormula>('/api/ra/formula', {
    key: computed(() => `ra-formula-${toValue(kind)}-${toValue(version) ?? 'active'}`),
    // Version codes are numbered per kind (RA and RA Branch can both have V.04).
    query: computed(() => (toValue(version) ? { version: toValue(version), kind: toValue(kind) } : { kind: toValue(kind) })),
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key],
  })
}

/** Head office building and branch, with the description RA configuration gives each. */
export interface RaBuildingType {
  kind: RaKind
  label: string
  description: string | null
}

export function useRaBuildingTypes() {
  return useFetch<{ items: RaBuildingType[] }>('/api/ra/building-types', { key: 'ra-building-types' })
}

/** A division (unit) working in buildings, with its MTD band and critical rating. */
export interface RaDivision {
  id: number
  name: string
  mtd: string
  critical_rating: string
  is_active: boolean
  used_by?: number
}

export type RaDivisionInput = Pick<RaDivision, 'name' | 'mtd' | 'critical_rating'>

export function useRaDivisions() {
  return useFetch<{ items: RaDivision[] }>('/api/ra/divisions', { key: 'ra-divisions', default: () => ({ items: [] }) })
}

/** Lookups derived from the formula: hazards by code, the risk matrix, guides per scale. */
export function useRaFormulaIndex(formula: MaybeRefOrGetter<RaFormula | null | undefined>) {
  const hazards = computed(() => {
    const map = new Map<string, RaHazard & { category: RaCategory }>()
    for (const category of toValue(formula)?.categories ?? []) {
      for (const hazard of category.hazards) map.set(hazard.code, { ...hazard, category })
    }
    return map
  })
  const matrix = computed(() => {
    const map = new Map<string, RaLevel>()
    for (const cell of toValue(formula)?.matrix ?? []) map.set(`${cell.probability}-${cell.impact}`, cell.level)
    return map
  })
  return { hazards, matrix }
}

export interface RaLocationRegisterQuery {
  kind: RaKind | 'all'
  q?: string
  region?: string
  province?: string
  active?: boolean
  approval?: RaLocationApprovalStatus
  /** Column to sort by; the newest change first (updated_at desc) by default. */
  sort?: 'name' | 'kind' | 'province' | 'assessments' | 'updated_at'
  dir?: 'asc' | 'desc'
  page: number
  per_page: number
}

/** The Locations register: buildings and branches together (or one kind), one page at a time. */
export function useRaLocationRegister(query: MaybeRefOrGetter<RaLocationRegisterQuery>) {
  return useFetch<RaPage<RaLocation>>('/api/ra/locations', {
    key: computed(() => `ra-location-register-${JSON.stringify(toValue(query))}`),
    query: computed(() => toValue(query)),
  })
}

export function useRaLocations(query: MaybeRefOrGetter<{ kind: RaKind, q?: string, active?: boolean }>) {
  return useFetch<{ items: RaLocation[] }>('/api/ra/locations', {
    key: computed(() => `ra-locations-${JSON.stringify(toValue(query))}`),
    query: computed(() => toValue(query)),
  })
}

export function useRaAssessments(query: MaybeRefOrGetter<RaListQuery>) {
  return useFetch<RaPage<RaAssessmentSummary>>('/api/ra/assessments', {
    query: computed(() => toValue(query)),
  })
}

export function useRaLocation(id: MaybeRefOrGetter<number>) {
  return useFetch<RaLocationDetail>(() => `${LOCATIONS}/${toValue(id)}`, {
    key: computed(() => `ra-location-${toValue(id)}`),
  })
}

export function useRaAssessment(id: MaybeRefOrGetter<number>) {
  return useFetch<RaAssessment>(() => `/api/ra/assessments/${toValue(id)}`, {
    key: computed(() => `ra-assessment-${toValue(id)}`),
  })
}

export type RaReportFormat = 'pdf' | 'xlsx'

/** The PDF report or the filled official workbook of an assessment. */
export function raReportUrl(id: number, format: RaReportFormat) {
  return `${BASE}/${id}/report.${format}`
}

/** Download a report as a file named by the server; throws when the server refuses. */
export async function downloadRaReport(id: number, format: RaReportFormat) {
  const response = await $fetch.raw<Blob>(raReportUrl(id, format), { responseType: 'blob' })
  const disposition = response.headers.get('content-disposition') ?? ''
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1]
  const url = URL.createObjectURL(response._data!)
  const link = document.createElement('a')
  link.href = url
  link.download = name ? decodeURIComponent(name) : `RA-${id}.${format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const CRISES = '/api/ra/crises'

export function useRaMap() {
  return useFetch<RaMapData>('/api/ra/map', { key: 'ra-map' })
}

export function useRaCrises(query: MaybeRefOrGetter<{ status?: RaCrisisStatus, q?: string, page: number, per_page?: number }>) {
  return useFetch<RaPage<RaCrisisSummary>>(CRISES, {
    key: computed(() => `ra-crises-${JSON.stringify(toValue(query))}`),
    query: computed(() => toValue(query)),
  })
}

export function useRaCrisis(id: MaybeRefOrGetter<number>) {
  return useFetch<RaCrisis>(() => `${CRISES}/${toValue(id)}`, {
    key: computed(() => `ra-crisis-${toValue(id)}`),
  })
}

export function useRaPlaybook() {
  return useFetch<{ items: RaPlaybookEntry[], can_edit: boolean }>('/api/ra/playbook', { key: 'ra-playbook' })
}

export const raCrisisApi = {
  declare: (body: RaCrisisInput) => $fetch<RaCrisis>(CRISES, { method: 'POST', body }),
  update: (id: number, body: RaCrisisInput) => $fetch<RaCrisis>(`${CRISES}/${id}`, { method: 'PUT', body }),
  addNote: (id: number, note: string) => $fetch<RaCrisis>(`${CRISES}/${id}/notes`, { method: 'POST', body: { note } }),
  close: (id: number, note: string | null) => $fetch<RaCrisis>(`${CRISES}/${id}/close`, { method: 'POST', body: { note } }),
  reopen: (id: number, note: string | null) => $fetch<RaCrisis>(`${CRISES}/${id}/reopen`, { method: 'POST', body: { note } }),
  remove: (id: number) => $fetch(`${CRISES}/${id}`, { method: 'DELETE' }),
  approve: (id: number, note: string | null) => $fetch<RaCrisis>(`${CRISES}/${id}/approve`, { method: 'POST', body: { note } }),
  reject: (id: number, note: string) => $fetch<RaCrisis>(`${CRISES}/${id}/reject`, { method: 'POST', body: { note } }),
  savePlaybook: (code: string, steps: { phase: RaPlaybookPhase, text: string }[]) =>
    $fetch<RaPlaybookEntry>(`/api/ra/playbook/${code}`, { method: 'PUT', body: { steps } }),
}

export const raApi = {
  createLocation: (body: RaLocationInput) => $fetch<RaLocationDetail>(LOCATIONS, { method: 'POST', body }),
  /** Renewals > Generate annual review for the last final RAs. */
  generateRenewals: (assessmentIds: number[]) =>
    $fetch<RaGenerateResult>('/api/ra/monitoring/renewals/generate', { method: 'POST', body: { assessment_ids: assessmentIds } }),
  /** New assessment: the locations the access scope opens for a reason (`all` for BCM). */
  locationScope: (kind: RaKind, reason: string) =>
    $fetch<{ all: boolean, ids: number[] }>(`${LOCATIONS}/scope`, { query: { kind, reason } }),
  updateLocation: (id: number, body: RaLocationInput) =>
    $fetch<RaLocationDetail>(`${LOCATIONS}/${id}`, { method: 'PUT', body }),
  getLocation: (id: number) => $fetch<RaLocationDetail>(`${LOCATIONS}/${id}`),
  createDivision: (body: RaDivisionInput) => $fetch<RaDivision>('/api/ra/divisions', { method: 'POST', body }),
  removeLocation: (id: number) => $fetch(`${LOCATIONS}/${id}`, { method: 'DELETE' }),
  approveLocation: (id: number, note: string | null) =>
    $fetch<RaLocationDetail>(`${LOCATIONS}/${id}/approve`, { method: 'POST', body: { note } }),
  rejectLocation: (id: number, note: string) =>
    $fetch<RaLocationDetail>(`${LOCATIONS}/${id}/reject`, { method: 'POST', body: { note } }),
  withdrawLocationRequest: (id: number) => $fetch<RaLocationDetail>(`${LOCATIONS}/${id}/withdraw`, { method: 'POST' }),
  resubmitLocation: (id: number) => $fetch<RaLocationDetail>(`${LOCATIONS}/${id}/resubmit`, { method: 'POST' }),
  setContacts: (id: number, contacts: RaContact[]) =>
    $fetch<RaLocationDetail>(`${LOCATIONS}/${id}/contacts`, { method: 'PUT', body: { contacts } }),
  setOccupants: (id: number, occupants: RaOccupant[]) =>
    $fetch<RaLocationDetail>(`${LOCATIONS}/${id}/occupants`, { method: 'PUT', body: { occupants } }),
  setRecoveryTeam: (id: number, members: RaRecoveryTeamMember[]) =>
    $fetch<RaLocationDetail>(`${LOCATIONS}/${id}/recovery-team`, { method: 'PUT', body: { members } }),
  setCallTree: (id: number, entries: RaCallTreeEntry[]) =>
    $fetch<RaLocationDetail>(`${LOCATIONS}/${id}/call-tree`, { method: 'PUT', body: { entries } }),
  get: (id: number) => $fetch<RaAssessment>(`${BASE}/${id}`),
  create: (body: RaAssessmentCreate) => $fetch<RaAssessment>(BASE, { method: 'POST', body }),
  update: (id: number, body: RaAssessmentUpdate) =>
    $fetch<RaAssessment>(`${BASE}/${id}`, { method: 'PUT', body }),
  setRatings: (id: number, ratings: RaRatingUpdate[]) =>
    $fetch<RaAssessment>(`${BASE}/${id}/ratings`, { method: 'PUT', body: { ratings } }),
  remove: (id: number) => $fetch(`${BASE}/${id}`, { method: 'DELETE' }),
  submit: (id: number) => $fetch<RaAssessment>(`${BASE}/${id}/submit`, { method: 'POST' }),
  approve: (id: number, comment: string | null) =>
    $fetch<RaAssessment>(`${BASE}/${id}/approve`, { method: 'POST', body: { comment } }),
  returnToDraft: (id: number, comment: string) =>
    $fetch<RaAssessment>(`${BASE}/${id}/return`, { method: 'POST', body: { comment } }),
  /** BCM: give the waiting step to another signer; `sent` is whether they were emailed. */
  changeSigner: (id: number, userId: number, reason: string) =>
    $fetch<RaActionResult>(`${BASE}/${id}/change-signer`, { method: 'POST', body: { user_id: userId, reason } }),
  /** BCM: approve the waiting step for its signer, with the evidence (their email or memo). */
  approveOnBehalf: (id: number, reason: string, file: File) => {
    const form = new FormData()
    form.append('reason', reason)
    form.append('file', file)
    return $fetch<RaActionResult>(`${BASE}/${id}/approve-on-behalf`, { method: 'POST', body: form })
  },
}

export interface RaActionResult {
  sent: boolean
  assessment: RaAssessment
}

/** The workflow message of a 422 (e.g. "This assessment is in sign-off…"), if any. */
export function raStatusMessage(error: unknown) {
  const details = (error as { data?: { details?: Record<string, string> } } | null)?.data?.details
  return details?.status
}

/** 409 from deleting a location that still has assessments. */
export function raIsConflict(error: unknown) {
  return (error as { statusCode?: number } | null)?.statusCode === 409
}

// --- Monitoring and Approval ------------------------------------------------------------------

/** An assessment as the Monitoring and Approval lists show it. */
export interface RaAssessmentRef {
  id: number
  ref_no: string | null
  period_year: number
  assessment_date: string | null
  reason?: RaReason | null
  status: RaStatus
  current_signoff_role: string | null
  /** Who signs the current step, e.g. "Location Incident Coordinator (LIC)". */
  current_step_title?: string | null
  highest_residual_level: RaLevel | null
  approved_at: string | null
  is_returned: boolean
}

export type RaRenewalBucket = 'overdue' | 'due_30' | 'due_90' | 'later'

/** A location with its RA in force (`approved`) and the RA being worked on (`open`). */
export interface RaMonitorLocation {
  location: RaLocationRef
  approved: RaAssessmentRef | null
  open: RaAssessmentRef | null
  assessment_count: number
  renewal_date: string | null
  days_left: number | null
  bucket: RaRenewalBucket | null
  /** Who made the RA shown (the one in force, else the open one), as SCCA's Assessor. */
  assessor: string | null
  /** That RA's LICOM. */
  licom?: string | null
  history: RaAssessmentRef[]
  /** Renewals only: the open RA's status, or `not_started`. */
  renewal_status?: RaStatus | 'not_started'
  /** Renewals only: this user may generate its annual review (as SCCA's). */
  can_generate?: boolean
}

/** List > RA(s): one RA of a location, `current` (the latest final) or `replaced`. */
export interface RaLocationHistoryRow extends RaAssessmentRef {
  assessor: string | null
  licom: string | null
  mark: 'current' | 'replaced' | null
}

/** Renewals > Generate annual review: what was created, skipped (an RA is open) and refused. */
export interface RaGenerateResult {
  created: { id: number, ref_no: string | null, renews: string | null, location: string }[]
  skipped: { id: number, ref_no: string | null, location: string, open_id: number, open_ref_no: string | null, reason: string }[]
  refused: { id: number, ref_no?: string | null, location?: string, reason: string }[]
}

/** An RA in sign-off and whose step it is. */
export interface RaSignoffWaiting extends RaAssessmentRef {
  location: RaLocationRef
  step: string
  /** Who signs the step, e.g. "Location Incident Coordinator (LIC)" (like SCCA). */
  step_title?: string
  signer: RaUserRef | null
  waiting_since: string | null
  working_days_waiting: number
  working_days_in_signoff: number
  submitted_at: string | null
  submitted_by: string | null
  /** Who made the RA (its creator), as SCCA's Assessor. */
  assessor?: string | null
  /** BCM board: false on an RA the caller made (reminders only, as SCCA's). */
  can_act?: boolean
  reminders_sent: number
  escalated_at: string | null
  level: 'ok' | 'reminder' | 'escalated'
}

export interface RaHistoryRow extends Omit<RaSignoffEvent, 'role'> {
  role: string | null
  /** Who signs the role, e.g. "Location Incident Coordinator (LIC)". */
  role_title?: string | null
  assessment: RaAssessmentRef & { location: RaLocationRef }
}

/** My history filter; `on_behalf` is an approval BCM gave for me. */
export type RaHistoryAction = RaSignoffEvent['action'] | 'on_behalf'

export interface RaMonitoringFilters {
  kind: RaKind
  q?: string
  region?: string
  level?: RaLevel | 'none'
  state?: 'approved' | 'draft' | 'in_signoff' | 'none'
  /** The reason of the building's RA in force or the one being worked on. */
  reason?: RaReason
  // Date range filters (assessment date)
  from?: string
  to?: string
  /** The location's organization, as SCCA's org filters. */
  directorate?: string
  sub_directorate?: string
  division?: string
  department?: string
}

export interface RaOverview {
  cards: {
    locations: number
    assessed: number
    not_assessed: number
    drafts: number
    in_signoff: number
    overdue_renewals: number
    due_in_90_days: number
    high_residual: number
    stuck_approvals: number
  }
  by_level: { level: RaLevel | 'none', locations: number }[]
  approved_per_month: { month: string, assessments: number }[]
}

export interface RaStepAverage {
  step: RaSignoffRole
  step_title: string
  approvals: number
  average_working_days: number | null
}

type Paged<T> = MaybeRefOrGetter<T & { page: number, per_page: number }>

function useRaList<T>(path: string, query: MaybeRefOrGetter<object>) {
  return useFetch<RaPage<T> & { counts?: Record<string, number> }>(path, {
    key: computed(() => `${path}-${JSON.stringify(toValue(query))}`),
    query: computed(() => toValue(query) as Record<string, unknown>),
  })
}

export function useRaOverview(filters: MaybeRefOrGetter<RaMonitoringFilters>) {
  return useFetch<RaOverview>('/api/ra/monitoring/overview', {
    key: computed(() => `ra-overview-${JSON.stringify(toValue(filters))}`),
    query: computed(() => toValue(filters)),
  })
}

export function useRaRenewals(query: Paged<RaMonitoringFilters>) {
  return useRaList<RaMonitorLocation>('/api/ra/monitoring/renewals', query)
}

export function useRaRegister(query: Paged<RaMonitoringFilters>) {
  return useRaList<RaMonitorLocation>('/api/ra/monitoring/register', query)
}

/** List > RA(s): every RA of one location, newest first. */
export function useRaLocationHistory(query: MaybeRefOrGetter<Paged<{ kind: RaKind, location_id: number }>>) {
  return useRaList<RaLocationHistoryRow>('/api/ra/monitoring/location-ras', query)
}

/** The org filter values of the locations in the user's scope. */
export function useRaMonitoringOrgValues(filters: MaybeRefOrGetter<RaMonitoringFilters>) {
  return useFetch<RaOrgValues>('/api/ra/monitoring/org-values', {
    key: computed(() => `ra-monitoring-org-values-${toValue(filters).kind}`),
    query: computed(() => ({ kind: toValue(filters).kind })),
    default: () => ({ directorates: [], sub_directorates: [], divisions: [], departments: [] }),
  })
}

export function useRaBottlenecks(query: Paged<RaMonitoringFilters & { step?: string }>) {
  return useRaList<RaSignoffWaiting>('/api/ra/monitoring/bottlenecks', query)
}

/** Average working days per sign-off step over approvals in the period. */
export function useRaBottlenecksStepAverages(filters: MaybeRefOrGetter<RaMonitoringFilters>) {
  return useFetch<{ items: RaStepAverage[] }>('/api/ra/monitoring/bottlenecks/step-averages', {
    key: computed(() => `ra-bottlenecks-step-averages-${JSON.stringify(toValue(filters))}`),
    query: computed(() => toValue(filters)),
  })
}

/** The provinces of the buildings (of a kind, or all), for the Buildings filter. */
export function useRaProvinces(kind: MaybeRefOrGetter<RaKind | 'all'>) {
  return useFetch<{ items: string[] }>('/api/ra/locations/provinces', {
    key: computed(() => `ra-provinces-${toValue(kind)}`),
    query: computed(() => ({ kind: toValue(kind) })),
  })
}

/** One unit of the region directory: a region (Sub Directorate) or an area (Group), with its
 *  head (D-1 / D-2), the office they work from and its city. */
export interface RaNetworkHead {
  level: string | null
  head: string | null
  office: string | null
  city: string | null
}
export interface RaNetworkArea extends RaNetworkHead {
  area: string
}
export interface RaNetworkRegion extends RaNetworkHead {
  region: string
  directorate: string
  areas: RaNetworkArea[]
}

/** The region directory for a branch's Region and Area (the DataRegion sheet; LDAP in
 *  production). Empty until it is imported: the region is then free text. */
/** The building form's organization lists: the user master's values and the locations'. */
export function useRaOrgValues() {
  return useFetch<RaOrgValues>('/api/ra/org-values', {
    key: 'ra-org-values',
    default: () => ({ directorates: [], sub_directorates: [], divisions: [], departments: [] }),
  })
}

export function useRaRegionDirectory() {
  return useFetch<{ items: RaNetworkRegion[] }>('/api/ra/regions', {
    key: 'ra-region-directory',
    default: () => ({ items: [] }),
  })
}

export function useRaRegions(kind: MaybeRefOrGetter<RaKind>) {
  return useFetch<{ items: string[] }>('/api/ra/monitoring/regions', {
    key: computed(() => `ra-regions-${toValue(kind)}`),
    query: computed(() => ({ kind: toValue(kind) })),
  })
}

export function useRaInbox(query: Paged<{ kind: RaKind }>) {
  return useRaList<RaSignoffWaiting>('/api/ra/approvals/inbox', query)
}

export function useRaUpcoming(query: Paged<{ kind: RaKind }>) {
  return useRaList<RaSignoffWaiting>('/api/ra/approvals/upcoming', query)
}

export function useRaHistory(query: Paged<{ kind: RaKind, action?: RaHistoryAction, q?: string }>) {
  return useRaList<RaHistoryRow>('/api/ra/approvals/history', query)
}

export function useRaBoard(query: Paged<{ kind: RaKind, step?: string, q?: string }>, enabled: MaybeRefOrGetter<boolean>) {
  return useFetch<RaPage<RaSignoffWaiting>>('/api/ra/approvals/board', {
    key: computed(() => `ra-board-${JSON.stringify(toValue(query))}`),
    query: computed(() => toValue(query)),
    immediate: toValue(enabled),
    watch: [() => toValue(enabled)],
  })
}

/** The Excel download of a Monitoring view, with the same filters (all rows). */
/** A Monitoring view as Excel, with the same filters; `ids`: only these buildings (the List
 *  tab's ticked rows), every RA of each. */
export function raExportUrl(view: 'register' | 'renewals' | 'bottlenecks' | 'location-ras', filters: RaMonitoringFilters & { location_id?: number }, ids: number[] = []) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '' && key !== 'page' && key !== 'per_page') {
      query.set(key, String(value))
    }
  }
  if (ids.length) query.set('ids', ids.join(','))
  const text = query.toString()
  return `/api/ra/monitoring/${view}.xlsx${text ? `?${text}` : ''}`
}
