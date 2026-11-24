import type { BiancaConfigVersion, BiancaListItems, BiancaListKey } from '~/composables/useBiancaConfigAdmin'

export const BIANCA_LISTS: { key: BiancaListKey, label: string, help: string, maxCode: number, maxActive: number, locked?: boolean }[] = [
  { key: 'periods', label: 'Impact periods', help: 'Order periods from shortest to longest. Keep between 1 and 24 active periods.', maxCode: 255, maxActive: 24 },
  { key: 'suggested_mtd', label: 'Suggested MTD', help: 'Part 1 choices, managed in Master data › Master MTD.', maxCode: 16, maxActive: 64 },
  { key: 'dependency_mtd', label: 'Dependency MTD', help: 'Use a duration, NA, or SLA as the code.', maxCode: 16, maxActive: 66 },
  { key: 'percentages', label: 'Function planned capacity', help: 'MST_Generic Value column I. Use a percentage between 0% and 100%.', maxCode: 8, maxActive: 101 },
  { key: 'upstream_capacity', label: 'Upstream capacity', help: 'MST_Generic Value column F. Use an active function capacity percentage, NA, or SLA.', maxCode: 8, maxActive: 103 },
  { key: 'downstream_capacity', label: 'Downstream capacity', help: 'MST_Generic Value column G. Percentages, NA and SLA for downstream dependencies.', maxCode: 8, maxActive: 103 },
  { key: 'expected_support_capacity', label: 'Expected business support capacity', help: 'MST_Generic Value column H. Recovery level options for Part 3.', maxCode: 8, maxActive: 103 },
  { key: 'generic_values', label: 'Generic percentages', help: 'MST_Generic Value column E. Includes NA and SLA. Planned capacity for each business function uses percentages only (column I).', maxCode: 8, maxActive: 103 },
  { key: 'alt_site_strategies', label: 'Alternate site strategies', help: 'Use the workbook value as the code.', maxCode: 128, maxActive: 50 },
  { key: 'frequencies', label: 'Critical timing frequencies', help: 'Use the workbook frequency as the code. If only Quartly or Quarterly is active, import accepts the alternate spelling.', maxCode: 64, maxActive: 64 },
  { key: 'system_usage', label: 'System dependency codes', help: 'The BIA gap rule uses these codes. You can edit their label and text.', maxCode: 32, maxActive: 3, locked: true },
  { key: 'yes_no', label: 'Yes / No codes', help: 'BIA uses these codes in validation and Excel. You can edit their label and text.', maxCode: 3, maxActive: 2, locked: true },
]

export function biancaListItems(version: BiancaConfigVersion): BiancaListItems {
  return Object.fromEntries(BIANCA_LISTS.map(({ key }) => [
    key,
    toRaw(version.list_items?.[key] ?? (version.payload[key] ?? version.payload.upstream_capacity).map((code) => ({ code, label: code, text: null, active: true }))),
  ])) as BiancaListItems
}
