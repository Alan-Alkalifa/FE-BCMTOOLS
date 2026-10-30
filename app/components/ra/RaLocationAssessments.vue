<script setup lang="ts">
import type { RaAssessmentSummary, RaLocationRef } from '~/composables/useRa'

/**
 * Monitoring > List: a building's RAs (all of them, newest first) shown under its row when
 * "Show in the table" is picked in its RA(s) popover.
 */
const props = defineProps<{ location: RaLocationRef }>()
const emit = defineEmits<{ hide: [] }>()

const ra = useRaModule()
const { data, status, error } = useFetch<{ items: RaAssessmentSummary[] }>('/api/ra/assessments', {
  key: `ra-location-assessments-${props.location.id}`,
  query: { kind: props.location.kind, location_id: props.location.id, per_page: 100 },
})
const rows = computed(() => [...(data.value?.items ?? [])].sort((a, b) => b.period_year - a.period_year || b.id - a.id))

function record(row: RaAssessmentSummary) {
  return raRecordPath(props.location.kind, row)
}

function step(row: RaAssessmentSummary) {
  if (!row.current_signoff_role) return null
  return row.current_step_title || raStepTitle(row.current_signoff_role, ra.value.signoffRoles)
}
</script>

<template>
  <div
    class="space-y-2 bg-elevated/30 px-4 py-3"
    :aria-label="`RAs of ${location.name}`"
    role="region"
  >
    <div class="flex items-center justify-between gap-2">
      <p class="text-sm font-medium text-highlighted">
        RAs of {{ location.name }}<span
          v-if="data"
          class="font-normal text-muted"
        > · {{ rows.length }}</span>
      </p>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-chevron-up"
        label="Hide"
        @click="emit('hide')"
      />
    </div>
    <p
      v-if="status === 'pending' && !data"
      class="text-sm text-muted"
    >
      Loading…
    </p>
    <p
      v-else-if="error"
      class="text-sm text-error"
    >
      {{ apiErrorMessage(error) }}
    </p>
    <div
      v-else
      class="overflow-x-auto rounded-md border border-default bg-default"
    >
      <table class="w-full text-left text-sm">
        <thead class="text-xs text-muted">
          <tr class="border-b border-default">
            <th class="px-3 py-2 font-medium">
              RA
            </th>
            <th class="px-3 py-2 font-medium">
              Period
            </th>
            <th class="px-3 py-2 font-medium">
              Reason
            </th>
            <th class="px-3 py-2 font-medium">
              Assessment date
            </th>
            <th class="px-3 py-2 text-center font-medium">
              Status
            </th>
            <th class="px-3 py-2 font-medium">
              Waiting for
            </th>
            <th class="px-3 py-2 font-medium">
              Highest residual
            </th>
            <th class="px-3 py-2 font-medium">
              Final on
            </th>
            <th class="px-3 py-2 font-medium">
              Renewal due
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="row in rows"
            :key="row.id"
          >
            <td class="px-3 py-2">
              <NuxtLink
                :to="record(row)"
                class="font-mono text-xs text-primary hover:underline"
              >
                {{ row.ref_no ?? `#${row.id}` }}
              </NuxtLink>
            </td>
            <td class="px-3 py-2 tabular-nums">
              {{ row.period_year }}
            </td>
            <td class="px-3 py-2">
              {{ raReasonLabel(row.reason) ?? '—' }}
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              {{ formatDate(row.assessment_date) || '—' }}
            </td>
            <td class="px-3 py-2 text-center">
              <StatusBadge
                :scale="raStatus"
                :value="raStatusKey(row)"
                size="sm"
              />
            </td>
            <td class="px-3 py-2 text-xs text-muted">
              {{ step(row) || '—' }}
            </td>
            <td class="px-3 py-2">
              <StatusBadge
                v-if="row.highest_residual_level"
                :scale="raRiskLevel"
                :value="row.highest_residual_level"
                size="sm"
              />
              <span
                v-else
                class="text-muted"
              >—</span>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              {{ formatDate(row.approved_at) || '—' }}
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              {{ formatDate(row.renewal_date) || '—' }}
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td
              colspan="8"
              class="px-3 py-4 text-center text-muted"
            >
              No RAs yet.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
