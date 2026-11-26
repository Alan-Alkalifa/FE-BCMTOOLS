<script setup lang="ts">
import type { RaGdacsAlert, RaGdacsReport } from '~/composables/useRa'

/**
 * The building map's "Disaster alerts (GDACS)" tab. GDACS's alerts over Indonesia of the last
 * 7 days (earthquake, tropical cyclone, flood, volcano, drought, forest fire), Red first, each
 * with its level, dates, the buildings and branches within the radius, GDACS's report
 * and "Show on map". It says when GDACS was last read and credits GDACS as the source.
 */
const props = defineProps<{
  report: RaGdacsReport | null | undefined
  error?: unknown
  selectedId?: number | null
}>()
const emit = defineEmits<{ show: [alert: RaGdacsAlert], place: [id: number] }>()

const { data: hazardTypes } = useRaHazardTypes()
const names = computed(() => Object.fromEntries((hazardTypes.value?.items ?? []).map((item) => [item.code, item.short_name])))
const LEVEL: Record<string, { color: 'success' | 'warning' | 'error', class: string }> = {
  Green: { color: 'success', class: 'bg-[#15803d]' },
  Orange: { color: 'warning', class: 'bg-[#c2410c]' },
  Red: { color: 'error', class: 'bg-[#b91c1c]' },
}
const counts = computed(() => {
  const found = { Red: 0, Orange: 0, Green: 0 }
  for (const item of props.report?.items ?? []) found[item.alert_level] += 1
  return found
})
function dates(alert: RaGdacsAlert) {
  const start = formatDateTime(alert.from_at)
  return alert.to_at && alert.to_at !== alert.from_at ? `${start} to ${formatDateTime(alert.to_at)}` : start
}
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    data-testid="ra-gdacs"
  >
    <template #header>
      <h2 class="text-lg font-semibold">
        Disaster alerts (GDACS)
      </h2>
      <p
        v-if="report?.polled_at"
        class="text-xs text-muted"
      >
        Updated {{ formatDateTime(report.polled_at) }}
      </p>
    </template>

    <div class="space-y-3 p-4 sm:p-6">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load GDACS's disaster alerts"
        :description="apiErrorMessage(error)"
      />
      <UAlert
        v-else-if="report && !report.enabled"
        color="neutral"
        variant="subtle"
        icon="i-lucide-power-off"
        title="Disaster alerts from GDACS are switched off"
        description="BCM switches them on in Administration › Sites configuration › Past disasters."
      />
      <UAlert
        v-else-if="report?.stale"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock-alert"
        :title="report.polled_at ? `GDACS hasn't been read since ${formatDateTime(report.polled_at)}` : 'GDACS hasn\'t been read yet'"
        :description="report.poll_error ?? 'The list may miss recent alerts.'"
      />

      <p
        v-if="report?.items.length"
        class="text-sm text-muted"
      >
        {{ formatNumber(report.matching, 0) }} {{ report.matching === 1 ? 'alert' : 'alerts' }} over Indonesia in the last {{ report.days }} days
        ({{ counts.Red }} Red, {{ counts.Orange }} Orange, {{ counts.Green }} Green),
        {{ formatNumber(report.affected, 0) }} {{ report.affected === 1 ? 'building or branch' : 'buildings or branches' }} within {{ formatNumber(report.radius_km, 0) }} km of one.
      </p>
      <ul
        v-if="report?.items.length"
        class="max-h-[32rem] divide-y divide-default overflow-y-auto rounded-md border border-default"
      >
        <li
          v-for="alert in report.items"
          :key="alert.id"
          :data-alert="alert.id"
          class="flex flex-col gap-2 p-3 sm:flex-row sm:items-start"
          :class="{ 'bg-primary/5': alert.id === selectedId }"
          :aria-current="alert.id === selectedId ? 'true' : undefined"
        >
          <span
            class="inline-flex h-6 min-w-9 shrink-0 items-center justify-center self-start rounded px-1.5 text-xs font-bold text-white"
            :class="LEVEL[alert.alert_level]?.class"
            aria-hidden="true"
          >{{ alert.event_type }}</span>
          <div class="min-w-0 flex-1 space-y-1 text-sm">
            <p class="font-medium text-highlighted">
              {{ alert.name ?? alert.type_label }}
            </p>
            <p class="flex flex-wrap items-center gap-1 text-muted">
              <UBadge
                :color="LEVEL[alert.alert_level]?.color ?? 'neutral'"
                variant="subtle"
                size="sm"
                :label="`${alert.alert_level} alert`"
              />
              <UBadge
                v-if="alert.hazard_code"
                color="neutral"
                variant="subtle"
                size="sm"
                :label="`${alert.hazard_code} · ${names[alert.hazard_code] ?? alert.type_label}`"
              />
              <span>{{ alert.type_label }} · {{ dates(alert) }}</span>
            </p>
            <p
              v-if="alert.places.length"
              class="flex flex-wrap items-center gap-x-2 gap-y-1 text-highlighted"
            >
              <UIcon
                name="i-lucide-building-2"
                class="size-4"
              />
              <button
                v-for="near in alert.places"
                :key="near.id"
                type="button"
                class="text-primary hover:underline"
                @click="emit('place', near.id)"
              >
                {{ near.name }} ({{ formatNumber(near.distance_km, 1) }} km)
              </button>
            </p>
            <p
              v-else
              class="text-muted"
            >
              No building or branch within {{ formatNumber(report.radius_km, 0) }} km.
            </p>
            <ULink
              v-if="alert.report_url"
              :to="alert.report_url"
              target="_blank"
              rel="noopener"
              class="text-xs text-primary hover:underline"
            >
              GDACS report
            </ULink>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-locate-fixed"
            label="Show on map"
            class="self-start"
            @click="emit('show', alert)"
          />
        </li>
      </ul>
      <p
        v-else-if="report && report.enabled && !error"
        class="py-4 text-center text-sm text-muted"
      >
        No GDACS alert over Indonesia in the last {{ report.days }} days.
      </p>

      <p class="text-xs text-muted">
        Source: {{ report?.source ?? 'GDACS (Global Disaster Alert and Coordination System)' }},
        <a
          :href="report?.source_url ?? 'https://www.gdacs.org/'"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline"
        >gdacs.org</a>.
      </p>
    </div>
  </UCard>
</template>
