<script setup lang="ts">
import type { RaWeatherReport, RaWeatherWarning } from '~/composables/useRa'

/**
 * The building map's "Weather warnings (BMKG)" tab. BMKG's active weather early warnings, the
 * ones over a building or branch first, each with its event, area, time and the places inside,
 * "Show on map" (its area) and BMKG's infographic. "History" lists the warnings that were over
 * a place, filtered by year. It says when BMKG was last read and credits BMKG as the source.
 */
const props = defineProps<{
  /** The active warnings, read by the map page (it draws them). */
  active: RaWeatherReport | null | undefined
  error?: unknown
  selectedId?: string | null
}>()
const emit = defineEmits<{ show: [warning: RaWeatherWarning], place: [id: number] }>()

const view = ref<'active' | 'history'>('active')
// A warning picked on the map is an active one: show the active list, where it is.
watch(() => props.selectedId, (id) => {
  if (id) view.value = 'active'
})
const from = ref<number | null>(null)
const to = ref<number | null>(null)
const backwards = computed(() => from.value !== null && to.value !== null && from.value > to.value)
const { data: history, error: historyError } = useAsyncData(
  () => `ra-weather-history-${view.value}-${from.value ?? ''}-${to.value ?? ''}`,
  () => (view.value === 'history' && !backwards.value
    ? $fetch<RaWeatherReport>('/api/ra/weather-warnings', { query: { status: 'history', from: from.value ?? undefined, to: to.value ?? undefined } })
    : Promise.resolve(null)),
)
const report = computed(() => (view.value === 'active' ? props.active : history.value))
const failure = computed(() => (view.value === 'active' ? props.error : historyError.value))
const yearItems = computed(() => raYearItems(props.active?.first_year ?? new Date().getFullYear()))

function when(warning: RaWeatherWarning) {
  return `${formatDateTime(warning.effective_at)} to ${formatDateTime(warning.expires_at)}`
}
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    data-testid="ra-weather"
  >
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold">
            Weather warnings (BMKG)
          </h2>
          <p
            v-if="active?.polled_at"
            class="text-xs text-muted"
          >
            Updated {{ formatDateTime(active.polled_at) }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UTabs
            v-model="view"
            :items="[{ label: `Active (${active?.matching ?? 0})`, value: 'active' }, { label: 'History', value: 'history' }]"
            :content="false"
            size="sm"
            aria-label="Weather warnings to show"
          />
          <template v-if="view === 'history'">
            <USelectMenu
              :model-value="from ?? undefined"
              value-key="value"
              :items="yearItems"
              placeholder="From year"
              :search-input="false"
              :clear="from !== null"
              class="w-36"
              aria-label="Weather warnings from year"
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
              aria-label="Weather warnings to year"
              @update:model-value="(value: number | null | undefined) => (to = value ?? null)"
            />
          </template>
        </div>
      </div>
    </template>

    <div class="space-y-3 p-4 sm:p-6">
      <UAlert
        v-if="view === 'history' && backwards"
        color="warning"
        variant="subtle"
        icon="i-lucide-calendar-x"
        title="The to year is before the from year"
      />
      <UAlert
        v-else-if="failure"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load BMKG's weather warnings"
        :description="apiErrorMessage(failure)"
      />
      <UAlert
        v-else-if="active && !active.enabled"
        color="neutral"
        variant="subtle"
        icon="i-lucide-power-off"
        title="Weather warnings from BMKG are switched off"
        description="BCM switches them on in Administration › Sites configuration › Past disasters."
      />
      <UAlert
        v-else-if="active?.stale"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock-alert"
        :title="active.polled_at ? `BMKG hasn't been read since ${formatDateTime(active.polled_at)}` : 'BMKG hasn\'t been read yet'"
        :description="active.poll_error ?? 'The list may miss recent warnings. Check BMKG directly.'"
      />

      <ul
        v-if="report?.items.length"
        class="max-h-[32rem] overflow-y-auto divide-y divide-default rounded-md border border-default"
      >
        <li
          v-for="warning in report.items"
          :key="warning.id"
          :data-warning="warning.code ?? warning.id"
          class="flex flex-col gap-2 p-3 sm:flex-row sm:items-start"
          :class="{ 'bg-info/5': warning.id === selectedId }"
          :aria-current="warning.id === selectedId ? 'true' : undefined"
        >
          <UBadge
            :color="raWeatherSeverityColor(warning.severity)"
            variant="subtle"
            size="lg"
            class="w-fit shrink-0"
            :label="warning.severity ?? 'Warning'"
          />
          <div class="min-w-0 flex-1 space-y-1 text-sm">
            <p class="font-medium text-highlighted">
              {{ warning.headline ?? warning.event }}
            </p>
            <p class="text-muted">
              {{ when(warning) }}<template v-if="warning.event">
                · {{ warning.event }}
              </template>
            </p>
            <p
              v-if="warning.description"
              class="line-clamp-2 text-muted"
            >
              {{ warning.description }}
            </p>
            <p
              v-if="warning.places.length"
              class="flex flex-wrap items-center gap-x-2 gap-y-1 text-highlighted"
            >
              <UIcon
                name="i-lucide-building-2"
                class="size-4"
              />
              <button
                v-for="place in warning.places"
                :key="place.id"
                type="button"
                class="text-primary hover:underline"
                @click="emit('place', place.id)"
              >
                {{ place.name }}
              </button>
            </p>
            <p
              v-else
              class="text-muted"
            >
              No building or branch inside.
            </p>
          </div>
          <div class="flex flex-wrap gap-2 sm:justify-end">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-locate-fixed"
              label="Show on map"
              @click="emit('show', warning)"
            />
            <UButton
              v-if="warning.infographic_url"
              :to="warning.infographic_url"
              target="_blank"
              rel="noopener"
              color="neutral"
              variant="ghost"
              size="sm"
              trailing-icon="i-lucide-external-link"
              label="Infographic"
            />
          </div>
        </li>
      </ul>
      <p
        v-else-if="report && report.enabled && !failure"
        class="py-4 text-center text-sm text-muted"
      >
        {{ view === 'active' ? 'No active weather warning.' : 'No warning was over a building or branch in these years.' }}
      </p>
      <p
        v-if="view === 'history' && report && report.matching > report.items.length"
        class="text-sm text-muted"
      >
        The latest {{ report.items.length }} of {{ formatNumber(report.matching, 0) }}.
      </p>

      <p class="text-xs text-muted">
        Source: {{ active?.source ?? 'BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)' }},
        <a
          :href="active?.source_url ?? 'https://www.bmkg.go.id/peringatan-dini'"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline"
        >bmkg.go.id</a>.
      </p>
    </div>
  </UCard>
</template>
