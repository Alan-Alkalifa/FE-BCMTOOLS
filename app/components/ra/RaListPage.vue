<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaAssessmentSummary, RaListQuery } from '~/composables/useRa'

const ra = useRaModule()
const route = useRoute()
const router = useRouter()

const PER_PAGE = 25
const THIS_YEAR = new Date().getFullYear()

function asLevel(value: unknown): RaLevel | undefined {
  return typeof value === 'string' && RA_LEVELS.includes(value as RaLevel) ? value as RaLevel : undefined
}

/** The status filter: a workflow status, or "awaiting" (waiting for my sign-off). */
type StatusFilter = RaStatus | 'awaiting'
function asStatus(value: unknown): StatusFilter | undefined {
  if (value === 'awaiting') return 'awaiting'
  return typeof value === 'string' && RA_STATUSES.includes(value as RaStatus) ? value as RaStatus : undefined
}

function asNumber(value: unknown): number | undefined {
  const number = Number(value)
  return typeof value === 'string' && Number.isInteger(number) && number > 0 ? number : undefined
}

function statusQuery(filter: StatusFilter | undefined): Pick<RaListQuery, 'status' | 'awaiting'> {
  if (filter === 'awaiting') return { awaiting: 'me' }
  return filter ? { status: filter } : {}
}

const query = computed<RaListQuery>(() => ({
  kind: ra.value.kind,
  q: typeof route.query.q === 'string' && route.query.q.trim() ? route.query.q.trim() : undefined,
  location_id: asNumber(route.query.location_id),
  year: asNumber(route.query.year),
  level: asLevel(route.query.level),
  ...statusQuery(asStatus(route.query.status)),
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: PER_PAGE,
}))

const search = ref(query.value.q ?? '')
const locationFilter = ref<number | 'all'>(query.value.location_id ?? 'all')
const yearFilter = ref<number | 'all'>(query.value.year ?? 'all')
const levelFilter = ref<RaLevel | 'all'>(query.value.level ?? 'all')
const statusFilter = ref<StatusFilter | 'all'>(asStatus(route.query.status) ?? 'all')
const hasFilters = computed(() =>
  Boolean(query.value.q || query.value.location_id || query.value.year || query.value.level
    || query.value.status || query.value.awaiting),
)

watch(
  () => [route.query.q, route.query.location_id, route.query.year, route.query.level, route.query.status],
  () => {
    search.value = query.value.q ?? ''
    locationFilter.value = query.value.location_id ?? 'all'
    yearFilter.value = query.value.year ?? 'all'
    levelFilter.value = query.value.level ?? 'all'
    statusFilter.value = asStatus(route.query.status) ?? 'all'
  },
)

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

function setFilter(name: 'location_id' | 'year' | 'level' | 'status', value: string | number) {
  const next = value === 'all' ? undefined : String(value)
  if (next === (route.query[name] ?? undefined)) return
  router.replace({ query: { ...route.query, [name]: next, page: undefined } })
}
watch(locationFilter, (value) => setFilter('location_id', value))
watch(yearFilter, (value) => setFilter('year', value))
watch(levelFilter, (value) => setFilter('level', value))
watch(statusFilter, (value) => setFilter('status', value))

const { data, status, error, refresh } = useRaAssessments(query)
const { data: locations } = useRaLocations(() => ({ kind: ra.value.kind }))
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

const range = computed(() => {
  const total = data.value?.total ?? 0
  if (!total) return { from: 0, to: 0 }
  const from = ((data.value?.page ?? 1) - 1) * PER_PAGE + 1
  return { from, to: Math.min(from + PER_PAGE - 1, total) }
})

const columns = computed<TableColumn<RaAssessmentSummary>[]>(() => [
  { accessorKey: 'ref_no', header: 'Ref. no.' },
  { id: 'location', header: ra.value.location.single },
  { accessorKey: 'period_year', header: 'Period' },
  { accessorKey: 'due_date', header: 'Renewal due' },
  { id: 'progress', header: 'Rated', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'highest_residual_level', header: 'Highest residual' },
  { accessorKey: 'status', header: 'Status' },
])

const locationItems = computed(() => [
  { label: `All ${ra.value.location.lowerPlural}`, value: 'all' as const },
  ...(locations.value?.items ?? []).map((location) => ({ label: location.name, value: location.id })),
])
const yearItems = [
  { label: 'All periods', value: 'all' as const },
  ...Array.from({ length: 8 }, (_, index) => THIS_YEAR + 1 - index).map((year) => ({ label: String(year), value: year })),
]
const levelItems = [
  { label: 'All residual levels', value: 'all' as const },
  ...RA_LEVELS.map((level) => ({ label: raRiskLevel[level].label, value: level })),
]
const statusItems = [
  { label: 'All statuses', value: 'all' as const },
  ...RA_STATUSES.map((value) => ({ label: raStatus[value].label, value })),
  { label: 'Waiting for my sign-off', value: 'awaiting' as const },
]

function openRow(_event: Event, row: { original: RaAssessmentSummary }) {
  navigateTo(`${ra.value.base}/${row.original.id}`)
}

const searchLabel = computed(() => `Search ${ra.value.location.lower} or ref. no.`)
</script>

<template>
  <AppPage
    :title="ra.title"
    :crumbs="[{ label: ra.title }]"
  >
    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="7"
      label="Loading assessments"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load assessments"
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

    <UCard v-else>
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="searchLabel"
          class="w-full sm:w-56"
          :aria-label="searchLabel"
        />
        <USelectMenu
          v-model="locationFilter"
          value-key="value"
          :items="locationItems"
          class="w-44"
          :aria-label="`Filter by ${ra.location.lower}`"
        />
        <USelectMenu
          v-model="yearFilter"
          value-key="value"
          :items="yearItems"
          :search-input="false"
          class="w-32"
          aria-label="Filter by period"
        />
        <USelectMenu
          v-model="levelFilter"
          value-key="value"
          :items="levelItems"
          :search-input="false"
          class="w-44"
          aria-label="Filter by highest residual level"
        />
        <USelectMenu
          v-model="statusFilter"
          value-key="value"
          :items="statusItems"
          :search-input="false"
          class="w-52"
          aria-label="Filter by status"
        />
        <div class="flex w-full flex-wrap gap-2 lg:ml-auto lg:w-auto">
          <UButton
            :to="`${ra.base}/locations`"
            color="neutral"
            variant="outline"
            :icon="ra.kind === 'branch' ? 'i-lucide-landmark' : 'i-lucide-building-2'"
            :label="`View ${ra.location.lowerPlural}`"
          />
          <UButton
            :to="`${ra.base}/new`"
            icon="i-lucide-plus"
            label="New assessment"
          />
        </div>
      </div>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        class="cursor-pointer"
        :on-select="openRow"
      >
        <template #ref_no-cell="{ row }">
          <NuxtLink
            :to="`${ra.base}/${row.original.id}`"
            class="font-medium whitespace-nowrap text-primary hover:underline"
          >
            {{ row.original.ref_no || 'Assessment' }}
          </NuxtLink>
        </template>
        <template #location-cell="{ row }">
          {{ row.original.location.name }}
          <p
            v-if="ra.hasRegion && row.original.location.region"
            class="text-xs text-muted"
          >
            {{ row.original.location.region }}
          </p>
        </template>
        <template #due_date-cell="{ row }">
          {{ formatDate(row.original.due_date) || '—' }}
        </template>
        <template #progress-cell="{ row }">
          {{ formatNumber(row.original.rated_count, 0) }} of {{ formatNumber(row.original.hazard_count, 0) }}
        </template>
        <template #highest_residual_level-cell="{ row }">
          <StatusBadge
            v-if="row.original.highest_residual_level"
            :scale="raRiskLevel"
            :value="row.original.highest_residual_level"
            size="sm"
          />
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge
            :scale="raStatus"
            :value="raStatusKey(row.original)"
            size="sm"
          />
          <p
            v-if="row.original.status === 'in_signoff'"
            class="text-xs text-muted"
          >
            {{ raSignoffLabel(row.original.current_signoff_role!, ra.signoffRoles) }}
          </p>
        </template>
      </UTable>

      <div
        v-if="data && !data.items.length"
        class="py-10 text-center"
      >
        <p class="text-sm text-muted">
          {{ hasFilters ? 'No assessments match these filters.' : 'No assessments yet. Use New assessment to create the first one.' }}
        </p>
      </div>

      <div
        v-if="data && data.total > 0"
        class="mt-4 flex flex-wrap items-center justify-between gap-3"
      >
        <p class="text-sm text-muted">
          Showing {{ formatNumber(range.from, 0) }}–{{ formatNumber(range.to, 0) }} of {{ formatNumber(data.total, 0) }}
        </p>
        <UPagination
          :page="data.page"
          :items-per-page="PER_PAGE"
          :total="data.total"
          :to="(page) => ({ query: { ...route.query, page } })"
        />
      </div>
    </UCard>
  </AppPage>
</template>
