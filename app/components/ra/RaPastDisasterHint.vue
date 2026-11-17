<script setup lang="ts">
/**
 * Under a hazard's Probability. The Historical of occurrence the outside sources suggest, each
 * with Use while the RA can be edited. A suggestion, the assessor still rates.
 * - BNPB's DIBI. How often it recorded this hazard in the building's regency over the window.
 * - WHO's Disease Outbreak News (its hazard, H11 by default). The country's outbreaks.
 * - OpenAQ (its hazard, H10 by default). The days PM2.5 was above the threshold at the station
 *   nearest to the building.
 * RA configuration > Past disasters sets them. A source shows nothing until it has been read.
 */
const props = defineProps<{ locationId: number, code: string, current: RaRatingValue, locked: boolean }>()
const emit = defineEmits<{ use: [rating: RaRatingValue] }>()

const { data } = useRaPastDisasters(() => props.locationId)
const found = computed(() => data.value?.hazards[props.code] ?? null)
const years = (from: string | null, to: string | null) => (from && to ? `${from.slice(0, 4)} to ${to.slice(0, 4)}` : '')
const period = computed(() => (data.value ? years(data.value.from, data.value.to) : ''))
const plural = (count: number) => (count === 1 ? 'once' : `${formatNumber(count, 0)} times`)

const who = computed(() => {
  const value = data.value?.outbreaks
  return value && value.enabled && value.synced_at && value.hazard_code === props.code ? value : null
})
const air = computed(() => {
  const value = data.value?.air
  if (!value || !value.enabled || !value.configured || value.hazard_code !== props.code) return null
  return value.station || value.error || !value.has_coordinates ? value : null
})
const dibi = computed(() => {
  if (!data.value?.synced_at) return false
  // Another source speaks for this hazard: DIBI's "none" would only add noise.
  return found.value || !(who.value || air.value)
})
const ug = (value: number) => `${formatNumber(value, 1)} µg/m³`

function canUse(rating: RaRatingValue | null | undefined): rating is RaRatingValue {
  return !!rating && !props.locked && props.current !== rating
}
</script>

<template>
  <div
    v-if="data && (dibi || who || air)"
    class="space-y-2 rounded-md border border-default bg-elevated/40 px-3 py-2 text-sm"
    data-testid="past-disasters"
  >
    <div v-if="dibi">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p v-if="!data.regency">
          <UIcon
            name="i-lucide-history"
            class="me-1 size-4 align-text-bottom text-muted"
          />
          <span class="text-muted">No DIBI regency matches this building's city ({{ data.city || 'not filled in' }}), so there is no suggestion.</span>
        </p>
        <p v-else-if="found">
          <UIcon
            name="i-lucide-history"
            class="me-1 size-4 align-text-bottom text-muted"
          />
          BNPB recorded it <span class="font-medium">{{ plural(found.events) }}</span> in {{ data.regency }} from {{ period }}.
          Suggested Historical of occurrence <span class="font-medium">{{ found.rating }}</span>.
        </p>
        <p v-else>
          <UIcon
            name="i-lucide-history"
            class="me-1 size-4 align-text-bottom text-muted"
          />
          <span class="text-muted">BNPB recorded none in {{ data.regency }} from {{ period }}.</span>
        </p>
        <UButton
          v-if="canUse(found?.rating)"
          size="xs"
          color="neutral"
          variant="outline"
          :label="`Use ${found!.rating}`"
          @click="emit('use', found!.rating)"
        />
      </div>
      <p
        v-if="found?.kinds.length"
        class="mt-1 text-xs text-muted"
      >
        {{ found.kinds.join(', ') }}<template v-if="found.last">
          · last on {{ formatDate(found.last) }}
        </template> · Source BNPB DIBI
      </p>
    </div>

    <div
      v-if="who"
      data-testid="outbreak-news"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p v-if="who.events">
          <UIcon
            name="i-lucide-biohazard"
            class="me-1 size-4 align-text-bottom text-muted"
          />
          WHO reported outbreaks in {{ who.country }} <span class="font-medium">{{ plural(who.events) }}</span> from {{ years(who.from, who.to) }}.
          Suggested Historical of occurrence <span class="font-medium">{{ who.rating }}</span>.
        </p>
        <p v-else>
          <UIcon
            name="i-lucide-biohazard"
            class="me-1 size-4 align-text-bottom text-muted"
          />
          <span class="text-muted">WHO reported no outbreak in {{ who.country }} from {{ years(who.from, who.to) }}.</span>
        </p>
        <UButton
          v-if="canUse(who.rating)"
          size="xs"
          color="neutral"
          variant="outline"
          :label="`Use ${who.rating}`"
          @click="emit('use', who.rating)"
        />
      </div>
      <ul
        v-if="who.items.length"
        class="mt-1 space-y-0.5 text-xs text-muted"
      >
        <li
          v-for="item in who.items"
          :key="item.url"
        >
          <ULink
            :to="item.url"
            target="_blank"
            class="hover:text-highlighted hover:underline"
          >
            {{ item.title }}
          </ULink>
          · {{ formatDate(item.on) }}
        </li>
      </ul>
      <p class="mt-1 text-xs text-muted">
        Source WHO Disease Outbreak News
      </p>
    </div>

    <div
      v-if="air"
      data-testid="air-quality"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p v-if="!air.has_coordinates">
          <UIcon
            name="i-lucide-wind"
            class="me-1 size-4 align-text-bottom text-muted"
          />
          <span class="text-muted">The building has no coordinates, so OpenAQ can't find a station near it.</span>
        </p>
        <p v-else-if="!air.station || !air.days">
          <UIcon
            name="i-lucide-wind"
            class="me-1 size-4 align-text-bottom text-muted"
          />
          <span class="text-muted">{{ air.error }}</span>
        </p>
        <p v-else-if="air.unhealthy_days">
          <UIcon
            name="i-lucide-wind"
            class="me-1 size-4 align-text-bottom text-muted"
          />
          PM2.5 was above {{ ug(air.threshold) }} on <span class="font-medium">{{ formatNumber(air.unhealthy_days, 0) }} {{ air.unhealthy_days === 1 ? 'day' : 'days' }}</span>
          at {{ air.station }}, {{ formatNumber(air.distance_km ?? 0, 1) }} km away, from {{ years(air.from, air.to) }}.
          Suggested Historical of occurrence <span class="font-medium">{{ air.rating }}</span>.
        </p>
        <p v-else>
          <UIcon
            name="i-lucide-wind"
            class="me-1 size-4 align-text-bottom text-muted"
          />
          <span class="text-muted">PM2.5 stayed at or below {{ ug(air.threshold) }} at {{ air.station }}, {{ formatNumber(air.distance_km ?? 0, 1) }} km away, from {{ years(air.from, air.to) }}.</span>
        </p>
        <UButton
          v-if="canUse(air.rating)"
          size="xs"
          color="neutral"
          variant="outline"
          :label="`Use ${air.rating}`"
          @click="emit('use', air.rating)"
        />
      </div>
      <p
        v-if="air.station && air.days"
        class="mt-1 text-xs text-muted"
      >
        {{ formatNumber(air.days, 0) }} days measured<template v-if="air.worst">
          · worst {{ ug(air.worst.value) }} on {{ formatDate(air.worst.on) }}
        </template><template v-if="air.latest">
          · latest {{ ug(air.latest.value) }} on {{ formatDate(air.latest.on) }}
        </template> · Source OpenAQ
      </p>
    </div>
  </div>
</template>
