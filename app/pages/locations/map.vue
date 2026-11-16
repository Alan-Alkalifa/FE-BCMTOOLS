<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaCrisisType, RaEarthquake, RaMapMarker, RaMapPlace, RaPin } from '~/composables/useRa'
import RaCrisisModal from '~/components/ra/RaCrisisModal.vue'

/**
 * Every head office building and branch with a map pin, on one map: measure the distance
 * between any two, see what is near a place, and declare a disaster. Open disasters show for
 * everyone until they are closed. A place not approved yet (new, or to deactivate) carries an
 * hourglass badge, a rejected one a cross and an inactive one a pause sign; a place not in
 * service (inactive, new and waiting, or rejected) is faded and no disaster affects it. The
 * legend and the list say so too. The map zooms with the scroll wheel while "Scroll to zoom" is
 * on.
 *
 * BMKG's recent earthquakes (magnitude 5.0 or more, or felt) show as rings at their epicentre
 * and in "Recent earthquakes (BMKG)" below the map, refreshed every 2 minutes; selecting one
 * (?quake=3) draws its alert radius, and a disaster can be declared from it. BMKG is credited
 * as the source next to the map and the list (BMKG's terms).
 */
definePageMeta({ permission: ['location.access', 'ra.access', 'ra_branch.access'] })

const route = useRoute()
const router = useRouter()
const { can } = useAuth()
const { data, status, error, refresh } = useRaMap()
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const crisisModal = useOverlay().create(RaCrisisModal)
const mapRef = useTemplateRef<{ focus: (pin: RaPin) => void, fit: (pins: RaPin[]) => void }>('map')

const showHeadOffice = ref(true)
const showBranches = ref(true)
/** Places not in service: inactive, new and waiting for approval, or rejected. */
const showInactive = ref(true)
const showQuakes = ref(true)

// BMKG's recent earthquakes, read again every 2 minutes (the server polls BMKG as often).
const { data: quakeList, error: quakeError, refresh: refreshQuakes } = useRaEarthquakes(7)
const quakes = computed(() => quakeList.value?.items ?? [])
let quakeTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  quakeTimer = setInterval(() => refreshQuakes(), 120_000)
  // The map data is shared with the disaster page (the same key): read it again on arrival, so
  // a disaster approved, rejected or closed meanwhile is shown as it stands now.
  if (data.value) refresh()
})
onBeforeUnmount(() => clearInterval(quakeTimer))

/** The selected earthquake stays in the URL (?quake=3), as the email links to it. */
const selectedQuakeId = computed<number | null>({
  get: () => Number(route.query.quake) || null,
  set: (id) => router.replace({ query: { ...route.query, quake: id ?? undefined } }),
})
const selectedQuake = computed(() => quakes.value.find((item) => item.id === selectedQuakeId.value) ?? null)

function quakeLabel(quake: RaEarthquake) {
  return `Earthquake M${raFormatMagnitude(quake.magnitude)}, ${formatDateTime(quake.occurred_at)}: ${quake.region ?? 'BMKG'}`
}

/** The map shows every place until the user picks an earthquake or a place: from then on it
 *  stays where they put it, also when the selected ring changes or the earthquakes are read
 *  again, instead of zooming back out to everything. */
const autoFit = ref(true)

/** Select an earthquake and zoom the map to it: its epicentre with the alert radius around it.
 *  `scroll`: bring the map into view first (from the list under it, or the email's link). */
function selectQuake(quake: RaEarthquake, scroll = false) {
  autoFit.value = false
  showQuakes.value = true
  selectedQuakeId.value = quake.id
  if (scroll) {
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.getElementById('building-map')?.scrollIntoView({ behavior, block: 'center' })
  }
  const radius = (quakeList.value?.alert_radius_km ?? 100) * 1000
  const dLat = radius / 111_320
  const dLng = radius / (111_320 * Math.cos((quake.latitude * Math.PI) / 180))
  mapRef.value?.fit([
    { lat: quake.latitude + dLat, lng: quake.longitude + dLng },
    { lat: quake.latitude - dLat, lng: quake.longitude - dLng },
  ])
}

// Opened from the email (?quake=3): show it once the list and the map are there.
watch([quakes, mapRef], ([items, map]) => {
  const quake = items.find((item) => item.id === selectedQuakeId.value)
  if (quake && map) nextTick(() => selectQuake(quake, true))
}, { once: true })

async function declareFromQuake(quake: RaEarthquake) {
  const list = quakeList.value
  if (!list) return
  const crisis = await crisisModal.open({
    places: places.value,
    fromQuake: {
      earthquake: quake,
      hazardCode: list.hazard_code,
      // The alert radius, within what a disaster allows (200 km).
      radiusM: Math.min(list.alert_radius_km * 1000, 200_000),
      source: list.source,
    },
  }).result
  if (crisis) await navigateTo(crisisPath(crisis.id, crisis.type))
}
/** Zoom the map with the mouse wheel or trackpad (on by default here; the page still scrolls
 *  outside the map). */
const scrollZoom = ref(true)

/** A place's status badge as the Buildings register shows it, without "Active". */
function badgesOf(place: RaMapPlace): RaBuildingState[] {
  const state = raBuildingState(place)
  return state === 'active' ? [] : [state]
}
/** The marker's badge: its approval first, otherwise a pause sign when it is inactive. */
function pinOfState(place: RaMapPlace): RaPinApproval | null {
  const approval = raBuildingApproval(place)
  if (approval === 'rejected') return 'rejected'
  if (approval) return 'waiting'
  return raInService(place) ? null : 'inactive'
}
const places = computed(() => data.value?.places ?? [])
const visible = computed(() => places.value.filter((place) =>
  (place.kind === 'branch' ? showBranches.value : showHeadOffice.value)
  && (showInactive.value || raInService(place))))
const counts = computed(() => ({
  head_office: places.value.filter((place) => place.kind === 'head_office').length,
  branch: places.value.filter((place) => place.kind === 'branch').length,
  inactive: places.value.filter((place) => !raInService(place)).length,
}))

function byId(id: number | null | undefined) {
  return places.value.find((place) => place.id === id) ?? null
}

function pinOf(place: RaMapPlace): RaPin {
  return { lat: place.latitude, lng: place.longitude }
}

/** The selected place stays in the URL (?place=12) so it can be shared. */
const selectedId = computed<number | null>({
  get: () => Number(route.query.place) || null,
  set: (id) => router.replace({ query: { ...route.query, place: id ?? undefined } }),
})
const selected = computed(() => byId(selectedId.value))

function select(id: number) {
  autoFit.value = false
  selectedId.value = id
  const place = byId(id)
  if (place) mapRef.value?.focus(pinOf(place))
}

function onMarker(id: number, variant: RaMapMarker['variant']) {
  if (variant === 'crisis') {
    const crisis = data.value?.crises.find((item) => item.id === Number(id))
    return navigateTo(crisisPath(Number(id), crisis?.type))
  }
  autoFit.value = false
  if (variant === 'quake') {
    const quake = quakes.value.find((item) => item.id === id)
    if (quake) selectQuake(quake)
    nextTick(() => document.querySelector(`[data-quake="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    return
  }
  selectedId.value = id
}

// Measure: from and to are any two places.
const fromId = ref<number | undefined>()
const toId = ref<number | undefined>()
const from = computed(() => byId(fromId.value))
const to = computed(() => byId(toId.value))
const distanceM = computed(() => (from.value && to.value ? raDistanceKm(pinOf(from.value), pinOf(to.value)) * 1000 : null))

function swap() {
  [fromId.value, toId.value] = [toId.value, fromId.value]
}

/** Empty both places: the measured line and the From column go. */
function clearMeasure() {
  fromId.value = undefined
  toId.value = undefined
}

function measureFrom(id: number) {
  fromId.value = id
  if (toId.value === id) toId.value = undefined
}

function measureTo(id: number) {
  toId.value = id
  if (fromId.value === id) fromId.value = undefined
}

const placeItems = computed(() => places.value.map((place) => ({
  label: place.name,
  value: place.id,
  description: [RA_PLACE_KIND_LABEL[place.kind], place.region].filter(Boolean).join(' · '),
  icon: place.kind === 'branch' ? 'i-lucide-landmark' : 'i-lucide-building-2',
})))

// What is near the selected place, with an optional ring.
const ringKm = ref<number | 'off'>('off')
const ringItems: { label: string, value: number | 'off' }[] = [
  { label: 'No ring', value: 'off' },
  ...RA_RING_KM.map((km) => ({ label: `${formatNumber(km, 0)} km ring`, value: km })),
]
const nearby = computed(() => {
  const origin = selected.value
  if (!origin) return []
  const rows = places.value
    .filter((place) => place.id !== origin.id)
    .map((place) => ({ place, distanceM: raDistanceKm(pinOf(origin), pinOf(place)) * 1000 }))
    .sort((a, b) => a.distanceM - b.distanceM)
  const ring = ringKm.value
  return ring === 'off' ? rows.slice(0, 5) : rows.filter((row) => row.distanceM <= ring * 1000)
})

const markers = computed<RaMapMarker[]>(() => [
  ...visible.value.map((place) => {
    const badges = badgesOf(place)
    return {
      id: place.id,
      lat: place.latitude,
      lng: place.longitude,
      label: `${place.name} (${RA_PLACE_KIND_LABEL[place.kind]})${badges.length ? `: ${badges.map((state) => raBuildingStatus[state].label).join(', ')}` : ''}`,
      level: (place.latest ? place.latest.highest_residual_level ?? 'na' : 'none') as RaMapMarker['level'],
      variant: place.kind === 'branch' ? 'branch' as const : 'location' as const,
      approval: pinOfState(place),
      outOfService: !raInService(place),
    }
  }),
  ...(data.value?.crises ?? []).map((crisis) => ({
    id: crisis.id,
    lat: crisis.latitude,
    lng: crisis.longitude,
    label: `${crisis.status === 'pending' ? 'Pending approval: ' : ''}${RA_CRISIS_TYPES[crisis.type].label} ${crisis.ref_no}: ${crisis.hazard.short_name}. Open its instructions.`,
    variant: 'crisis' as const,
    pending: crisis.status === 'pending',
  })),
  ...(showQuakes.value ? quakes.value : []).map((quake) => ({
    id: quake.id,
    lat: quake.latitude,
    lng: quake.longitude,
    label: quakeLabel(quake),
    variant: 'quake' as const,
    strong: quake.magnitude >= 6,
  })),
])

const circles = computed(() => [
  ...(data.value?.crises ?? []).map((crisis) => ({
    id: crisis.id,
    lat: crisis.latitude,
    lng: crisis.longitude,
    radiusM: crisis.radius_m,
    crisis: true,
    pending: crisis.status === 'pending',
  })),
  ...(selected.value && ringKm.value !== 'off'
    ? [{ id: -1, ...pinOf(selected.value), radiusM: ringKm.value * 1000, active: true }]
    : []),
  ...(selectedQuake.value && showQuakes.value
    ? [{
        id: -2,
        lat: selectedQuake.value.latitude,
        lng: selectedQuake.value.longitude,
        radiusM: (quakeList.value?.alert_radius_km ?? 100) * 1000,
        quake: true,
      }]
    : []),
])

const line = computed<[RaPin, RaPin] | null>(() => (from.value && to.value ? [pinOf(from.value), pinOf(to.value)] : null))

/** The crisis types the user may declare (`ra.disaster.declare`, `ra.incident.declare`), in `order`. */
function declareTypes(order: RaCrisisType[]) {
  const allowed = data.value?.declare_types ?? order
  return order.filter((type) => allowed.includes(type))
}

async function declare(type: RaCrisisType, locationId?: number) {
  const crisis = await crisisModal.open({ places: places.value, locationId: locationId ?? null, type }).result
  if (crisis) {
    await navigateTo(crisisPath(crisis.id, crisis.type))
  }
}

// The places as a table: the text version of the map.
const search = ref('')
const tableRows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return visible.value
    .filter((place) => !term || [place.name, place.region, place.address].some((text) => text?.toLowerCase().includes(term)))
    .map((place) => ({ ...place, distanceM: from.value ? raDistanceKm(pinOf(from.value), pinOf(place)) * 1000 : null }))
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0) || a.name.localeCompare(b.name))
})
const columns = computed<TableColumn<(typeof tableRows.value)[number]>[]>(() => [
  { accessorKey: 'name', header: 'Place' },
  { accessorKey: 'kind', header: 'Type' },
  { accessorKey: 'region', header: 'Region' },
  { id: 'latest', header: 'Latest residual' },
  ...(from.value ? [{ id: 'distance', header: `From ${from.value.name}`, meta: { class: { th: 'text-right', td: 'text-right' } } }] : []),
])

const unpinnedLinks = computed(() => {
  const unpinned = data.value?.unpinned
  if (!unpinned) return []
  return [
    ...(unpinned.head_office ? [{ type: 'head_office', label: `${unpinned.head_office} ${unpinned.head_office === 1 ? 'building' : 'buildings'}` }] : []),
    ...(unpinned.branch ? [{ type: 'branch', label: `${unpinned.branch} ${unpinned.branch === 1 ? 'branch' : 'branches'}` }] : []),
  ]
})

// Measuring zooms the map to the two places.
watch(line, (pins) => {
  if (pins) mapRef.value?.fit(pins)
})

function locationUrl(place: { id: number, kind: string }) {
  return masterBuildingPath(place.id)
}

function assessmentUrl(place: RaMapPlace) {
  return raRecordPath(place.kind, place.latest!)
}
/** Without RA access the latest RA is named, not linked. */
const canOpenRa = useCanOpenRa()
</script>

<template>
  <AppPage
    title="Building map"
    :crumbs="[{ label: BUILDINGS_GROUP }, { label: 'Building map' }]"
  >
    <template #actions>
      <template v-if="data?.can_declare">
        <UButton
          v-for="type in declareTypes(['incident', 'disaster'])"
          :key="type"
          :color="type === 'disaster' ? 'primary' : 'neutral'"
          :variant="type === 'disaster' ? 'solid' : 'outline'"
          :icon="RA_CRISIS_TYPES[type].icon"
          :label="`Declare ${RA_CRISIS_TYPES[type].label}`"
          @click="declare(type, selected?.id)"
        />
      </template>
    </template>

    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading the building map"
      class="space-y-6"
    >
      <div class="skeleton h-[32rem] w-full" />
    </SkeletonGroup>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the building map"
      :description="apiErrorMessage(error)"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="refresh()"
        />
      </template>
    </UAlert>

    <template v-else-if="data">
      <section
        v-if="data.crises.length"
        aria-label="Open and pending disasters and incidents"
        class="space-y-2"
      >
        <UAlert
          v-for="crisis in data.crises"
          :key="crisis.id"
          :color="crisis.status === 'pending' ? 'warning' : 'error'"
          variant="subtle"
          :icon="crisis.status === 'pending' ? 'i-lucide-hourglass' : 'i-lucide-siren'"
          :title="`${crisis.status === 'pending' ? 'Pending approval: ' : ''}${crisis.hazard.short_name} at ${crisis.location?.name ?? raFormatCoordinates({ lat: crisis.latitude, lng: crisis.longitude })}`"
          :description="`${crisis.ref_no} · since ${formatDateTime(crisis.started_at)} · ${raFormatDistance(crisis.radius_m)} radius · ${crisis.affected_count} ${crisis.affected_count === 1 ? 'place' : 'places'} affected${crisis.status === 'pending' ? ' · waiting for someone else to confirm it' : ''}`"
        >
          <template #actions>
            <UButton
              :to="crisisPath(crisis.id, crisis.type)"
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-arrow-right"
              label="View instructions"
            />
          </template>
        </UAlert>
      </section>

      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <UCard :ui="{ body: 'space-y-3' }">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
            <UCheckbox
              v-model="showHeadOffice"
              :label="`Head office buildings (${counts.head_office})`"
            />
            <UCheckbox
              v-model="showBranches"
              :label="`Branches (${counts.branch})`"
            />
            <UCheckbox
              v-if="counts.inactive"
              v-model="showInactive"
              :label="`Inactive (${counts.inactive})`"
              description="Not in service: inactive, new and waiting for approval, or rejected."
              :ui="{ description: 'sr-only' }"
            />
            <UCheckbox
              v-model="showQuakes"
              :label="`Earthquakes, BMKG (${quakes.length})`"
            />
            <USwitch
              v-model="scrollZoom"
              label="Scroll to zoom"
              description="Zoom the map with the mouse wheel or trackpad."
              :ui="{ description: 'sr-only' }"
            />
            <USelectMenu
              :model-value="selectedId ?? undefined"
              :items="placeItems"
              value-key="value"
              icon="i-lucide-search"
              placeholder="Find a building or branch"
              aria-label="Find a building or branch"
              class="w-full sm:ml-auto sm:w-72"
              @update:model-value="(id: number) => select(id)"
            />
          </div>

          <RaMap
            id="building-map"
            ref="map"
            :markers="markers"
            :circles="circles"
            :line="line"
            :selected="selectedId"
            :auto-fit="autoFit"
            label="Map of the head office buildings and branches. Select a place for its details."
            height-class="h-[32rem]"
            :scroll-zoom="scrollZoom"
            @select="onMarker"
          />

          <RaMapLegend />

          <p class="text-xs text-muted">
            Earthquake data: {{ quakeList?.source ?? 'BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)' }}.
          </p>

          <p
            v-if="unpinnedLinks.length"
            class="flex items-start gap-1.5 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-map-pin-off"
              class="mt-0.5 size-4 shrink-0"
            />
            <span>Not on the map yet (no pin): <template
              v-for="(item, index) in unpinnedLinks"
              :key="item.type"
            ><template v-if="index"> and </template><NuxtLink
              v-if="can('location.master')"
              :to="{ path: MASTER_BUILDINGS_PATH, query: { type: item.type } }"
              class="text-primary hover:underline"
            >{{ item.label }}</NuxtLink><template v-else>{{ item.label }}</template></template>. Set the pin on their Map tab.</span>
          </p>
        </UCard>

        <div class="space-y-6">
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">
                Measure distance
              </h2>
              <p class="text-sm text-muted">
                Between any two buildings or branches, in a straight line.
              </p>
            </template>
            <div class="space-y-3">
              <UFormField label="From">
                <USelectMenu
                  v-model="fromId"
                  :items="placeItems"
                  value-key="value"
                  placeholder="Choose a place"
                  :clear="{ 'aria-label': 'Clear From' }"
                  class="w-full"
                  @clear="fromId = undefined"
                />
              </UFormField>
              <div class="flex justify-center gap-2">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-arrow-down-up"
                  label="Swap"
                  :disabled="!fromId && !toId"
                  @click="swap"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-x"
                  label="Clear"
                  :disabled="!fromId && !toId"
                  @click="clearMeasure"
                />
              </div>
              <UFormField label="To">
                <USelectMenu
                  v-model="toId"
                  :items="placeItems"
                  value-key="value"
                  placeholder="Choose a place"
                  :clear="{ 'aria-label': 'Clear To' }"
                  class="w-full"
                  @clear="toId = undefined"
                />
              </UFormField>
              <div
                v-if="distanceM !== null && from && to"
                class="rounded-md bg-elevated p-3"
                role="status"
              >
                <p class="text-2xl font-semibold text-highlighted tabular-nums">
                  {{ raFormatDistance(distanceM) }}
                </p>
                <p class="text-sm text-muted">
                  Straight line from {{ from.name }} to {{ to.name }}.
                </p>
                <UButton
                  :to="raDirectionsUrl(pinOf(from), pinOf(to))"
                  target="_blank"
                  rel="noopener"
                  variant="link"
                  trailing-icon="i-lucide-external-link"
                  label="Road route in Google Maps"
                  class="px-0"
                />
              </div>
            </div>
          </UCard>

          <UCard v-if="selected">
            <template #header>
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <h2 class="text-lg font-semibold">
                    {{ selected.name }}
                  </h2>
                  <p class="text-sm text-muted">
                    {{ [RA_PLACE_KIND_LABEL[selected.kind], selected.region].filter(Boolean).join(' · ') }}
                  </p>
                  <div
                    v-if="badgesOf(selected).length"
                    class="mt-1 flex flex-wrap gap-1"
                  >
                    <StatusBadge
                      v-for="state in badgesOf(selected)"
                      :key="state"
                      :scale="raBuildingStatus"
                      :value="state"
                      size="sm"
                    />
                  </div>
                </div>
                <UTooltip text="Clear the selection">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-x"
                    aria-label="Clear the selection"
                    @click="selectedId = null"
                  />
                </UTooltip>
              </div>
            </template>
            <div class="space-y-4 text-sm">
              <p
                v-if="selected.address"
                class="text-muted"
              >
                {{ selected.address }}
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-muted">Latest RA:</span>
                <template v-if="selected.latest">
                  <NuxtLink
                    v-if="canOpenRa(selected.kind)"
                    :to="assessmentUrl(selected)"
                    class="text-primary hover:underline"
                  >
                    {{ selected.latest.ref_no ?? selected.latest.period_year }}
                  </NuxtLink>
                  <span v-else>{{ selected.latest.ref_no ?? selected.latest.period_year }}</span>
                  <StatusBadge
                    v-if="selected.latest.highest_residual_level"
                    :scale="raRiskLevel"
                    :value="selected.latest.highest_residual_level"
                    size="sm"
                  />
                </template>
                <span v-else>None yet</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  label="Measure from here"
                  @click="measureFrom(selected.id)"
                />
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  label="Measure to here"
                  @click="measureTo(selected.id)"
                />
                <template v-if="data.can_declare">
                  <UButton
                    v-for="type in declareTypes(['disaster', 'incident'])"
                    :key="type"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    :icon="RA_CRISIS_TYPES[type].icon"
                    :label="`Declare ${RA_CRISIS_TYPES[type].label} here`"
                    @click="declare(type, selected.id)"
                  />
                </template>
              </div>
              <div>
                <div class="mb-2 flex items-center justify-between gap-2">
                  <h3 class="font-medium text-highlighted">
                    {{ ringKm === 'off' ? 'Nearest places' : `Within ${formatNumber(ringKm, 0)} km` }}
                  </h3>
                  <USelect
                    v-model="ringKm"
                    :items="ringItems"
                    size="sm"
                    class="w-32"
                    aria-label="Ring around the place"
                  />
                </div>
                <ul
                  v-if="nearby.length"
                  class="divide-y divide-default rounded-md border border-default"
                >
                  <li
                    v-for="row in nearby"
                    :key="row.place.id"
                  >
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-elevated/60 focus-visible:outline-2 focus-visible:outline-primary"
                      @click="select(row.place.id)"
                    >
                      <UIcon
                        :name="row.place.kind === 'branch' ? 'i-lucide-landmark' : 'i-lucide-building-2'"
                        class="size-4 shrink-0 text-muted"
                      />
                      <span class="min-w-0 flex-1 truncate">{{ row.place.name }}</span>
                      <span class="text-muted tabular-nums">{{ raFormatDistance(row.distanceM) }}</span>
                    </button>
                  </li>
                </ul>
                <p
                  v-else
                  class="text-muted"
                >
                  {{ ringKm === 'off' ? 'No other place on the map.' : 'No other place in this ring.' }}
                </p>
              </div>
            </div>
            <template
              v-if="can('location.master')"
              #footer
            >
              <UButton
                :to="locationUrl(selected)"
                variant="link"
                trailing-icon="i-lucide-arrow-right"
                :label="`Open the ${selected.kind === 'branch' ? 'branch' : 'building'}`"
                class="px-0"
              />
            </template>
          </UCard>
          <p
            v-else
            class="text-sm text-muted"
          >
            Select a pin, or find a place above, to see what is near it.
          </p>
        </div>
      </div>

      <RaEarthquakesCard
        :list="quakeList"
        :error="quakeError"
        :selected-id="selectedQuakeId"
        @select="(quake) => selectQuake(quake, true)"
        @declare="declareFromQuake"
      />

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-semibold">
              Places on the map
            </h2>
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Search by name, region or address"
              aria-label="Search the places"
              class="w-full sm:w-72"
            />
          </div>
        </template>
        <UTable
          :data="tableRows"
          :columns="columns"
          class="max-h-[28rem]"
          sticky
        >
          <template #name-cell="{ row }">
            <div class="flex flex-wrap items-center gap-x-2">
              <UButton
                variant="link"
                class="px-0 font-medium"
                :label="row.original.name"
                @click="select(row.original.id)"
              />
              <StatusBadge
                v-for="state in badgesOf(row.original)"
                :key="state"
                :scale="raBuildingStatus"
                :value="state"
                size="sm"
              />
            </div>
          </template>
          <template #kind-cell="{ row }">
            {{ RA_PLACE_KIND_LABEL[row.original.kind] }}
          </template>
          <template #region-cell="{ row }">
            {{ row.original.region || '—' }}
          </template>
          <template #latest-cell="{ row }">
            <StatusBadge
              v-if="row.original.latest?.highest_residual_level"
              :scale="raRiskLevel"
              :value="row.original.latest.highest_residual_level"
              size="sm"
            />
            <span
              v-else
              class="text-muted"
            >{{ row.original.latest ? 'Not rated' : 'No RA yet' }}</span>
          </template>
          <template #distance-cell="{ row }">
            <span class="tabular-nums">{{ row.original.distanceM === null ? '—' : raFormatDistance(row.original.distanceM) }}</span>
          </template>
        </UTable>
        <p
          v-if="!tableRows.length"
          class="py-8 text-center text-sm text-muted"
        >
          {{ places.length ? 'No place matches.' : 'No building or branch has a map pin yet.' }}
        </p>
      </UCard>
    </template>
  </AppPage>
</template>
