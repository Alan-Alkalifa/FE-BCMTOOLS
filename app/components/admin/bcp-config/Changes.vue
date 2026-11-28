<script setup lang="ts">
import type { BcpConfigChange, BcpConfigVersion } from '~/composables/useBcpConfigAdmin'

/** What this version changes against the version it was copied from, as BIA configuration's. */
const props = defineProps<{ version: BcpConfigVersion }>()

const sectionOf = Object.fromEntries(
  BCP_CONFIG_TABS.filter((item) => 'part' in item).map((item) => [(item as { part: string }).part, item.label]),
) as Record<string, string>

const changeStatus = defineStatusScale<BcpConfigChange['change']>({
  added: { label: 'Added', color: 'success', icon: 'i-lucide-plus' },
  removed: { label: 'Removed', color: 'error', icon: 'i-lucide-minus' },
  changed: { label: 'Changed', color: 'warning', icon: 'i-lucide-pencil' },
})

function labelOf(key: string) {
  if (key === '@order') return 'Order'
  return key.charAt(0).toUpperCase() + key.slice(1).replaceAll('_', ' ')
}

const sections = computed(() => {
  const groups = new Map<string, (BcpConfigChange & { label: string })[]>()
  for (const change of props.version.changes) {
    const section = sectionOf[change.part] ?? labelOf(change.part)
    if (!groups.has(section)) groups.set(section, [])
    const [, ...rest] = change.path
    groups.get(section)!.push({ ...change, label: rest.length ? rest.map(labelOf).join(' / ') : section })
  }
  return [...groups.entries()]
})

function display(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    if (!value.length) return '—'
    return value.map((item, index) => `${index + 1}. ${display(item).replaceAll('\n', '\n    ')}`).join('\n')
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => `${labelOf(key)}: ${display(item)}`).join('\n')
  }
  return String(value)
}
</script>

<template>
  <div class="min-w-0 space-y-4">
    <UAlert
      v-if="!version.changes.length"
      color="neutral"
      variant="subtle"
      icon="i-lucide-equal"
      :title="version.based_on ? 'No saved changes against the source version.' : 'This is the first version: there is nothing to compare it with.'"
    />
    <template v-else>
      <p class="text-sm text-muted">
        {{ formatNumber(version.changes.length) }} {{ version.changes.length === 1 ? 'change' : 'changes' }} against {{ version.based_on }}.
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
                  {{ version.based_on }} value
                </th>
                <th
                  scope="col"
                  class="w-1/3 px-3 py-2 pe-4"
                >
                  {{ version.code }} value
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="change in changes"
                :key="JSON.stringify(change.path)"
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
                    :value="change.change"
                    size="sm"
                  />
                </td>
                <td class="min-w-64 px-3 py-2 align-top whitespace-pre-wrap wrap-anywhere text-muted">
                  {{ display(change.previous_value) }}
                </td>
                <td class="min-w-64 px-3 py-2 pe-4 align-top whitespace-pre-wrap wrap-anywhere">
                  {{ display(change.current_value) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>
  </div>
</template>
