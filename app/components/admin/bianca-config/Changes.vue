<script setup lang="ts">
import type { BiancaConfigVersion } from '~/composables/useBiancaConfigAdmin'

const props = defineProps<{ version: BiancaConfigVersion }>()

const parts: Record<string, [section: string, label: string]> = {
  staff_grades: ['Personnel levels', 'Personnel categories'],
  periods: ['Lists', 'Impact periods'],
  suggested_mtd: ['Lists', 'Suggested MTD'],
  dependency_mtd: ['Lists', 'Dependency MTD'],
  percentages: ['Lists', 'Function planned capacity'],
  upstream_capacity: ['Lists', 'Upstream capacity'],
  downstream_capacity: ['Lists', 'Downstream capacity'],
  expected_support_capacity: ['Lists', 'Expected business support capacity'],
  generic_values: ['Lists', 'Generic percentages'],
  financial_bands: ['Impact and MTD', 'Financial loss matrix'],
  impact_matrix: ['Impact and MTD', 'Regulatory and customer matrix'],
  alt_site_strategies: ['Lists', 'Alternate site strategies'],
  frequencies: ['Lists', 'Critical timing frequencies'],
  system_usage: ['Lists', 'System dependency codes'],
  yes_no: ['Lists', 'Yes / No codes'],
  loss_alert_idr: ['Impact and MTD', 'Financial loss alert (IDR)'],
  score_alert: ['Impact and MTD', 'Highlighted impact score'],
  scores: ['Impact and MTD', 'Allowed impact scores'],
  hours_per_day: ['Impact and MTD', 'Hours per day'],
  days_per_week: ['Impact and MTD', 'Days per week'],
  max_functions: ['Impact and MTD', 'Function rows in the Excel template'],
  it_slots: ['Impact and MTD', 'IT rows per function'],
  dependency_slots: ['Impact and MTD', 'Non-IT rows per function'],
  review_period_months: ['Impact and MTD', 'Review period of a final BIA (months)'],
  expected_mtd: ['Impact and MTD', 'Expected MTD'],
  mtd_options: ['Impact and MTD', 'Expected MTD master'],
  suggested_mtd_by_period: ['Impact and MTD', 'Suggested MTD by impact period'],
  suggested_mtd_fallback: ['Impact and MTD', 'Suggested MTD fallback'],
  office_location_labels: ['Office location types', 'Location label'],
  guides: ['Guides and statements', 'Guide and statement text'],
  signoff_steps: ['Approval template', 'Sign-off steps'],
}

const changeStatus = defineStatusScale<'added' | 'removed' | 'changed'>({
  added: { label: 'Added', color: 'success', icon: 'i-lucide-plus' },
  removed: { label: 'Removed', color: 'error', icon: 'i-lucide-minus' },
  changed: { label: 'Changed', color: 'warning', icon: 'i-lucide-pencil' },
})

function changeKind(before: unknown, after: unknown) {
  if (before == null) return 'added'
  if (after == null) return 'removed'
  return 'changed'
}

function labelOf(key: string) {
  return key.charAt(0).toUpperCase() + key.slice(1).replaceAll('_', ' ')
}

const fieldLabels: Record<string, string> = {
  '@order': 'Order', 'label': 'Label', 'text': 'Text', 'active': 'Active',
  'min_level': 'First U level', 'max_level': 'Last U level', 'requires_note': 'Note required',
  'signer_mode': 'Signer selection', 'user_id': 'Signer', 'required': 'Required', 'title': 'Title',
  'category': 'Category', 'regulatory': 'Regulatory impact', 'customer': 'Customer impact',
  'description': 'Description',
  'use_it': 'MTD IT', 'use_non_it': 'MTD Non IT',
  'bcm_role': 'Operational BCM role',
}
const guideLabels: Record<string, string> = {
  suggested_mtd: 'Suggested MTD', expected_mtd: 'Expected MTD', regulatory: 'Regulatory impact',
  customer: 'Customer impact', recovery: 'Recovery', attestation: 'Attestation statement',
  it_dependency: 'IT dependencies', non_it_dependency: 'Non-IT dependencies',
  alternate_site: 'Alternate site strategy', risk_assessment: 'Personel and risk assessment',
  critical_timings: 'Critical timings',
}
function changeLabel(change: BiancaConfigVersion['changes'][number], fallback: string) {
  const [, item, ...fields] = change.path ?? []
  if (!item) return fallback
  if (change.part === 'guides') return guideLabels[item] ?? labelOf(item)
  const name = change.part === 'impact_matrix' ? `Score ${item}` : item
  return [fallback, name, ...fields.map((field) => fieldLabels[field] ?? labelOf(field))].join(' / ')
}

const sections = computed(() => {
  const groups = new Map<string, (BiancaConfigVersion['changes'][number] & { label: string })[]>()
  for (const change of props.version.changes) {
    const [section, label] = parts[change.part] ?? ['Other parameters', labelOf(change.part)]
    if (!groups.has(section)) groups.set(section, [])
    groups.get(section)!.push({ ...change, label: changeLabel(change, label) })
  }
  return [...groups.entries()]
})

function display(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    if (!value.length) return '—'
    return value.map((item, index) => {
      const line = display(item)
      return (index + 1) + '. ' + line.replaceAll('\n', '\n    ')
    }).join('\n')
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => labelOf(key) + ': ' + display(item)).join('\n')
  }
  return typeof value === 'number' ? (formatNumber(value, 20) ?? String(value)) : String(value)
}
</script>

<template>
  <div class="min-w-0 space-y-4">
    <UAlert
      v-if="!version.changes.length"
      color="neutral"
      variant="subtle"
      icon="i-lucide-equal"
      title="No saved parameter changes."
    />
    <template v-else>
      <p class="text-sm text-muted">
        {{ formatNumber(version.changes.length) }} parameter {{ version.changes.length === 1 ? 'change' : 'changes' }} against the source version.
      </p>
      <UCard
        v-for="[section, changes] in sections"
        :key="section"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <h2 class="font-semibold text-highlighted">
            {{ section }}
          </h2>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[36rem] text-sm">
            <caption class="sr-only">
              Changes to {{ section }}
            </caption>
            <thead class="bg-muted text-left text-xs uppercase text-muted">
              <tr>
                <th
                  scope="col"
                  class="w-44 px-3 py-2 ps-4"
                >
                  Item
                </th>
                <th
                  scope="col"
                  class="w-24 px-3 py-2"
                >
                  Change
                </th>
                <th
                  scope="col"
                  class="w-1/3 px-3 py-2"
                >
                  Previous version
                </th>
                <th
                  scope="col"
                  class="w-1/3 px-3 py-2"
                >
                  Previous value
                </th>
                <th
                  scope="col"
                  class="w-1/3 px-3 py-2 pe-4"
                >
                  Current version
                </th>
                <th
                  scope="col"
                  class="w-1/3 px-3 py-2 pe-4"
                >
                  Current value
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="change in changes"
                :key="JSON.stringify(change.path ?? [change.part])"
              >
                <th
                  scope="row"
                  class="px-3 py-2 ps-4 text-left align-top font-medium"
                >
                  {{ change.label }}
                </th>
                <td class="px-3 py-2 align-top">
                  <StatusBadge
                    :scale="changeStatus"
                    :value="change.change ?? changeKind(change.before, change.after)"
                    size="sm"
                  />
                </td>
                <td class="px-3 py-2 align-top font-medium">
                  {{ change.previous_version ?? version.previous_version ?? '—' }}
                </td>
                <td class="min-w-64 px-3 py-2 align-top whitespace-pre-wrap wrap-anywhere text-muted">
                  {{ display(change.previous_value !== undefined ? change.previous_value : change.before) }}
                </td>
                <td class="px-3 py-2 align-top font-medium">
                  {{ change.current_version ?? version.current_version ?? version.code }}
                </td>
                <td class="min-w-64 px-3 py-2 pe-4 align-top whitespace-pre-wrap wrap-anywhere">
                  {{ display(change.current_value !== undefined ? change.current_value : change.after) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>
  </div>
</template>
