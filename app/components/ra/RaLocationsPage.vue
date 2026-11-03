<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { LocationQueryRaw } from 'vue-router'
import type { RaLocation } from '~/composables/useRa'

/**
 * The Buildings register: head office buildings and branches in one table, filtered by type,
 * province and status and sorted by a column (all in the URL; the newest change first by
 * default), one page at a time. A row opens the building's profile.
 * A new building, and making one inactive, waits for someone else's approval: the Status
 * Building column shows it, and the status filter lists the ones waiting. Approving, rejecting
 * and deleting are done on the building's page, not here.
 */
const { can } = useAuth()
/** Every building and branch with the Location permission, otherwise the RA sides the user
 *  holds (RA and RA Branch are granted separately). */
const kinds = useLocationKinds()
const canOpenRa = useCanOpenRa()
const editKinds = useRaKinds('edit')
const canEdit = computed(() => editKinds.value.length > 0)
function canEditRow(location: RaLocation) {
  return can(RA_MODULES[location.kind].perm.edit)
}
const route = useRoute()
const router = useRouter()

const perPage = useRowsPerPage()
type TypeFilter = RaKind | 'all'
type StatusFilter = 'all' | 'active' | 'inactive' | 'pending' | 'rejected'

function text(name: string) {
  const value = route.query[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
const type = computed<TypeFilter>(() => {
  const value = text('type')
  return value === 'head_office' || value === 'branch' ? value : 'all'
})
const statusFilter = computed<StatusFilter>(() => {
  const value = text('status')
  return value === 'active' || value === 'inactive' || value === 'pending' || value === 'rejected' ? value : 'all'
})
const province = computed(() => text('province'))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))

/** Sortable columns and the direction a first click sorts them in. */
const SORTS = { name: 'asc', kind: 'asc', province: 'asc', assessments: 'desc', updated_at: 'desc' } as const
type SortKey = keyof typeof SORTS
type SortDir = 'asc' | 'desc'
const DEFAULT_SORT: SortKey = 'updated_at'
const sortKey = computed<SortKey>(() => {
  const value = text('sort')
  return value && value in SORTS ? value as SortKey : DEFAULT_SORT
})
const sortDir = computed<SortDir>(() => {
  const value = text('dir')
  return value === 'asc' || value === 'desc' ? value : SORTS[sortKey.value]
})
function sortedBy(key: SortKey): SortDir | null {
  return sortKey.value === key ? sortDir.value : null
}
function sortBy(key: SortKey) {
  const dir: SortDir = sortKey.value === key ? (sortDir.value === 'asc' ? 'desc' : 'asc') : SORTS[key]
  const isDefault = key === DEFAULT_SORT && dir === SORTS[DEFAULT_SORT]
  const query: LocationQueryRaw = {
    ...route.query,
    sort: isDefault ? undefined : key,
    dir: isDefault ? undefined : dir,
    page: undefined,
  }
  router.replace({ query })
}

function setQuery(name: string, value: string | undefined) {
  const next = value === undefined || value === 'all' || value === '' ? undefined : value
  if (next === (route.query[name] ?? undefined)) return
  const query: LocationQueryRaw = { ...route.query, [name]: next, page: undefined }
  router.replace({ query })
}

const search = ref(text('q') ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => setQuery('q', value.trim() || undefined), 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const typeModel = computed<TypeFilter>({ get: () => type.value, set: (value) => setQuery('type', value) })
const provinceModel = computed<string>({ get: () => province.value ?? 'all', set: (value) => setQuery('province', value) })
const statusModel = computed<StatusFilter>({ get: () => statusFilter.value, set: (value) => setQuery('status', value) })

const { data, status, error, refresh } = useRaLocationRegister(() => ({
  kind: type.value,
  q: text('q'),
  province: province.value,
  active: statusFilter.value === 'active' || statusFilter.value === 'inactive' ? statusFilter.value === 'active' : undefined,
  approval: statusFilter.value === 'pending' || statusFilter.value === 'rejected' ? statusFilter.value : undefined,
  sort: sortKey.value,
  dir: sortDir.value,
  page: page.value,
  per_page: perPage.value,
}))
const { data: provinceData } = useRaProvinces(type)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const hasFilters = computed(() => Boolean(text('q') || type.value !== 'all' || province.value || statusFilter.value !== 'all'))
function clearFilters() {
  clearTimeout(searchTimer)
  search.value = ''
  // Clearing the filters keeps the sort.
  router.replace({ query: { sort: text('sort'), dir: text('dir') } })
}

const typeItems = [
  { label: 'All types', value: 'all' as const },
  { label: 'Head office buildings', value: 'head_office' as const },
  { label: 'Branches', value: 'branch' as const },
]
const provinceItems = computed(() => [
  { label: 'All provinces', value: 'all' },
  ...(provinceData.value?.items ?? []).map((name) => ({ label: name, value: name })),
])
const statusItems = [
  { label: 'Active and inactive', value: 'all' as const },
  { label: 'Active', value: 'active' as const },
  { label: 'Inactive', value: 'inactive' as const },
  { label: 'Waiting for approval', value: 'pending' as const },
  { label: 'Rejected', value: 'rejected' as const },
]

const columns: TableColumn<RaLocation>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'kind', header: 'Type' },
  { accessorKey: 'province', header: 'Province' },
  // The address gives way on narrower screens so Last updated stays in view (it is on the building page).
  { accessorKey: 'address', header: 'Address', meta: { class: { th: 'hidden 2xl:table-cell', td: 'hidden 2xl:table-cell' } } },
  { accessorKey: 'assessment_count', header: 'Assessments', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'latest_assessment', header: 'Latest assessment' },
  { id: 'latest', header: 'Latest residual' },
  { id: 'building_status', header: 'Status Building' },
  { id: 'assessment_status', header: 'Status Assessment', meta: RA_STATUS_COLUMN },
  { accessorKey: 'updated_at', header: 'Last updated' },
  { id: 'actions', header: '', meta: { class: { td: 'w-0 whitespace-nowrap' } } },
]

function noun(location: RaLocation) {
  return RA_MODULES[location.kind].location.lower
}

function openRow(_event: Event, row: { original: RaLocation }) {
  navigateTo(locationPath(row.original.id))
}

const addTo = computed(() => {
  const only = editKinds.value.length === 1 ? editKinds.value[0] : undefined
  const kind = type.value === 'all' ? only : type.value
  return { path: `${LOCATIONS_PATH}/new`, query: kind ? { type: kind } : {} }
})
</script>

<template>
  <AppPage
    title="Buildings"
    icon="i-lucide-building"
    description="Head office buildings and branches: each one's profile, map pin and RAs."
    :crumbs="[{ label: BUILDINGS_GROUP }, { label: 'Buildings' }]"
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
        v-if="canEdit"
        :to="addTo"
        icon="i-lucide-plus"
        label="Input building data"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="11"
      :rows="5"
      label="Loading buildings"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the buildings"
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
      <!-- As SCCA: search, then status → type → province (ListFilterBar). -->
      <ListFilterBar
        :filtered="hasFilters"
        @clear="clearFilters"
      >
        <template #search>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Name, ID, city, province or address"
            class="w-full"
            aria-label="Search by name, ID, city, province or address"
          />
        </template>
        <USelectMenu
          v-model="statusModel"
          value-key="value"
          :items="statusItems"
          :search-input="false"
          class="w-44"
          aria-label="Status"
        />
        <USelectMenu
          v-if="kinds.length > 1"
          v-model="typeModel"
          value-key="value"
          :items="typeItems"
          :search-input="false"
          class="w-40"
          aria-label="Type"
        />
        <USelectMenu
          v-model="provinceModel"
          value-key="value"
          :items="provinceItems"
          class="w-44"
          aria-label="Province"
        />
      </ListFilterBar>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        class="cursor-pointer"
        :on-select="openRow"
        :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4' }"
      >
        <template #name-header>
          <SortHeader
            label="Name"
            :direction="sortedBy('name')"
            @sort="sortBy('name')"
          />
        </template>
        <template #kind-header>
          <SortHeader
            label="Type"
            :direction="sortedBy('kind')"
            @sort="sortBy('kind')"
          />
        </template>
        <template #province-header>
          <SortHeader
            label="Province"
            :direction="sortedBy('province')"
            @sort="sortBy('province')"
          />
        </template>
        <template #assessment_count-header>
          <SortHeader
            label="Assessments"
            end
            :direction="sortedBy('assessments')"
            @sort="sortBy('assessments')"
          />
        </template>
        <template #updated_at-header>
          <SortHeader
            label="Last updated"
            :direction="sortedBy('updated_at')"
            @sort="sortBy('updated_at')"
          />
        </template>
        <template #name-cell="{ row }">
          <NuxtLink
            :to="locationPath(row.original.id)"
            class="font-medium text-primary hover:underline"
          >
            {{ row.original.name }}
          </NuxtLink>
          <p
            v-if="row.original.code"
            class="text-xs text-muted"
          >
            {{ row.original.code }}
          </p>
        </template>
        <template #kind-cell="{ row }">
          <StatusBadge
            :scale="raLocationKind"
            :value="row.original.kind"
            size="sm"
          />
        </template>
        <template #province-cell="{ row }">
          <span v-if="row.original.province">{{ row.original.province }}</span>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #address-cell="{ row }">
          <UTooltip
            v-if="row.original.address"
            :text="row.original.address"
          >
            <span class="block max-w-48 truncate">{{ row.original.address }}</span>
          </UTooltip>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #assessment_count-cell="{ row }">
          {{ formatNumber(row.original.assessment_count, 0) }}
        </template>
        <template #latest_assessment-cell="{ row }">
          <NuxtLink
            v-if="row.original.latest_assessment && canOpenRa(row.original.kind)"
            :to="raRecordPath(row.original.kind, row.original.latest_assessment)"
            class="whitespace-nowrap text-primary hover:underline"
            @click.stop
          >
            {{ row.original.latest_assessment.ref_no }}
          </NuxtLink>
          <span
            v-else-if="row.original.latest_assessment"
            class="whitespace-nowrap"
          >{{ row.original.latest_assessment.ref_no }}</span>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #latest-cell="{ row }">
          <StatusBadge
            v-if="row.original.latest_assessment?.highest_residual_level"
            :scale="raRiskLevel"
            :value="row.original.latest_assessment.highest_residual_level"
            size="sm"
          />
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #building_status-cell="{ row }">
          <StatusBadge
            :scale="raBuildingStatus"
            :value="raBuildingState(row.original)"
            size="sm"
          />
        </template>
        <template #assessment_status-cell="{ row }">
          <!-- Draft (also when returned), In approval or Approved. -->
          <StatusBadge
            v-if="row.original.latest_assessment"
            :scale="raStatus"
            :value="row.original.latest_assessment.status"
            size="sm"
          />
          <span
            v-else
            class="text-muted"
          >No RA yet</span>
        </template>
        <template #updated_at-cell="{ row }">
          <UTooltip
            v-if="row.original.updated_at"
            :text="formatDateTime(row.original.updated_at) ?? ''"
          >
            <span class="whitespace-nowrap tabular-nums">{{ formatDate(row.original.updated_at) }}</span>
          </UTooltip>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex items-center justify-end gap-1">
            <UTooltip :text="canEditRow(row.original) ? `Edit ${noun(row.original)}` : `Open ${noun(row.original)}`">
              <UButton
                :to="locationPath(row.original.id)"
                color="neutral"
                variant="ghost"
                size="sm"
                :icon="canEditRow(row.original) ? 'i-lucide-pencil' : 'i-lucide-eye'"
                :aria-label="`${canEditRow(row.original) ? 'Edit' : 'Open'} ${row.original.name}`"
                @click.stop
              />
            </UTooltip>
          </div>
        </template>
        <template #empty>
          <p class="py-10 text-center text-sm text-muted">
            {{ hasFilters ? 'No buildings match these filters.' : 'No buildings yet. Add the first head office building or branch to assess.' }}
          </p>
        </template>
      </UTable>

      <TablePagination
        v-if="data"
        v-model:per-page="perPage"
        page-sizes
        :page="data.page"
        :total="data.total"
        :to="(next) => ({ query: { ...route.query, page: next > 1 ? next : undefined } })"
        label="Buildings"
      />
    </UCard>
  </AppPage>
</template>
