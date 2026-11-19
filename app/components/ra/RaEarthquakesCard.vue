<script setup lang="ts">
import type { RaEarthquake, RaEarthquakeList } from '~/composables/useRa'

/**
 * The building map's "Recent earthquakes (BMKG)": BMKG's earthquakes of the last days that are
 * of magnitude 5.0 or more or felt, newest first, each with the buildings and branches within
 * the alert radius, the shakemap, and either the disasters declared from it or "Declare
 * disaster". It says when BMKG was last read, warns when that is long ago, and always credits
 * BMKG as the source (BMKG's terms).
 */
const props = defineProps<{
  list: RaEarthquakeList | null | undefined
  error?: unknown
  selectedId?: number | null
}>()
const emit = defineEmits<{ select: [quake: RaEarthquake], declare: [quake: RaEarthquake] }>()

const items = computed(() => props.list?.items ?? [])

/** Orange from magnitude 5.0, red from 6.0; a smaller one felt by people is info. */
function tone(quake: RaEarthquake) {
  if (quake.magnitude >= 6) return 'error' as const
  if (quake.magnitude >= 5) return 'warning' as const
  return 'info' as const
}

function nearText(quake: RaEarthquake) {
  const [first, ...rest] = quake.nearby
  if (!first) return `No building or branch within ${raFormatDistance(quake.alert_radius_km * 1000)}.`
  const more = rest.length ? ` and ${rest.length} more` : ''
  return `${first.location.name}, ${raFormatDistance(first.distance_m)} from the epicentre${more}.`
}
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    data-testid="ra-earthquakes"
  >
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold">
            Recent earthquakes (BMKG)
          </h2>
          <p class="text-sm text-muted">
            The last {{ list?.days ?? 7 }} days: magnitude {{ raFormatMagnitude(list?.min_magnitude ?? 5) }} or more, or felt by people. BCM is emailed when a building or branch is within the earthquake's alert radius, e<sup>(M ÷ 1,01 − 0,13)</sup> km ({{ raFormatDistance(raAlertRadiusKm(list?.min_magnitude ?? 5) * 1000) }} at M{{ raFormatMagnitude(list?.min_magnitude ?? 5) }}).
          </p>
        </div>
        <p
          v-if="list?.polled_at"
          class="text-xs text-muted"
        >
          Updated {{ formatDateTime(list.polled_at) }}
        </p>
      </div>
    </template>

    <div class="space-y-3 p-4 sm:p-6">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load the earthquakes"
        :description="apiErrorMessage(error)"
      />
      <UAlert
        v-else-if="list && !list.enabled"
        color="neutral"
        variant="subtle"
        icon="i-lucide-power-off"
        title="Earthquakes from BMKG are switched off"
        description="BCM switches them on in Administration › Sites configuration › Earthquakes."
      />
      <UAlert
        v-else-if="list?.stale"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock-alert"
        :title="list.polled_at ? `BMKG hasn't been read since ${formatDateTime(list.polled_at)}` : 'BMKG hasn\'t been read yet'"
        :description="list.poll_error ? `The last try: ${list.poll_error}` : 'The list may miss recent earthquakes. Check BMKG directly if something just happened.'"
      />

      <ul
        v-if="items.length"
        class="divide-y divide-default rounded-md border border-default"
      >
        <li
          v-for="quake in items"
          :key="quake.id"
          :data-quake="quake.id"
          class="flex flex-col gap-2 p-3 sm:flex-row sm:items-start"
          :class="{ 'bg-warning/5': quake.id === selectedId }"
        >
          <UBadge
            :color="tone(quake)"
            variant="subtle"
            size="lg"
            class="w-fit shrink-0 tabular-nums"
            :label="`M${raFormatMagnitude(quake.magnitude)}`"
          />
          <div class="min-w-0 flex-1 space-y-1 text-sm">
            <p class="font-medium text-highlighted">
              {{ quake.region ?? raFormatCoordinates({ lat: quake.latitude, lng: quake.longitude }) }}
            </p>
            <p class="text-muted">
              {{ formatDateTime(quake.occurred_at) }}<template v-if="quake.depth_km !== null">
                · {{ quake.depth_km }} km deep
              </template>
            </p>
            <p v-if="quake.felt">
              <span class="text-muted">Felt:</span> {{ quake.felt }}
            </p>
            <p v-if="quake.tsunami">
              <!-- BMKG's latest earthquake (autogempa, the one with a shakemap) words its Potensi
                   more widely, e.g. "felt, to be passed on to the public": Potential. -->
              <span class="text-muted">{{ quake.shakemap_url ? 'Potential' : 'Tsunami' }}:</span> {{ quake.tsunami }}
            </p>
            <p :class="quake.nearby.length ? 'text-highlighted' : 'text-muted'">
              <UIcon
                v-if="quake.nearby.length"
                name="i-lucide-building-2"
                class="mr-1 inline-block size-4 align-text-bottom"
              />{{ nearText(quake) }}
            </p>
            <p
              v-if="quake.incidents.length"
              class="flex flex-wrap items-center gap-2"
            >
              <span class="text-muted">Declared:</span>
              <NuxtLink
                v-for="incident in quake.incidents"
                :key="incident.id"
                :to="crisisPath(incident.id)"
                class="text-primary hover:underline"
              >{{ incident.ref_no }}</NuxtLink>
            </p>
          </div>
          <div class="flex flex-wrap gap-2 sm:justify-end">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-locate-fixed"
              label="Show on map"
              @click="emit('select', quake)"
            />
            <UButton
              v-if="quake.shakemap_url"
              :to="quake.shakemap_url"
              target="_blank"
              rel="noopener"
              color="neutral"
              variant="ghost"
              size="sm"
              trailing-icon="i-lucide-external-link"
              label="Shakemap"
            />
            <UButton
              v-if="list?.can_declare && !quake.incidents.length"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-siren"
              label="Declare Disaster"
              @click="emit('declare', quake)"
            />
          </div>
        </li>
      </ul>
      <p
        v-else-if="list && list.enabled && !error"
        class="py-4 text-center text-sm text-muted"
      >
        No earthquake of magnitude {{ raFormatMagnitude(list.min_magnitude) }} or more, or felt, in the last {{ list.days }} days.
      </p>

      <p class="text-xs text-muted">
        Source: {{ list?.source ?? 'BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)' }},
        <a
          :href="list?.source_url ?? 'https://data.bmkg.go.id/gempabumi/'"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline"
        >data.bmkg.go.id</a>.
      </p>
    </div>
  </UCard>
</template>
