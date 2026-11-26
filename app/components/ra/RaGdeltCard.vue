<script setup lang="ts">
import type { RaGdeltPlace, RaGdeltReport } from '~/composables/useRa'

/**
 * The building map's "Incident news (GDELT)" tab. The places in Indonesia that news articles of
 * the last 7 days mentioned for an incident hazard's GDELT themes (the hazards set as Incident;
 * disasters come from BMKG, GDACS and NASA FIRMS), whose headline names both the hazard (one of
 * its keywords) and the place, the ones with a building or branch within the incident radius
 * first, each with its hazards, how many articles, the buildings near it, the latest articles
 * ("Show articles"), "Show on map" and, with a building near it, "Declare incident" for whoever
 * may declare one. A hazard picker keeps one hazard. It says when GDELT was last read and
 * credits GDELT as the source.
 */
const props = defineProps<{
  report: RaGdeltReport | null | undefined
  error?: unknown
  selectedKey?: string | null
  /** The hazard shown, or null for all. */
  hazard: string | null
  /** The user may declare an incident (Declare incident on incident news near a building). */
  canDeclareIncident?: boolean
}>()
const emit = defineEmits<{ 'show': [place: RaGdeltPlace], 'place': [id: number], 'update:hazard': [code: string | null], 'declare': [place: RaGdeltPlace, hazardCode: string] }>()

const { data: hazardTypes } = useRaHazardTypes()
const names = computed(() => Object.fromEntries((hazardTypes.value?.items ?? []).map((item) => [item.code, item.short_name])))
const hazardItems = computed(() => [
  { label: 'All hazards', value: 'all' },
  ...(props.report?.hazards ?? []).map((code) => ({ label: `${code} · ${names.value[code] ?? code}`, value: code })),
])
const hazardModel = computed<string>({
  get: () => props.hazard ?? 'all',
  set: (value) => emit('update:hazard', value === 'all' ? null : value),
})

/** The places whose articles are open (Show articles). */
const expanded = ref(new Set<string>())
function toggle(key: string) {
  const next = new Set(expanded.value)
  if (!next.delete(key)) next.add(key)
  expanded.value = next
}
// A place picked on the map: open its articles.
watch(() => props.selectedKey, (key) => {
  if (key && !expanded.value.has(key)) toggle(key)
}, { immediate: true })
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    data-testid="ra-gdelt"
  >
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold">
            Incident news (GDELT)
          </h2>
          <p
            v-if="report?.polled_at"
            class="text-xs text-muted"
          >
            Updated {{ formatDateTime(report.polled_at) }}
          </p>
        </div>
        <USelectMenu
          v-model="hazardModel"
          value-key="value"
          :items="hazardItems"
          :search-input="false"
          class="w-64"
          aria-label="Hazard of the incident news"
        />
      </div>
    </template>

    <div class="space-y-3 p-4 sm:p-6">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load GDELT's incident news"
        :description="apiErrorMessage(error)"
      />
      <UAlert
        v-else-if="report && !report.enabled"
        color="neutral"
        variant="subtle"
        icon="i-lucide-power-off"
        title="Incident news from GDELT is switched off"
        description="BCM switches it on in Administration › Sites configuration › Past disasters."
      />
      <UAlert
        v-else-if="report?.stale"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock-alert"
        :title="report.polled_at ? `GDELT hasn't been read since ${formatDateTime(report.polled_at)}` : 'GDELT hasn\'t been read yet'"
        :description="report.poll_error ?? 'The list may miss recent news.'"
      />

      <p
        v-if="report?.items.length"
        class="text-sm text-muted"
      >
        {{ formatNumber(report.matching, 0) }} {{ report.matching === 1 ? 'place' : 'places' }},
        {{ formatNumber(report.affected, 0) }} {{ report.affected === 1 ? 'building or branch' : 'buildings or branches' }} within {{ formatNumber(report.radius_km, 1) }} km of one.
      </p>
      <ul
        v-if="report?.items.length"
        class="max-h-[32rem] divide-y divide-default overflow-y-auto rounded-md border border-default"
      >
        <li
          v-for="place in report.items"
          :key="place.key"
          :data-news="place.key"
          class="flex flex-col gap-2 p-3 sm:flex-row sm:items-start"
          :class="{ 'bg-primary/5': place.key === selectedKey }"
          :aria-current="place.key === selectedKey ? 'true' : undefined"
        >
          <span
            class="inline-flex h-6 min-w-9 shrink-0 items-center justify-center self-start rounded bg-[#b45309] px-1.5 text-xs font-semibold tabular-nums text-white"

            :aria-label="`${place.articles_count} ${place.articles_count === 1 ? 'article' : 'articles'}`"
          >{{ place.articles_count }}</span>
          <div class="min-w-0 flex-1 space-y-1 text-sm">
            <p class="font-medium text-highlighted">
              {{ place.name ?? `${place.lat}, ${place.lon}` }}
            </p>
            <p class="flex flex-wrap items-center gap-1 text-muted">
              <UBadge
                v-for="code in place.hazards"
                :key="code"
                color="neutral"
                variant="subtle"
                size="sm"
                :label="`${code} · ${names[code] ?? code}`"
              />
              <span>· latest {{ formatDateTime(place.last) }}</span>
            </p>
            <p
              v-if="place.places.length"
              class="flex flex-wrap items-center gap-x-2 gap-y-1 text-highlighted"
            >
              <UIcon
                name="i-lucide-building-2"
                class="size-4"
              />
              <button
                v-for="near in place.places"
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
              No building or branch within {{ formatNumber(place.radius_km ?? report.radius_km, 1) }} km.
            </p>
            <UButton
              color="neutral"
              variant="link"
              size="xs"
              class="px-0"
              :trailing-icon="expanded.has(place.key) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              :label="expanded.has(place.key) ? 'Hide articles' : 'Show articles'"
              :aria-expanded="expanded.has(place.key)"
              :aria-controls="`news-articles-${place.key}`"
              @click="toggle(place.key)"
            />
            <ul
              v-if="expanded.has(place.key)"
              :id="`news-articles-${place.key}`"
              class="space-y-0.5 text-xs text-muted"
            >
              <li
                v-for="article in place.articles"
                :key="article.url"
              >
                <ULink
                  :to="article.url"
                  target="_blank"
                  rel="noopener"
                  class="text-primary hover:underline"
                >
                  {{ article.title ?? article.domain ?? article.url }}
                </ULink>
                <template v-if="article.title && article.domain">
                  · {{ article.domain }}
                </template>
                · {{ formatDateTime(article.published_at) }} · {{ article.hazard_code }}
              </li>
              <li v-if="place.articles_count > place.articles.length">
                The latest {{ place.articles.length }} of {{ formatNumber(place.articles_count, 0) }}.
              </li>
            </ul>
          </div>
          <div class="flex flex-col items-stretch gap-1 self-start">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-locate-fixed"
              label="Show on map"
              @click="emit('show', place)"
            />
            <UButton
              v-if="canDeclareIncident && place.places.length"
              color="warning"
              variant="outline"
              size="sm"
              :icon="RA_CRISIS_TYPES.incident.icon"
              label="Declare incident"
              @click="emit('declare', place, place.hazards[0]!)"
            />
          </div>
        </li>
      </ul>
      <p
        v-else-if="report && report.enabled && !error"
        class="py-4 text-center text-sm text-muted"
      >
        No incident news in the last {{ report.days }} days whose headline names an incident hazard and the place.
      </p>
      <p
        v-if="report && report.matching > report.items.length"
        class="text-sm text-muted"
      >
        The {{ report.items.length }} first of {{ formatNumber(report.matching, 0) }}.
      </p>

      <p class="text-xs text-muted">
        Source: {{ report?.source ?? 'The GDELT Project' }},
        <a
          :href="report?.source_url ?? 'https://www.gdeltproject.org/'"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline"
        >gdeltproject.org</a>.
      </p>
    </div>
  </UCard>
</template>
