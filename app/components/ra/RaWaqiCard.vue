<script setup lang="ts">
import type { RaMapPlace, RaWaqiReport, RaWaqiStation, RaWaqiStationDetail } from '~/composables/useRa'

/**
 * The building map's "Air quality now (WAQI)" tab. The World Air Quality Index project's
 * stations over the buildings, read live by the map page (it draws them) and never kept, the
 * worst first. Each has its AQI and band, when it was measured and the buildings in its area
 * (Sites configuration sets the area and the AQI from which they are affected). "Affected"
 * lists the stations with an affected building, "With buildings" those with any, "All" every
 * one. The selected station opens with WAQI's own widget, each pollutant and its sources.
 */
const props = defineProps<{
  report: RaWaqiReport | null | undefined
  error?: unknown
  places: RaMapPlace[]
  selectedId?: number | null
}>()
const emit = defineEmits<{ show: [station: RaWaqiStation], place: [id: number], select: [id: number] }>()

type View = 'affected' | 'areas' | 'all'
const view = ref<View>('affected')
const stations = computed(() => props.report?.stations ?? [])
const lists = computed<Record<View, RaWaqiStation[]>>(() => ({
  affected: stations.value.filter((station) => station.affected),
  areas: stations.value.filter((station) => station.places.length),
  all: stations.value,
}))
const shown = computed(() => lists.value[view.value])
const affectedPlaces = computed(() => (props.report?.places ?? []).filter((row) => row.affected).length)
// A station picked on the map is shown in a list that holds it.
watch(() => [props.selectedId, stations.value] as const, ([id]) => {
  if (!id || lists.value[view.value].some((station) => station.id === id)) return
  view.value = lists.value.areas.some((station) => station.id === id) ? 'areas' : 'all'
}, { immediate: true })

const placeName = (id: number) => props.places.find((place) => place.id === id)?.name ?? `Building ${id}`
const bandOf = (code: string | null | undefined) => WAQI_BANDS.find((band) => band.code === code) ?? null

// --- the selected station ----------------------------------------------------------------------

const { data: detail, error: detailError, status: detailStatus } = useAsyncData(
  () => `ra-waqi-station-${props.selectedId ?? 'none'}`,
  () => (props.selectedId ? $fetch<RaWaqiStationDetail>(`/api/ra/waqi/stations/${props.selectedId}`) : Promise.resolve(null)),
  { server: false },
)
/** WAQI first, then the station's own sources. */
const sources = computed(() => [
  { name: 'World Air Quality Index Project', url: 'https://waqi.info' },
  ...(detail.value?.attributions ?? []).filter((item) => !/World Air Quality Index/i.test(item.name)),
])

interface AqiConfig { container: string, city: string, lang: string }
interface AqiFeed {
  (config: AqiConfig | AqiConfig[], key?: string, n?: number): void
  c?: AqiConfig[]
  n?: number
  k?: string
}
const containerId = `waqi-widget-${useId()}`
const widgetFailed = ref(false)
let script: HTMLScriptElement | undefined

/** WAQI's loader, as its widget page gives it: it keeps the settings in `_aqiFeed.c` and loads
 *  the station's script, which fills the container. Set again by each card, for its own state. */
function feed(): AqiFeed {
  const loader: AqiFeed = (config, key, n = 0) => {
    loader.k = loader.k || (key ? `&k=${key}` : '')
    loader.c = Array.isArray(config) ? config : [config]
    loader.n = n
    script?.remove()
    const settings = loader.c[n]!
    script = document.createElement('script')
    script.async = true
    script.src = `https://feed.aqicn.org/feed/${encodeURI(settings.city)}/${settings.lang}/feed.v1.js?n=${n}${loader.k}`
    script.onerror = () => (widgetFailed.value = true)
    document.head.appendChild(script)
  }
  ;(window as unknown as { _aqiFeed?: AqiFeed })._aqiFeed = loader
  return loader
}

function showWidget() {
  const city = detail.value?.station?.widget_city
  const box = document.getElementById(containerId)
  if (!city || !box) return
  box.replaceChildren()
  widgetFailed.value = false
  feed()({ container: containerId, city, lang: 'en' })
}
watch(() => [detail.value?.station?.widget_city, view.value], () => nextTick(showWidget))
onMounted(() => nextTick(showWidget))
onBeforeUnmount(() => script?.remove())
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    data-testid="ra-waqi"
  >
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold">
            Air quality now (WAQI)
          </h2>
          <p
            v-if="report?.enabled"
            class="text-xs text-muted"
          >
            Updated {{ formatDateTime(report.read_at) }} · Affected means AQI {{ report.threshold }} or more within {{ formatNumber(report.radius_km, 1) }} km of a station
          </p>
        </div>
        <UTabs
          v-if="report?.enabled"
          v-model="view"
          :items="[
            { label: `Affected (${lists.affected.length})`, value: 'affected' },
            { label: `With buildings (${lists.areas.length})`, value: 'areas' },
            { label: `All stations (${lists.all.length})`, value: 'all' },
          ]"
          :content="false"
          size="sm"
          aria-label="WAQI stations to show"
        />
      </div>
    </template>

    <div class="space-y-3 p-4 sm:p-6">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not read WAQI"
        :description="apiErrorMessage(error)"
      />
      <UAlert
        v-else-if="report && !report.enabled"
        color="warning"
        variant="subtle"
        icon="i-lucide-key-round"
        title="No WAQI token on the server"
        description="Nothing is read until WAQI_TOKEN is set in the backend's .env."
      />
      <p
        v-else-if="report?.message"
        class="text-sm text-muted"
      >
        {{ report.message }}
      </p>
      <p
        v-else-if="!report"
        class="text-sm text-muted"
      >
        Reading WAQI…
      </p>

      <p
        v-if="report?.enabled && !report.message"
        class="text-sm"
        :class="affectedPlaces ? 'text-highlighted' : 'text-muted'"
      >
        {{ affectedPlaces ? `${affectedPlaces} ${affectedPlaces === 1 ? 'building or branch is' : 'buildings and branches are'} affected now.` : 'No building or branch is affected now.' }}
      </p>

      <ul
        v-if="shown.length"
        class="divide-y divide-default rounded-md border border-default"
      >
        <li
          v-for="station in shown"
          :key="station.id"
          :data-station="station.id"
          class="space-y-3 p-3"
          :class="{ 'bg-primary/5': station.id === selectedId }"
          :aria-current="station.id === selectedId ? 'true' : undefined"
        >
          <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
            <span
              class="inline-flex h-7 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums"
              :style="{ backgroundColor: bandOf(station.band?.code)?.hex ?? '#94a3b8', color: bandOf(station.band?.code)?.text ?? '#ffffff' }"
            >{{ station.aqi ?? '–' }}</span>
            <div class="min-w-0 flex-1 space-y-1 text-sm">
              <p class="font-medium text-highlighted">
                {{ station.name ?? 'WAQI station' }}
              </p>
              <p class="text-muted">
                {{ station.band?.label ?? 'No reading' }}<template v-if="station.measured_at">
                  · Measured {{ formatDateTime(station.measured_at) }}
                </template>
              </p>
              <p
                v-if="station.places.length"
                class="flex flex-wrap items-center gap-x-2 gap-y-1"
              >
                <UBadge
                  v-if="station.affected"
                  color="error"
                  variant="subtle"
                  size="sm"
                  label="Affected"
                />
                <UIcon
                  v-else
                  name="i-lucide-building-2"
                  class="size-4 text-muted"
                />
                <button
                  v-for="place in station.places"
                  :key="place.id"
                  type="button"
                  class="text-primary hover:underline"
                  @click="emit('place', place.id)"
                >
                  {{ placeName(place.id) }} ({{ formatNumber(place.distance_km, 1) }} km)
                </button>
              </p>
              <p
                v-else
                class="text-muted"
              >
                No building or branch in its area.
              </p>
            </div>
            <div class="flex flex-wrap gap-2 sm:justify-end">
              <UButton
                v-if="station.id !== selectedId"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-info"
                label="Details"
                @click="emit('select', station.id)"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-locate-fixed"
                label="Show on map"
                @click="emit('show', station)"
              />
            </div>
          </div>

          <div
            v-if="station.id === selectedId"
            class="grid items-start gap-4 border-t border-default pt-3 lg:grid-cols-2"
            data-testid="waqi-detail"
          >
            <div class="space-y-2">
              <div
                :id="containerId"
                class="min-h-24"
                data-testid="waqi-widget"
              />
              <p
                v-if="widgetFailed"
                class="text-sm text-muted"
              >
                WAQI's widget could not load.
              </p>
            </div>
            <div class="space-y-2 text-sm">
              <UAlert
                v-if="detailError"
                color="error"
                variant="subtle"
                icon="i-lucide-circle-alert"
                title="Could not read the station"
                :description="apiErrorMessage(detailError)"
              />
              <p
                v-else-if="detailStatus === 'pending' && !detail"
                class="text-muted"
              >
                Reading the station…
              </p>
              <dl
                v-else-if="detail?.station"
                class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5"
              >
                <template v-if="detail.dominant">
                  <dt class="text-muted">
                    Main pollutant
                  </dt>
                  <dd>{{ detail.dominant }}</dd>
                </template>
                <template
                  v-for="item in detail.pollutants ?? []"
                  :key="item.code"
                >
                  <dt class="text-muted">
                    {{ item.label }}
                  </dt>
                  <dd class="tabular-nums">
                    AQI {{ formatNumber(item.value, 0) }}
                  </dd>
                </template>
                <template v-if="detail.station.url">
                  <dt class="text-muted">
                    Station page
                  </dt>
                  <dd>
                    <ULink
                      :to="detail.station.url"
                      target="_blank"
                      class="text-primary hover:underline"
                    >
                      aqicn.org
                    </ULink>
                  </dd>
                </template>
              </dl>
              <p
                v-if="detail?.station"
                class="text-xs text-muted"
              >
                Data from
                <template
                  v-for="(item, index) in sources"
                  :key="item.name"
                >
                  <ULink
                    v-if="item.url"
                    :to="item.url"
                    target="_blank"
                    class="hover:underline"
                  >
                    {{ item.name }}
                  </ULink>
                  <span v-else>{{ item.name }}</span>{{ index < sources.length - 1 ? ', ' : '.' }}
                </template>
              </p>
            </div>
          </div>
        </li>
      </ul>
      <p
        v-else-if="report?.enabled && !report.message && !error"
        class="py-4 text-center text-sm text-muted"
      >
        {{ view === 'all' ? 'WAQI has no station over the buildings.' : view === 'areas' ? 'No station has a building or branch in its area.' : 'No station has an affected building or branch.' }}
      </p>

      <p class="text-xs text-muted">
        Source. {{ report?.source ?? 'World Air Quality Index Project' }},
        <a
          :href="report?.source_url ?? 'https://waqi.info'"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline"
        >waqi.info</a>, and the stations' own sources.
      </p>
    </div>
  </UCard>
</template>
