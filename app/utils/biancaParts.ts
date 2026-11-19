/**
 * The parts of a business function, as the BIA workbook (Template BIA ver 2.4) heads its sheets:
 * the title, the objective and the instructions written above each table.
 */
export type BiancaPart = 'p1' | 'p2a' | 'p2b' | 'p3' | 'p4'

export interface BiancaPartInfo {
  value: BiancaPart
  /** The number and short name, for the function list. */
  label: string
  /** The sheet's title. */
  title: string
  objective: string
  /** The instructions above the sheet's table. */
  notes: string[]
}

export const BIANCA_PARTS: readonly BiancaPartInfo[] = [
  {
    value: 'p1',
    label: 'Part 1 · Impact assessment',
    title: 'Part 1: Impact assessment',
    objective: 'To assess the financial impact, the non-financial impact and the Suggested MTD of the business function.',
    notes: [
      'Impact assessment if the business activities STOP TOTALLY, from the point of disruption to the end of week 4.',
      'Potential cumulative financial loss in IDR; potential regulatory impact (A) and customer service impact (B) scored 1 to 3 for each period.',
      'The Suggested MTD is the first period with a loss above the alert threshold or a score of 3.',
    ],
  },
  {
    value: 'p2a',
    label: 'Part 2a · IT dependency',
    title: 'Part 2a: Determination of the business function MTD and criticality, and identification of the IT application systems',
    objective: 'To determine the business function\'s Expected MTD and category, and to identify the inter-dependency between the business function and IT (systems supported internally and / or externally).',
    notes: [
      'Expected MTD: equal to or shorter than the Suggested MTD (e.g. a local regulator requirement).',
      'Business function category: verify it with the categorization table (Reference).',
      'Pick the IT application system from the list; when it isn\'t listed, key it in under Others (confirm its RTO and RPO with IT or the vendor). Pick NA when the function uses no application.',
      'Justify at the bottom (Notes for all functions) when an RTO is equal to or longer than the MTD.',
      'DAAT = Expected MTD − system RTO − backlog clearing time. Workaround critical gaps are mandatory when RTO > MTD, there is no workaround and the system dependency is full.',
    ],
  },
  {
    value: 'p2b',
    label: 'Part 2b · Non-IT dependency',
    title: 'Part 2b: Identification of internal and external critical dependencies',
    objective: 'To identify the inter-dependency between the business function and its upstream and downstream, and to make sure their MTDs are in sync.',
    notes: [
      'Upstream: who triggers the activity. Downstream: who receives or processes your output / instruction. Write NA when there is none.',
      'Justify at the bottom (Notes for all functions) when their planned capacity is less than your function\'s, or their MTD longer.',
      'SLA: the time agreed in the agreement, or NA when there is no SLA.',
    ],
  },
  {
    value: 'p3',
    label: 'Part 3 · Recovery strategies',
    title: 'Part 3: Recovery prioritization and recovery strategies determination',
    objective: 'To determine the business / support operations\' recovery prioritization and the outstanding recovery strategies.',
    notes: [
      'Expected recovery level: aligned with the Group recovery strategies.',
      'Resources at the alternate site to meet the planned capacity (excluding work from home).',
      'Vital record and its location: mandatory for a Business Critical function.',
    ],
  },
  {
    value: 'p4',
    label: 'Part 4 · Critical timings',
    title: 'Part 4: Identification of the business function\'s critical timings',
    objective: 'To identify the critical timing and frequency, and to describe briefly the critical business activities that must be performed at those times.',
    notes: [],
  },
]

export function biancaPartInfo(part: BiancaPart) {
  return BIANCA_PARTS.find((item) => item.value === part)!
}

// --- what is filled in ----------------------------------------------------------------------

type Value = string | number | boolean | null | undefined
const blank = (value: Value) => value == null || (typeof value === 'string' && !value.trim())
const filled = (...values: Value[]) => values.every((value) => !blank(value))
const isNa = (value: Value) => typeof value === 'string' && value.trim().toUpperCase() === 'NA'

interface FunctionLike {
  loss?: (number | null | undefined)[] | null
  regulatory_scores?: (number | null | undefined)[] | null
  customer_scores?: (number | null | undefined)[] | null
  [field: string]: unknown
}

/**
 * Whether a part of a function has everything Submit asks of it (the same rules as the API's
 * completeness check; a few cross-checks, like the workaround gaps, only Submit tells). For the
 * ticks in the function list, so it's easy to see how far the BIA is filled.
 */
export function biancaPartDone(fn: FunctionLike, part: BiancaPart, periods: number, category?: string | null) {
  const value = (name: string) => fn[name] as Value
  const rows = (name: string) => (fn[name] as Record<string, Value>[] | undefined) ?? []
  switch (part) {
    case 'p1':
      return ['loss', 'regulatory_scores', 'customer_scores'].every((name) => {
        const values = (fn[name] as (number | null | undefined)[] | null | undefined) ?? []
        return Array.from({ length: periods }, (_, i) => values[i]).every((item) => item != null)
      }) && filled(value('suggested_mtd'))
    case 'p2a':
      return filled(value('expected_mtd')) && rows('it_dependencies').length > 0
        && rows('it_dependencies').every((row) => {
          if (blank(row.application_name)) return false
          if (isNa(row.application_name) && row.application_id == null) return true
          return filled(row.rto, row.rpo, row.workaround, row.backlog_hours, row.system_usage)
        })
    case 'p2b':
      return filled(value('planned_capacity')) && rows('dependencies').length > 0
        && rows('dependencies').every((row) => (['up', 'down'] as const).every((side) => {
          const name = row[`${side}_name`]
          if (blank(name)) return false
          if (isNa(name)) return true
          return filled(row[`${side}_capacity`], row[`${side}_mtd`], row[`${side}_sla`], row[`${side}_outsourced`], row[`${side}_material`])
        }))
    case 'p3':
      return filled(
        value('total_staff'), value('staff_required'), value('recovery_level'), value('prioritization_strategy'),
        value('outstanding_strategy'), value('alt_site_strategy'), value('seats_current'), value('seats_required'),
        value('res_pc'), value('res_phone'), value('res_fax'), value('res_copier'),
      ) && (category !== 'Business Critical' || filled(value('vital_record'), value('vital_record_location')))
    case 'p4':
      return filled(value('description'), value('frequency'), value('critical_timings'), value('critical_activity'))
  }
}
