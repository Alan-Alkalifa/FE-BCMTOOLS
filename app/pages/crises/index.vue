<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaCrisisStatus, RaCrisisSummary } from '~/composables/useRa'
import RaCrisisModal from '~/components/ra/RaCrisisModal.vue'

/** Every incident declared on the location map, open and closed, newest first. */
definePageMeta({ permission: ['ra.access', 'ra_branch.access'] })

const route = useRoute()
const router = useRouter()
const perPage = useRowsPerPage()

function asStatus(value: unknown): RaCrisisStatus | undefined {
  return value === 'pending' || value === 'open' || value === 'closed' || value === 'rejected' ? value : undefined
}

const query = computed(() => ({
  status: asStatus(route.query.status),
  q: typeof route.query.q === 'string' && route.query.q.trim() ? route.query.q.trim() : undefined,
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: perPage.value,
}))
const { data, status, error, refresh } = useRaCrises(query)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const { data: map } = useRaMap()
const crisisModal = useOverlay().create(RaCrisisModal)

const search = ref(query.value.q ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const next = value.trim()
    if (next === (query.value.q ?? '')) return
    router.replace({ query: { ...route.query, q: next || undefined, page: undefined } })
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))
const filtered = computed(() => Boolean(route.query.q || route.query.status))
function clearFilters() {
  clearTimeout(searchTimer)
  search.value = ''
  router.replace({ query: {} })
}

const statusFilter = computed({
  get: () => query.value.status ?? 'all',
  set: (value: RaCrisisStatus | 'all') => router.replace({
    query: { ...route.query, status: value === 'all' ? undefined : value, page: undefined },
  }),
})
const statusItems = [
  { label: 'All incidents', value: 'all' },
  { label: 'Pending approval', value: 'pending' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
  { label: 'Rejected', value: 'rejected' },
]

const columns: TableColumn<RaCrisisSummary>[] = [
  { accessorKey: 'ref_no', header: 'Reference' },
  { id: 'hazard', header: 'Hazard' },
  { id: 'place', header: 'Place' },
  { accessorKey: 'started_at', header: 'Started' },
  { accessorKey: 'radius_m', header: 'Radius', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'affected_count', header: 'Affected', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'status', header: 'Status' },
]

function openRow(_event: Event, row: { original: RaCrisisSummary }) {
  navigateTo(crisisPath(row.original.id))
}

async function declare() {
  const crisis = await crisisModal.open({ places: map.value?.places ?? [] }).result
  if (crisis) await navigateTo(crisisPath(crisis.id))
}
</script>

<template>
  <AppPage
    title="Incidents"
    :crumbs="[{ label: BUILDINGS_GROUP }, { label: 'Incidents' }]"
  >
    <template #actions>
      <UButton
        :to="LOCATION_MAP_PATH"
        color="neutral"
        variant="outline"
        icon="i-lucide-map"
        label="Building map"
      />
      <UButton
        v-if="map?.can_declare"
        icon="i-lucide-siren"
        label="Declare incident/disaster"
        @click="declare"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="7"
      :rows="5"
      label="Loading incidents"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the incidents"
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

    <UCard
      v-else
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <ListFilterBar
        :filtered="filtered"
        @clear="clearFilters"
      >
        <template #search>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Reference, hazard or place"
            aria-label="Search by reference, hazard or place"
            class="w-full"
          />
        </template>
        <USelect
          v-model="statusFilter"
          :items="statusItems"
          class="w-40"
          aria-label="Filter by status"
        />
      </ListFilterBar>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        class="cursor-pointer"
        :on-select="openRow"
      >
        <template #ref_no-cell="{ row }">
          <NuxtLink
            :to="crisisPath(row.original.id)"
            class="font-medium whitespace-nowrap text-primary hover:underline"
          >
            {{ row.original.ref_no }}
          </NuxtLink>
        </template>
        <template #hazard-cell="{ row }">
          <span>{{ row.original.hazard.short_name }}</span>
          <p class="text-xs text-muted">
            {{ row.original.hazard.category?.label }}
          </p>
        </template>
        <template #place-cell="{ row }">
          {{ row.original.location?.name ?? raFormatCoordinates({ lat: row.original.latitude, lng: row.original.longitude }) }}
        </template>
        <template #started_at-cell="{ row }">
          <span class="whitespace-nowrap">{{ formatDateTime(row.original.started_at) }}</span>
        </template>
        <template #radius_m-cell="{ row }">
          <span class="tabular-nums">{{ raFormatDistance(row.original.radius_m) }}</span>
        </template>
        <template #affected_count-cell="{ row }">
          <span class="tabular-nums">{{ formatNumber(row.original.affected_count, 0) }}</span>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge
            :scale="raCrisisStatus"
            :value="row.original.status"
            size="sm"
          />
          <p
            v-if="row.original.closed_at"
            class="text-xs text-muted"
          >
            {{ formatDateTime(row.original.closed_at) }}
          </p>
        </template>
        <template #empty>
          <p class="py-10 text-center text-sm text-muted">
            {{ query.q || query.status ? 'No incidents match these filters.' : 'No incident has been declared yet.' }}
          </p>
        </template>
      </UTable>

      <TablePagination
        v-if="data"
        v-model:per-page="perPage"
        page-sizes
        :total="data.total"
        label="Incidents"
        :to="(page) => ({ query: { ...route.query, page } })"
        :page="query.page"
      />
    </UCard>
  </AppPage>
</template>
