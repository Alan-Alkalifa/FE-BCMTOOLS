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
export type SccaReason = (typeof SCCA_REASONS)[number]['value']

/** Workbook: "On Premises/ SaaS/ PaaS/ IaaS". The API stores On Premises as `On-premise`. */
export const SCCA_DEPLOYMENT_MODELS = [
  { value: 'On-premise', label: 'On Premises' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'PaaS', label: 'PaaS' },
  { value: 'IaaS', label: 'IaaS' },
] as const
export type SccaDeploymentModel = (typeof SCCA_DEPLOYMENT_MODELS)[number]['value']

export function deploymentModelLabel(value: string | null | undefined) {
  return SCCA_DEPLOYMENT_MODELS.find((item) => item.value === value)?.label ?? value ?? null
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
  return SCCA_REASONS.find((item) => item.value === reason)?.label ?? null
}

export const SCCA_OVERRIDE_TYPES = ['upgrade', 'downgrade'] as const
export type SccaOverrideType = (typeof SCCA_OVERRIDE_TYPES)[number]

export const SCCA_DIRECTIONS = [
  { value: 'upstream', label: 'Upstream systems', description: 'Systems that send data to this application.' },
  { value: 'downstream', label: 'Downstream systems', description: 'Systems that receive data from this application.' },
] as const
export type SccaDirection = (typeof SCCA_DIRECTIONS)[number]['value']

export const SCCA_DEPENDENCIES = ['Full', 'Partial', 'No'] as const
export type SccaDependency = (typeof SCCA_DEPENDENCIES)[number]

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

/** Lower is a tighter recovery point. NA is not a commitment. */
const RPO_RANK: Record<string, number> = { LST: 1, LDB: 2 }

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
): string {
  if (!row.system_name.trim()) return ''
  const gaps: string[] = []
  if (!row.criticality_category || !row.rto || !row.rpo || !row.dr_capacity.trim()) {
    gaps.push('Category, RTO, RPO or DR capacity is missing.')
  }
  if (row.dependency === 'Partial' && !row.workaround.trim()) {
    gaps.push('Partial dependency needs a workaround.')
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

function rpoIsWorse(committed: string, required: string): boolean {
  const requiredRank = RPO_RANK[required]
  if (requiredRank == null) return false
  const committedRank = RPO_RANK[committed]
  if (committedRank == null) return true
  return committedRank > requiredRank
}

/** Compares IT committed values with the business and regulatory requirements. */
export function recoveryGapMessages(
  it: RecoverySlice,
  business: RecoverySlice,
  regulatory: RecoverySlice,
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
  if (rpoIsWorse(it.rpo, business.rpo)) gaps.push('IT committed RPO is weaker than the business RPO.')
  if (rpoIsWorse(it.rpo, regulatory.rpo)) gaps.push('IT committed RPO is weaker than the regulatory RPO.')
  return gaps
}

function hourExceedsStandard(value: string, spec: string | null | undefined): boolean {
  if (!spec) return false
  const hours = firstNumber(value)
  const range = parseHourRange(spec)
  if (hours == null || !range) return false
  return hours > range.max
}

function availabilityBelowStandard(value: string, spec: string | null | undefined): boolean {
  if (!spec) return false
  const floor = standardUptimeFloor(spec)
  const actual = firstNumber(value)
  if (floor == null || actual == null) return false
  return actual < floor
}

/** Rigid check against the CIMBN recovery architecture standard for this category. Other is skipped. */
export function standardGapMessages(
  category: string | null | undefined,
  it: RecoverySlice,
  business: RecoverySlice,
  standard: { category: string, mtd: string | null, rto: string | null, uptime: string | null } | undefined,
): string[] {
  if (!category || category === 'Other' || !standard) return []
  const gaps: string[] = []
  if (hourExceedsStandard(it.rto, standard.rto)) {
    gaps.push(`IT committed RTO is outside the CIMBN standard for ${category} (${standard.rto}).`)
  }
  if (hourExceedsStandard(business.mtd, standard.mtd)) {
    gaps.push(`Business MTD is outside the CIMBN standard for ${category} (${standard.mtd}).`)
  }
  if (availabilityBelowStandard(it.availability_sla, standard.uptime)) {
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
  standards?: Array<{ category: string, mtd: string | null, rto: string | null, uptime: string | null }>
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
    }, committedRto)
    if (message) {
      const where = row.system_name.trim() || 'An interdependency'
      gaps.push(`${where} (${row.direction}): ${message}`)
    }
  }
  return gaps
}

export const SCCA_SIGNOFF_ROLES = [
  { value: 'system_user_lead', label: 'System user lead' },
  { value: 'it_support_pic', label: 'IT support PIC' },
  { value: 'enterprise_architecture', label: 'Enterprise architecture' },
  { value: 'service_level_mgmt', label: 'Service level management' },
  { value: 'app_owner_d2', label: 'Application owner (D-2)' },
  { value: 'app_owner_d1', label: 'Application owner (D-1)' },
  { value: 'it_support_approval', label: 'IT support approval' },
  { value: 'bcm_acknowledgement', label: 'BCM acknowledgement' },
] as const
export type SccaSignoffRole = (typeof SCCA_SIGNOFF_ROLES)[number]['value']

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

/** I4: the number of interfaces (systems on the A3 tab) gives the rating. */
export function interfaceRating(count: number) {
  if (count >= 40) return 5
  if (count >= 30) return 4
  if (count >= 20) return 3
  if (count >= 10) return 2
  return 1
}

/** A3: the highest category among systems with a Full dependency; 1 when there are none. */
export function interdependencyRating(rows: Array<{ dependency?: string | null, criticality_category?: string | null }>) {
  const ratings = rows
    .filter((row) => row.dependency === 'Full' && row.criticality_category)
    .map((row) => CATEGORY_RATING[row.criticality_category as SccaCategory] ?? 1)
  return ratings.length ? Math.max(...ratings) : 1
}

/**
 * The notes printed on SCC_Rating, as warnings. They don't block saving, as in the workbook:
 * - C1 Critical means C5 and P4 are Critical too.
 * - A3 is the highest category of the systems with a Full dependency on the A3 tab.
 * - I4 follows the number of interfaces on the A3 tab.
 */
export function ratingNoteWarnings(
  ratings: Record<string, number | undefined>,
  interdependencies: Array<{ dependency?: string | null, criticality_category?: string | null, system_name?: string }>,
): { code: string, message: string }[] {
  const warnings: { code: string, message: string }[] = []
  if (ratings.C1 === 5) {
    for (const code of ['C5', 'P4']) {
      if (ratings[code] != null && ratings[code] !== 5) {
        warnings.push({ code, message: `C1 is Critical, so ${code} should be Critical too.` })
      }
    }
  }
  const rows = interdependencies.filter((row) => (row.system_name ?? '').trim() !== '')
  if (rows.length) {
    const a3 = interdependencyRating(rows)
    if (ratings.A3 != null && ratings.A3 !== a3) {
      warnings.push({ code: 'A3', message: `The A3 tab suggests ${a3}: the highest category among systems with a Full dependency.` })
    }
    const i4 = interfaceRating(rows.length)
    if (ratings.I4 != null && ratings.I4 !== i4) {
      warnings.push({ code: 'I4', message: `The A3 tab lists ${rows.length} interface${rows.length === 1 ? '' : 's'}, which suggests ${i4}.` })
    }
  }
  return warnings
}
