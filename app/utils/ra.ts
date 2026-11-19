/**
 * Risk Assessment Location (RA): the LRP scorecard. Two workbooks share the module, told apart by
 * the kind: the HO workbook (RA, office buildings) and the Cabang workbook (RA Branch).
 */

import type { RaCrisis, RaCrisisType, RaMapMarker } from '~/composables/useRa'

export type RaKind = 'head_office' | 'branch'

export const RA_LEVELS = ['Low', 'Medium', 'High'] as const
export type RaLevel = (typeof RA_LEVELS)[number]

/** Ordered severity (design system: neutral → info → warning → error). Never brand red. */
export const raRiskLevel = defineStatusScale<RaLevel | 'na'>({
  Low: { label: 'Low', color: 'info', icon: 'i-lucide-circle-dot' },
  Medium: { label: 'Medium', color: 'warning', icon: 'i-lucide-triangle-alert' },
  High: { label: 'High', color: 'error', icon: 'i-lucide-octagon-alert' },
  na: { label: 'Not applicable', color: 'neutral', icon: 'i-lucide-circle-minus' },
})

/** Whether every hazard is rated without open issues (what submitting for sign-off needs). */
export const raCompletion = defineStatusScale({
  complete: { label: 'Complete', color: 'success', icon: 'i-lucide-circle-check' },
  draft: { label: 'Incomplete', color: 'neutral', icon: 'i-lucide-circle-dashed' },
})

/** An RA's status, in SCCA's words and colours (`sccaStatus`): Draft, In approval, Final. A
 *  returned RA is a draft again (status `draft`): Need revision until its assessor accepts the
 *  return (it can't be edited before), then In revision. */
export type RaStatus = 'draft' | 'in_signoff' | 'approved'
export const RA_STATUSES: RaStatus[] = ['draft', 'in_signoff', 'approved']
/** A returned draft: waiting for its assessor to accept the return, or accepted. */
export type RaRevisionState = 'need_revision' | 'in_revision'
/** What a status badge shows: the status, or Need revision / In revision for a returned draft. */
export type RaStatusKey = RaStatus | RaRevisionState
export const raStatus = defineStatusScale<RaStatusKey>({
  draft: { label: 'Draft', color: 'neutral', icon: 'i-lucide-file-pen' },
  need_revision: { label: 'Need revision', color: 'error', icon: 'i-lucide-undo-2' },
  in_revision: { label: 'In revision', color: 'warning', icon: 'i-lucide-pencil-line' },
  in_signoff: { label: 'In approval', color: 'warning', icon: 'i-lucide-hourglass' },
  approved: { label: 'Final', color: 'success', icon: 'i-lucide-badge-check' },
})

/** The scale key of an RA's status: Need revision / In revision for a returned draft. */
export function raStatusKey(item: { status: RaStatus, is_returned?: boolean, revision_state?: RaRevisionState | null }): RaStatusKey {
  if (item.status !== 'draft') return item.status
  return item.revision_state ?? (item.is_returned ? 'in_revision' : 'draft')
}

/** As SCCA's New application: a New building's assessment date can be earlier than today (back
 *  date), but not in an earlier year (no back year). The API says the same. */
export function raNewBuildingDateProblem(reason: string | null | undefined, date: string | null | undefined, todayIso = raTodayIso()) {
  if (reason !== 'new_building' || !date) return null
  const year = todayIso.slice(0, 4)
  return date.slice(0, 4) < year
    ? `A new building's assessment date can be earlier this year, but not before 1 Jan ${year}.`
    : null
}

export const RA_PHONE_EXAMPLE = '0813 1226 2739'

/** The location incident team's mobile numbers (LIC, LICOM) are phone numbers, never a note
 *  (the recovery team and call tree take notes instead): digits with spaces, brackets, dots or
 *  dashes and an optional leading +, 8 to 15 digits. The API checks the same. */
export function raPhoneProblem(value: string | null | undefined) {
  const text = (value ?? '').trim()
  if (!/^\+?[0-9 ().-]+$/.test(text)) return `Use digits only, e.g. ${RA_PHONE_EXAMPLE}. Spaces, + ( ) and - are allowed.`
  const digits = text.replace(/\D/g, '').length
  if (digits < 8 || digits > 15) return `A phone number has 8 to 15 digits, e.g. ${RA_PHONE_EXAMPLE}.`
  return null
}

/** A number to prefill (a profile's mobile), or '' when it isn't a phone number ("-"). */
export function raPhoneOrEmpty(value: string | null | undefined) {
  return value && !raPhoneProblem(value) ? value.trim() : ''
}

/** Today in WIB, as YYYY-MM-DD. */
export function raTodayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

/** A status column: the badges centred under a centred header (as SCCA's lists). */
export const RA_STATUS_COLUMN = { class: { th: 'text-center', td: 'text-center' } }

/** "N/A", 1–5, or null while not filled in. Matches the API. */
export type RaRatingValue = 'N/A' | 1 | 2 | 3 | 4 | 5 | null

export const RA_IMPACTS = [
  { key: 'monetary', label: 'Monetary' },
  { key: 'human', label: 'Human' },
  { key: 'reputation', label: 'Reputation' },
  { key: 'infrastructure', label: 'Infrastructure' },
] as const
export type RaImpact = (typeof RA_IMPACTS)[number]['key']
export type RaGuideScale = 'historical' | 'probability' | RaImpact

export const RA_GROSS_FIELDS = [
  { key: 'historical', label: 'Historical occurrence', scale: 'historical' },
  { key: 'probability', label: 'Probability of occurrence', scale: 'probability' },
  ...RA_IMPACTS.map((impact) => ({ key: impact.key, label: `${impact.label} impact`, scale: impact.key })),
] as const

export const RA_RESIDUAL_FIELDS = [
  { key: 'residual_probability', label: 'Probability', scale: 'probability' },
  { key: 'residual_monetary', label: 'Monetary impact', scale: 'monetary' },
  { key: 'residual_human', label: 'Human impact', scale: 'human' },
  { key: 'residual_reputation', label: 'Reputation impact', scale: 'reputation' },
  { key: 'residual_infrastructure', label: 'Infrastructure impact', scale: 'infrastructure' },
] as const

export type RaRatingField = (typeof RA_GROSS_FIELDS)[number]['key'] | (typeof RA_RESIDUAL_FIELDS)[number]['key']
export const RA_RATING_FIELDS: RaRatingField[] = [
  ...RA_GROSS_FIELDS.map((field) => field.key),
  ...RA_RESIDUAL_FIELDS.map((field) => field.key),
]

/** RA Branch rates one risk: probability (column J) and the impacts after mitigation (column O). */
export const RA_BRANCH_PROBABILITY_FIELDS = RA_GROSS_FIELDS.slice(0, 2)
export const RA_BRANCH_IMPACT_FIELDS = RA_RESIDUAL_FIELDS.slice(1)

/** The rating inputs each kind asks for (the API's `formula.inputs`). */
export const RA_KIND_INPUTS: Record<RaKind, RaRatingField[]> = {
  head_office: RA_RATING_FIELDS,
  branch: [...RA_BRANCH_PROBABILITY_FIELDS, ...RA_BRANCH_IMPACT_FIELDS].map((field) => field.key),
}

/** The workbook's sign-off steps. RA configuration can add, remove, reorder and rename them per
 *  version (`formula.signoff_steps`, see raRoleOptions). As SCCA's steps, the label is the step's
 *  title and the hint its short name (who signs). */
export const RA_SIGNOFF_ROLES = [
  { value: 'prepared_by', label: 'Prepared by Location Incident Coordinator (LIC)', hint: 'LIC' },
  { value: 'acknowledged_by_unit', label: 'Acknowledged by Unit Critical Business Function', hint: 'Unit Critical Business Function' },
  { value: 'reviewed_by', label: 'Reviewed by Alternate Location Incident Commander (LICOM)', hint: 'LICOM' },
  { value: 'acknowledged_by_bcm', label: 'Acknowledged by Business Continuity Management Head', hint: 'BCM Head' },
] as const

/** Who picks the signer of the workbook's steps when a version has none stored: the LIC prepares,
 *  the LICOM reviews, the others are chosen. */
export const RA_DEFAULT_SIGNER_MODES: Partial<Record<string, RaSignerMode>> = { prepared_by: 'lic', reviewed_by: 'licom' }

/** Who picks a step's signer, as RA configuration and the Sign-off tab describe it. */
export const raSignerModes: Record<RaSignerMode, { label: string, description: string }> = {
  chosen: { label: 'Chosen', description: 'The assessor picks the signer on the Sign-off tab.' },
  default: { label: 'Default', description: 'The signer picked below is filled in on new RAs. The assessor can change it.' },
  fixed: { label: 'Fixed', description: 'The signer picked below signs every RA. It is put on the step at Submit and nobody on the RA changes it.' },
  lic: { label: 'The LIC', description: 'The location incident coordinator picked on the Details tab.' },
  licom: { label: 'The LICOM', description: 'The location incident commander picked on the Details tab.' },
}

/** Sign-off row of the branch workbook: prepared by the BOSM, approved by the BM, reviewed by the NRSOH. */
export const RA_BRANCH_SIGNOFF_ROLES = [
  { value: 'prepared_by', label: 'Prepared by BOSM', hint: 'BOSM' },
  { value: 'approved_by', label: 'Approved by Branch Manager (BM)', hint: 'Branch Manager' },
  { value: 'reviewed_by', label: 'Reviewed by NRSOH', hint: 'NRSOH' },
] as const

/** A sign-off step code: the workbook's (prepared_by, …) or one RA configuration added. */
export type RaSignoffRole = string

/** Who picks a sign-off step's signer (like SCCA's): chosen on the Sign-off tab, a default
 *  filled in on a new RA, a fixed signer put on the step at Submit, or the LIC / LICOM of the
 *  Details tab. */
export type RaSignerMode = 'chosen' | 'default' | 'fixed' | 'lic' | 'licom'
/** When a step signs: always, or only on an RA whose building is new and waiting for approval. */
export type RaStepCondition = 'always' | 'building_pending'
export const RA_STEP_CONDITIONS: { value: RaStepCondition, label: string, description: string }[] = [
  { value: 'always', label: 'Always', description: 'Signs every RA.' },
  {
    value: 'building_pending',
    label: 'Building waiting for approval',
    description: 'Signs only an RA whose building is new and waiting for approval, always first, before the other steps. Without such a step, that RA can\'t be submitted until the building is approved.',
  },
]

export interface RaSignoffRoleOption {
  value: RaSignoffRole
  label: string
  hint: string
  /** Who picks the signer and whether the step is required (RA configuration). */
  mode?: RaSignerMode
  mandatory?: boolean
}

/** Everything that differs between RA and RA Branch on screen. The API decides the rules. */
export interface RaModule {
  kind: RaKind
  /** Route prefix: `/ra` or `/ra-branch`. */
  base: string
  /** Crumb and page title. */
  title: string
  description: string
  /** The building register: "Building" / "Branch". */
  location: { single: string, plural: string, lower: string, lowerPlural: string }
  refPrefix: string
  /** Gross and residual risk (HO), or one residual risk (branch). */
  singleRisk: boolean
  /** The LCP profile tabs: occupants, recovery team, call tree. */
  hasLcp: boolean
  hasRegion: boolean
  lic: { label: string, hint: string }
  licom: { label: string, hint: string }
  signoffRoles: readonly RaSignoffRoleOption[]
  /** RA (head office) and RA Branch are granted separately: ra.* and ra_branch.*. */
  perm: { access: string, edit: string, manage: string }
}

/** Either side opens the shared Location pages (buildings, map, disasters, guidebook). */
export const RA_ANY_ACCESS = ['ra.access', 'ra_branch.access']
export const RA_ANY_EDIT = ['ra.edit', 'ra_branch.edit']
export const RA_ANY_MANAGE = ['ra.manage', 'ra_branch.manage']

export const RA_MODULES: Record<RaKind, RaModule> = {
  head_office: {
    kind: 'head_office',
    base: '/ra',
    // "RA HO" beside "RA Branch": the menu group, page titles and breadcrumbs.
    title: 'RA HO',
    description: 'Location risk assessment for an office building.',
    location: { single: 'Building', plural: 'Buildings', lower: 'building', lowerPlural: 'buildings' },
    refPrefix: 'RA',
    singleRisk: false,
    hasLcp: true,
    hasRegion: false,
    lic: { label: 'Location incident coordinator (LIC)', hint: 'The assessor: whoever makes the RA.' },
    licom: { label: 'Location incident commander (LICOM) / alternate', hint: '' },
    signoffRoles: RA_SIGNOFF_ROLES,
    perm: { access: 'ra.access', edit: 'ra.edit', manage: 'ra.manage' },
  },
  branch: {
    kind: 'branch',
    base: '/ra-branch',
    title: 'RA Branch',
    description: 'Location risk assessment for a branch.',
    location: { single: 'Branch', plural: 'Branches', lower: 'branch', lowerPlural: 'branches' },
    refPrefix: 'RAB',
    singleRisk: true,
    hasLcp: true,
    hasRegion: true,
    lic: { label: 'Location incident coordinator (LIC)', hint: 'The assessor (the BOSM), with a WhatsApp number.' },
    licom: { label: 'Location incident commander (LICOM) / alternate', hint: 'The NRSOH, with a WhatsApp number.' },
    signoffRoles: RA_BRANCH_SIGNOFF_ROLES,
    perm: { access: 'ra_branch.access', edit: 'ra_branch.edit', manage: 'ra_branch.manage' },
  },
}

export const RA_CONTACT_KINDS = [
  { value: 'floor_warden', label: 'Floor wardens', single: 'Floor warden' },
  { value: 'hospital', label: 'Hospitals', single: 'Hospital' },
  { value: 'police', label: 'Police', single: 'Police station' },
  { value: 'fire_brigade', label: 'Fire brigade', single: 'Fire brigade' },
  { value: 'other', label: 'Other contacts', single: 'Contact' },
] as const
export type RaContactKind = (typeof RA_CONTACT_KINDS)[number]['value']

export interface RaHazardResult {
  gross_probability: number | null
  gross_impact: number | null
  gross_level: RaLevel | null
  residual_probability: number | null
  residual_impact: number | null
  residual_level: RaLevel | null
  is_rated: boolean
}

export interface RaIssue {
  field: string
  message: string
}

type RaInputs = Partial<Record<RaRatingField, RaRatingValue>>

/** Like Excel's MAX: N/A is ignored, all N/A is 0, any blank leaves the rating empty. */
export function raCombine(values: RaRatingValue[]): number | null {
  if (values.some((value) => value === null || value === undefined)) return null
  const numbers = values.filter((value): value is 1 | 2 | 3 | 4 | 5 => value !== 'N/A')
  return numbers.length ? Math.max(...numbers) : 0
}

export function raLevelAt(matrix: Map<string, RaLevel>, probability: number | null, impact: number | null) {
  if (!probability || !impact) return null
  return matrix.get(`${probability}-${impact}`) ?? null
}

/** Client mirror of the API calculator, for instant feedback while rating. The API stays authoritative. */
export function raRateHazard(inputs: RaInputs, matrix: Map<string, RaLevel>, kind: RaKind = 'head_office'): RaHazardResult {
  const get = (key: RaRatingField) => inputs[key] ?? null
  if (kind === 'branch') {
    const probability = raCombine(RA_BRANCH_PROBABILITY_FIELDS.map((field) => get(field.key)))
    const impact = raCombine(RA_BRANCH_IMPACT_FIELDS.map((field) => get(field.key)))
    return {
      gross_probability: null,
      gross_impact: null,
      gross_level: null,
      residual_probability: probability,
      residual_impact: impact,
      residual_level: raLevelAt(matrix, probability, impact),
      is_rated: probability !== null && impact !== null,
    }
  }
  const grossProbability = raCombine([get('historical'), get('probability')])
  const grossImpact = raCombine(RA_IMPACTS.map((impact) => get(impact.key)))
  const residualProbability = raCombine([get('residual_probability')])
  const residualImpact = raCombine(RA_RESIDUAL_FIELDS.slice(1).map((field) => get(field.key)))
  return {
    gross_probability: grossProbability,
    gross_impact: grossImpact,
    gross_level: raLevelAt(matrix, grossProbability, grossImpact),
    residual_probability: residualProbability,
    residual_impact: residualImpact,
    residual_level: raLevelAt(matrix, residualProbability, residualImpact),
    is_rated: [grossProbability, grossImpact, residualProbability, residualImpact].every((value) => value !== null),
  }
}

function blank(text: string | null | undefined) {
  return !text || !text.trim()
}

/** Same rules as the API: what still stops a hazard from counting as complete. */
export function raHazardIssues(
  inputs: RaInputs,
  texts: { mitigation?: string | null, action_plan?: string | null },
  result: RaHazardResult,
  kind: RaKind = 'head_office',
): RaIssue[] {
  const issues: RaIssue[] = RA_KIND_INPUTS[kind]
    .filter((key) => inputs[key] === null || inputs[key] === undefined)
    .map((key) => ({ field: key, message: 'Choose a rating, or N/A.' }))
  const pairs = kind === 'branch'
    ? [['probability', result.residual_probability, result.residual_impact] as const]
    : [
        ['probability', result.gross_probability, result.gross_impact] as const,
        ['residual_probability', result.residual_probability, result.residual_impact] as const,
      ]
  for (const [field, probability, impact] of pairs) {
    if (probability !== null && impact !== null && (probability === 0) !== (impact === 0)) {
      issues.push({ field, message: 'Rate both probability and impact, or set every rating to N/A.' })
    }
  }
  if (raMitigationRequired(result, kind) && blank(texts.mitigation)) {
    issues.push({ field: 'mitigation', message: 'Describe the existing mitigation measures.' })
  }
  // The action plan is optional, also for a High residual risk.
  return issues
}

/** HO: unless the gross risk is 1 × 1 or not applicable. Branch: every applicable hazard. */
export function raMitigationRequired(result: RaHazardResult, kind: RaKind = 'head_office') {
  if (kind === 'branch') return Boolean(result.residual_level)
  const oneByOne = result.gross_probability === 1 && result.gross_impact === 1
  return Boolean(result.gross_level) && !oneByOne
}

export function raHazardWarnings(result: RaHazardResult, kind: RaKind = 'head_office'): RaIssue[] {
  const warnings: RaIssue[] = []
  if (kind === 'branch') return warnings
  if ((result.residual_probability ?? 0) > (result.gross_probability ?? 0)) {
    warnings.push({ field: 'residual_probability', message: 'Higher after mitigation than the gross probability.' })
  }
  if ((result.residual_impact ?? 0) > (result.gross_impact ?? 0)) {
    warnings.push({ field: 'residual_impact', message: 'Higher after mitigation than the gross impact.' })
  }
  return warnings
}

/** "3 × 4" for a rated pair, "N/A" when not applicable, "—" while incomplete. */
export function raPairLabel(probability: number | null, impact: number | null) {
  if (probability === null || impact === null) return '—'
  if (!probability || !impact) return 'N/A'
  return `${probability} × ${impact}`
}

export function raLevelKey(result: { level: RaLevel | null, rated: boolean }): RaLevel | 'na' | null {
  if (result.level) return result.level
  return result.rated ? 'na' : null
}

/** A step's title ("Prepared by Location Incident Coordinator (LIC)") for one module. */
export function raSignoffRoleName(role: RaSignoffRole | null | undefined, roles: readonly RaSignoffRoleOption[]) {
  return roles.find((item) => item.value === role)?.label ?? role ?? ''
}

export function raSignoffLabel(role: RaSignoffRole, roles: readonly RaSignoffRoleOption[] = RA_SIGNOFF_ROLES) {
  return roles.find((item) => item.value === role)?.label ?? role
}

/** A step's title ("Prepared by Location Incident Coordinator (LIC)"), as Monitoring and
 *  Approval show the step (like SCCA). */
export function raStepTitle(role: string | null | undefined, roles: readonly RaSignoffRoleOption[] = RA_SIGNOFF_ROLES) {
  if (!role) return ''
  return roles.find((item) => item.value === role)?.label ?? role
}

/** The sign-off steps of a configuration version (as RA configuration sets them), or the
 *  module's defaults. With `codes` (an assessment's `signoff_step_codes`), only the steps that
 *  sign that RA: the building approver only while its building waits for approval. `null`
 *  (an assessment without the list) leaves the building approver out. */
export function raRoleOptions(
  formula: { signoff_steps?: { code: RaSignoffRole, label: string, title: string, signer_mode?: RaSignerMode, mandatory?: boolean, condition?: RaStepCondition }[] } | null | undefined,
  fallback: readonly RaSignoffRoleOption[],
  codes?: readonly string[] | null,
): RaSignoffRoleOption[] {
  const rows = formula?.signoff_steps
  if (!rows?.length) {
    return fallback.map((row) => ({ ...row, mode: RA_DEFAULT_SIGNER_MODES[row.value] ?? 'chosen', mandatory: true }))
  }
  const signs = (row: { code: string, condition?: RaStepCondition }) =>
    codes ? codes.includes(row.code) : codes === null ? (row.condition ?? 'always') === 'always' : true
  return rows.filter(signs).map((row) => ({
    value: row.code,
    label: row.label,
    hint: row.title,
    mode: row.signer_mode ?? 'chosen',
    mandatory: row.mandatory ?? true,
  }))
}

/** A division's maximum tolerable downtime band and its critical rating (the SCCA categories). */
export const RA_MTD_BANDS = ['0-4 hours', '4-12 hours', '12-24 hours', '24-48 hours', '> 48 hours'] as const
export const RA_CRITICAL_RATINGS = ['Critical', 'Very Important', 'Important', 'Necessary', 'Other'] as const
/** The MTD band that goes with each critical rating, suggested when a division is added. */
export const RA_RATING_MTD: Record<string, string> = {
  'Critical': '0-4 hours',
  'Very Important': '4-12 hours',
  'Important': '12-24 hours',
  'Necessary': '24-48 hours',
  'Other': '> 48 hours',
}

/** LCP-Recovery Team Structure. The Location Recovery Team is level 1, the other teams level 2. */
export const RA_RECOVERY_TEAMS = [
  { value: 'location_recovery_team', label: 'Location Recovery Team', level: 1, description: 'Incident commander, coordinator, IMT leads, RTF and BCM.' },
  { value: 'damage_assessment_team', label: 'Damage Assessment Team (DAT)', level: 2, description: 'Assesses damage to the building and facilities.' },
  { value: 'emergency_response_team', label: 'Emergency Response Team (ERT)', level: 2, description: 'Floor wardens, building management and security.' },
  { value: 'core_support_team', label: 'Core Support Team', level: 2, description: 'HR, SPAPM, corporate communication and compliance.' },
] as const
export type RaRecoveryTeam = (typeof RA_RECOVERY_TEAMS)[number]['value']

/** What a map legend (RaMapLegend) can list: the same symbols the map draws. */
export type RaMapLegendItem = 'building' | 'branch' | 'waiting' | 'rejected' | 'inactive' | 'crisis' | 'crisis_pending' | 'quake'

/** LCP-Call Tree. */
export const RA_CALL_TREE_LEVELS = [
  { value: 1, label: 'Level 1', description: 'The LICOM contacts the LIC, heads of division and the BCM facilitator.' },
  { value: 2, label: 'Level 2', description: 'The LIC, heads of division and the BCM facilitator contact the ERT, DAT, core support team, heads of department, CMC and the affected IMTs.' },
  { value: 3, label: 'Level 3', description: 'Each level 2 contact calls their own team.' },
] as const
export type RaCallTreeLevel = (typeof RA_CALL_TREE_LEVELS)[number]['value']

// The recovery team and call tree forms (RaGroupedRowsForm). As in the workbook, a role (caller)
// is written once with its people under it, and every field takes free text: a person and a
// number, or a note such as "Sesuai Tab LRP (front)". The role, name and mobile (caller, contact
// and mobile) are required; the API checks the same.
export const RA_TEAM_LEAD = { key: 'role', label: 'Role', placeholder: 'Role, e.g. Floor Warden (lantai B1) or Security' }
export const RA_TEAM_FIELDS = [
  { key: 'name', label: 'Name', required: true, wide: true, placeholder: 'Name, or a note such as (Sesuai Shift)' },
  { key: 'mobile', label: 'Mobile', required: true, placeholder: 'Number, or a note' },
  { key: 'home_phone', label: 'Home phone' },
]
export const RA_CALL_TREE_LEAD = { key: 'caller', label: 'Caller', placeholder: 'Who calls, e.g. LIC – Legiran' }
export const RA_CALL_TREE_FIELDS = [
  { key: 'contact_name', label: 'Contact', required: true, placeholder: 'Name, or a note' },
  { key: 'division', label: 'Division or role', wide: true },
  { key: 'mobile', label: 'Mobile', required: true, placeholder: 'Number, or a note' },
  { key: 'home_phone', label: 'Home phone' },
]
export const RA_CALL_TREE_GROUPS = RA_CALL_TREE_LEVELS.map((level) => ({ ...level, label: `${level.label} call tree` }))

/**
 * The team charts beside the recovery team and call tree: the HO workbook's pictures until BCM
 * uploads others in Administration > RA configuration > Team diagrams (per kind).
 */
export const RA_DIAGRAMS = {
  recovery_team: {
    label: 'Recovery team structure',
    button: 'View structure chart',
    description: 'How the corporate, location and business recovery teams are organized.',
  },
  call_tree: {
    label: 'Location call tree',
    button: 'View call tree chart',
    description: 'Who calls whom at levels one to three when a disaster happens.',
  },
} as const
export type RaDiagram = keyof typeof RA_DIAGRAMS

/** The chart image; `version` (from RA configuration) skips a cached copy after a change. */
export function raDiagramUrl(kind: RaKind, diagram: RaDiagram, version?: string) {
  const query = new URLSearchParams({ kind })
  if (version) query.set('v', version)
  return `/api/ra/diagrams/${diagram}?${query}`
}

export const raYesNo = defineStatusScale({
  yes: { label: 'Yes', color: 'success', icon: 'i-lucide-circle-check' },
  no: { label: 'No', color: 'neutral', icon: 'i-lucide-circle-x' },
})

export function raYesNoKey(value: boolean | null | undefined) {
  return value === true ? 'yes' : value === false ? 'no' : null
}

/**
 * "lat, lng" as Google Maps copies it ("-6.271633, 106.719358"), or two numbers separated by
 * spaces or a semicolon. Null when it isn't a valid WGS 84 pair.
 */
export function raParseCoordinates(text: string): { lat: number, lng: number } | null {
  const parts = text.trim().split(/[\s,;]+/).filter(Boolean)
  if (parts.length !== 2) return null
  const [lat, lng] = parts.map(Number) as [number, number]
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
}

export function raFormatCoordinates(pin: { lat: number, lng: number } | null | undefined) {
  return pin ? `${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}` : ''
}

/** Opens Google Maps at the pin, or searching the address when there is no pin yet. */
export function raGoogleMapsUrl(query: { lat: number, lng: number } | string) {
  const value = typeof query === 'string' ? query : `${query.lat},${query.lng}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`
}

/** Pin colour per latest highest residual level; "none" for a location without an assessment. */
export const RA_PIN_CLASS: Record<RaLevel | 'na' | 'none', string> = {
  High: 'text-error',
  Medium: 'text-warning',
  Low: 'text-info',
  na: 'text-muted',
  none: 'text-muted',
}

/** US EPA's AQI bands as WAQI colours them, on its tiles and widget. */
export const WAQI_BANDS: { code: RaWaqiBand, label: string, range: string, hex: string, text: string }[] = [
  { code: 'good', label: 'Good', range: '0–50', hex: '#009966', text: '#ffffff' },
  { code: 'moderate', label: 'Moderate', range: '51–100', hex: '#ffde33', text: '#1f2937' },
  { code: 'sensitive', label: 'Unhealthy for sensitive groups', range: '101–150', hex: '#ff9933', text: '#1f2937' },
  { code: 'unhealthy', label: 'Unhealthy', range: '151–200', hex: '#cc0033', text: '#ffffff' },
  { code: 'very_unhealthy', label: 'Very unhealthy', range: '201–300', hex: '#660099', text: '#ffffff' },
  { code: 'hazardous', label: 'Hazardous', range: '301+', hex: '#7e0023', text: '#ffffff' },
]

/** The AQI band a number falls in (US EPA, as WAQI uses). */
export function waqiBand(aqi: number) {
  const tops = [50, 100, 150, 200, 300]
  const index = tops.findIndex((top) => aqi <= top)
  return WAQI_BANDS[index === -1 ? WAQI_BANDS.length - 1 : index]!
}

/** Distance rings the location map can draw around the selected place, in km. */
export const RA_RING_KM = [1, 2, 5, 10, 25] as const

/** Great-circle distance in km (haversine), plenty accurate at city scale. */
export function raDistanceKm(a: { lat: number, lng: number }, b: { lat: number, lng: number }) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** "1,7 km", "850 m": distances in Indonesian number format. */
export function raFormatDistance(metres: number) {
  if (metres < 1000) return `${formatNumber(Math.round(metres / 10) * 10, 0)} m`
  return `${formatNumber(metres / 1000, metres < 10_000 ? 1 : 0)} km`
}

/** An earthquake's magnitude with one decimal, in Indonesian number format: "5,6", "5,0". */
export function raFormatMagnitude(value: number) {
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
}

/** Driving directions between two pins in Google Maps (road distance and time). */
export function raDirectionsUrl(from: { lat: number, lng: number }, to: { lat: number, lng: number }) {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}`
}

export const raCrisisStatus = defineStatusScale<'pending' | 'open' | 'closed' | 'rejected'>({
  pending: { label: 'Pending approval', color: 'warning', icon: 'i-lucide-hourglass' },
  open: { label: 'Open', color: 'error', icon: 'i-lucide-siren' },
  closed: { label: 'Closed', color: 'neutral', icon: 'i-lucide-circle-check' },
  rejected: { label: 'Rejected', color: 'neutral', icon: 'i-lucide-circle-x' },
})

/**
 * A building's status with its four-eyes approval: a new building waits for approval
 * (pending), may be rejected, and making it inactive waits too (deactivating).
 */
export type RaBuildingState = 'pending' | 'rejected' | 'deactivating' | 'active' | 'inactive'
export const raBuildingStatus = defineStatusScale<RaBuildingState>({
  pending: { label: 'Waiting for approval', color: 'warning', icon: 'i-lucide-hourglass' },
  rejected: { label: 'Rejected', color: 'error', icon: 'i-lucide-circle-x' },
  deactivating: { label: 'Deactivation requested', color: 'warning', icon: 'i-lucide-circle-pause' },
  active: { label: 'Active', color: 'success', icon: 'i-lucide-circle-check' },
  inactive: { label: 'Inactive', color: 'neutral', icon: 'i-lucide-circle-pause' },
})

interface RaBuildingLike {
  is_active?: boolean
  in_service?: boolean
  approval?: { status: 'pending' | 'approved' | 'rejected', action: 'register' | 'deactivate' | null } | null
}

/**
 * In service: active and approved as a building, the API's `in_service`. A deactivation
 * waiting for approval still counts. An inactive building, a new one waiting for approval and a
 * rejected one are not in service: the register shows them as Inactive, the map fades them,
 * and no disaster affects them.
 */
export function raInService(location: RaBuildingLike): boolean {
  if (typeof location.in_service === 'boolean') return location.in_service
  const approval = location.approval
  return (location.is_active ?? true) && (!approval || approval.status === 'approved' || approval.action === 'deactivate')
}

/** Where its approval stands when it waits or was rejected, otherwise null. */
export function raBuildingApproval(location: RaBuildingLike): RaBuildingState | null {
  const approval = location.approval
  if (approval?.status === 'rejected') return 'rejected'
  if (approval?.status === 'pending') return approval.action === 'deactivate' ? 'deactivating' : 'pending'
  return null
}

/** A building's status, one badge: Waiting for approval (new), Deactivation requested,
 *  Rejected, otherwise Active or Inactive (its own switch). Filters and the map still count a
 *  new building waiting and a rejected one as not in service (raInService). */
export function raBuildingState(location: RaBuildingLike): RaBuildingState {
  return raBuildingApproval(location) ?? ((location.is_active ?? true) ? 'active' : 'inactive')
}

export const raPlaybookReview = defineStatusScale<'reviewed' | 'starter'>({
  reviewed: { label: 'Reviewed by BCM', color: 'success', icon: 'i-lucide-badge-check' },
  starter: { label: 'Starter steps', color: 'warning', icon: 'i-lucide-file-pen' },
})

export const RA_PLAYBOOK_PHASES = [
  { value: 'immediate', label: 'Right away', description: 'Keep people safe and raise the alarm.' },
  { value: 'stabilise', label: 'Within the first hours', description: 'Account for everyone, start the call tree, assess the damage.' },
  { value: 'recover', label: 'Recovery', description: 'Move to alternate sites and return to the building.' },
] as const

export const RA_PLACE_KIND_LABEL: Record<RaKind, string> = {
  head_office: 'Head office building',
  branch: 'Branch',
}

export const RA_CRISIS_ACTION_LABEL: Record<string, string> = {
  declared: 'Declared',
  approved: 'Approved',
  rejected: 'Rejected',
  updated: 'Updated',
  note: 'Update',
  closed: 'Closed',
  reopened: 'Reopened',
}

/** The date ("2026-10-21") and time ("14:05") in WIB of a UTC timestamp, for the form fields. */
export function raWibParts(value: string | Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(typeof value === 'string' ? new Date(value) : value)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` }
}

/** A WIB date and time as an ISO timestamp with its offset (WIB is UTC+7 all year). */
export function raWibToIso(date: string, time: string) {
  return `${date}T${time}:00+07:00`
}

/** RA and RA Branch have three sections, as SCCA: Monitoring, Manage and Approval. */
export type RaSection = 'monitoring' | 'manage' | 'approval'

export const RA_SECTIONS: Record<RaSection, { label: string, icon: string }> = {
  monitoring: { label: 'Monitoring', icon: 'i-lucide-chart-column' },
  manage: { label: 'Manage', icon: 'i-lucide-list-checks' },
  approval: { label: 'Approval', icon: 'i-lucide-badge-check' },
}

/** `/ra/manage/12`, `/ra-branch/monitoring`, `/ra/manage/new`. */
export function raPath(kind: RaKind, section: RaSection, id?: number | 'new') {
  return `${RA_MODULES[kind].base}/${section}${id === undefined ? '' : `/${id}`}`
}

/** The print-friendly report of an assessment, inside its section (as SCCA's View report). */
export function raReportPath(kind: RaKind, section: RaSection, id: number) {
  return `${raPath(kind, section, id)}/report`
}

/** Where an assessment opens from elsewhere (a location, the map, a disaster): a draft in Manage
 *  to work on it, anything else in Monitoring to read it. */
export function raRecordPath(kind: RaKind, assessment: { id: number, status?: RaStatus | null }) {
  return raPath(kind, assessment.status === 'draft' ? 'manage' : 'monitoring', assessment.id)
}

/** Why an RA is made, like SCCA's assessment reason. Annual review renews the building's last
 *  final RA; New building is its first RA (the API checks both). */
export type RaReason = 'annual_review' | 'new_building' | 'structural_change'
export const RA_REASONS: { value: RaReason, label: string, description: string }[] = [
  { value: 'new_building', label: 'New building', description: 'The first RA of this building or branch.' },
  { value: 'annual_review', label: 'Annual review', description: 'Renews the last final RA.' },
  { value: 'structural_change', label: 'Structural change', description: 'The building changed, e.g. a renovation or new occupants.' },
]
/** Like SCCA's System change: the renewal date is picked (at most a year after the assessment);
 *  every other reason renews a year after it. */
export const RA_CUSTOM_DUE_REASON: RaReason = 'structural_change'

/** The help under Reason for assessment, which changes with the reason picked (as in SCCA). */
export function raReasonHelp(value: string | null | undefined) {
  const reason = RA_REASONS.find((item) => item.value === value)
  if (!reason) return 'Pick the reason first: the other fields open once it is chosen, and it decides the renewal due date.'
  const renewal = reason.value === RA_CUSTOM_DUE_REASON
    ? 'Pick the renewal due date below: it can be sooner than one year.'
    : 'Renewal is due one year after the assessment date.'
  return `${reason.description} ${renewal}`
}

/** The API's field errors for an RA's header, with the period's ("This location already has an
 *  assessment for 2026.") on the assessment date, which sets the period: there is no period
 *  field to show it on. */
export function raHeaderErrors<T extends { name?: string }>(errors: T[]): T[] {
  return errors.map((item) => (item.name === 'period_year' ? { ...item, name: 'assessment_date' } : item))
}

/** The fields of an RA's header, for the error banner. */
const RA_FIELD_LABELS: Record<string, string> = {
  reason: 'Reason for assessment',
  location_id: 'Building',
  assessment_date: 'Assessment date',
  period_year: 'Assessment date',
  due_date: 'Renewal due date',
  lic_user_id: 'LIC',
  lic_phone: 'LIC mobile number',
  licom_user_id: 'LICOM',
  licom_phone: 'LICOM mobile number',
  copy_from_id: 'Previous RA',
}

/** As SCCA's banner (apiErrorText): what went wrong, then each field's message. */
/** A new building's sections, as RA › New sends them with the RA (`contacts.0.phone`). */
const RA_SECTION_LABELS: Record<string, string> = {
  location: 'Building',
  contacts: 'Emergency contacts',
  occupants: 'Occupants',
  recovery_team: 'Recovery team',
  call_tree: 'Call tree',
}

function raFieldLabel(name: string) {
  const [section = '', ...rest] = name.split('.')
  const label = RA_SECTION_LABELS[section]
  if (!label || !rest.length) return RA_FIELD_LABELS[name] ?? name.replaceAll('_', ' ')
  const row = rest.length > 1 ? `, row ${Number(rest[0]) + 1}` : ''
  return `${label}${row}, ${rest.at(-1)!.replaceAll('_', ' ')}`
}

export function raErrorText(error: unknown) {
  const lines = apiFieldErrors(error).map((item) => `• ${raFieldLabel(item.name ?? '')}: ${item.message}`)
  return [apiErrorMessage(error), ...lines].join('\n')
}

/** The RA period is the year of the assessment date ("2026-10-28" → 2026). */
export function raPeriodOf(date: string | null | undefined) {
  const year = Number(date?.slice(0, 4))
  return Number.isInteger(year) && year > 0 ? year : null
}

export function raReasonLabel(value: string | null | undefined) {
  return RA_REASONS.find((reason) => reason.value === value)?.label ?? null
}

/** The grey line under a building's name: its ID and, for a branch, its region. */
export function raLocationLine(location: { code?: string | null, region?: string | null }) {
  return [location.code, location.region].filter(Boolean).join(' · ')
}

/** The sign-off waiting time: "Today", "1 working day", "4 working days". */
export function raWaiting(days: number) {
  if (days <= 0) return 'Today'
  return `${days} working ${days === 1 ? 'day' : 'days'}`
}

export const raRenewalBucket = defineStatusScale<'overdue' | 'due_30' | 'due_90' | 'later'>({
  overdue: { label: 'Overdue', color: 'error', icon: 'i-lucide-circle-alert' },
  due_30: { label: 'Due in 30 days', color: 'warning', icon: 'i-lucide-calendar-clock' },
  due_90: { label: 'Due in 31–90 days', color: 'info', icon: 'i-lucide-calendar' },
  later: { label: 'Not due yet', color: 'neutral', icon: 'i-lucide-calendar-check' },
})

/** Escalation/wait level for sign-off steps: ok → reminder → escalated. */
export type RaWaitLevel = 'ok' | 'reminder' | 'escalated'
export const raWaitLevel = defineStatusScale<RaWaitLevel>({
  ok: { label: 'On track', color: 'success', icon: 'i-lucide-circle-check' },
  reminder: { label: 'Reminder due', color: 'warning', icon: 'i-lucide-bell' },
  escalated: { label: 'Escalated', color: 'error', icon: 'i-lucide-siren' },
})

/** The first crumb of the pages in the Sites menu group (the building map, Disaster and
 *  Incident with their guidebooks): Home › Sites › Building map. The routes keep their /locations names. */
export const BUILDINGS_GROUP = 'Sites'
/** Import from Excel: a building and its RA from the HO or Cabang workbook. */
export const LOCATION_IMPORT_PATH = '/locations/import'

export const LOCATION_MAP_PATH = '/locations/map'

/** Administration > Sites configuration and its tabs (old RA configuration links to them open it). */
export const SITES_CONFIG_PATH = '/admin/sites-config'
export const SITES_CONFIG_TABS = ['hazard-types', 'earthquakes', 'past-disasters'] as const
export type SitesConfigTab = (typeof SITES_CONFIG_TABS)[number]

/** The Disaster and Incident menus (a crisis is one or the other by its hazard): their names,
 *  pages and icon. Manage is at `path`, Monitoring, Approval and Guidebook under it. */
export const RA_CRISIS_TYPES: Record<RaCrisisType, { label: string, plural: string, lower: string, path: string, icon: string }> = {
  disaster: { label: 'Disaster', plural: 'Disasters', lower: 'disaster', path: '/disasters', icon: 'i-lucide-siren' },
  incident: { label: 'Incident', plural: 'Incidents', lower: 'incident', path: '/incidents', icon: 'i-lucide-triangle-alert' },
}

/** Administration › Master building, and a building's page there, on a tab (`map`,
 *  `contacts`, ...) when given: the only page of a building (`sites.master`). Show a link to
 *  it only to who may open it (`can('sites.master')`). */
export const MASTER_BUILDINGS_PATH = '/admin/buildings'
export function masterBuildingPath(id: number, tab?: string) {
  return `${MASTER_BUILDINGS_PATH}/${id}${tab ? `?tab=${tab}` : ''}`
}

/** Disaster › Guidebook or Incident › Guidebook, on a hazard when given. */
export function guidebookPath(type: RaCrisisType, hazard?: string) {
  return `${RA_CRISIS_TYPES[type].path}/guidebook${hazard ? `?hazard=${hazard}` : ''}`
}

/** A disaster's (or incident's) page. */
export function crisisPath(id: number, type: RaCrisisType = 'disaster') {
  return `${RA_CRISIS_TYPES[type].path}/${id}`
}

/** A disaster's (or incident's) print view. */
export function crisisReportPath(id: number, type: RaCrisisType = 'disaster') {
  return `${crisisPath(id, type)}/report`
}

/** Where a disaster happened: its building or branch, or the pin's coordinates. */
export function raCrisisPlaceName(crisis: RaCrisis) {
  return crisis.location?.name ?? raFormatCoordinates({ lat: crisis.latitude, lng: crisis.longitude })
}

/** A disaster's map: its point (unless it is at a building's pin, shown by the ring) and the
 *  affected places, coloured by their residual risk for the hazard. */
export function raCrisisMarkers(crisis: RaCrisis): RaMapMarker[] {
  const atPin = crisis.affected.some((row) => row.distance_m === 0)
  return [
    ...(atPin
      ? []
      : [{
          id: crisis.id,
          lat: crisis.latitude,
          lng: crisis.longitude,
          label: `${RA_CRISIS_TYPES[crisis.type].label} point: ${raCrisisPlaceName(crisis)}`,
          variant: 'crisis' as const,
          pending: crisis.status === 'pending',
        }]),
    ...crisis.affected.map((row) => ({
      id: row.location.id,
      lat: row.location.latitude,
      lng: row.location.longitude,
      label: `${row.location.name} (${RA_PLACE_KIND_LABEL[row.location.kind]}), affected`,
      level: row.assessment?.rating?.residual_level ?? (row.assessment ? 'na' as const : 'none' as const),
      variant: row.location.kind === 'branch' ? 'branch' as const : 'location' as const,
    })),
  ]
}

/** A disaster's affected area. */
export function raCrisisCircles(crisis: RaCrisis) {
  return [{ id: crisis.id, lat: crisis.latitude, lng: crisis.longitude, radiusM: crisis.radius_m, crisis: true, pending: crisis.status === 'pending' }]
}

/** The register's type badge: head office building or branch. */
export const raLocationKind = defineStatusScale<RaKind>({
  head_office: { label: 'Head office', color: 'neutral', icon: 'i-lucide-building-2' },
  branch: { label: 'Branch', color: 'neutral', icon: 'i-lucide-landmark' },
})

/** The years a review can pick from, newest first: from `first` to this year. */
export function raYearItems(first = 2000, last = new Date().getFullYear()) {
  const items: { label: string, value: number }[] = []
  for (let year = last; year >= first; year--) items.push({ label: String(year), value: year })
  return items
}

/** The review years when none are picked: the last 10, this one included (as the API counts). */
export function raDefaultReviewYears(span = 10) {
  const to = new Date().getFullYear()
  return { from: to - span + 1, to }
}
