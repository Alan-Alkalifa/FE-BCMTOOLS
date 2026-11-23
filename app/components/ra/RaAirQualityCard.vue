<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import type { RaAirQualityReport, RaAirTrend, RaIspuBand, RaMapPlace } from '~/composables/useRa'

/**
 * The building map's "Air quality (OpenAQ)" tab.
 * - A bar chart of each place's latest PM2.5, coloured by its ISPU band, with the threshold.
 * - A line chart of the daily PM2.5 at one place's station over the years picked (the place
 *   selected on the map, or the worst), with the ISPU bands behind it.
 * - The list of every pinned place read so far, the worst latest first, with its station, the
 *   worst day and the days above the threshold. "Show on map" selects the place.
 * OpenAQ is credited as the source.
 */
const props = defineProps<{
  places: RaMapPlace[]
  selectedId?: number | null
}>()
const emit = defineEmits<{ select: [id: number] }>()

const { data: report, error } = useFetch<RaAirQualityReport>('/api/ra/air-quality', { key: 'ra-air-quality' })

const BANDS: Record<RaIspuBand, { label: string, color: 'success' | 'info' | 'warning' | 'error', hex: string }> = {
  baik: { label: 'Baik', color: 'success', hex: '#16a34a' },
  sedang: { label: 'Sedang', color: 'info', hex: '#2563eb' },
  tidak_sehat: { label: 'Tidak sehat', color: 'warning', hex: '#f59e0b' },
  sangat_tidak_sehat: { label: 'Sangat tidak sehat', color: 'error', hex: '#dc2626' },
  berbahaya: { label: 'Berbahaya', color: 'error', hex: '#7f1d1d' },
}
/** ISPU's PM2.5 bands (µg/m³), for the trend's background. */
const BAND_RANGES: [RaIspuBand, number, number | null][] = [
  ['baik', 0, 15.5],
  ['sedang', 15.5, 55.4],
  ['tidak_sehat', 55.4, 150.4],
  ['sangat_tidak_sehat', 150.4, 250.4],
  ['berbahaya', 250.4, null],
]

const rows = computed(() => (report.value?.items ?? []).flatMap((item) => {
  const place = props.places.find((row) => row.id === item.location_id)
  return place ? [{ ...item, place }] : []
}))
const ug = (value: number) => `${formatNumber(value, 1)} µg/m³`
const latestRead = computed(() => (report.value?.items ?? []).reduce<string | null>(
  (last, item) => (item.read_at && (!last || item.read_at > last) ? item.read_at : last), null))
const threshold = computed(() => report.value?.threshold ?? 55.4)

// --- latest PM2.5 per place --------------------------------------------------------------------

const measured = computed(() => rows.value.filter((row) => row.latest))
const barOption = computed<EChartsOption>(() => {
  // The worst on top.
  const items = [...measured.value].reverse()
  return {
    aria: { enabled: true },
    grid: { left: 8, right: 24, top: 28, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (value) => ug(Number(value)) },
    xAxis: { type: 'value', min: 0 },
    yAxis: { type: 'category', data: items.map((row) => row.place.name), axisLabel: { width: 160, overflow: 'truncate' } },
    series: [{
      type: 'bar',
      name: 'Latest PM2.5',
      barMaxWidth: 18,
      data: items.map((row) => ({ value: row.latest!.value, itemStyle: { color: BANDS[row.latest!.band].hex } })),
      markLine: {
        symbol: 'none',
        lineStyle: { type: 'dashed', color: '#64748b' },
        label: { formatter: `Threshold ${formatNumber(threshold.value, 1)}`, position: 'end', color: '#64748b' },
        data: [{ xAxis: threshold.value }],
      },
    }],
  }
})
const barTable = computed(() => ({
  columns: ['Place', 'PM2.5 (µg/m³)', 'ISPU', 'Day'],
  rows: measured.value.map((row) => [row.place.name, formatNumber(row.latest!.value, 1) ?? '', BANDS[row.latest!.band].label, formatDate(row.latest!.on) ?? '']),
}))
const barSummary = computed(() => {
  const above = measured.value.filter((row) => row.latest!.value > threshold.value).length
  return `${above} of ${measured.value.length} places above ${ug(threshold.value)} on their latest day.`
})
const barHeight = computed(() => Math.max(200, measured.value.length * 28 + 48))

// --- daily trend of one place ------------------------------------------------------------------

const picked = ref<number | null>(null)
watch(() => props.selectedId, (id) => {
  if (id && rows.value.some((row) => row.location_id === id)) picked.value = id
})
const trendId = computed(() => picked.value ?? measured.value[0]?.location_id ?? null)
const trendPlace = computed(() => rows.value.find((row) => row.location_id === trendId.value) ?? null)
const placeItems = computed(() => rows.value.filter((row) => row.station).map((row) => ({ label: row.place.name, value: row.location_id })))
const yearItems = raYearItems(2016)
const from = ref<number | null>(null)
const to = ref<number | null>(null)
const backwards = computed(() => from.value !== null && to.value !== null && from.value > to.value)
// Read again when the place or the years change (the key follows them).
const { data: trend, status: trendStatus } = useAsyncData(
  () => `ra-air-trend-${trendId.value ?? 'none'}-${from.value ?? ''}-${to.value ?? ''}`,
  () => (trendId.value && !backwards.value
    ? $fetch<RaAirTrend>(`/api/ra/air-quality/${trendId.value}/days`, { query: { from: from.value ?? undefined, to: to.value ?? undefined } })
    : Promise.resolve(null)),
)
const trendOption = computed<EChartsOption>(() => {
  const limit = trend.value?.threshold ?? threshold.value
  const top = Math.max(limit, ...(trend.value?.items ?? []).map((item) => item.value))
  return {
    aria: { enabled: true },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (value) => ug(Number(value)) },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', min: 0 },
    series: [{
      type: 'line',
      name: 'Daily PM2.5',
      showSymbol: false,
      lineStyle: { width: 1.5, color: '#334155' },
      itemStyle: { color: '#334155' },
      data: (trend.value?.items ?? []).map((item) => [item.day, item.value]),
      markLine: {
        symbol: 'none',
        lineStyle: { type: 'dashed', color: '#64748b' },
        label: { formatter: `Threshold ${formatNumber(limit, 1)}`, position: 'insideEndTop', color: '#64748b' },
        data: [{ yAxis: limit }],
      },
      markArea: {
        silent: true,
        data: BAND_RANGES
          .filter(([, low]) => low < top)
          .map(([band, low, high]) => [
            { yAxis: low, itemStyle: { color: BANDS[band].hex, opacity: 0.08 } },
            { yAxis: Math.min(high ?? top * 1.1, top * 1.1) },
          ]),
      },
    }],
  }
})
const trendTable = computed(() => ({
  columns: ['Day', 'PM2.5 (µg/m³)'],
  rows: (trend.value?.items ?? []).map((item) => [formatDate(item.day) ?? item.day, formatNumber(item.value, 1) ?? '']),
}))
const trendSummary = computed(() => {
  const items = trend.value?.items ?? []
  if (!items.length) return ''
  const limit = trend.value?.threshold ?? threshold.value
  const above = items.filter((item) => item.value > limit).length
  return `${formatNumber(above, 0)} of ${formatNumber(items.length, 0)} days above ${ug(limit)} at ${trend.value?.station ?? 'the station'}, ${formatNumber(trend.value?.distance_km ?? 0, 1)} km away.`
})
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="measured.length"
      class="grid items-start gap-4 xl:grid-cols-2"
      data-testid="air-charts"
    >
      <AppChart
        title="Latest PM2.5 per place (µg/m³)"
        :summary="barSummary"
        :option="barOption"
        :table="barTable"
        :height="barHeight"
      />
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <USelectMenu
            :model-value="trendId ?? undefined"
            value-key="value"
            :items="placeItems"
            class="w-full sm:w-64"
            aria-label="Daily PM2.5 of"
            @update:model-value="(id: number) => (picked = id)"
          />
          <USelectMenu
            :model-value="from ?? undefined"
            value-key="value"
            :items="yearItems"
            placeholder="From year"
            :search-input="false"
            :clear="from !== null"
            class="w-36"
            aria-label="Daily PM2.5 from year"
            @update:model-value="(value: number | null | undefined) => (from = value ?? null)"
          />
          <USelectMenu
            :model-value="to ?? undefined"
            value-key="value"
            :items="yearItems"
            placeholder="To year"
            :search-input="false"
            :clear="to !== null"
            class="w-36"
            aria-label="Daily PM2.5 to year"
            @update:model-value="(value: number | null | undefined) => (to = value ?? null)"
          />
        </div>
        <AppChart
          :title="`Daily PM2.5 (µg/m³) near ${trendPlace?.place.name ?? 'the place'}`"
          :summary="trendSummary"
          :option="trendOption"
          :table="trendTable"
          :loading="trendStatus === 'pending' && !trend"
          :empty="backwards ? 'The to year is before the from year.' : (trend && !trend.items.length ? 'No daily average kept for these years.' : null)"
          :height="280"
        />
      </div>
    </div>

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
          description="BCM switches it on in Administration › Sites configuration › Past disasters."
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
          class="max-h-[32rem] overflow-y-auto divide-y divide-default rounded-md border border-default"
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
          Source: {{ report?.source ?? 'OpenAQ' }},
          <a
            :href="report?.source_url ?? 'https://explore.openaq.org'"
            target="_blank"
            rel="noopener"
            class="text-primary hover:underline"
          >explore.openaq.org</a>.
        </p>
      </div>
    </UCard>
  </div>
</template>
