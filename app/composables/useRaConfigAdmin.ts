import type { RaDivision, RaDivisionInput, RaFormula, RaSignoffStep } from '~/composables/useRa'

/**
 * Administration > RA configuration, like the SCCA one: versions per kind (RA and RA Branch)
 * with the hazards and guides, sign-off steps, statements and notes; the live default and fixed
 * signers, the division list and the reminder rules (live, not versioned).
 */
export interface RaConfigVersionMeta {
  id: number
  code: string
  kind: RaKind
  name: string
  status: 'draft' | 'active' | 'retired'
  notes: string | null
  based_on: string | null
  created_by: string | null
  created_at: string | null
  requested_by: string | null
  requested_by_id: number | null
  requested_at: string | null
  published_by: string | null
  published_at: string | null
  used_by: number
}

export type RaConfigTextField
  = | 'type_description'
    | 'hazard_intro'
    | 'signoff_statement_en'
    | 'risk_summary_note_en'
    | 'building_pending_note_en'

export interface RaConfigVersion extends Omit<RaFormula, 'status'>, RaConfigVersionMeta {
  stored_texts: Record<RaConfigTextField, string | null>
  default_texts: Partial<Record<RaConfigTextField, string>>
  default_steps: RaSignoffStep[]
  problems: string[]
  can: { edit: boolean, request_publish: boolean, withdraw_request: boolean, publish: boolean, discard: boolean }
}

/** A default or fixed step of the active and draft versions, with its live signer (not
 *  versioned: saved at once for every version of the kind). */
export interface RaSignerStep {
  code: string
  label: string
  title: string
  signer_mode: 'default' | 'fixed'
  signer_roles: string[]
  versions: { code: string, status: string }[]
  signer: { id: number, display_name: string | null, email: string | null, job_title: string | null, department: string | null } | null
  problem: string | null
  updated_by: string | null
  updated_at: string | null
}

export interface RaConfigChange {
  part: string
  item: string
  field: string
  from: string | null
  to: string | null
}

export interface RaHazardsInput {
  categories: {
    code: string | null
    name: string
    label: string
    hazards: { code: string | null, short_name: string, name: string }[]
  }[]
}

export interface RaSettings {
  reminders_enabled: boolean
  reminder_after_days: number
  reminder_every_days: number
  escalate_after_days: number
  extra_escalation_emails: string[]
  renewal_notice_days: number[]
  overdue_repeat_days: number
  window_start_hour: number
  window_end_hour: number
  /** A declared disaster waiting for approval: remind every N hours, escalate after M. */
  incident_reminder_hours: number
  incident_escalate_hours: number
  updated_at?: string | null
  updated_by?: string | null
}

/** RA configuration > Team diagrams: a chart of a kind, uploaded or the workbook's. */
export interface RaDiagramInfo {
  diagram: RaDiagram
  label: string
  kind: RaKind
  custom: boolean
  filename: string | null
  content_type: 'image/png' | 'image/jpeg'
  width: number
  height: number
  size: number
  /** Changes with the image. */
  version: string
  updated_at: string | null
  updated_by: string | null
}

const BASE = '/api/admin/ra-config'
const VERSIONS = `${BASE}/versions`

/** A version is named by its code within its kind: RA and RA Branch can both have V.04. */
export interface RaVersionRef {
  code: string
  kind: RaKind
}

function at(version: RaVersionRef, path = '') {
  return `${VERSIONS}/${encodeURIComponent(version.code)}${path}?kind=${version.kind}`
}

export const raConfigApi = {
  versions: () => $fetch<{ items: RaConfigVersionMeta[], can_start_draft: Record<RaKind, boolean> }>(VERSIONS),
  get: (version: RaVersionRef) => $fetch<RaConfigVersion>(at(version)),
  startDraft: (kind: RaKind) => $fetch<RaConfigVersion>(VERSIONS, { method: 'POST', body: { kind } }),
  update: (version: RaVersionRef, body: { code?: string, name: string, notes: string | null }) =>
    $fetch<RaConfigVersion>(at(version), { method: 'PATCH', body }),
  discard: (version: RaVersionRef) => $fetch(at(version), { method: 'DELETE' }),
  setHazards: (version: RaVersionRef, body: RaHazardsInput) =>
    $fetch<RaConfigVersion>(at(version, '/hazards'), { method: 'PUT', body }),
  setGuides: (version: RaVersionRef, guides: RaFormula['guides']) =>
    $fetch<RaConfigVersion>(at(version, '/guides'), { method: 'PUT', body: { guides } }),
  setMitigationExamples: (version: RaVersionRef, examples: { area: string, example: string }[]) =>
    $fetch<RaConfigVersion>(at(version, '/mitigation-examples'), { method: 'PUT', body: { examples } }),
  setSteps: (version: RaVersionRef, steps: RaSignoffStep[]) =>
    $fetch<RaConfigVersion>(at(version, '/steps'), { method: 'PUT', body: { steps } }),
  signers: (kind: RaKind) => $fetch<{ items: RaSignerStep[] }>(`${BASE}/signers?kind=${kind}`),
  setSigner: (kind: RaKind, step: string, userId: number | null) =>
    $fetch<RaSignerStep>(`${BASE}/signers/${encodeURIComponent(step)}?kind=${kind}`, { method: 'PUT', body: { user_id: userId } }),
  setTexts: (version: RaVersionRef, texts: Partial<Record<RaConfigTextField, string | null>>) =>
    $fetch<RaConfigVersion>(at(version, '/texts'), { method: 'PUT', body: texts }),
  diff: (version: RaVersionRef) => $fetch<{ against: string | null, changes: RaConfigChange[] }>(at(version, '/diff')),
  requestPublish: (version: RaVersionRef) => $fetch<RaConfigVersion>(at(version, '/request-publish'), { method: 'POST' }),
  withdrawRequest: (version: RaVersionRef) => $fetch<RaConfigVersion>(at(version, '/withdraw-request'), { method: 'POST' }),
  publish: (version: RaVersionRef) => $fetch<RaConfigVersion>(at(version, '/publish'), { method: 'POST' }),
  divisions: () => $fetch<{ items: RaDivision[] }>(`${BASE}/divisions`),
  createDivision: (body: RaDivisionInput) => $fetch<RaDivision>(`${BASE}/divisions`, { method: 'POST', body }),
  updateDivision: (id: number, body: Partial<RaDivisionInput> & { is_active?: boolean }) =>
    $fetch<RaDivision>(`${BASE}/divisions/${id}`, { method: 'PATCH', body }),
  deleteDivision: (id: number) => $fetch(`${BASE}/divisions/${id}`, { method: 'DELETE' }),
  settings: () => $fetch<RaSettings>(`${BASE}/settings`),
  saveSettings: (body: RaSettings) => $fetch<RaSettings>(`${BASE}/settings`, { method: 'PUT', body }),
  diagrams: (kind: RaKind) => $fetch<{ items: RaDiagramInfo[] }>(`${BASE}/diagrams?kind=${kind}`),
  uploadDiagram: (kind: RaKind, diagram: RaDiagram, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return $fetch<RaDiagramInfo>(`${BASE}/diagrams/${diagram}?kind=${kind}`, { method: 'PUT', body })
  },
  resetDiagram: (kind: RaKind, diagram: RaDiagram) =>
    $fetch<RaDiagramInfo>(`${BASE}/diagrams/${diagram}?kind=${kind}`, { method: 'DELETE' }),
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Shared by the editor tabs: the editable copy of a part of the version, and its save. */
export function useRaConfigPart<T>(
  version: Ref<RaConfigVersion>,
  pick: (version: RaConfigVersion) => T,
  save: (version: RaVersionRef, value: T) => Promise<RaConfigVersion>,
  onSaved: (version: RaConfigVersion) => void,
  message: string,
) {
  const toast = useToast()
  const draft = ref(copy(pick(version.value))) as Ref<T>
  const error = ref<string | null>(null)
  const busy = ref(false)
  const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(pick(version.value)))
  watch(version, (value) => {
    draft.value = copy(pick(value))
  })
  async function submit() {
    error.value = null
    busy.value = true
    try {
      const saved = await save(version.value, draft.value)
      onSaved(saved)
      toast.add({ title: message, color: 'success', icon: 'i-lucide-circle-check' })
    } catch (failure) {
      error.value = configErrorText(failure)
    } finally {
      busy.value = false
    }
  }
  function reset() {
    draft.value = copy(pick(version.value))
    error.value = null
  }
  return { draft, error, busy, dirty, submit, reset }
}

// --- RA configuration > Access scope (live rules, not part of a version), as SCCA's ---------

export type RaRenewalStatus = 'overdue' | 'due_30' | 'due_90' | 'active'
export type RaScopedReason = 'annual_review' | 'structural_change'

export interface RaAccessRuleInput {
  name: string
  /** Organization levels the rule covers (or name `user_ids`). */
  levels: string[]
  /** Empty: the user's own directorate. */
  directorates: string[]
  /** head_office, branch; empty: both. */
  kinds: RaKind[]
  reasons: RaScopedReason[]
  /** Annual review only; empty: every status. */
  renewal_statuses: RaRenewalStatus[]
  /** The highest residual of the location's last final RA. Empty for every level. */
  risk_levels: RaLevel[]
  can_generate: boolean
  /** Levels a generated annual review's LICOM may have. */
  contributor_levels: string[]
  user_ids: number[]
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
}

export interface RaAccessRule extends RaAccessRuleInput {
  id: number
  users: { id: number, name: string }[]
  sort_order: number
  updated_by: string | null
  updated_at: string | null
}

export interface RaAccessOptions {
  levels: string[]
  directorates: string[]
  kinds: { code: RaKind, label: string }[]
  reasons: { code: RaScopedReason, label: string }[]
  renewal_statuses: { code: RaRenewalStatus, label: string }[]
  risk_levels: { code: RaLevel, label: string }[]
}

export interface RaAccessCheck {
  user: { id: number, name: string, directorate: string | null, org_level: string | null }
  rules: { id: number, name: string }[]
  can_generate: boolean
  reasons: RaScopedReason[]
  locations: Partial<Record<RaScopedReason, number>>
  /** Of the rules' LICOM levels, so may be picked as a generated annual review's LICOM. */
  can_be_contributor?: boolean
}

const ACCESS = `${BASE}/access-rules`

export const raAccessApi = {
  list: () => $fetch<{ items: RaAccessRule[], options: RaAccessOptions }>(ACCESS),
  create: (body: RaAccessRuleInput) => $fetch<RaAccessRule>(ACCESS, { method: 'POST', body }),
  update: (id: number, body: RaAccessRuleInput) => $fetch<RaAccessRule>(`${ACCESS}/${id}`, { method: 'PUT', body }),
  remove: (id: number) => $fetch(`${ACCESS}/${id}`, { method: 'DELETE' }),
  check: (userId: number) => $fetch<RaAccessCheck>(`${ACCESS}/check`, { query: { user_id: userId } }),
}
