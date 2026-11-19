/**
 * The SCCA configuration of a version (GET /api/scca/config): choice lists, sign-off steps,
 * rating notes, questions and guides, formula and recovery standards. Each SCCA is shown with
 * the configuration of its own version, so publishing a newer version never changes it.
 *
 * The V4.2 constants in utils/scca.ts stay as the fallback (and for tests); a loaded
 * configuration also fills a small registry so labels shown outside a record (lists, the
 * approval board, the audit log) use the configured titles.
 */
import { reactive } from 'vue'
import type { SccaDrConfig } from '~/utils/scca-dr'

export const SCCA_LIST_NAMES = [
  'assessment_reason',
  'deployment_model',
  'business_days',
  'business_hours',
  'category',
  'hours',
  'rpo',
  'ha',
  'instance_type',
  'dr_type',
  'dr_capacity',
  'processing_mode',
  'dependency',
] as const
export type SccaListName = (typeof SCCA_LIST_NAMES)[number]

export interface SccaConfigItem {
  code: string
  label: string
  report_text: string | null
  active: boolean
  attrs: Record<string, boolean | number | string | null>
}

export type SccaSignerMode = 'chosen' | 'default' | 'fixed'

export interface SccaConfigStep {
  code: string
  title: string
  short: string
  mandatory: boolean
  signer_mode: SccaSignerMode
  signer_roles: string[]
  excel_box: number | null
  comments_all_tabs: boolean
  /** The live default or fixed signer (GET /api/scca/config). */
  signer?: {
    id: number
    display_name: string | null
    email: string | null
    job_title: string | null
    department: string | null
  } | null
}

export type SccaRatingNote
  = | { kind: 'follows', params: { question: string, rating: number, then: string[] } }
    | { kind: 'a3', params: { question: string } }
    | { kind: 'i4', params: { question: string, from: number[] } }

export interface SccaConfigStandard {
  category: string
  mtd: string | null
  rto: string | null
  uptime: string | null
  mtd_from_h?: number | null
  mtd_to_h?: number | null
  rto_from_h?: number | null
  rto_to_h?: number | null
  uptime_min_pct?: number | null
  /** The CIMBN block of an SCCA is these (read-only there): `rpo`, `ha` and `dr_type` list
   *  codes, `dr_capacity` a percentage; null = not set. */
  rpo?: string | null
  ha?: string | null
  dr_capacity?: number | null
  dr_type?: string | null
}

export interface SccaConfigQuestion {
  code: string
  dimension: 'C' | 'I' | 'A' | 'P'
  sort_order?: number
  component: string
  label: string
  question: string
  options: { rating: number, label: string, guidance: string | null }[]
}

export interface SccaConfig {
  id: number
  code: string
  name: string
  status: 'draft' | 'active' | 'retired'
  notes: string | null
  renewal_months: number
  based_on: string | null
  published_at: string | null
  questions: SccaConfigQuestion[]
  weights: { scope: string, key: string, weight: number }[]
  thresholds: { kind: 'CIA' | 'POLOSS', level: number, min_score: number }[]
  matrix: { cia_level: number, poloss_level: number, category: string }[]
  recovery_standards: SccaConfigStandard[]
  lists: Record<SccaListName, SccaConfigItem[]>
  list_labels: Record<SccaListName, string>
  steps: SccaConfigStep[]
  rating_notes: SccaRatingNote[]
  /** DR decision: settings, DR type catalogue and system characteristics (Lampiran 8-10). */
  dr?: SccaDrConfig
}

/** Step titles and list labels from the configurations loaded so far (newest load wins). */
const registry = reactive({
  steps: {} as Record<string, { title: string, short: string }>,
  stepOrder: [] as string[],
  labels: {} as Record<string, Record<string, string>>,
})

export function rememberSccaConfig(config: SccaConfig | null | undefined) {
  if (!config) return
  for (const step of config.steps) registry.steps[step.code] = { title: step.title, short: step.short }
  if (config.status === 'active' || !registry.stepOrder.length) {
    registry.stepOrder = config.steps.map((step) => step.code)
  }
  for (const name of SCCA_LIST_NAMES) {
    const labels = (registry.labels[name] ??= {})
    for (const item of config.lists[name] ?? []) labels[item.code] = item.label
  }
}

export function registeredStep(code: string | null | undefined) {
  return code ? registry.steps[code] : undefined
}

/** Step codes of the active version in approval order (once a configuration has loaded). */
export function registeredStepOrder() {
  return registry.stepOrder
}

export function registeredLabel(name: SccaListName, code: string | null | undefined) {
  return code ? registry.labels[name]?.[code] : undefined
}

/** Select items for a list: the active items, plus the stored value if it was retired since. */
export function sccaListOptions(config: SccaConfig | null | undefined, name: SccaListName, current?: string | null) {
  const items = config?.lists[name] ?? []
  const options = items
    .filter((item) => item.active || item.code === current)
    .map((item) => ({ label: item.active ? item.label : `${item.label} (retired)`, value: item.code }))
  if (current && !options.some((option) => option.value === current)) {
    options.unshift({ label: current, value: current })
  }
  return options
}

export function sccaListItem(config: SccaConfig | null | undefined, name: SccaListName, code: string | null | undefined) {
  if (!code) return undefined
  return config?.lists[name]?.find((item) => item.code === code)
}

export function sccaListLabel(config: SccaConfig | null | undefined, name: SccaListName, code: string | null | undefined) {
  if (!code) return null
  return sccaListItem(config, name, code)?.label ?? registeredLabel(name, code) ?? code
}

/** Codes of the items whose rule `attr` is true, e.g. dependency `needs_workaround`. */
export function sccaCodesWith(config: SccaConfig | null | undefined, name: SccaListName, attr: string) {
  return (config?.lists[name] ?? []).filter((item) => item.attrs?.[attr]).map((item) => item.code)
}

export function sccaRenewalPeriod(months: number) {
  if (months % 12 === 0) {
    const years = months / 12
    return `${years} year${years === 1 ? '' : 's'}`
  }
  return `${months} months`
}

export const sccaSignerModes: Record<SccaSignerMode, { label: string, description: string }> = {
  chosen: { label: 'Chosen', description: 'The assessor picks the signer.' },
  default: { label: 'Default', description: 'The signer picked below is filled in on new SCCAs; the assessor can change it.' },
  fixed: { label: 'Fixed', description: 'The signer picked below signs every SCCA, applied at Submit; nobody on the SCCA changes it.' },
}
