<script setup lang="ts">
import type { RaFirmsHotspot, RaFirmsReport } from '~/composables/useRa'

/**
 * The building map's "Fire hotspots (NASA FIRMS)" tab. The buildings and branches with a fire
 * hotspot within the radius in the last 7 days, the most first, each with how many, the
 * nearest and the strongest, and "Show on map". Then the hotspots near a building, newest
 * first, each with "Show on map". It says when FIRMS was last read and credits NASA FIRMS as
 * the source. Without a MAP_KEY it says FIRMS is off.
 */
const props = defineProps<{
  report: RaFirmsReport | null | undefined
  error?: unknown
  selectedId?: number | null
}>()
const emit = defineEmits<{ show: [hotspot: RaFirmsHotspot], place: [id: number] }>()

const near = computed(() => (props.report?.items ?? []).filter((item) => item.near))
const CONFIDENCE: Record<string, string> = { low: 'Low', nominal: 'Nominal', high: 'High' }
function power(frp: number | null) {
  return frp === null ? 'not reported' : `${formatNumber(frp, 1)} MW`
}
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    data-testid="ra-firms"
  >
    <template #header>
      <h2 class="text-lg font-semibold">
        Fire hotspots (NASA FIRMS)
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
        title="Could not load NASA FIRMS's fire hotspots"
        :description="apiErrorMessage(error)"
      />
      <UAlert
        v-else-if="report && !report.enabled"
        color="neutral"
        variant="subtle"
        icon="i-lucide-power-off"
        title="Fire hotspots from NASA FIRMS are off"
        :description="report.configured ? 'BCM switches them on in Administration › Sites configuration › Past disasters.' : 'The server has no FIRMS MAP_KEY yet. Ask the administrator to set FIRMS_MAP_KEY.'"
      />
      <UAlert
        v-else-if="report?.stale"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock-alert"
        :title="report.polled_at ? `NASA FIRMS hasn't been read since ${formatDateTime(report.polled_at)}` : 'NASA FIRMS hasn\'t been read yet'"
        :description="report.poll_error ?? 'The map may miss recent hotspots.'"
      />

      <template v-if="report?.enabled && !error">
        <p class="text-sm text-muted">
          {{ formatNumber(report.matching, 0) }} {{ report.matching === 1 ? 'hotspot' : 'hotspots' }} over Indonesia in the last {{ report.days }} days,
          {{ formatNumber(report.affected, 0) }} {{ report.affected === 1 ? 'building or branch' : 'buildings or branches' }} within {{ formatNumber(report.radius_km, 1) }} km of one.
        </p>

        <section
          v-if="report.buildings.length"
          aria-labelledby="firms-buildings"
          class="space-y-2"
        >
          <h3
            id="firms-buildings"
            class="text-sm font-semibold text-highlighted"
          >
            Buildings and branches near a hotspot
          </h3>
          <ul class="divide-y divide-default rounded-md border border-default">
            <li
              v-for="building in report.buildings"
              :key="building.id"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm"
            >
              <span
                class="inline-flex h-6 min-w-9 items-center justify-center rounded bg-[#dc2626] px-1.5 text-xs font-semibold tabular-nums text-white"
                :aria-label="`${building.count} ${building.count === 1 ? 'hotspot' : 'hotspots'}`"
              >{{ building.count }}</span>
              <button
                type="button"
                class="font-medium text-primary hover:underline"
                @click="emit('place', building.id)"
              >
                {{ building.name }}
              </button>
              <span class="text-muted">
                nearest {{ formatNumber(building.nearest_km, 1) }} km · latest {{ formatDateTime(building.last) }} · strongest {{ power(building.max_frp) }}
              </span>
            </li>
          </ul>
        </section>

        <section
          v-if="near.length"
          aria-labelledby="firms-near"
          class="space-y-2"
        >
          <h3
            id="firms-near"
            class="text-sm font-semibold text-highlighted"
          >
            Hotspots near a building
          </h3>
          <ul class="max-h-[24rem] divide-y divide-default overflow-y-auto rounded-md border border-default">
            <li
              v-for="hotspot in near"
              :key="hotspot.id"
              :data-hotspot="hotspot.id"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm"
              :class="{ 'bg-primary/5': hotspot.id === selectedId }"
              :aria-current="hotspot.id === selectedId ? 'true' : undefined"
            >
              <span class="min-w-0 flex-1">
                <span class="font-medium text-highlighted">{{ formatDateTime(hotspot.acquired_at) }}</span>
                <span class="text-muted">
                  · {{ CONFIDENCE[hotspot.confidence] }} confidence · {{ power(hotspot.frp) }} · {{ hotspot.satellite ?? hotspot.source }}{{ hotspot.daynight === 'N' ? ', night' : '' }}
                </span>
              </span>
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-locate-fixed"
                label="Show on map"
                @click="emit('show', hotspot)"
              />
            </li>
          </ul>
        </section>
        <p
          v-else
          class="py-4 text-center text-sm text-muted"
        >
          No hotspot within {{ formatNumber(report.radius_km, 1) }} km of a building or branch in the last {{ report.days }} days.
        </p>
        <p
          v-if="report.matching > report.items.length"
          class="text-sm text-muted"
        >
          The map shows {{ formatNumber(report.items.length, 0) }} of {{ formatNumber(report.matching, 0) }} hotspots, those near a building first, then the newest.
        </p>
      </template>

      <p class="text-xs text-muted">
        Source: {{ report?.source ?? 'NASA FIRMS (Fire Information for Resource Management System)' }},
        <a
          :href="report?.source_url ?? 'https://firms.modaps.eosdis.nasa.gov/'"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline"
        >firms.modaps.eosdis.nasa.gov</a>.
      </p>
    </div>
  </UCard>
</template>
