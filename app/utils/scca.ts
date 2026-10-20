export const SCCA_CATEGORIES = ['Critical', 'Very Important', 'Important', 'Necessary', 'Other'] as const
export type SccaCategory = (typeof SCCA_CATEGORIES)[number]

export const sccaCategory = defineStatusScale<SccaCategory>({
  'Critical': { label: 'Critical', color: 'error', icon: 'i-lucide-octagon-alert' },
  'Very Important': { label: 'Very important', color: 'warning', icon: 'i-lucide-triangle-alert' },
  'Important': { label: 'Important', color: 'info', icon: 'i-lucide-info' },
  'Necessary': { label: 'Necessary', color: 'neutral', icon: 'i-lucide-circle-dot' },
  'Other': { label: 'Other', color: 'neutral', icon: 'i-lucide-circle-minus' },
})

/** 4 for Critical down to 0 for Other. */
export function categoryRank(category: SccaCategory) {
  return SCCA_CATEGORIES.length - 1 - SCCA_CATEGORIES.indexOf(category)
}

export type SccaDimension = 'C' | 'I' | 'A' | 'P'

export const SCCA_DIMENSIONS: { key: SccaDimension, label: string }[] = [
  { key: 'C', label: 'Confidentiality' },
  { key: 'I', label: 'Integrity' },
  { key: 'A', label: 'Availability' },
  { key: 'P', label: 'Potential loss' },
]

export const SCCA_REASONS = [
  { value: 'new_application', label: 'New application' },
  { value: 'annual_review', label: 'Annual review' },
  { value: 'system_change', label: 'System change' },
] as const
/** A reason code (V4.2: the 3 above; a configuration version can add more). */
export type SccaReason = string

/** Workbook: "On Premises/ SaaS/ PaaS/ IaaS". The API stores On Premises as `On-premise`. */
export const SCCA_DEPLOYMENT_MODELS = [
  { value: 'On-premise', label: 'On Premises' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'PaaS', label: 'PaaS' },
  { value: 'IaaS', label: 'IaaS' },
] as const
export type SccaDeploymentModel = (typeof SCCA_DEPLOYMENT_MODELS)[number]['value']

export function deploymentModelLabel(value: string | null | undefined) {
  return registeredLabel('deployment_model', value)
    ?? SCCA_DEPLOYMENT_MODELS.find((item) => item.value === value)?.label ?? value ?? null
}
export const SCCA_BUSINESS_DAYS = [
  { value: 'Mon-Fri', label: 'Mon–Fri' },
  { value: 'Mon-Sat', label: 'Mon–Sat' },
  { value: 'Mon-Sun', label: 'Mon–Sun' },
] as const
export const SCCA_BUSINESS_HOURS = [
  { value: '08-18', label: '08.00–18.00' },
  { value: '08-21', label: '08.00–21.00' },
  { value: '00-24', label: '00.00–24.00 (24×7)' },
] as const

export function reasonLabel(reason: string | null | undefined) {
  return registeredLabel('assessment_reason', reason)
    ?? SCCA_REASONS.find((item) => item.value === reason)?.label ?? reason ?? null
}

export const SCCA_OVERRIDE_TYPES = ['upgrade', 'downgrade'] as const
export type SccaOverrideType = (typeof SCCA_OVERRIDE_TYPES)[number]

export const SCCA_DIRECTIONS = [
  { value: 'upstream', label: 'Upstream systems', description: 'Systems that send data to this application.' },
  { value: 'downstream', label: 'Downstream systems', description: 'Systems that receive data from this application.' },
] as const
export type SccaDirection = (typeof SCCA_DIRECTIONS)[number]['value']

export const SCCA_DEPENDENCIES = ['Full', 'Partial', 'No'] as const
/** A dependency code (V4.2: Full, Partial, No). */
export type SccaDependency = string

export const SCCA_RECOVERY_KINDS = [
  { value: 'current_it', label: 'Current IT committed values' },
  { value: 'business', label: 'Business requirements' },
  { value: 'regulatory', label: 'Regulatory requirements' },
  { value: 'cimbn_standard', label: 'CIMBN recovery architecture standard' },
  { value: 'final', label: 'Final system characteristics' },
] as const
export type SccaRecoveryKind = (typeof SCCA_RECOVERY_KINDS)[number]['value']

export const SCCA_RECOVERY_FIELDS = [
  { key: 'availability_sla', label: 'Availability / SLA' },
  { key: 'mtd', label: 'MTD' },
  { key: 'rto', label: 'RTO' },
  { key: 'rpo', label: 'RPO' },
  { key: 'ha', label: 'HA (Prod / DR)' },
  { key: 'dr_capacity', label: 'DR capacity' },
  { key: 'instance_type', label: 'Instance (Shared / Different)' },
  { key: 'dr_type', label: 'DR type' },
] as const
export type SccaRecoveryField = (typeof SCCA_RECOVERY_FIELDS)[number]['key']

export type SccaRecoveryControl = 'percent' | 'hours' | 'rpo' | 'ha' | 'instance' | 'drType' | 'drCapacity'

export interface SccaRecoverySectionField {
  key: SccaRecoveryField
  label: string
  control: SccaRecoveryControl
}

export const SCCA_RECOVERY_SECTIONS: Record<SccaRecoveryKind, SccaRecoverySectionField[]> = {
  current_it: [
    { key: 'availability_sla', label: 'Availability / SLA (%)', control: 'percent' },
    { key: 'rto', label: 'RTO (hrs)', control: 'hours' },
    { key: 'rpo', label: 'RPO', control: 'rpo' },
    { key: 'ha', label: 'HA (Prod / DR)', control: 'ha' },
    { key: 'dr_capacity', label: 'DR capacity (%)', control: 'percent' },
    { key: 'instance_type', label: 'Instance (Shared / Different)', control: 'instance' },
  ],
  business: [
    { key: 'availability_sla', label: 'Availability / SLA (%)', control: 'percent' },
    { key: 'mtd', label: 'MTD', control: 'hours' },
    { key: 'rto', label: 'RTO (hrs)', control: 'hours' },
    { key: 'rpo', label: 'RPO', control: 'rpo' },
    { key: 'dr_capacity', label: 'DR capacity (%)', control: 'percent' },
  ],
  regulatory: [
    { key: 'mtd', label: 'MTD', control: 'hours' },
    { key: 'rto', label: 'RTO', control: 'hours' },
    { key: 'rpo', label: 'RPO', control: 'rpo' },
  ],
  cimbn_standard: [
    { key: 'availability_sla', label: 'Availability / SLA (%)', control: 'percent' },
    { key: 'rto', label: 'RTO', control: 'hours' },
    { key: 'rpo', label: 'RPO', control: 'rpo' },
    { key: 'ha', label: 'HA (Prod / DR)', control: 'ha' },
    { key: 'dr_capacity', label: 'DR capacity (%)', control: 'percent' },
    { key: 'dr_type', label: 'DR type', control: 'drType' },
  ],
  final: [
    { key: 'availability_sla', label: 'Availability / SLA (%)', control: 'percent' },
    { key: 'mtd', label: 'MTD', control: 'hours' },
    { key: 'rto', label: 'RTO', control: 'hours' },
    { key: 'rpo', label: 'RPO', control: 'rpo' },
    { key: 'ha', label: 'HA (Prod / DR)', control: 'ha' },
    { key: 'dr_capacity', label: 'DR capacity (%)', control: 'drCapacity' },
  ],
}

/** 1–24 h, plus 36/48/72 h so the Necessary (24–48 h) and Other (> 48 h) MTD bands fit. Matches the API. */
export const SCCA_HOURS = [...Array.from({ length: 24 }, (_, index) => index + 1), 36, 48, 72]

export const SCCA_HOUR_OPTIONS = [
  { label: 'NA', value: 'NA' },
  ...SCCA_HOURS.map((hours) => ({ label: `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`, value: String(hours) })),
]

export function hourOptions(current: string) {
  if (current && !SCCA_HOUR_OPTIONS.some((option) => option.value === current)) {
    return [{ label: current, value: current }, ...SCCA_HOUR_OPTIONS]
  }
  return [...SCCA_HOUR_OPTIONS]
}

/** Keeps a percentage between 0 and 100. An empty value stays empty. */
export function clampPercent(value: string | number | null | undefined): string {
  if (value == null) return ''
  const text = String(value).replace('%', '').trim()
  if (text === '') return ''
  if (text === '.' || /^\d+\.$/.test(text)) {
    const head = Number(text.replace('.', ''))
    return head > 100 ? '100' : text
  }
  const number = Number(text)
  if (!Number.isFinite(number)) return ''
  if (number < 0) return '0'
  if (number > 100) return '100'
  return text
}

export const SCCA_RPO_OPTIONS = ['LDB', 'NA', 'LST'] as const
export const SCCA_HA_OPTIONS = ['Yes (Prod)', 'Active - Active', 'Active - Passive', 'No'] as const
export const SCCA_INSTANCE_OPTIONS = ['Shared', 'Different'] as const
export const SCCA_DR_TYPE_OPTIONS = ['Hot DR', 'Warm DR', 'Cold DR'] as const
export const SCCA_DR_CAPACITY_OPTIONS = ['100%', '50% - 50%', 'NA'] as const

export function optionsWith(current: string, options: readonly string[]) {
  return current && !options.includes(current) ? [current, ...options] : [...options]
}

/** Lower is a tighter recovery point. NA is not a commitment. (V4.2; a configuration's
 * RPO items carry their own `rank`.) */
const RPO_RANK: Record<string, number> = { LST: 1, LDB: 2 }

function rpoRanks(config?: SccaConfig | null): Record<string, number> {
  if (!config?.lists?.rpo) return RPO_RANK
  return Object.fromEntries(
    config.lists.rpo.filter((item) => item.attrs?.rank != null).map((item) => [item.code, Number(item.attrs.rank)]),
  )
}

export function firstNumber(value: string): number | null {
  const match = value.match(/\d+(?:\.\d+)?/)
  if (!match) return null
  const number = Number(match[0])
  return Number.isFinite(number) ? number : null
}

export function interdependencyGap(
  row: {
    system_name: string
    criticality_category?: string
    rto: string
    rpo: string
    dr_capacity: string
    dependency?: string
    workaround: string
  },
  committedRto: string,
  config?: SccaConfig | null,
): string {
  if (!row.system_name.trim()) return ''
  const gaps: string[] = []
  if (!row.criticality_category || !row.rto || !row.rpo || !row.dr_capacity.trim()) {
    gaps.push('Category, RTO, RPO or DR capacity is missing.')
  }
  const workaround = config?.lists?.dependency ? sccaCodesWith(config, 'dependency', 'needs_workaround') : ['Partial']
  if (row.dependency && workaround.includes(row.dependency) && !row.workaround.trim()) {
    const label = config ? sccaListLabel(config, 'dependency', row.dependency) : row.dependency
    gaps.push(`${label} dependency needs a workaround.`)
  }
  const rowRto = firstNumber(row.rto)
  const committed = firstNumber(committedRto)
  if (rowRto != null && committed != null && rowRto > committed) {
    gaps.push(`RTO ${rowRto} h is longer than the committed RTO of ${committed} h.`)
  }
  return gaps.join(' ')
}

export function parseHourRange(spec: string): { min: number, max: number } | null {
  const greater = spec.match(/>\s*(\d+(?:\.\d+)?)/)
  if (greater) {
    const min = Number(greater[1])
    return Number.isFinite(min) ? { min, max: Number.POSITIVE_INFINITY } : null
  }
  const span = spec.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
  if (!span) return null
  const min = Number(span[1])
  const max = Number(span[2])
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null
}

/** Upper bound of a standard hour range, used when filling a single RTO/MTD value. */
export function standardHourValue(spec: string): string {
  const range = parseHourRange(spec)
  if (!range || !Number.isFinite(range.max)) return ''
  return String(range.max)
}

/** Minimum uptime for a rigid check. "95% atau kurang" and "Not applicable" have none. */
export function standardUptimeFloor(spec: string): number | null {
  if (/not applicable|atau kurang/i.test(spec)) return null
  return firstNumber(spec)
}

interface RecoverySlice {
  availability_sla: string
  mtd: string
  rto: string
  rpo: string
  dr_capacity: string
}

function hoursAreWorse(committed: string, required: string, higherIsBetter: boolean): boolean {
  const left = firstNumber(committed)
  const right = firstNumber(required)
  if (left == null || right == null) return false
  return higherIsBetter ? left < right : left > right
}

function rpoIsWorse(committed: string, required: string, config?: SccaConfig | null): boolean {
  const ranks = rpoRanks(config)
  const requiredRank = ranks[required]
  if (requiredRank == null) return false
  const committedRank = ranks[committed]
  if (committedRank == null) return true
  return committedRank > requiredRank
}

/** Compares IT committed values with the business and regulatory requirements. */
export function recoveryGapMessages(
  it: RecoverySlice,
  business: RecoverySlice,
  regulatory: RecoverySlice,
  config?: SccaConfig | null,
): string[] {
  const gaps: string[] = []
  if (hoursAreWorse(it.rto, business.rto, false)) gaps.push('IT committed RTO is longer than the business RTO.')
  if (hoursAreWorse(it.rto, regulatory.rto, false)) gaps.push('IT committed RTO is longer than the regulatory RTO.')
  if (hoursAreWorse(business.rto, regulatory.rto, false)) gaps.push('Business RTO is longer than the regulatory RTO.')
  if (hoursAreWorse(business.mtd, regulatory.mtd, false)) gaps.push('Business MTD is longer than the regulatory MTD.')
  if (hoursAreWorse(it.availability_sla, business.availability_sla, true)) {
    gaps.push('IT committed availability is below the business SLA.')
  }
  if (hoursAreWorse(it.dr_capacity, business.dr_capacity, true)) {
    gaps.push('IT committed DR capacity is below the business requirement.')
  }
  if (rpoIsWorse(it.rpo, business.rpo, config)) gaps.push('IT committed RPO is weaker than the business RPO.')
  if (rpoIsWorse(it.rpo, regulatory.rpo, config)) gaps.push('IT committed RPO is weaker than the regulatory RPO.')
  return gaps
}

function hourExceedsStandard(value: string, spec: string | null | undefined, upper?: number | null): boolean {
  if (upper != null) {
    const hours = firstNumber(value)
    return hours != null && hours > upper
  }
  if (!spec) return false
  const hours = firstNumber(value)
  const range = parseHourRange(spec)
  if (hours == null || !range) return false
  return hours > range.max
}

function availabilityBelowStandard(value: string, spec: string | null | undefined, minimum?: number | null): boolean {
  if (minimum == null && !spec) return false
  const floor = minimum ?? standardUptimeFloor(spec ?? '')
  const actual = firstNumber(value)
  if (floor == null || actual == null) return false
  return actual < floor
}

/** Rigid check against the CIMBN recovery architecture standard for this category. Other is skipped. */
export function standardGapMessages(
  category: string | null | undefined,
  it: RecoverySlice,
  business: RecoverySlice,
  standard: SccaConfigStandard | undefined,
): string[] {
  if (!category || category === 'Other' || !standard) return []
  const gaps: string[] = []
  if (hourExceedsStandard(it.rto, standard.rto, standard.rto_to_h)) {
    gaps.push(`IT committed RTO is outside the CIMBN standard for ${category} (${standard.rto}).`)
  }
  if (hourExceedsStandard(business.mtd, standard.mtd, standard.mtd_to_h)) {
    gaps.push(`Business MTD is outside the CIMBN standard for ${category} (${standard.mtd}).`)
  }
  if (availabilityBelowStandard(it.availability_sla, standard.uptime, standard.uptime_min_pct)) {
    gaps.push(`IT committed availability is below the CIMBN standard of ${standard.uptime}.`)
  }
  return gaps
}

type RecoverySliceInput = Partial<Record<keyof RecoverySlice, string | null | undefined>>

function recoverySlice(row?: RecoverySliceInput | null): RecoverySlice {
  return {
    availability_sla: row?.availability_sla ?? '',
    mtd: row?.mtd ?? '',
    rto: row?.rto ?? '',
    rpo: row?.rpo ?? '',
    dr_capacity: row?.dr_capacity ?? '',
  }
}

/** Recovery and interdependency gap lines to show again on the result tab. */
export function previousTabGapMessages(input: {
  missingAnswers?: string[]
  recoveryValues?: Array<{ kind: string } & RecoverySliceInput>
  category?: string | null
  standards?: SccaConfigStandard[]
  config?: SccaConfig | null
  interdependencies?: Array<{
    direction: string
    system_name: string
    criticality_category?: string | null
    rto?: string | null
    rpo?: string | null
    dr_capacity?: string | null
    dependency?: string | null
    workaround?: string | null
  }>
}): string[] {
  const gaps: string[] = []
  const missing = input.missingAnswers?.length ?? 0
  if (missing) {
    gaps.push(`Rating is incomplete. ${missing} question${missing === 1 ? '' : 's'} still need a rating.`)
  }

  const byKind = Object.fromEntries((input.recoveryValues ?? []).map((row) => [row.kind, row]))
  gaps.push(
    ...recoveryGapMessages(
      recoverySlice(byKind.current_it),
      recoverySlice(byKind.business),
      recoverySlice(byKind.regulatory),
      input.config,
    ),
    ...standardGapMessages(
      input.category,
      recoverySlice(byKind.current_it),
      recoverySlice(byKind.business),
      input.standards?.find((row) => row.category === input.category),
    ),
  )

  const committedRto = byKind.current_it?.rto ?? ''
  for (const row of input.interdependencies ?? []) {
    const message = interdependencyGap({
      system_name: row.system_name,
      criticality_category: row.criticality_category ?? undefined,
      rto: row.rto ?? '',
      rpo: row.rpo ?? '',
      dr_capacity: row.dr_capacity ?? '',
      dependency: row.dependency ?? undefined,
      workaround: row.workaround ?? '',
    }, committedRto, input.config)
    if (message) {
      const where = row.system_name.trim() || 'An interdependency'
      gaps.push(`${where} (${row.direction}): ${message}`)
    }
  }
  return gaps
}

/** Sign-off steps in approval order, titled as on the SCC_Result form. The BCM reviewer step
 * is added by BCM Tools after the IT Support PIC; at that step only the BCM reviewer can comment on
 * the tabs other than Result and sign-off. */
export const SCCA_SIGNOFF_ROLES = [
  { value: 'system_user_lead', label: 'Assessment by System User / User Lead', short: 'User Lead' },
  { value: 'it_support_pic', label: 'Assessment by IT Support PIC', short: 'IT Support PIC' },
  { value: 'bcm_reviewer', label: 'Reviewed by BCM Reviewer', short: 'BCM Reviewer' },
  { value: 'enterprise_architecture', label: 'Reviewed by Enterprise Architecture', short: 'Enterprise Architecture' },
  { value: 'service_level_mgmt', label: 'Reviewed by Service Level Mgt.', short: 'Service Level Mgt.' },
  { value: 'app_owner_d2', label: 'Approved by Application Owner / Business Unit D-2', short: 'App Owner D-2' },
  { value: 'app_owner_d1', label: 'Approved by Application Owner / Business Unit D-1', short: 'App Owner D-1' },
  { value: 'it_support_approval', label: 'Approved by IT Support', short: 'IT Support' },
  { value: 'bcm_acknowledgement', label: 'Acknowledged by BCM', short: 'BCM' },
] as const
/** A step code. V4.2 has the 9 above; a configuration version can add or rename steps. */
export type SccaSignoffRole = string

/** "5-CIA" / "4-PoLoss", as the workbook writes the levels. */
export function sccaLevelLabel(level: number | null | undefined, kind: 'CIA' | 'POLOSS') {
  if (!level) return null
  return kind === 'CIA' ? `${level}-CIA` : `${level}-PoLoss`
}

const CATEGORY_RATING: Record<SccaCategory, number> = {
  'Critical': 5,
  'Very Important': 4,
  'Important': 3,
  'Necessary': 2,
  'Other': 1,
}

/** I4: the number of interfaces (systems on the A3 tab) gives the rating. `from` holds the
 * counts where ratings 2, 3, 4 and 5 start (V4.2: 10, 20, 30, 40). */
export function interfaceRating(count: number, from: number[] = [10, 20, 30, 40]) {
  let rating = 1
  from.forEach((start, index) => {
    if (count >= start) rating = index + 2
  })
  return rating
}

/** A3: the highest category among systems with a dependency that counts (V4.2: Full); 1 when
 * there are none. A configuration gives each category its `a3_rating`. */
export function interdependencyRating(
  rows: Array<{ dependency?: string | null, criticality_category?: string | null }>,
  config?: SccaConfig | null,
) {
  const counts = config?.lists?.dependency ? sccaCodesWith(config, 'dependency', 'counts_for_a3') : ['Full']
  const rating = (category: string) => {
    const configured = sccaListItem(config, 'category', category)?.attrs?.a3_rating
    return configured != null ? Number(configured) : (CATEGORY_RATING[category as SccaCategory] ?? 1)
  }
  const ratings = rows
    .filter((row) => row.dependency && counts.includes(row.dependency) && row.criticality_category)
    .map((row) => rating(row.criticality_category!))
  return ratings.length ? Math.max(...ratings) : 1
}

const DEFAULT_NOTES: SccaRatingNote[] = [
  { kind: 'follows', params: { question: 'C1', rating: 5, then: ['C5', 'P4'] } },
  { kind: 'a3', params: { question: 'A3' } },
  { kind: 'i4', params: { question: 'I4', from: [10, 20, 30, 40] } },
]
const RATING_WORDS: Record<number, string> = { 5: 'Critical', 4: 'High', 3: 'Medium', 2: 'Low', 1: 'Insignificant' }

/**
 * The notes printed on SCC_Rating, as warnings. They don't block saving, as in the workbook:
 * - C1 Critical means C5 and P4 are Critical too.
 * - A3 is the highest category of the systems with a Full dependency on the A3 tab.
 * - I4 follows the number of interfaces on the A3 tab.
 */
export function ratingNoteWarnings(
  ratings: Record<string, number | undefined>,
  interdependencies: Array<{ dependency?: string | null, criticality_category?: string | null, system_name?: string }>,
  config?: SccaConfig | null,
): { code: string, message: string }[] {
  const warnings: { code: string, message: string }[] = []
  const notes = config?.rating_notes ?? DEFAULT_NOTES
  const rows = interdependencies.filter((row) => (row.system_name ?? '').trim() !== '')
  const counted = config?.lists?.dependency
    ? sccaCodesWith(config, 'dependency', 'counts_for_a3').map((code) => sccaListLabel(config, 'dependency', code)).join(' or ')
    : 'Full'
  for (const note of notes) {
    const question = note.params.question
    if (note.kind === 'follows') {
      if (ratings[question] !== note.params.rating) continue
      const word = RATING_WORDS[note.params.rating] ?? String(note.params.rating)
      for (const code of note.params.then) {
        if (ratings[code] != null && ratings[code] !== note.params.rating) {
          warnings.push({ code, message: `${question} is ${word}, so ${code} should be ${word} too.` })
        }
      }
    } else if (note.kind === 'a3' && rows.length) {
      const a3 = interdependencyRating(rows, config)
      if (ratings[question] != null && ratings[question] !== a3) {
        warnings.push({ code: question, message: `The A3 tab suggests ${a3}: the highest category among systems with a ${counted} dependency.` })
      }
    } else if (note.kind === 'i4' && rows.length) {
      const i4 = interfaceRating(rows.length, note.params.from)
      if (ratings[question] != null && ratings[question] !== i4) {
        warnings.push({ code: question, message: `The A3 tab lists ${rows.length} interface${rows.length === 1 ? '' : 's'}, which suggests ${i4}.` })
      }
    }
  }
  return warnings
}

export function signoffRoleLabel(role: string | null | undefined, short = false) {
  const configured = registeredStep(role)
  if (configured) return short ? configured.short : configured.title
  const found = SCCA_SIGNOFF_ROLES.find((item) => item.value === role)
  if (!found) return role ?? ''
  return short ? found.short : found.label
}

/** Who wrote a comment: a sign-off step, the assessor, the contributor or an admin. */
export function commentRoleLabel(role: string | null | undefined) {
  if (role === 'assessor') return 'Assessor'
  if (role === 'contributor') return 'Contributor'
  if (role === 'admin') return 'BCM admin'
  return signoffRoleLabel(role, true)
}

export const SCCA_STATUSES = ['draft', 'in_approval', 'final'] as const
export type SccaStatus = (typeof SCCA_STATUSES)[number]

export const sccaStatus = defineStatusScale<SccaStatus>({
  draft: { label: 'Draft', color: 'neutral', icon: 'i-lucide-file-pen' },
  in_approval: { label: 'In approval', color: 'warning', icon: 'i-lucide-hourglass' },
  final: { label: 'Final', color: 'success', icon: 'i-lucide-badge-check' },
})

export type SccaSignoffStatus = 'pending' | 'approved' | 'rejected'

export const sccaSignoffStatus = defineStatusScale<SccaSignoffStatus>({
  pending: { label: 'Pending', color: 'neutral', icon: 'i-lucide-clock' },
  approved: { label: 'Approved', color: 'success', icon: 'i-lucide-circle-check' },
  rejected: { label: 'Rejected', color: 'error', icon: 'i-lucide-circle-x' },
})

/** Editor tabs; comments are attached to one of them. */
export const SCCA_TABS = [
  { value: 'details', label: 'Application' },
  { value: 'rating', label: 'Rating' },
  { value: 'interdependencies', label: 'Interdependencies' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'result', label: 'Result and sign-off' },
] as const
export type SccaTab = (typeof SCCA_TABS)[number]['value']
