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

export interface RaFormula {
  code: string
  kind: RaKind
  name: string
  /** The rating inputs of this kind, in questionnaire order. */
  inputs: RaRatingField[]
  signoff_roles: RaSignoffRole[]
  levels: RaLevel[]
  instructions: string[]
  signoff_statement: string | null
  risk_summary_note: string | null
  categories: RaCategory[]
  guides: Record<RaGuideScale, RaGuide[]>
  matrix: { probability: number, impact: number, level: RaLevel }[]
  mitigation_examples: { area: string, example: string }[]
}

export type RaRatingInputs = Record<RaRatingField, RaRatingValue>

export interface RaRatingTexts {
  mitigation: string | null
  action_plan: string | null
  cim_ref_no: string | null
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
}

/** Assigning a signer (draft only). Approvals go through raApi.approve. */
export interface RaSignoffInput {
  role: RaSignoffRole
  signer_id?: number | null
  designation?: string | null
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
}

export interface RaSignoffEvent {
  action: 'submitted' | 'approved' | 'returned'
  role: RaSignoffRole | null
  user: string | null
  comment: string | null
  at: string
}

export interface RaWorkflow {
  status: RaStatus
  current_signoff_role: RaSignoffRole | null
  awaiting_signer: RaUserRef | null
  can_edit: boolean
  can_submit: boolean
  can_approve: boolean
  can_return: boolean
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
  kind: RaKind
  name: string
  region: string | null
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
  /** A head office building (pin), a branch (square), or a crisis point (siren). */
  variant?: 'location' | 'branch' | 'crisis'
}

export interface RaMapCircle extends RaPin {
  id: number
  radiusM: number
  active?: boolean
  /** A crisis's affected area (error colour) rather than a distance ring. */
  crisis?: boolean
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

export type RaCrisisStatus = 'open' | 'closed'
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
      cim_ref_no: string | null
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
  history: { action: 'declared' | 'updated' | 'note' | 'closed' | 'reopened', note: string | null, user: string | null, at: string }[]
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
  latitude: number | null
  longitude: number | null
  is_active: boolean
  assessment_count: number
  latest_assessment: RaAssessmentSummary | null
  updated_at: string
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
  lic_name: string | null
  lic_phone: string | null
  licom_name: string | null
  licom_phone: string | null
}

export interface RaAssessmentSummary {
  id: number
  ref_no: string | null
  period_year: number
  assessment_date: string | null
  due_date: string | null
  location: RaLocationRef
  rated_count: number
  hazard_count: number
  highest_gross_level: RaLevel | null
  highest_residual_level: RaLevel | null
  is_complete: boolean
  status: RaStatus
  current_signoff_role: RaSignoffRole | null
  is_returned: boolean
  created_by: string | null
  updated_at: string
}

export interface RaAssessment extends RaAssessmentFields, RaWorkflow {
  id: number
  ref_no: string | null
  kind: RaKind
  formula_version: string
  can_delete: boolean
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
  status?: RaStatus
  awaiting?: 'me'
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
export type RaAssessmentUpdate = Partial<RaAssessmentFields> & { signoffs?: RaSignoffInput[] }
export type RaAssessmentCreate = Partial<RaAssessmentFields> & {
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
  region?: string | null
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

/** RA or RA Branch, from the route (`/ra/…` or `/ra-branch/…`). */
export function useRaModule() {
  const route = useRoute()
  return computed(() => (route.path === '/ra-branch' || route.path.startsWith('/ra-branch/')
    ? RA_MODULES.branch
    : RA_MODULES.head_office))
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

export function useRaFormula(kind: MaybeRefOrGetter<RaKind>) {
  return useFetch<RaFormula>('/api/ra/formula', {
    key: computed(() => `ra-formula-${toValue(kind)}`),
    query: computed(() => ({ kind: toValue(kind) })),
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key],
  })
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
  savePlaybook: (code: string, steps: { phase: RaPlaybookPhase, text: string }[]) =>
    $fetch<RaPlaybookEntry>(`/api/ra/playbook/${code}`, { method: 'PUT', body: { steps } }),
}

export const raApi = {
  createLocation: (body: RaLocationInput) => $fetch<RaLocationDetail>(LOCATIONS, { method: 'POST', body }),
  updateLocation: (id: number, body: RaLocationInput) =>
    $fetch<RaLocationDetail>(`${LOCATIONS}/${id}`, { method: 'PUT', body }),
  getLocation: (id: number) => $fetch<RaLocationDetail>(`${LOCATIONS}/${id}`),
  removeLocation: (id: number) => $fetch(`${LOCATIONS}/${id}`, { method: 'DELETE' }),
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
