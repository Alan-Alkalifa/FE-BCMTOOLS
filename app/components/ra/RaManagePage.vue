<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaAssessmentSummary, RaListQuery } from '~/composables/useRa'

/**
 * RA (or RA Branch) Manage, as SCCA Manage: the drafts being worked on (including those returned
 * for changes) and New assessment. Submitted RAs live in Approval and Monitoring.
 */
const ra = useRaModule()
const { can } = useAuth()
const route = useRoute()
const router = useRouter()

const PER_PAGE = 25
const THIS_YEAR = new Date().getFullYear()

function asNumber(value: unknown): number | undefined {
  const number = Number(value)
  return typeof value === 'string' && Number.isInteger(number) && number > 0 ? number : undefined
}

const query = computed<RaListQuery>(() => ({
  kind: ra.value.kind,
  status: 'draft',
  q: typeof route.query.q === 'string' && route.query.q.trim() ? route.query.q.trim() : undefined,
  location_id: asNumber(route.query.location_id),
  year: asNumber(route.query.year),
  ...(route.query.mine === '1' ? { mine: '1' as const } : {}),
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: PER_PAGE,
}))

function setQuery(name: string, value: string | number | undefined) {
  const next = value === undefined || value === 'all' ? undefined : String(value)
  if (next === (route.query[name] ?? undefined)) return
  router.replace({ query: { ...route.query, [name]: next, page: undefined } })
}

const search = ref(query.value.q ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => setQuery('q', value.trim() || undefined), 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const locationFilter = computed<number | 'all'>({
  get: () => query.value.location_id ?? 'all',
  set: (value) => setQuery('location_id', value),
})
const yearFilter = computed<number | 'all'>({
  get: () => query.value.year ?? 'all',
  set: (value) => setQuery('year', value),
})
const whose = computed<'all' | 'mine'>({
  get: () => (query.value.mine ? 'mine' : 'all'),
  set: (value) => setQuery('mine', value === 'mine' ? '1' : undefined),
})

const { data, status, error, refresh } = useRaAssessments(query)
const { data: locations } = useRaLocations(() => ({ kind: ra.value.kind }))
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const hasFilters = computed(() => Boolean(query.value.q || query.value.location_id || query.value.year || query.value.mine))

const columns = computed<TableColumn<RaAssessmentSummary>[]>(() => [
  { accessorKey: 'ref_no', header: 'Ref. no.' },
  { id: 'location', header: ra.value.location.single },
  { accessorKey: 'period_year', header: 'Period' },
  { id: 'progress', header: 'Rated', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'highest_residual_level', header: 'Highest residual' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'created_by', header: 'Created by' },
  { accessorKey: 'updated_at', header: 'Last saved' },
])

const locationItems = computed(() => [
  { label: `All ${ra.value.location.lowerPlural}`, value: 'all' as const },
  ...(locations.value?.items ?? []).map((location) => ({ label: location.name, value: location.id })),
])
const yearItems = [
  { label: 'All periods', value: 'all' as const },
  ...Array.from({ length: 8 }, (_, index) => THIS_YEAR + 1 - index).map((year) => ({ label: String(year), value: year })),
]
const whoseItems = [
  { label: 'All drafts', value: 'all' as const },
  { label: 'Created by me', value: 'mine' as const },
]

function openRow(_event: Event, row: { original: RaAssessmentSummary }) {
  navigateTo(raPath(ra.value.kind, 'manage', row.original.id))
}
</script>

<template>
  <AppPage
    :title="`Manage ${ra.title === 'RA' ? 'RAs' : `${ra.title} RAs`}`"
    icon="i-lucide-list-checks"
    description="The drafts being worked on, including those returned for changes. Submitted RAs are in Approval and Monitoring."
    :crumbs="[{ label: ra.title, to: raPath(ra.kind, 'monitoring') }, { label: 'Manage' }]"
  >
    <template #actions>
      <UButton
        :to="{ path: LOCATIONS_PATH, query: { type: ra.kind } }"
        color="neutral"
        variant="outline"
        :icon="ra.kind === 'branch' ? 'i-lucide-landmark' : 'i-lucide-building-2'"
        :label="`View ${ra.location.lowerPlural}`"
      />
      <UButton
        v-if="can('ra.edit')"
        :to="raPath(ra.kind, 'manage', 'new')"
        icon="i-lucide-plus"
        label="New assessment"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="8"
      label="Loading drafts"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the drafts"
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
      <div class="flex flex-wrap items-center gap-2 p-4">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="`Search ${ra.location.lower} or ref. no.`"
          class="w-full sm:w-60"
          :aria-label="`Search ${ra.location.lower} or ref. no.`"
        />
        <USelectMenu
          v-model="locationFilter"
          value-key="value"
          :items="locationItems"
          class="w-48"
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
          v-model="whose"
          value-key="value"
          :items="whoseItems"
          :search-input="false"
          class="w-40"
          aria-label="Whose drafts"
        />
      </div>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        class="cursor-pointer"
        :on-select="openRow"
        :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4' }"
      >
        <template #ref_no-cell="{ row }">
          <NuxtLink
            :to="raPath(ra.kind, 'manage', row.original.id)"
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
      </template>
        <template #created_by-cell="{ row }">
          {{ row.original.created_by || '—' }}
        </template>
        <template #updated_at-cell="{ row }">
          <span class="whitespace-nowrap">{{ formatDateTime(row.original.updated_at) }}</span>
        </template>
        <template #empty>
          <p class="py-10 text-center text-sm text-muted">
            {{ hasFilters ? 'No drafts match these filters.' : 'No drafts. Use New assessment to start one.' }}
          </p>
        </template>
      </UTable>

      <TablePagination
        v-if="data"
        :page="data.page"
        :per-page="PER_PAGE"
        :total="data.total"
        :to="(next) => ({ query: { ...route.query, page: next } })"
        label="Drafts"
      />
    </UCard>
  </AppPage>
</template>
