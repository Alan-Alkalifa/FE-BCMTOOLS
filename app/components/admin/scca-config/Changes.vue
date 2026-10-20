<script setup lang="ts">
import type { SccaConfigChange, SccaConfigVersion } from '~/composables/useSccaConfigAdmin'

/** What this version changes against the version it was copied from: the publish review. */
const props = defineProps<{ version: SccaConfigVersion }>()

const { data, status, error, refresh } = useAsyncData(
  () => `scca-config-diff-${props.version.code}`,
  () => sccaConfigApi.diff(props.version.code),
  { watch: [() => props.version] },
)

const sections = computed(() => {
  const groups = new Map<string, SccaConfigChange[]>()
  for (const change of data.value?.changes ?? []) {
    if (!groups.has(change.section)) groups.set(change.section, [])
    groups.get(change.section)!.push(change)
  }
  return [...groups.entries()]
})

const CHANGE = defineStatusScale<SccaConfigChange['change']>({
  added: { label: 'Added', color: 'success', icon: 'i-lucide-plus' },
  removed: { label: 'Removed', color: 'error', icon: 'i-lucide-minus' },
  changed: { label: 'Changed', color: 'warning', icon: 'i-lucide-pencil' },
})

function show(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value !== 'object') return String(value)
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${key.replaceAll('_', ' ')}: ${item == null || item === '' ? '—' : typeof item === 'object' ? JSON.stringify(item) : String(item)}`)
    .join('\n')
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the changes"
      :description="configErrorText(error)"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="refresh()"
        />
      </template>
    </UAlert>
    <SkeletonCard
      v-else-if="status === 'pending' && !data"
      :lines="5"
    />
    <UAlert
      v-else-if="!data?.compared_with"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :title="`${version.code} has no earlier version to compare with.`"
    />
    <UAlert
      v-else-if="!data.changes.length"
      color="neutral"
      variant="subtle"
      icon="i-lucide-equal"
      :title="`${version.code} is the same as ${data.compared_with}.`"
    />
    <template v-else>
      <p class="text-sm text-muted">
        {{ formatNumber(data.changes.length) }} change{{ data.changes.length === 1 ? '' : 's' }} against {{ data.compared_with }}.
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
          <table class="w-full text-sm">
            <caption class="sr-only">
              Changes to {{ section }}
            </caption>
            <thead class="bg-muted text-left text-xs uppercase text-muted">
              <tr>
                <th class="w-56 px-3 py-2 ps-4">
                  Item
                </th>
                <th class="w-28 px-3 py-2">
                  Change
                </th>
                <th class="px-3 py-2">
                  {{ data.compared_with }}
                </th>
                <th class="px-3 py-2 pe-4">
                  {{ version.code }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="change in changes"
                :key="change.item"
              >
                <th
                  scope="row"
                  class="px-3 py-2 ps-4 text-left align-top font-medium"
                >
                  {{ change.item }}
                </th>
                <td class="px-3 py-2 align-top">
                  <StatusBadge
                    :scale="CHANGE"
                    :value="change.change"
                    size="sm"
                  />
                </td>
                <td class="whitespace-pre-line px-3 py-2 align-top text-muted">
                  {{ show(change.before) }}
                </td>
                <td class="whitespace-pre-line px-3 py-2 pe-4 align-top">
                  {{ show(change.after) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>
  </div>
</template>
