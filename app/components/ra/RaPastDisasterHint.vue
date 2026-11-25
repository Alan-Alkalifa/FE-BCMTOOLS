<script setup lang="ts">
/**
 * Under a hazard's Probability. How often the outside sources recorded the hazard over the
 * review years picked for it (the last 10 without them), for the assessor to weigh.
 * - BNPB's DIBI. Records in the building's regency.
 * - WHO's Disease Outbreak News (its hazard, H11 by default). The country's outbreaks.
 * - OpenAQ (its hazard, H10 by default). Days PM2.5 was above the threshold at the station
 *   nearest to the building.
 * - BMKG's weather early warnings (their hazard, H06 by default). Warnings over the building.
 * - GDELT (each hazard with keywords). Indonesian news articles naming the building's city.
 * - NASA FIRMS (its hazard, H09 by default). Fire hotspots within the radius of the building.
 * - GDACS (each hazard an event type counts for). Alerts within the radius of the building.
 * - Media Cloud (each incident hazard with keywords). Indonesian stories since 2016 whose headline
 *   names the hazard and the building's city.
 * Sites configuration > Past disasters sets them. A source shows nothing until it has been read.
 */
const props = defineProps<{ locationId: number, code: string, fromYear: number | null, toYear: number | null }>()

const { data } = useRaPastDisasters(() => props.locationId, () => ({ from: props.fromYear, to: props.toYear }))
const found = computed(() => data.value?.hazards[props.code] ?? null)
const period = computed(() => (data.value ? span(data.value.from_year, data.value.to_year) : ''))
const plural = (count: number) => (count === 1 ? 'once' : `${formatNumber(count, 0)} times`)
function span(from: number, to: number) {
  return from === to ? `in ${from}` : `from ${from} to ${to}`
}

const who = computed(() => {
  const value = data.value?.outbreaks
  return value && value.enabled && value.synced_at && value.hazard_code === props.code ? value : null
})
const air = computed(() => {
  const value = data.value?.air
  if (!value || !value.enabled || !value.configured || value.hazard_code !== props.code) return null
  return value.station || value.error || !value.has_coordinates ? value : null
})
const warned = computed(() => {
  const value = data.value?.weather
  return value && value.enabled && value.polled_at && value.hazard_code === props.code ? value : null
})
const news = computed(() => {
  const value = data.value?.gdelt
  const hazard = value?.enabled ? value.hazards[props.code] : null
  return value && hazard?.read_at ? { ...hazard, city: value.city, from_year: value.from_year, to_year: value.to_year } : null
})
const fires = computed(() => {
  const value = data.value?.firms
  return value && value.enabled && value.hazard_code === props.code && (value.read_at || !value.has_coordinates) ? value : null
})
/** FIRMS's counts start later than the review. */
const firesLate = computed(() => {
  const held = fires.value?.held_from
  return held && Number(held.slice(0, 4)) >= (fires.value?.from_year ?? 0) ? held : null
})
const alerts = computed(() => {
  const value = data.value?.gdacs
  if (!value?.enabled || !value.polled_at || !value.has_coordinates) return null
  const hazard = value.hazards[props.code]
  return hazard ? { ...value, hazard } : null
})
const alertsLate = computed(() => {
  const held = alerts.value?.held_from
  return held && Number(held.slice(0, 4)) >= (alerts.value?.from_year ?? 0) ? held : null
})
const archive = computed(() => {
  const value = data.value?.mediacloud
  const hazard = value?.enabled ? value.hazards[props.code] : null
  return value && (hazard?.read_at || hazard?.read_until) ? { ...hazard, city: value.city, from_year: value.from_year, to_year: value.to_year } : null
})
/** The hazard's history is still coming in: the last day read so far. */
const archiveSoFar = computed(() => (archive.value && !archive.value.read_at ? archive.value.read_until ?? null : null))
const archiveLate = computed(() => {
  const held = archive.value?.held_from
  return held && Number(held.slice(0, 4)) > (archive.value?.from_year ?? 0) ? held : null
})
const GDACS_LEVEL: Record<string, string> = { Green: 'text-success', Orange: 'text-warning', Red: 'text-error' }
/** GDELT's counts start later than the review. */
const newsLate = computed(() => {
  const held = news.value?.held_from
  return held && Number(held.slice(0, 4)) >= (news.value?.from_year ?? 0) ? held : null
})
const dibi = computed(() => {
  if (!data.value?.synced_at) return false
  // Another source speaks for this hazard: DIBI's "none" would only add noise.
  return found.value || !(who.value || air.value || warned.value || news.value || fires.value || alerts.value || archive.value)
})
/** BMKG's warnings are kept from a later day than the review starts. */
const warnedLate = computed(() => {
  const held = warned.value?.held_from
  return held && Number(held.slice(0, 4)) >= (warned.value?.from_year ?? 0) ? held : null
})
/** DIBI keeps records from a later year than the review starts. */
const dibiLate = computed(() => data.value?.held_from && data.value.held_from > data.value.from_year ? data.value.held_from : null)
const airLate = computed(() => {
  const held = air.value?.held_from
  return held && Number(held.slice(0, 4)) > (air.value?.from_year ?? 0) ? held : null
})
const ug = (value: number) => `${formatNumber(value, 1)} µg/m³`
</script>

<template>
  <div
    v-if="data && (dibi || who || air || warned || news || fires || alerts || archive)"
    class="space-y-2 rounded-md border border-default bg-elevated/40 px-3 py-2 text-sm"
    data-testid="past-disasters"
  >
    <div v-if="dibi">
      <p v-if="!data.regency">
        <UIcon
          name="i-lucide-history"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">No DIBI regency matches this building's city ({{ data.city || 'not filled in' }}).</span>
      </p>
      <p v-else-if="found">
        <UIcon
          name="i-lucide-history"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        BNPB recorded it <span class="font-medium">{{ plural(found.events) }}</span> in {{ data.regency }} {{ period }}.
      </p>
      <p v-else>
        <UIcon
          name="i-lucide-history"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">BNPB recorded none in {{ data.regency }} {{ period }}.</span>
      </p>
      <p
        v-if="data.regency && (found?.kinds.length || dibiLate)"
        class="mt-1 text-xs text-muted"
      >
        <template v-if="found?.kinds.length">
          {{ found.kinds.join(', ') }}<template v-if="found.last">
            · last on {{ formatDate(found.last) }}
          </template> ·
        </template>
        <template v-if="dibiLate">
          DIBI records are kept from {{ dibiLate }} ·
        </template>
        Source: BNPB DIBI
      </p>
    </div>

    <div
      v-if="warned"
      data-testid="weather-warnings"
    >
      <p v-if="!warned.has_coordinates">
        <UIcon
          name="i-lucide-cloud-lightning"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">The building has no coordinates, so BMKG's warning areas can't be matched to it.</span>
      </p>
      <p v-else-if="warned.events">
        <UIcon
          name="i-lucide-cloud-lightning"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        BMKG warned of severe weather over the building <span class="font-medium">{{ plural(warned.events) }}</span>, on {{ formatNumber(warned.days, 0) }} {{ warned.days === 1 ? 'day' : 'days' }}, {{ span(warned.from_year, warned.to_year) }}.
      </p>
      <p v-else>
        <UIcon
          name="i-lucide-cloud-lightning"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">BMKG warned of no severe weather over the building {{ span(warned.from_year, warned.to_year) }}.</span>
      </p>
      <ul
        v-if="warned.items.length"
        class="mt-1 space-y-0.5 text-xs text-muted"
      >
        <li
          v-for="item in warned.items"
          :key="item.effective_at"
        >
          {{ item.headline ?? item.event }} · {{ formatDateTime(item.effective_at) }}
        </li>
      </ul>
      <p class="mt-1 text-xs text-muted">
        <template v-if="warnedLate">
          Warnings kept from {{ formatDate(warnedLate) }} ·
        </template>
        Source: BMKG weather early warnings
      </p>
    </div>

    <div
      v-if="news"
      data-testid="gdelt-news"
    >
      <p v-if="news.articles">
        <UIcon
          name="i-lucide-newspaper"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        Indonesian news reported it in {{ news.city }} in <span class="font-medium">{{ formatNumber(news.articles, 0) }} {{ news.articles === 1 ? 'article' : 'articles' }}</span>, on {{ formatNumber(news.days, 0) }} {{ news.days === 1 ? 'day' : 'days' }}, {{ span(news.from_year, news.to_year) }}.
      </p>
      <p v-else>
        <UIcon
          name="i-lucide-newspaper"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">Indonesian news reported none in {{ news.city }} {{ span(news.from_year, news.to_year) }}.</span>
      </p>
      <ul
        v-if="news.items.length"
        class="mt-1 space-y-0.5 text-xs text-muted"
      >
        <li
          v-for="item in news.items"
          :key="item.url"
        >
          <ULink
            :to="item.url"
            target="_blank"
            rel="noopener"
            class="hover:text-highlighted hover:underline"
          >
            {{ item.title ?? item.domain ?? item.url }}
          </ULink>
          · {{ formatDate(item.seen_at) }}
        </li>
      </ul>
      <p class="mt-1 text-xs text-muted">
        {{ news.keywords.join(', ') }}<template v-if="newsLate">
          · counted from {{ formatDate(newsLate) }}
        </template> · Source: GDELT
      </p>
    </div>

    <div
      v-if="archive"
      data-testid="mediacloud-news"
    >
      <p v-if="archive.stories">
        <UIcon
          name="i-lucide-archive"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        Indonesian headlines named it in {{ archive.city }} in <span class="font-medium">{{ formatNumber(archive.stories, 0) }} {{ archive.stories === 1 ? 'story' : 'stories' }}</span>, on {{ formatNumber(archive.days, 0) }} {{ archive.days === 1 ? 'day' : 'days' }}, {{ span(archive.from_year, archive.to_year) }}.
      </p>
      <p v-else>
        <UIcon
          name="i-lucide-archive"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">No Indonesian headline named it in {{ archive.city }} {{ span(archive.from_year, archive.to_year) }}.</span>
      </p>
      <ul
        v-if="archive.items.length"
        class="mt-1 space-y-0.5 text-xs text-muted"
      >
        <li
          v-for="item in archive.items"
          :key="item.url"
        >
          <ULink
            :to="item.url"
            target="_blank"
            rel="noopener"
            class="hover:text-highlighted hover:underline"
          >
            {{ item.title ?? item.media_name ?? item.url }}
          </ULink>
          <template v-if="item.media_name">
            · {{ item.media_name }}
          </template>
          · {{ formatDate(item.published_on) }}
        </li>
      </ul>
      <p class="mt-1 text-xs text-muted">
        {{ archive.keywords.join(', ') }} and the city in the headline<template v-if="archiveLate">
          · counted from {{ formatDate(archiveLate) }}
        </template><template v-if="archiveSoFar">
          · read up to {{ formatDate(archiveSoFar) }} so far
        </template> · Source: Media Cloud
      </p>
    </div>

    <div
      v-if="fires"
      data-testid="firms-hotspots"
    >
      <p v-if="!fires.has_coordinates">
        <UIcon
          name="i-lucide-flame"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">The building has no coordinates, so NASA FIRMS's hotspots can't be matched to it.</span>
      </p>
      <p v-else-if="fires.hotspots">
        <UIcon
          name="i-lucide-flame"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        NASA FIRMS saw <span class="font-medium">{{ formatNumber(fires.hotspots, 0) }} fire {{ fires.hotspots === 1 ? 'hotspot' : 'hotspots' }}</span> within {{ formatNumber(fires.radius_km, 1) }} km of the building, on {{ formatNumber(fires.days, 0) }} {{ fires.days === 1 ? 'day' : 'days' }}, {{ span(fires.from_year, fires.to_year) }}.
      </p>
      <p v-else>
        <UIcon
          name="i-lucide-flame"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">NASA FIRMS saw no fire hotspot within {{ formatNumber(fires.radius_km, 1) }} km of the building {{ span(fires.from_year, fires.to_year) }}.</span>
      </p>
      <ul
        v-if="fires.items.length"
        class="mt-1 space-y-0.5 text-xs text-muted"
      >
        <li
          v-for="item in fires.items"
          :key="item.day"
        >
          {{ formatDate(item.day) }} · {{ item.count }} {{ item.count === 1 ? 'hotspot' : 'hotspots' }}<template v-if="item.max_frp !== null">
            · strongest {{ formatNumber(item.max_frp, 1) }} MW
          </template>
        </li>
      </ul>
      <p class="mt-1 text-xs text-muted">
        <template v-if="firesLate">
          Counted from {{ formatDate(firesLate) }} ·
        </template>
        Source: NASA FIRMS (VIIRS)
      </p>
    </div>

    <div
      v-if="alerts"
      data-testid="gdacs-alerts"
    >
      <p v-if="alerts.hazard.events">
        <UIcon
          name="i-lucide-triangle-alert"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        GDACS alerted <span class="font-medium">{{ plural(alerts.hazard.events) }}</span> within {{ formatNumber(alerts.radius_km, 0) }} km of the building {{ span(alerts.from_year, alerts.to_year) }}{{ alerts.hazard.highest ? `, ${alerts.hazard.highest} at most` : '' }}.
      </p>
      <p v-else>
        <UIcon
          name="i-lucide-triangle-alert"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">GDACS alerted none within {{ formatNumber(alerts.radius_km, 0) }} km of the building {{ span(alerts.from_year, alerts.to_year) }}.</span>
      </p>
      <ul
        v-if="alerts.hazard.items.length"
        class="mt-1 space-y-0.5 text-xs text-muted"
      >
        <li
          v-for="item in alerts.hazard.items"
          :key="item.id"
        >
          <span :class="GDACS_LEVEL[item.alert_level]">{{ item.alert_level }}</span> ·
          <ULink
            v-if="item.report_url"
            :to="item.report_url"
            target="_blank"
            rel="noopener"
            class="hover:text-highlighted hover:underline"
          >
            {{ item.name ?? item.type_label }}
          </ULink>
          <template v-else>
            {{ item.name ?? item.type_label }}
          </template>
          · {{ formatDate(item.from_at) }}
        </li>
      </ul>
      <p class="mt-1 text-xs text-muted">
        <template v-if="alertsLate">
          Alerts kept from {{ formatDate(alertsLate) }} ·
        </template>
        Source: GDACS
      </p>
    </div>

    <div
      v-if="who"
      data-testid="outbreak-news"
    >
      <p v-if="who.events">
        <UIcon
          name="i-lucide-biohazard"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        WHO reported outbreaks in {{ who.country }} <span class="font-medium">{{ plural(who.events) }}</span> {{ span(who.from_year, who.to_year) }}.
      </p>
      <p v-else>
        <UIcon
          name="i-lucide-biohazard"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">WHO reported no outbreak in {{ who.country }} {{ span(who.from_year, who.to_year) }}.</span>
      </p>
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
        Source: WHO Disease Outbreak News
      </p>
    </div>

    <div
      v-if="air"
      data-testid="air-quality"
    >
      <p v-if="!air.has_coordinates">
        <UIcon
          name="i-lucide-wind"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">The building has no coordinates, so OpenAQ can't find a station near it.</span>
      </p>
      <p v-else-if="!air.station">
        <UIcon
          name="i-lucide-wind"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">{{ air.error }}</span>
      </p>
      <p v-else-if="!air.days">
        <UIcon
          name="i-lucide-wind"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">{{ air.station }} has no daily PM2.5 average {{ span(air.from_year, air.to_year) }}.</span>
      </p>
      <p v-else-if="air.unhealthy_days">
        <UIcon
          name="i-lucide-wind"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        PM2.5 was above {{ ug(air.threshold) }} on <span class="font-medium">{{ formatNumber(air.unhealthy_days, 0) }} {{ air.unhealthy_days === 1 ? 'day' : 'days' }}</span>
        at {{ air.station }}, {{ formatNumber(air.distance_km ?? 0, 1) }} km away, {{ span(air.from_year, air.to_year) }}.
      </p>
      <p v-else>
        <UIcon
          name="i-lucide-wind"
          class="me-1 size-4 align-text-bottom text-muted"
        />
        <span class="text-muted">PM2.5 stayed at or below {{ ug(air.threshold) }} at {{ air.station }}, {{ formatNumber(air.distance_km ?? 0, 1) }} km away, {{ span(air.from_year, air.to_year) }}.</span>
      </p>
      <p
        v-if="air.station && air.days"
        class="mt-1 text-xs text-muted"
      >
        {{ formatNumber(air.days, 0) }} days measured<template v-if="air.worst">
          · worst {{ ug(air.worst.value) }} on {{ formatDate(air.worst.on) }}
        </template><template v-if="airLate">
          · days kept from {{ formatDate(airLate) }}
        </template> · Source: OpenAQ
      </p>
    </div>
  </div>
</template>
