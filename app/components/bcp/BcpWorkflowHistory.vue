<script setup lang="ts">
import type { BcpEventRow, BcpPlan } from '~/composables/useBcp'

/** The Workflow History tab, as the production BCP: what happened to the BCP, newest first. */
const props = defineProps<{ plan: BcpPlan }>()

function section(code: string | undefined) {
  if (!code || code === 'summary') return 'Summary BIA'
  const condition = props.plan.conditions.find((item) => item.code === code)
  return condition ? condition.title.split(':')[0]?.trim() || condition.title : code
}
function activity(event: BcpEventRow) {
  switch (event.action) {
    case 'created': return 'Created'
    case 'saved': return `Saved ${section(event.detail.section)}`
    case 'attachment_added': return 'Attachment uploaded'
    case 'attachment_removed': return 'Attachment removed'
    case 'submitted': return 'Submitted for approval'
    case 'invalidated': return 'Invalid'
    default: return event.action.replaceAll('_', ' ')
  }
}
function remarks(event: BcpEventRow) {
  return event.detail.filename ?? event.detail.reason ?? event.detail.note ?? ''
}
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <h2 class="font-semibold text-highlighted">
        Workflow History
      </h2>
    </template>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[40rem] text-sm">
        <caption class="sr-only">
          Workflow history of {{ plan.ref_no }}
        </caption>
        <thead class="bg-muted text-left text-xs uppercase text-muted">
          <tr>
            <th class="w-44 px-4 py-2">
              Date
            </th>
            <th class="w-56 px-3 py-2">
              Activity
            </th>
            <th class="w-48 px-3 py-2">
              By
            </th>
            <th class="px-4 py-2">
              Remarks
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="event in plan.events"
            :key="event.id"
          >
            <td class="px-4 py-2 align-top">
              {{ formatDateTime(event.at) || '—' }}
            </td>
            <td class="px-3 py-2 align-top">
              {{ activity(event) }}
            </td>
            <td class="px-3 py-2 align-top">
              {{ event.actor || 'System' }}
            </td>
            <td class="px-4 py-2 align-top whitespace-pre-line">
              {{ remarks(event) || '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p
      v-if="!plan.events.length"
      class="py-6 text-center text-sm text-muted"
    >
      Nothing yet.
    </p>
  </UCard>
</template>
