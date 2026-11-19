import type { SccaConfigStandard } from '~/utils/scca-config'

/**
 * The DR decision (Standard Teknologi H.03.P.02.01 versi 08.2026, Lampiran 8-10), mirrored from
 * the backend (`services/scca/dr.py`) so the Recovery tab answers while the assessor types. The
 * server recomputes and stores the same decision on every save.
 */
export interface SccaDrSettings {
  mandatory_categories: string[]
  mtd_threshold_h: number
  question_alt_process: string
  question_accept: string
  outcome_proposed: string
  outcome_not_required: string
  category_mtd_h: Record<string, number>
  rto_gap_pct: number
  band_upper_inclusive: boolean
  acceptance_mode: 'assessor' | 'owner_signoff'
  legacy_mode: 'not_assessed' | 'bcm_may_run'
}

export interface SccaDrBand {
  mtd_from_h: number | null
  mtd_to_h: number | null
  suggested_dr: string
  target_rto: string
  target_rpo: string
  dr_type: string
  dr_capacity: string
  data_sync_type: string
  sync_method: string
  backup_tools: string
}

export type SccaDrCharacteristicKey
  = | 'data_sync' | 'disaster_recovery' | 'rpo' | 'backup_interval' | 'app_resiliency'
    | 'infra_resiliency' | 'dr_testing' | 'service_monitoring' | 'dr_type_minimum'

export type SccaDrCharacteristics = Record<SccaDrCharacteristicKey, string>

export interface SccaDrConfig {
  settings: SccaDrSettings
  catalogue: SccaDrBand[]
  characteristics: Record<string, SccaDrCharacteristics>
}

export interface SccaDrDecision {
  status: 'no_category' | 'needs_answer' | 'complete'
  category: string | null
  mtd_h: number | null
  outcome: 'proposed' | 'not_required' | null
  outcome_label: string | null
  reason: string | null
  needs: ('alt_process' | 'accepts')[]
  path: 'mandatory' | 'tree' | null
  suggested: SccaDrBand | null
  characteristics: Partial<SccaDrCharacteristics>
  decided_at: string | null
}

export const SCCA_DR_CHARACTERISTICS: { key: SccaDrCharacteristicKey, label: string }[] = [
  { key: 'data_sync', label: 'Data synchronization' },
  { key: 'disaster_recovery', label: 'Disaster recovery' },
  { key: 'rpo', label: 'RPO' },
  { key: 'backup_interval', label: 'Backup interval' },
  { key: 'app_resiliency', label: 'Application resiliency' },
  { key: 'infra_resiliency', label: 'Infrastructure resiliency' },
  { key: 'dr_testing', label: 'DR testing' },
  { key: 'service_monitoring', label: 'Business service monitoring' },
  { key: 'dr_type_minimum', label: 'Minimum DR type' },
]

/** What the Recovery panel shows as information, not entered. */
export const SCCA_DR_INFO_KEYS: SccaDrCharacteristicKey[] = [
  'backup_interval', 'app_resiliency', 'infra_resiliency', 'rpo', 'dr_testing', 'service_monitoring',
]

export const SCCA_DR_BAND_FIELDS: { key: keyof SccaDrBand, label: string }[] = [
  { key: 'suggested_dr', label: 'Suggested DR' },
  { key: 'target_rto', label: 'Target RTO' },
  { key: 'target_rpo', label: 'Target RPO' },
  { key: 'dr_type', label: 'DR type' },
  { key: 'dr_capacity', label: 'DR capacity' },
  { key: 'data_sync_type', label: 'Data sync type' },
  { key: 'sync_method', label: 'Sync method (optional)' },
  { key: 'backup_tools', label: 'Backup tools' },
]

const NO_DR_TYPES = new Set(['', 'none', 'no dr', 'n/a', 'na'])

export function bandLabel(band: Pick<SccaDrBand, 'mtd_from_h' | 'mtd_to_h'>) {
  const from = band.mtd_from_h ?? 0
  if (band.mtd_to_h == null) return `> ${from} h`
  return from === 0 ? `≤ ${band.mtd_to_h} h` : `${from} – ${band.mtd_to_h} h`
}

function hours(value: number | null | undefined) {
  if (value == null) return '—'
  return `${Number.isInteger(value) ? value : value}`.concat(' h')
}

/** Lampiran 8 MTD of a category: the setting's override, else the recovery standard's MTD upper
 *  bound (the lower bound for the open-ended category, 48 h). */
export function sccaCategoryMtd(
  dr: SccaDrConfig,
  standards: SccaConfigStandard[],
  category: string | null | undefined,
): number | null {
  if (!category) return null
  const override = dr.settings.category_mtd_h?.[category]
  if (override != null) return Number(override)
  const standard = standards.find((row) => row.category === category)
  if (!standard) return null
  return standard.mtd_to_h ?? standard.mtd_from_h ?? null
}

export function sccaDrBand(dr: SccaDrConfig, mtd: number | null): SccaDrBand | null {
  if (mtd == null) return null
  const inclusive = dr.settings.band_upper_inclusive !== false
  const bands = [...dr.catalogue].sort((a, b) => (a.mtd_from_h ?? 0) - (b.mtd_from_h ?? 0))
  return bands.find((band) => {
    const low = band.mtd_from_h ?? 0
    const high = band.mtd_to_h
    const inside = inclusive ? (mtd > low || (low === 0 && mtd >= 0)) && (high == null || mtd <= high) : mtd >= low && (high == null || mtd < high)
    return inside
  }) ?? null
}

export function decideDr(
  dr: SccaDrConfig,
  standards: SccaConfigStandard[],
  category: string | null | undefined,
  altProcess: boolean | null | undefined,
  accepts: boolean | null | undefined,
): SccaDrDecision {
  const mtd = sccaCategoryMtd(dr, standards, category)
  const decision: SccaDrDecision = {
    status: 'no_category',
    category: category ?? null,
    mtd_h: mtd,
    outcome: null,
    outcome_label: null,
    reason: null,
    needs: [],
    path: null,
    suggested: null,
    characteristics: dr.characteristics?.[category ?? ''] ?? {},
    decided_at: null,
  }
  if (!category) return decision
  const settings = dr.settings
  const over = mtd != null && mtd > Number(settings.mtd_threshold_h)
  const finish = (outcome: 'proposed' | 'not_required', reason: string): SccaDrDecision => ({
    ...decision,
    status: 'complete',
    outcome,
    outcome_label: outcome === 'proposed' ? settings.outcome_proposed : settings.outcome_not_required,
    reason,
    suggested: sccaDrBand(dr, mtd),
  })
  if (settings.mandatory_categories.includes(category)) {
    decision.path = 'mandatory'
    return finish('proposed', `DR is mandatory for ${category} (Lampiran 8).`)
  }
  decision.path = 'tree'
  if (altProcess == null) return { ...decision, status: 'needs_answer', needs: ['alt_process'] }
  if (altProcess) {
    return finish('not_required', over
      ? `MTD of ${hours(mtd)} is over ${hours(Number(settings.mtd_threshold_h))} and an alternate business process exists.`
      : 'An alternate business process exists.')
  }
  if (accepts == null) return { ...decision, status: 'needs_answer', needs: ['accepts'] }
  if (accepts) return finish('not_required', 'The business accepts running without DR.')
  return finish('proposed', 'No alternate business process and the business does not accept it.')
}

function firstNumber(value: string | null | undefined) {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

/** The automatic DR gaps under the Final recovery row. */
export function drGapMessages(
  dr: SccaDrConfig,
  decision: SccaDrDecision | null | undefined,
  finalRto: string | null | undefined,
  finalDrType: string | null | undefined,
): string[] {
  if (!decision || decision.status !== 'complete' || decision.outcome !== 'proposed') return []
  const messages: string[] = []
  if (NO_DR_TYPES.has(String(finalDrType ?? '').trim().toLowerCase())) {
    messages.push('DR is proposed by the DR Decision Tree but the Final row has no DR.')
  }
  const rto = firstNumber(finalRto)
  const limit = (decision.mtd_h ?? 0) * Number(dr.settings.rto_gap_pct ?? 0) / 100
  if (rto != null && limit && rto > limit) {
    messages.push(`Final RTO ${hours(rto)} is longer than ${Number(dr.settings.rto_gap_pct)}% of the ${decision.category} MTD (${hours(limit)}).`)
  }
  const band = decision.suggested
  if (band && rto != null) {
    const numbers = String(band.target_rto ?? '').match(/\d+(?:\.\d+)?/g)
    const target = numbers ? Number(numbers.at(-1)) : null
    if (target != null && rto > target) {
      messages.push(`Final RTO ${hours(rto)} is longer than the ${band.suggested_dr} target of ${hours(target)}.`)
    }
  }
  return messages
}
