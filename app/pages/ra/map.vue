<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaMapMarker, RaMapPlace, RaPin } from '~/composables/useRa'
import RaCrisisModal from '~/components/ra/RaCrisisModal.vue'

/**
 * Every head office building and branch with a map pin, on one map: measure the distance
 * between any two, see what is near a place, and declare a crisis. Open crises show for
 * everyone until they are closed.
 */
definePageMeta({ permission: 'ra.access' })

const route = useRoute()
const router = useRouter()
const { data, status, error, refresh } = useRaMap()
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const crisisModal = useOverlay().create(RaCrisisModal)
const mapRef = useTemplateRef<{ focus: (pin: RaPin) => void, fit: (pins: RaPin[]) => void }>('map')

const showHeadOffice = ref(true)
const showBranches = ref(true)
const places = computed(() => data.value?.places ?? [])
const visible = computed(() => places.value.filter((place) =>
  place.kind === 'branch' ? showBranches.value : showHeadOffice.value))
const counts = computed(() => ({
  head_office: places.value.filter((place) => place.kind === 'head_office').length,
  branch: places.value.filter((place) => place.kind === 'branch').length,
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
  selectedId.value = id
  const place = byId(id)
  if (place) mapRef.value?.focus(pinOf(place))
}

function onMarker(id: number, variant: RaMapMarker['variant']) {
  if (variant === 'crisis') return navigateTo(`/ra/crises/${id}`)
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
  ...visible.value.map((place) => ({
    id: place.id,
    lat: place.latitude,
    lng: place.longitude,
    label: `${place.name} (${RA_PLACE_KIND_LABEL[place.kind]})`,
    level: (place.latest ? place.latest.highest_residual_level ?? 'na' : 'none') as RaMapMarker['level'],
    variant: place.kind === 'branch' ? 'branch' as const : 'location' as const,
  })),
  ...(data.value?.crises ?? []).map((crisis) => ({
    id: crisis.id,
    lat: crisis.latitude,
    lng: crisis.longitude,
    label: `Crisis ${crisis.ref_no}: ${crisis.hazard.short_name}. Open its instructions.`,
    variant: 'crisis' as const,
  })),
])

const circles = computed(() => [
  ...(data.value?.crises ?? []).map((crisis) => ({
    id: crisis.id,
    lat: crisis.latitude,
    lng: crisis.longitude,
    radiusM: crisis.radius_m,
    crisis: true,
  })),
  ...(selected.value && ringKm.value !== 'off'
    ? [{ id: -1, ...pinOf(selected.value), radiusM: ringKm.value * 1000, active: true }]
    : []),
])

const line = computed<[RaPin, RaPin] | null>(() => (from.value && to.value ? [pinOf(from.value), pinOf(to.value)] : null))

async function declare(locationId?: number) {
  const crisis = await crisisModal.open({ places: places.value, locationId: locationId ?? null }).result
  if (crisis) {
    await navigateTo(`/ra/crises/${crisis.id}`)
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
    ...(unpinned.head_office ? [{ to: '/ra/locations', label: `${unpinned.head_office} ${unpinned.head_office === 1 ? 'building' : 'buildings'}` }] : []),
    ...(unpinned.branch ? [{ to: '/ra-branch/locations', label: `${unpinned.branch} ${unpinned.branch === 1 ? 'branch' : 'branches'}` }] : []),
  ]
})

// Measuring zooms the map to the two places.
watch(line, (pins) => {
  if (pins) mapRef.value?.fit(pins)
})

function locationUrl(place: { id: number, kind: string }) {
  return place.kind === 'branch' ? `/ra-branch/locations/${place.id}` : `/ra/locations/${place.id}`
}

function assessmentUrl(place: RaMapPlace) {
  return place.kind === 'branch' ? `/ra-branch/${place.latest!.id}` : `/ra/${place.latest!.id}`
}
</script>

<template>
  <AppPage
    title="Location map"
    :crumbs="[{ label: 'RA', to: '/ra' }, { label: 'Location map' }]"
  >
    <template #actions>
      <UButton
        to="/ra/crises"
        color="neutral"
        variant="outline"
        icon="i-lucide-history"
        label="Crisis history"
      />
      <UButton
        v-if="data?.can_declare"
        color="error"
        icon="i-lucide-siren"
        label="Declare crisis"
        @click="declare(selected?.id)"
      />
    </template>

    <SkeletonGroup
      v-if="showSkeleton"
      label="Loading the location map"
      class="space-y-6"
    >
      <div class="skeleton h-[32rem] w-full" />
    </SkeletonGroup>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the location map"
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
        aria-label="Open crises"
        class="space-y-2"
      >
        <UAlert
          v-for="crisis in data.crises"
          :key="crisis.id"
          color="error"
          variant="subtle"
          icon="i-lucide-siren"
          :title="`${crisis.hazard.short_name} at ${crisis.location?.name ?? raFormatCoordinates({ lat: crisis.latitude, lng: crisis.longitude })}`"
          :description="`${crisis.ref_no} · since ${formatDateTime(crisis.started_at)} · ${raFormatDistance(crisis.radius_m)} radius · ${crisis.affected_count} ${crisis.affected_count === 1 ? 'place' : 'places'} affected`"
        >
          <template #actions>
            <UButton
              :to="`/ra/crises/${crisis.id}`"
              color="error"
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
            ref="map"
            :markers="markers"
            :circles="circles"
            :line="line"
            :selected="selectedId"
            label="Map of the head office buildings and branches. Select a place for its details."
            height-class="h-[32rem]"
            @select="onMarker"
          />

          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span class="flex items-center gap-1"><UIcon
              name="i-lucide-map-pin"
              class="size-4"
            /> Head office building</span>
            <span class="flex items-center gap-1"><UIcon
              name="i-lucide-square"
              class="size-4"
            /> Branch</span>
            <span class="flex items-center gap-1"><UIcon
              name="i-lucide-siren"
              class="size-4 text-error"
            /> Crisis and its affected area</span>
            <span>Colour: latest residual risk</span>
            <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-error" />High</span>
            <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-warning" />Medium</span>
            <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-info" />Low</span>
            <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-muted ring-1 ring-default" />No RA yet</span>
          </div>

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
              :key="item.to"
            ><template v-if="index"> and </template><NuxtLink
              :to="item.to"
              class="text-primary hover:underline"
            >{{ item.label }}</NuxtLink></template>. Set the pin on their Map tab.</span>
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
                  class="w-full"
                />
              </UFormField>
              <div class="flex justify-center">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-arrow-down-up"
                  label="Swap"
                  :disabled="!fromId && !toId"
                  @click="swap"
                />
              </div>
              <UFormField label="To">
                <USelectMenu
                  v-model="toId"
                  :items="placeItems"
                  value-key="value"
                  placeholder="Choose a place"
                  class="w-full"
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
                </div>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-x"
                  aria-label="Clear the selection"
                  @click="selectedId = null"
                />
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
                    :to="assessmentUrl(selected)"
                    class="text-primary hover:underline"
                  >
                    {{ selected.latest.ref_no ?? selected.latest.period_year }}
                  </NuxtLink>
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
                <UButton
                  v-if="data.can_declare"
                  color="error"
                  variant="soft"
                  size="sm"
                  icon="i-lucide-siren"
                  label="Declare crisis here"
                  @click="declare(selected.id)"
                />
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
            <template #footer>
              <UButton
                :to="locationUrl(selected)"
                variant="link"
                trailing-icon="i-lucide-arrow-right"
                :label="`Open the ${selected.kind === 'branch' ? 'branch' : 'location'}`"
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
            <UButton
              variant="link"
              class="px-0 font-medium"
              :label="row.original.name"
              @click="select(row.original.id)"
            />
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
