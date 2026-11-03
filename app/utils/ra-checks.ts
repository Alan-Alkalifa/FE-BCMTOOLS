import type { RaAssessment } from '~/composables/useRa'

/**
 * What an RA still needs before Submit, by tab (as SCCA's `sccaMissing`, and the same rules as
 * the API's submit check, services/ra/signoff.py). Manage shows the counts as red badges on
 * the tabs while the RA is a draft the reader can edit.
 */

export type RaCheckTab = 'details' | 'hazards' | 'summary' | 'signoff'

function empty(value: unknown) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

export function raMissing(
  assessment: RaAssessment,
  steps: readonly RaSignoffRoleOption[],
): Record<RaCheckTab, string[]> {
  const missing: Record<RaCheckTab, string[]> = { details: [], hazards: [], summary: [], signoff: [] }

  // Details: the reason, the dates and the location incident team.
  if (empty(assessment.reason)) missing.details.push('Reason for assessment')
  if (empty(assessment.assessment_date)) missing.details.push('Assessment date')
  if (assessment.reason === RA_CUSTOM_DUE_REASON && empty(assessment.due_date)) missing.details.push('Renewal due date')
  for (const member of ['lic', 'licom'] as const) {
    const label = member.toUpperCase()
    if (!assessment[`${member}_user`] && empty(assessment[`${member}_name`])) missing.details.push(label)
    if (empty(assessment[`${member}_phone`])) missing.details.push(`${label} mobile number`)
  }

  // Hazards: every hazard rated, without open issues.
  const done = new Set(assessment.ratings
    .filter((rating) => rating.result?.is_rated && !rating.issues.length)
    .map((rating) => rating.code))
  const left = Math.max(assessment.summary.total - done.size, 0)
  for (const rating of assessment.ratings) {
    if (!done.has(rating.code)) missing.hazards.push(rating.code)
  }
  // Hazards never saved have no rating row yet: count them too.
  for (let index = missing.hazards.length; index < left; index += 1) missing.hazards.push('unrated')

  // Sign-off: a signer on every required step. A fixed step gets its signer at Submit.
  for (const step of steps) {
    if (step.mandatory === false || step.mode === 'fixed') continue
    if (!assessment.signoffs.some((row) => row.role === step.value && row.signer)) missing.signoff.push(step.label)
  }
  return missing
}
