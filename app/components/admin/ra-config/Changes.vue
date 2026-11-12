<script setup lang="ts">
import type { RaConfigChange, RaConfigVersion } from '~/composables/useRaConfigAdmin'

/** What this version changes against the version it was copied from: the publish review. */
const props = defineProps<{ version: RaConfigVersion }>()

const { data, status, error, refresh } = useAsyncData(
  () => `ra-config-diff-${props.version.kind}-${props.version.code}`,
  () => raConfigApi.diff(props.version),
  { watch: [() => props.version] },
)

const sections = computed(() => {
  const groups = new Map<string, RaConfigChange[]>()
  for (const change of data.value?.changes ?? []) {
    if (!groups.has(change.part)) groups.set(change.part, [])
    groups.get(change.part)!.push(change)
  }
  return [...groups.entries()]
})

const ITEMS: Record<string, string> = {
  type_description: 'Building type description',
  hazard_intro: 'Hazards introduction',
  signoff_statement_en: 'Sign-off statement',
  risk_summary_note_en: 'Risk Summary note',
  building_pending_note_en: 'Building approver card',
}

function item(change: RaConfigChange) {
  const name = ITEMS[change.item] ?? change.item.replaceAll('_', ' ')
  return change.field === 'Text' ? name : [name, change.field].filter(Boolean).join(' · ')
}

function kind(change: RaConfigChange) {
  if (change.from === null) return 'added'
  if (change.to === null) return 'removed'
  return 'changed'
}
const CHANGE = defineStatusScale<'added' | 'removed' | 'changed'>({
  added: { label: 'Added', color: 'success', icon: 'i-lucide-plus' },
  removed: { label: 'Removed', color: 'error', icon: 'i-lucide-minus' },
  changed: { label: 'Changed', color: 'warning', icon: 'i-lucide-pencil' },
})
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
      v-else-if="!data?.against"
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
      :title="`${version.code} is the same as ${data.against}.`"
    />
    <template v-else>
      <p class="text-sm text-muted">
        {{ formatNumber(data.changes.length) }} change{{ data.changes.length === 1 ? '' : 's' }} against {{ data.against }}.
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
          <table class="w-full text-left text-sm">
            <caption class="sr-only">
              Changes to {{ section }}
            </caption>
            <thead class="bg-muted text-xs text-muted uppercase">
              <tr>
                <th class="w-64 px-3 py-2 ps-4">
                  Item
                </th>
                <th class="w-28 px-3 py-2">
                  Change
                </th>
                <th class="px-3 py-2">
                  {{ data.against }}
                </th>
                <th class="px-3 py-2 pe-4">
                  {{ version.code }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="change in changes"
                :key="`${change.item}-${change.field}`"
              >
                <th
                  scope="row"
                  class="px-3 py-2 ps-4 text-left align-top font-medium"
                >
                  {{ item(change) }}
                </th>
                <td class="px-3 py-2 align-top">
                  <StatusBadge
                    :scale="CHANGE"
                    :value="kind(change)"
                    size="sm"
                  />
                </td>
                <td class="px-3 py-2 align-top whitespace-pre-line text-muted">
                  {{ change.from ?? '—' }}
                </td>
                <td class="px-3 py-2 pe-4 align-top whitespace-pre-line">
                  {{ change.to ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>
  </div>
</template>
