<script setup lang="ts">
import type { RaAirQualityReport, RaIspuBand, RaMapPlace } from '~/composables/useRa'

/**
 * The building map's "Air quality (OpenAQ)" tab. Each pinned place read so far, the worst
 * latest PM2.5 first, with its ISPU band, its nearest station, the worst day and the days above
 * the threshold. "Show on map" selects the place. OpenAQ is credited as the source.
 */
const props = defineProps<{
  report: RaAirQualityReport | null | undefined
  places: RaMapPlace[]
  error?: unknown
  selectedId?: number | null
}>()
const emit = defineEmits<{ select: [id: number] }>()

const BANDS: Record<RaIspuBand, { label: string, color: 'success' | 'info' | 'warning' | 'error' }> = {
  baik: { label: 'Baik', color: 'success' },
  sedang: { label: 'Sedang', color: 'info' },
  tidak_sehat: { label: 'Tidak sehat', color: 'warning' },
  sangat_tidak_sehat: { label: 'Sangat tidak sehat', color: 'error' },
  berbahaya: { label: 'Berbahaya', color: 'error' },
}

const rows = computed(() => (props.report?.items ?? []).flatMap((item) => {
  const place = props.places.find((row) => row.id === item.location_id)
  return place ? [{ ...item, place }] : []
}))
const ug = (value: number) => `${formatNumber(value, 1)} µg/m³`
const latestRead = computed(() => (props.report?.items ?? []).reduce<string | null>(
  (last, item) => (item.read_at && (!last || item.read_at > last) ? item.read_at : last), null))
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    data-testid="ra-air-quality"
  >
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <h2 class="text-lg font-semibold">
          Air quality near the buildings (OpenAQ)
        </h2>
        <p
          v-if="latestRead"
          class="text-xs text-muted"
        >
          Updated {{ formatDateTime(latestRead) }}
        </p>
      </div>
    </template>

    <div class="space-y-3 p-4 sm:p-6">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load the air quality"
        :description="apiErrorMessage(error)"
      />
      <UAlert
        v-else-if="report && !report.enabled"
        color="neutral"
        variant="subtle"
        icon="i-lucide-power-off"
        title="Air quality from OpenAQ is switched off"
        description="BCM switches it on in Administration › RA configuration › Past disasters."
      />
      <UAlert
        v-else-if="report && !report.configured"
        color="warning"
        variant="subtle"
        icon="i-lucide-key-round"
        title="No OpenAQ API key on the server"
        description="Nothing is read until OPENAQ_API_KEY is set in the backend's .env."
      />
      <UAlert
        v-else-if="report?.error"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock-alert"
        title="The last OpenAQ run had a problem"
        :description="report.error"
      />

      <ul
        v-if="rows.length"
        class="divide-y divide-default rounded-md border border-default"
      >
        <li
          v-for="row in rows"
          :key="row.location_id"
          :data-place="row.location_id"
          class="flex flex-col gap-2 p-3 sm:flex-row sm:items-start"
          :class="{ 'bg-warning/5': row.location_id === selectedId }"
        >
          <UBadge
            v-if="row.latest"
            :color="BANDS[row.latest.band].color"
            variant="subtle"
            size="lg"
            class="w-fit shrink-0 tabular-nums"
            :label="`${formatNumber(row.latest.value, 1)} · ${BANDS[row.latest.band].label}`"
          />
          <UBadge
            v-else
            color="neutral"
            variant="subtle"
            size="lg"
            class="w-fit shrink-0"
            label="No data"
          />
          <div class="min-w-0 flex-1 space-y-1 text-sm">
            <p class="font-medium text-highlighted">
              {{ row.place.name }}
            </p>
            <template v-if="row.station">
              <p class="text-muted">
                {{ row.station }}, {{ formatNumber(row.distance_km ?? 0, 1) }} km away<template v-if="row.latest">
                  · PM2.5 daily average on {{ formatDate(row.latest.on) }}
                </template>
              </p>
              <p v-if="row.days">
                Above {{ ug(row.threshold) }} on {{ formatNumber(row.unhealthy_days, 0) }} of {{ formatNumber(row.days, 0) }} days<template v-if="row.from">
                  since {{ formatDate(row.from) }}
                </template><template v-if="row.worst">
                  · worst {{ ug(row.worst.value) }} on {{ formatDate(row.worst.on) }}
                </template>
              </p>
            </template>
            <p
              v-if="row.error"
              class="text-muted"
            >
              {{ row.error }}
            </p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-locate-fixed"
            label="Show on map"
            @click="emit('select', row.location_id)"
          />
        </li>
      </ul>
      <p
        v-else-if="report && report.enabled && report.configured && !error"
        class="py-4 text-center text-sm text-muted"
      >
        No building has been read from OpenAQ yet.
      </p>
      <p
        v-if="report && report.places > rows.length && rows.length"
        class="text-sm text-muted"
      >
        {{ formatNumber(rows.length, 0) }} of {{ formatNumber(report.places, 0) }} places on the map read so far.
      </p>

      <p class="text-xs text-muted">
        Source. {{ report?.source ?? 'OpenAQ' }},
        <a
          :href="report?.source_url ?? 'https://explore.openaq.org'"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline"
        >explore.openaq.org</a>.
      </p>
    </div>
  </UCard>
</template>
