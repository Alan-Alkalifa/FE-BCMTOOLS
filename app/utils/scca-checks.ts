import type { SccaAssessment } from '~/composables/useScca'

/**
 * The checks an SCCA must pass before Submit (the same rules as the API's submit check,
 * services/scca/approval.py), and its gaps, grouped by tab. Manage, Approval and Monitoring
 * all show them with SccaGapSummary, so they read the same everywhere.
 */

export type SccaCheckTab = 'details' | 'rating' | 'interdependencies' | 'recovery' | 'result'

export const SCCA_CHECK_TABS: { value: SccaCheckTab, label: string }[] = [
  { value: 'details', label: 'Application' },
  { value: 'rating', label: 'Rating' },
  { value: 'interdependencies', label: 'Interdependencies' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'result', label: 'Result and sign-off' },
]

const HEADER_FIELDS: [keyof SccaAssessment, string][] = [
  ['application_code', 'Application code'],
  ['application_name', 'Application name'],
  ['assessment_reason', 'Reason for assessment'],
  ['assessment_date', 'Assessment date'],
  ['application_owner', 'Application owner'],
  ['it_support', 'IT support'],
  ['business_stakeholders', 'Business stakeholder'],
  ['deployment_model', 'Deployment model'],
  ['customer_facing', 'Customer facing'],
  ['business_days', 'Business days'],
  ['business_hours', 'Business hours'],
]

const INTERDEPENDENCY_FIELDS: [string, string][] = [
  ['criticality_category', 'category'],
  ['rto', 'RTO (hours)'],
  ['rpo', 'RPO'],
  ['dr_capacity', 'DR capacity (%)'],
  ['processing_mode', 'processing mode'],
  ['dependency', 'dependency'],
]

/** Every recovery block is required at Submit except Regulatory requirements. */
const REQUIRED_RECOVERY_KINDS = ['current_it', 'business', 'cimbn_standard', 'final'] as const

function empty(value: unknown) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

/** What still has to be filled in before Submit, by tab. */
export function sccaMissing(assessment: SccaAssessment, config?: SccaConfig | null): Record<SccaCheckTab, string[]> {
  const missing: Record<SccaCheckTab, string[]> = { details: [], rating: [], interdependencies: [], recovery: [], result: [] }

  for (const [field, label] of HEADER_FIELDS) {
    if (empty(assessment[field])) missing.details.push(label)
  }

  const unrated = assessment.missing_answers.length
  if (unrated) missing.rating.push(`${unrated} question${unrated === 1 ? '' : 's'} not rated`)

  for (const direction of ['upstream', 'downstream'] as const) {
    assessment.interdependencies
      .filter((row) => row.direction === direction)
      .forEach((row, index) => {
        const fields = INTERDEPENDENCY_FIELDS
          .filter(([field]) => empty((row as unknown as Record<string, unknown>)[field]))
          .map(([, label]) => label)
        if (!row.application_id) fields.unshift('application')
        if (fields.length) {
          missing.interdependencies.push(`${direction === 'upstream' ? 'Upstream' : 'Downstream'} ${index + 1}${row.system_name ? ` (${row.system_name})` : ''}: ${fields.join(', ')}`)
        }
      })
  }

  const rows = Object.fromEntries(assessment.recovery_values.map((row) => [row.kind, row]))
  for (const kind of REQUIRED_RECOVERY_KINDS) {
    const row = rows[kind]
    const fields = SCCA_RECOVERY_SECTIONS[kind]
      .filter((field) => empty(row?.[field.key]))
      .map((field) => field.label)
    if (fields.length) {
      const label = SCCA_RECOVERY_KINDS.find((item) => item.value === kind)?.label ?? kind
      missing.recovery.push(`${label}: ${fields.join(', ')}`)
    }
  }

  if (assessment.override_type) {
    if (empty(assessment.override_category)) missing.result.push('New category')
    if (empty(assessment.justification)) missing.result.push('Justification')
    if (empty(assessment.cim_ref_no)) missing.result.push('CIM / MKK / RA ref. no.')
  }
  const steps = config?.steps
    ?? SCCA_SIGNOFF_ROLES.map((role) => ({ code: role.value, short: role.short, mandatory: true, signer_mode: 'chosen' }))
  const unassigned = steps
    .filter((step) => step.mandatory && step.signer_mode !== 'fixed')
    .filter((step) => !assessment.signoffs.some((row) => row.role === step.code && row.user_id))
    .map((step) => step.short)
  if (unassigned.length) missing.result.push(`Sign-off user for: ${unassigned.join(', ')}`)
  return missing
}

export function sccaMissingCount(missing: Record<SccaCheckTab, string[]>) {
  return Object.values(missing).reduce((total, items) => total + items.length, 0)
}

/** The gaps to explain (they don't block Submit), by tab. */
export function sccaGaps(
  assessment: SccaAssessment,
  config?: SccaConfig | null,
  standards?: SccaConfigStandard[],
): Record<SccaCheckTab, string[]> {
  const gaps: Record<SccaCheckTab, string[]> = { details: [], rating: [], interdependencies: [], recovery: [], result: [] }

  const ratings = Object.fromEntries(assessment.answers.map((row) => [row.code, row.rating]))
  gaps.rating = ratingNoteWarnings(ratings, assessment.interdependencies, config).map((warning) => warning.message)

  const committedRto = assessment.recovery_values.find((row) => row.kind === 'current_it')?.rto ?? ''
  for (const row of assessment.interdependencies) {
    const where = `${row.system_name || 'An application'} (${row.direction})`
    const auto = interdependencyGap({
      system_name: row.system_name,
      criticality_category: row.criticality_category ?? undefined,
      rto: row.rto ?? '',
      rpo: row.rpo ?? '',
      dr_capacity: row.dr_capacity ?? '',
      dependency: row.dependency ?? undefined,
      workaround: row.workaround ?? '',
    }, committedRto, config)
    if (auto) gaps.interdependencies.push(`${where}: ${auto}`)
    if (row.gaps_note?.trim()) gaps.interdependencies.push(`${where}, noted: ${row.gaps_note.trim()}`)
  }

  const category = assessment.result.final_category ?? assessment.result.computed_category
  gaps.recovery = previousTabGapMessages({
    recoveryValues: assessment.recovery_values,
    category,
    standards,
    config,
  })
  return gaps
}
