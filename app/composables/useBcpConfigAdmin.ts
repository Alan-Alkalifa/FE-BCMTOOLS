/**
 * Administration > BCP configuration: versions of the BCP parameters (the standard text, the
 * level of disruption, the workaround conditions, the contacts and the approval template of
 * Template BCP Unit Kerja ver.23). One active, at most one draft. A tab saves one part of the
 * draft with the draft's revision; publishing takes two people.
 */
import { configErrorText } from '~/composables/useSccaConfigAdmin'

export type BcpStandardTextKey = 'kata_pengantar' | 'tujuan' | 'dasar_penyusunan' | 'ruang_lingkup'
  | 'penggunaan' | 'uji_coba' | 'pengkinian' | 'asumsi' | 'budget' | 'cmt' | 'cct' | 'imt' | 'rtf'
  | 'keterkaitan' | 'eskalasi' | 'mekanisme_eskalasi' | 'lokasi_assembly' | 'ccc' | 'prosedur_pemulihan'
  | 'kembali_normal' | 'uji_coba_dokumen' | 'pengkinian_dokumen' | 'proposal_objective'
  | 'proposal_reasons' | 'proposal_background'

export interface BcpCrisisRole { code: string, label: string, min_level: string | null, required: boolean, min_count: number }
export interface BcpCmtMember { code: string, title: string, name: string }
export type BcpLodColor = 'black' | 'red' | 'amber' | 'yellow' | 'green' | 'neutral'
export interface BcpWorkaroundColumn { code: string, label: string, example: string, active: boolean }
export interface BcpWorkaroundCondition {
  code: string
  title: string
  intro: string
  scope: 'per_function' | 'all_critical'
  columns: BcpWorkaroundColumn[]
  active: boolean
  show_pandemic_levels: boolean
}
export interface BcpProcedureSnapshot { code: string, name: string, procedure: string, form: string, pic: string, notes: string, active: boolean }
/** A scenario of Master data › BCP scenario and procedure, as the version copied it. */
export interface BcpScenarioSnapshot {
  code: string
  name: string
  condition_code: string
  description: string
  active: boolean
  procedures: BcpProcedureSnapshot[]
}
export interface BcpApprovalStep {
  code: string
  group: 'prepared' | 'reviewed' | 'rcu' | 'mandatory' | 'approval'
  title: string
  signer_mode: 'plan_role' | 'fixed' | 'chosen'
  plan_role: 'rtf_lead' | 'imt_lead' | null
  name: string | null
  position: string | null
  required: boolean
}

export interface BcpConfigPayload {
  scope: {
    required_categories: string[]
    workaround_categories: string[]
    chapter_categories: { category: string, title: string, definition: string }[]
  }
  standard_text: Record<BcpStandardTextKey, string>
  glossary: { code: string, term: string, definition: string }[]
  crisis_teams: { imt: BcpCrisisRole[], rtf: BcpCrisisRole[], cmt_members: BcpCmtMember[], cmt_secretary: BcpCmtMember }
  lod: {
    levels: { code: string, label: string, color: BcpLodColor }[]
    criteria: { code: string, label: string, descriptions: Record<string, string> }[]
    activation: { code: string, label: string, by_level: Record<string, string> }[]
    notes: string
  }
  workaround: {
    conditions: BcpWorkaroundCondition[]
    pandemic_levels: { code: string, phase: string, level: string, description: string }[]
    split_wfh_text: string
  }
  contacts: {
    internal: { code: string, name: string, organization: string, service: string, phone_mobile: string, phone_office: string, email: string }[]
    emergency: { code: string, name: string, phone: string, fax: string }[]
    needs_categories: { code: string, label: string, example: string }[]
    checklist: { code: string, label: string }[]
  }
  approval_steps: BcpApprovalStep[]
  document: { review_period_months: number, test_period_months: number, template_label: string }
  /** Read-only: copied from Master data › BCP scenario and procedure. */
  scenarios: BcpScenarioSnapshot[]
}

export type BcpPart = Exclude<keyof BcpConfigPayload, 'scenarios'>

export interface BcpConfigVersionMeta {
  id: number
  code: string
  name: string
  notes: string | null
  status: 'draft' | 'active' | 'retired'
  revision: number
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

export interface BcpConfigChange {
  part: string
  path: string[]
  change: 'added' | 'removed' | 'changed'
  previous_version: string
  previous_value: unknown
  current_version: string
  current_value: unknown
}

export interface BcpConfigVersion extends BcpConfigVersionMeta {
  payload: BcpConfigPayload
  problems: string[]
  /** Codes a published version used: they can be made inactive, not removed or renamed. */
  locked: { levels: string[], conditions: string[], columns: Record<string, string[]> }
  can: { edit: boolean, request_publish: boolean, withdraw_request: boolean, publish: boolean, discard: boolean }
  changes: BcpConfigChange[]
}

export const bcpVersionStatus = defineStatusScale<BcpConfigVersionMeta['status']>({
  draft: { label: 'Draft', color: 'warning', icon: 'i-lucide-file-pen' },
  active: { label: 'Active', color: 'success', icon: 'i-lucide-badge-check' },
  retired: { label: 'Retired', color: 'neutral', icon: 'i-lucide-archive' },
})

const BASE = '/api/admin/bcp-config/versions'

export const bcpConfigApi = {
  versions: () => $fetch<{ items: BcpConfigVersionMeta[], can_start_draft: boolean }>(BASE),
  get: (code: string) => $fetch<BcpConfigVersion>(`${BASE}/${code}`),
  startDraft: () => $fetch<BcpConfigVersion>(BASE, { method: 'POST' }),
  updateMeta: (code: string, body: { revision: number, name: string, notes: string | null }) =>
    $fetch<BcpConfigVersion>(`${BASE}/${code}`, { method: 'PATCH', body }),
  setPart: <P extends BcpPart>(code: string, part: P, revision: number, value: BcpConfigPayload[P]) =>
    $fetch<BcpConfigVersion>(`${BASE}/${code}/parts/${part}`, { method: 'PUT', body: { revision, value } }),
  requestPublish: (code: string, revision: number) =>
    $fetch<BcpConfigVersion>(`${BASE}/${code}/request-publish`, { method: 'POST', body: { revision } }),
  withdrawRequest: (code: string, revision: number) =>
    $fetch<BcpConfigVersion>(`${BASE}/${code}/withdraw-request`, { method: 'POST', body: { revision } }),
  publish: (code: string, revision: number) =>
    $fetch<BcpConfigVersion>(`${BASE}/${code}/publish`, { method: 'POST', body: { revision } }),
  discard: (code: string, revision: number) =>
    $fetch(`${BASE}/${code}`, { method: 'DELETE', body: { revision } }),
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * One tab's editable copy of its part and its save, as SCCA configuration's useConfigPart. The
 * save sends the draft's revision: a stale tab gets a 409 instead of overwriting another save.
 */
export function useBcpConfigPart<P extends BcpPart>(
  version: Ref<BcpConfigVersion>,
  part: P,
  onSaved: (version: BcpConfigVersion) => void,
  message: string,
) {
  const toast = useToast()
  const draft = ref(copy(version.value.payload[part])) as Ref<BcpConfigPayload[P]>
  const error = ref<string | null>(null)
  const busy = ref(false)
  const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(version.value.payload[part]))
  watch(version, (value) => {
    draft.value = copy(value.payload[part])
  })
  async function submit() {
    error.value = null
    busy.value = true
    try {
      const saved = await bcpConfigApi.setPart(version.value.code, part, version.value.revision, draft.value)
      onSaved(saved)
      toast.add({ title: message, color: 'success', icon: 'i-lucide-circle-check' })
    } catch (failure) {
      error.value = configErrorText(failure)
    } finally {
      busy.value = false
    }
  }
  function reset() {
    draft.value = copy(version.value.payload[part])
    error.value = null
  }
  return { draft, error, busy, dirty, submit, reset }
}

/**
 * Codes already saved in this version (as BIA configuration's saved personnel codes): their code
 * is locked, since BCPs and the published versions use it. A row added in the tab and not saved
 * yet can still take any code.
 */
export function bcpSavedCodes(rows: { code: string }[] | undefined) {
  return new Set((rows ?? []).map((row) => row.code))
}

/** A code from a label: lowercase, underscores, starting with a letter, 40 characters at most. */
export function bcpCodeFrom(label: string, taken: Iterable<string>) {
  const base = (label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item')
    .replace(/^(\d)/, 'x$1').slice(0, 36)
  const used = new Set(taken)
  let code = base
  for (let n = 2; used.has(code); n++) code = `${base}_${n}`
  return code
}
