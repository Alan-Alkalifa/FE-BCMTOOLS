<script setup lang="ts">
import type { RaLocation, RaMapCircle, RaMapMarker, RaPin } from '~/composables/useRa'

/**
 * The register on a map: one pin per location, coloured by the highest residual risk of its
 * latest assessment. The list beside it carries the same information as text, and lists the
 * locations that have no pin yet.
 *
 * On the RA (head office) register, "Show nearby branches" adds the RA Branch branches within
 * RA_NEARBY_RADIUS_KM of any building, as squares, with a ring around each building: the
 * branches staff could fall back to, and those exposed to the same local hazards.
 */
const props = defineProps<{ locations: RaLocation[] }>()

const ra = useRaModule()
const route = useRoute()
const router = useRouter()
const map = useTemplateRef<{ focus: (pin: RaPin) => void }>('map')
const selectedId = ref<number | null>(null)

type PinLevel = NonNullable<RaMapMarker['level']>

function levelOf(location: RaLocation): PinLevel {
  const latest = location.latest_assessment
  if (!latest) return 'none'
  return latest.highest_residual_level ?? (latest.rated_count ? 'na' : 'none')
}

const pinned = computed(() => props.locations.filter((location) => raPin(location)))
const unpinned = computed(() => props.locations.filter((location) => !raPin(location)))

/* Nearby branches (RA only), kept in the URL as ?nearby=branches. */
const canShowNearby = computed(() => ra.value.kind === 'head_office')
const showNearby = computed({
  get: () => canShowNearby.value && route.query.nearby === 'branches',
  set: (value: boolean) => {
    router.replace({ query: { ...route.query, nearby: value ? 'branches' : undefined } })
  },
})
const radiusLabel = `${formatNumber(RA_NEARBY_RADIUS_KM, 0)} km`

const branches = ref<RaLocation[] | null>(null)
const branchesStatus = ref<'idle' | 'pending' | 'error'>('idle')

async function loadBranches() {
  if (branches.value || branchesStatus.value === 'pending') return
  branchesStatus.value = 'pending'
  try {
    const data = await $fetch<{ items: RaLocation[] }>('/api/ra/locations', { query: { kind: 'branch', active: true } })
    branches.value = data.items
    branchesStatus.value = 'idle'
  } catch {
    branchesStatus.value = 'error'
  }
}

watch(showNearby, (on) => {
  if (on) loadBranches()
}, { immediate: true })

interface NearbyBranch {
  branch: RaLocation
  pin: RaPin
  /** The closest building of the register, and how far it is. */
  nearest: RaLocation
  km: number
}

/** Branches with a pin within the radius of at least one building, closest first. */
const nearby = computed<NearbyBranch[]>(() => {
  if (!showNearby.value || !branches.value) return []
  const buildings = pinned.value.map((location) => ({ location, pin: raPin(location)! }))
  const found: NearbyBranch[] = []
  for (const branch of branches.value) {
    const pin = raPin(branch)
    if (!pin || !buildings.length) continue
    let best: { location: RaLocation, km: number } | undefined
    for (const building of buildings) {
      const km = raDistanceKm(pin, building.pin)
      if (!best || km < best.km) best = { location: building.location, km }
    }
    if (best && best.km <= RA_NEARBY_RADIUS_KM) found.push({ branch, pin, nearest: best.location, km: best.km })
  }
  return found.sort((a, b) => a.km - b.km)
})
const branchesWithoutPin = computed(() => (branches.value ?? []).filter((branch) => !raPin(branch)).length)

/** For the selected building: every branch within the radius of it (not only the nearest). */
function branchesNear(location: RaLocation) {
  const centre = raPin(location)
  if (!centre || !branches.value) return []
  return branches.value
    .flatMap((branch) => {
      const pin = raPin(branch)
      if (!pin) return []
      const km = raDistanceKm(pin, centre)
      return km <= RA_NEARBY_RADIUS_KM ? [{ branch, km }] : []
    })
    .sort((a, b) => a.km - b.km)
}

const markers = computed<RaMapMarker[]>(() => [
  ...pinned.value.map((location) => ({
    id: location.id,
    label: location.name,
    level: levelOf(location),
    ...raPin(location)!,
  })),
  ...nearby.value.map((item) => ({
    id: item.branch.id,
    label: `${item.branch.name} (branch, ${km(item.km)})`,
    level: levelOf(item.branch),
    variant: 'branch' as const,
    ...item.pin,
  })),
])

const circles = computed<RaMapCircle[]>(() => (showNearby.value
  ? pinned.value.map((location) => ({
      id: location.id,
      radiusM: RA_NEARBY_RADIUS_KM * 1000,
      active: location.id === selectedId.value,
      ...raPin(location)!,
    }))
  : []))

const selected = computed(() => props.locations.find((location) => location.id === selectedId.value))
const selectedBranch = computed(() => nearby.value.find((item) => item.branch.id === selectedId.value))
const selectedNearby = computed(() => (selected.value && showNearby.value ? branchesNear(selected.value) : []))

watch(() => props.locations, (locations) => {
  if (selectedId.value && !locations.some((location) => location.id === selectedId.value)) selectedId.value = null
})
watch(showNearby, (on) => {
  if (!on && selectedBranch.value) selectedId.value = null
})

function pick(location: RaLocation) {
  selectedId.value = location.id
  const pin = raPin(location)
  if (pin) map.value?.focus(pin)
}

function km(value: number) {
  return `${formatNumber(value, 1)} km`
}

const LEGEND: { key: PinLevel, label: string }[] = [
  { key: 'High', label: 'High' },
  { key: 'Medium', label: 'Medium' },
  { key: 'Low', label: 'Low' },
  { key: 'none', label: 'No rated assessment' },
]

const mapLabel = computed(() => {
  const count = pinned.value.length
  const base = `Map of ${count} ${count === 1 ? ra.value.location.lower : ra.value.location.lowerPlural}`
  if (!showNearby.value) return base
  const branchCount = nearby.value.length
  return `${base}, with ${branchCount} ${branchCount === 1 ? 'branch' : 'branches'} within ${radiusLabel}`
})

const nearbySummary = computed(() => {
  if (!showNearby.value || !branches.value) return undefined
  const count = nearby.value.length
  const text = `${count} ${count === 1 ? 'branch' : 'branches'} within ${radiusLabel} of a building.`
  return branchesWithoutPin.value
    ? `${text} ${branchesWithoutPin.value} without a map pin can't be placed.`
    : text
})
</script>

<template>
  <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <div class="space-y-3">
      <div
        v-if="canShowNearby"
        class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
      >
        <USwitch
          v-model="showNearby"
          :label="`Show nearby branches (within ${radiusLabel})`"
          :description="nearbySummary"
        />
        <p
          v-if="branchesStatus === 'pending'"
          class="flex items-center gap-1.5 text-sm text-muted"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-4 animate-spin"
          />
          Loading branches
        </p>
        <p
          v-else-if="branchesStatus === 'error'"
          class="flex items-center gap-2 text-sm text-error"
        >
          Couldn't load the branches.
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            label="Try again"
            @click="loadBranches"
          />
        </p>
      </div>

      <RaMap
        ref="map"
        :markers="markers"
        :circles="circles"
        :selected="selectedId"
        :label="mapLabel"
        height-class="h-[32rem]"
        @select="(id) => (selectedId = id)"
      />
      <ul
        class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted"
        aria-label="Map legend: colours show the highest residual risk of the latest assessment"
      >
        <li
          v-for="item in LEGEND"
          :key="item.key"
          class="inline-flex items-center gap-1.5"
        >
          <UIcon
            name="i-lucide-map-pin"
            class="size-4"
            :class="RA_PIN_CLASS[item.key]"
          />
          {{ item.label }}
        </li>
        <template v-if="showNearby">
          <li class="inline-flex items-center gap-1.5">
            <UIcon
              name="i-lucide-landmark"
              class="size-4"
            />
            Branch (square)
          </li>
          <li class="inline-flex items-center gap-1.5">
            <UIcon
              name="i-lucide-circle-dashed"
              class="size-4"
            />
            {{ radiusLabel }} around each building
          </li>
        </template>
      </ul>
    </div>

    <div class="space-y-6">
      <UCard v-if="selected">
        <template #header>
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold">
              {{ selected.name }}
            </h3>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-x"
              aria-label="Close"
              @click="selectedId = null"
            />
          </div>
          <p
            v-if="ra.hasRegion && selected.region"
            class="text-sm text-muted"
          >
            {{ selected.region }}
          </p>
        </template>
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-muted">
              Address
            </dt>
            <dd>{{ selected.address || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Latest assessment
            </dt>
            <dd
              v-if="selected.latest_assessment"
              class="flex flex-wrap items-center gap-2"
            >
              <NuxtLink
                :to="`${ra.base}/${selected.latest_assessment.id}`"
                class="text-primary hover:underline"
              >
                {{ selected.latest_assessment.ref_no }}
              </NuxtLink>
              <StatusBadge
                v-if="selected.latest_assessment.highest_residual_level"
                :scale="raRiskLevel"
                :value="selected.latest_assessment.highest_residual_level"
                size="sm"
              />
            </dd>
            <dd v-else>
              None yet
            </dd>
          </div>
          <div v-if="showNearby && branches">
            <dt class="text-muted">
              Branches within {{ radiusLabel }}
            </dt>
            <dd v-if="selectedNearby.length">
              <ul class="mt-1 space-y-1">
                <li
                  v-for="item in selectedNearby"
                  :key="item.branch.id"
                  class="flex items-baseline justify-between gap-2"
                >
                  <NuxtLink
                    :to="`/ra-branch/locations/${item.branch.id}`"
                    class="min-w-0 truncate text-primary hover:underline"
                  >
                    {{ item.branch.name }}
                  </NuxtLink>
                  <span class="shrink-0 text-muted tabular-nums">{{ km(item.km) }}</span>
                </li>
              </ul>
            </dd>
            <dd v-else>
              None
            </dd>
          </div>
        </dl>
        <template #footer>
          <UButton
            :to="`${ra.base}/locations/${selected.id}`"
            color="neutral"
            variant="outline"
            trailing-icon="i-lucide-arrow-right"
            :label="`Open ${ra.location.lower}`"
          />
        </template>
      </UCard>

      <UCard v-else-if="selectedBranch">
        <template #header>
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-xs text-muted">
                Branch
              </p>
              <h3 class="font-semibold">
                {{ selectedBranch.branch.name }}
              </h3>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-x"
              aria-label="Close"
              @click="selectedId = null"
            />
          </div>
          <p
            v-if="selectedBranch.branch.region"
            class="text-sm text-muted"
          >
            {{ selectedBranch.branch.region }}
          </p>
        </template>
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-muted">
              Address
            </dt>
            <dd>{{ selectedBranch.branch.address || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Nearest building
            </dt>
            <dd>
              {{ selectedBranch.nearest.name }}
              <span class="text-muted tabular-nums">· {{ km(selectedBranch.km) }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Latest RA Branch assessment
            </dt>
            <dd
              v-if="selectedBranch.branch.latest_assessment"
              class="flex flex-wrap items-center gap-2"
            >
              <NuxtLink
                :to="`/ra-branch/${selectedBranch.branch.latest_assessment.id}`"
                class="text-primary hover:underline"
              >
                {{ selectedBranch.branch.latest_assessment.ref_no }}
              </NuxtLink>
              <StatusBadge
                v-if="selectedBranch.branch.latest_assessment.highest_residual_level"
                :scale="raRiskLevel"
                :value="selectedBranch.branch.latest_assessment.highest_residual_level"
                size="sm"
              />
            </dd>
            <dd v-else>
              None yet
            </dd>
          </div>
        </dl>
        <template #footer>
          <UButton
            :to="`/ra-branch/locations/${selectedBranch.branch.id}`"
            color="neutral"
            variant="outline"
            trailing-icon="i-lucide-arrow-right"
            label="Open branch"
          />
        </template>
      </UCard>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <h3 class="font-semibold">
            On the map
          </h3>
          <p class="text-sm text-muted">
            {{ pinned.length }} of {{ locations.length }} {{ ra.location.lowerPlural }}
          </p>
        </template>
        <ul
          v-if="pinned.length"
          class="max-h-80 overflow-y-auto py-2"
        >
          <li
            v-for="location in pinned"
            :key="location.id"
          >
            <button
              type="button"
              class="flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
              :class="location.id === selectedId ? 'bg-elevated font-medium text-highlighted' : 'text-default'"
              :aria-current="location.id === selectedId ? 'true' : undefined"
              @click="pick(location)"
            >
              <UIcon
                name="i-lucide-map-pin"
                class="size-4 shrink-0"
                :class="RA_PIN_CLASS[levelOf(location)]"
              />
              <span class="min-w-0 flex-1 truncate">{{ location.name }}</span>
              <StatusBadge
                v-if="location.latest_assessment?.highest_residual_level"
                :scale="raRiskLevel"
                :value="location.latest_assessment.highest_residual_level"
                size="sm"
              />
            </button>
          </li>
        </ul>
        <p
          v-else
          class="px-4 py-6 text-sm text-muted"
        >
          No {{ ra.location.lower }} has a map pin yet.
        </p>
      </UCard>

      <UCard
        v-if="showNearby && branches"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <h3 class="font-semibold">
            Nearby branches
          </h3>
          <p class="text-sm text-muted">
            Within {{ radiusLabel }} of a building, closest first
          </p>
        </template>
        <ul
          v-if="nearby.length"
          class="max-h-80 overflow-y-auto py-2"
        >
          <li
            v-for="item in nearby"
            :key="item.branch.id"
          >
            <button
              type="button"
              class="flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
              :class="item.branch.id === selectedId ? 'bg-elevated font-medium text-highlighted' : 'text-default'"
              :aria-current="item.branch.id === selectedId ? 'true' : undefined"
              @click="pick(item.branch)"
            >
              <UIcon
                name="i-lucide-landmark"
                class="size-4 shrink-0"
                :class="RA_PIN_CLASS[levelOf(item.branch)]"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate">{{ item.branch.name }}</span>
                <span class="block truncate text-xs text-muted">{{ km(item.km) }} from {{ item.nearest.name }}</span>
              </span>
            </button>
          </li>
        </ul>
        <p
          v-else
          class="px-4 py-6 text-sm text-muted"
        >
          No branch with a map pin is within {{ radiusLabel }} of these buildings.
        </p>
      </UCard>

      <UCard
        v-if="unpinned.length"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <h3 class="font-semibold">
            Without a pin
          </h3>
          <p class="text-sm text-muted">
            Add it on the {{ ra.location.lower }}'s Map tab.
          </p>
        </template>
        <ul class="max-h-60 overflow-y-auto py-2">
          <li
            v-for="location in unpinned"
            :key="location.id"
          >
            <NuxtLink
              :to="`${ra.base}/locations/${location.id}?tab=map`"
              class="flex items-center gap-2 px-4 py-1.5 text-sm text-default hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
            >
              <UIcon
                name="i-lucide-map-pin-plus"
                class="size-4 shrink-0 text-muted"
              />
              <span class="min-w-0 flex-1 truncate">{{ location.name }}</span>
            </NuxtLink>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
