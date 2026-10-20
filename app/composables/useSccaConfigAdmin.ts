/** Administration > SCCA configuration: versions, the draft's edits, four-eyes publish, the
 * calculator, impact and diff, and the live default and fixed signers (picked on the Sign-off steps tab). */
import type { SccaPreview } from '~/composables/useScca'

export interface SccaConfigVersionMeta {
  id: number
  code: string
  name: string
  status: 'draft' | 'active' | 'retired'
  notes: string | null
  renewal_months: number
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

export interface SccaConfigVersion extends SccaConfig, Omit<SccaConfigVersionMeta, keyof SccaConfig> {
  problems: string[]
  can: { edit: boolean, request_publish: boolean, withdraw_request: boolean, publish: boolean, discard: boolean }
}

export interface SccaConfigImpact {
  compared_with: string | null
  checked: number
  changed: number
  re_rate: number
  items: {
    id: number
    ref_no: string | null
    application_name: string
    status: SccaStatus
    category_now: string | null
    category_new: string | null
    final_category: string | null
    overridden: boolean
    re_rate: string[]
  }[]
}

export interface SccaConfigChange {
  section: string
  item: string
  change: 'added' | 'removed' | 'changed'
  before: unknown
  after: unknown
}

export interface SccaSignerStep {
  code: string
  title: string
  signer_mode: 'default' | 'fixed'
  signer_roles: string[]
  versions: { code: string, status: string }[]
  signer: SccaConfigStep['signer']
  problem: string | null
  updated_by: string | null
  updated_at: string | null
}

const BASE = '/api/admin/scca-config/versions'

export const sccaVersionStatus = defineStatusScale<SccaConfigVersionMeta['status']>({
  draft: { label: 'Draft', color: 'warning', icon: 'i-lucide-file-pen' },
  active: { label: 'Active', color: 'success', icon: 'i-lucide-badge-check' },
  retired: { label: 'Retired', color: 'neutral', icon: 'i-lucide-archive' },
})

export const sccaConfigApi = {
  versions: () => $fetch<{ items: SccaConfigVersionMeta[], can_start_draft: boolean }>(BASE),
  get: (code: string) => $fetch<SccaConfigVersion>(`${BASE}/${code}`),
  startDraft: (body: { code?: string, name?: string, notes?: string | null } = {}) =>
    $fetch<SccaConfigVersion>(BASE, { method: 'POST', body }),
  update: (code: string, body: { name?: string, notes?: string | null, renewal_months?: number }) =>
    $fetch<SccaConfigVersion>(`${BASE}/${code}`, { method: 'PATCH', body }),
  discard: (code: string) => $fetch(`${BASE}/${code}`, { method: 'DELETE' }),
  setList: (code: string, name: SccaListName, items: SccaConfigItem[]) =>
    $fetch<SccaConfigVersion>(`${BASE}/${code}/lists/${name}`, { method: 'PUT', body: { items } }),
  setQuestions: (code: string, questions: SccaConfigQuestion[]) =>
    $fetch<SccaConfigVersion>(`${BASE}/${code}/questions`, { method: 'PUT', body: { questions } }),
  setSteps: (code: string, steps: SccaConfigStep[]) =>
    $fetch<SccaConfigVersion>(`${BASE}/${code}/steps`, { method: 'PUT', body: { steps } }),
  setFormula: (code: string, body: Partial<Pick<SccaConfig, 'weights' | 'thresholds' | 'matrix' | 'recovery_standards'>>) =>
    $fetch<SccaConfigVersion>(`${BASE}/${code}/formula`, { method: 'PUT', body }),
  setNotes: (code: string, notes: SccaRatingNote[]) =>
    $fetch<SccaConfigVersion>(`${BASE}/${code}/notes`, { method: 'PUT', body: { notes } }),
  calculate: (code: string, ratings: Record<string, number>) =>
    $fetch<SccaPreview>(`${BASE}/${code}/calculate`, { method: 'POST', body: { ratings } }),
  impact: (code: string) => $fetch<SccaConfigImpact>(`${BASE}/${code}/impact`),
  diff: (code: string) => $fetch<{ compared_with: string | null, changes: SccaConfigChange[] }>(`${BASE}/${code}/diff`),
  requestPublish: (code: string) => $fetch<SccaConfigVersion>(`${BASE}/${code}/request-publish`, { method: 'POST' }),
  withdrawRequest: (code: string) => $fetch<SccaConfigVersion>(`${BASE}/${code}/withdraw-request`, { method: 'POST' }),
  publish: (code: string) => $fetch<SccaConfigVersion>(`${BASE}/${code}/publish`, { method: 'POST' }),
  signers: () => $fetch<{ items: SccaSignerStep[] }>('/api/admin/settings/scca/signers'),
  setSigner: (step: string, userId: number | null) =>
    $fetch<SccaSignerStep>(`/api/admin/settings/scca/signers/${step}`, { method: 'PUT', body: { user_id: userId } }),
}

const ROWS: Record<string, string> = { items: 'Row', steps: 'Step', questions: 'Question', notes: 'Note', weights: 'Weight', thresholds: 'Level', matrix: 'Cell', recovery_standards: 'Standard' }

/** `steps.2.signer_roles` → "Step 3 · signer roles". */
export function configFieldLabel(path: string) {
  const [part, index, ...rest] = path.split('.')
  if (part && index != null && /^\d+$/.test(index) && ROWS[part]) {
    return [`${ROWS[part]} ${Number(index) + 1}`, ...rest.map((name) => name.replaceAll('_', ' '))].join(' · ')
  }
  return path.replaceAll('_', ' ').replaceAll('.', ' · ')
}

/** A 422's field messages as one readable list, for the editors' error alerts. */
export function configErrorText(error: unknown): string {
  const data = (error as { statusCode?: number, data?: { message?: string, details?: Record<string, string> } })?.data
  const lines = Object.entries(data?.details ?? {}).map(([field, message]) => `• ${configFieldLabel(field)}: ${message}`)
  return [data?.message ?? apiErrorMessage(error).replace('assessment', 'configuration'), ...lines].join('\n')
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Shared by the editor tabs: the editable copy of a part of the version, and its save. */
export function useConfigPart<T>(
  version: Ref<SccaConfigVersion>,
  pick: (version: SccaConfigVersion) => T,
  save: (code: string, value: T) => Promise<SccaConfigVersion>,
  onSaved: (version: SccaConfigVersion) => void,
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
      const saved = await save(version.value.code, draft.value)
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
