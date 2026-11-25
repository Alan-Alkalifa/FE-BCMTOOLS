import type { BiancaConfigVersion, BiancaListItems, BiancaListKey } from '~/composables/useBiancaConfigAdmin'

/** `usedIn`: where the workbook (Template BIA Ver2.4) asks for the list. */
export const BIANCA_LISTS: { key: BiancaListKey, label: string, help: string, maxCode: number, maxActive: number, locked?: boolean, usedIn?: string }[] = [
  { key: 'periods', label: 'Impact periods', help: 'Order periods from shortest to longest. Keep between 1 and 24 active periods.', maxCode: 255, maxActive: 24, usedIn: 'Part 1, columns D–K (financial loss) and M–T (scores), one column per period' },
  { key: 'suggested_mtd', label: 'Suggested MTD', help: 'Part 1 choices. This version keeps a copy of Master data › Master MTD, refreshed whenever the draft is saved, submitted and published.', maxCode: 16, maxActive: 64, usedIn: 'Part 1, column U' },
  { key: 'dependency_mtd', label: 'Dependency MTD', help: 'Use a duration, NA, or SLA as the code.', maxCode: 16, maxActive: 66 },
  { key: 'percentages', label: 'Function planned capacity', help: 'MST_Generic Value column I. Use a percentage between 0% and 100%.', maxCode: 8, maxActive: 101 },
  { key: 'upstream_capacity', label: 'Upstream capacity', help: 'MST_Generic Value column F. Use an active function capacity percentage, NA, or SLA.', maxCode: 8, maxActive: 103 },
  { key: 'downstream_capacity', label: 'Downstream capacity', help: 'MST_Generic Value column G. Percentages, NA and SLA for downstream dependencies.', maxCode: 8, maxActive: 103 },
  { key: 'expected_support_capacity', label: 'Expected business support capacity', help: 'MST_Generic Value column H. Recovery level options for Part 3.', maxCode: 8, maxActive: 103 },
  { key: 'generic_values', label: 'Generic percentages', help: 'MST_Generic Value column E. Includes NA and SLA. Planned capacity for each business function uses percentages only (column I).', maxCode: 8, maxActive: 103 },
  { key: 'alt_site_strategies', label: 'Alternate site strategies', help: 'Use the workbook value as the code.', maxCode: 128, maxActive: 50, usedIn: 'Part 3, column L (Recommended Alternate Site Strategy)' },
  { key: 'frequencies', label: 'Critical timing frequencies', help: 'Use the workbook frequency as the code. If only Quartly or Quarterly is active, import accepts the alternate spelling.', maxCode: 64, maxActive: 64, usedIn: 'Part 4, column E' },
  { key: 'system_usage', label: 'System usage', help: 'The Workaround critical gaps rule uses Full Dependency, so the codes stay as they are. You can edit their name and description.', maxCode: 32, maxActive: 3, locked: true, usedIn: 'Part 2a, column M' },
  { key: 'yes_no', label: 'Yes / No answers', help: 'Validation and the Excel template use these codes, so they stay as they are. You can edit their name and description.', maxCode: 3, maxActive: 2, locked: true, usedIn: 'Part 2a columns J and R, Part 2b columns J and K, and the Sign Off and RA questions' },
]

/** Lists > Planned capacity: one table, a column per use (as BIANCA's Master Planned
 * Capacity). Each column is still saved as its own list. */
export const BIANCA_CAPACITY_LISTS: { key: BiancaListKey, short: string, column: string, help: string }[] = [
  { key: 'percentages', short: 'Business function', column: 'Part 2b D · Part 3 D', help: 'Planned capacity for each business function (MST_Generic Value column I). Percentages only.' },
  { key: 'upstream_capacity', short: 'Upstream', column: 'Part 2b G', help: 'Planned capacity of an upstream dependency (column F).' },
  { key: 'downstream_capacity', short: 'Downstream', column: 'Part 2b M', help: 'Planned capacity of a downstream dependency (column G).' },
  { key: 'expected_support_capacity', short: 'Expected support', column: 'Part 3 I', help: 'Expected business/support recovery level (column H).' },
  { key: 'generic_values', short: 'Generic', column: 'MST_Generic E', help: 'Generic percentages (column E).' },
]

export function biancaListItems(version: BiancaConfigVersion): BiancaListItems {
  return Object.fromEntries(BIANCA_LISTS.map(({ key }) => [
    key,
    toRaw(version.list_items?.[key] ?? (version.payload[key] ?? version.payload.upstream_capacity).map((code) => ({ code, label: code, text: null, active: true }))),
  ])) as BiancaListItems
}
