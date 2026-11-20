<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaAssessmentSummary, RaListQuery, RaMyRole } from '~/composables/useRa'

/**
 * RA (or RA Branch) Manage, as SCCA Manage. The drafts the user is the assessor or LICOM of
 * (including those returned for changes), and the generated annual reviews their access scope
 * shows read-only (My role Directorate). Submitted RAs live in Approval and Monitoring.
 */
const ra = useRaModule()
const { can } = useAuth()
const route = useRoute()
const router = useRouter()

const perPage = useRowsPerPage()
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
  reason: RA_REASONS.some((reason) => reason.value === route.query.reason) ? route.query.reason as RaReason : undefined,
  mine: '1' as const,
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: perPage.value,
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
const reasonFilter = computed<RaReason | 'all'>({
  get: () => query.value.reason ?? 'all',
  set: (value) => setQuery('reason', value),
})
const reasonItems = [
  { label: 'All reasons', value: 'all' as const },
  ...RA_REASONS.map((reason) => ({ label: reason.label, value: reason.value })),
]

const { data, status, error, refresh } = useRaAssessments(query)
/** Import from Excel, as a dialog on this module's type (`?import=1` opens it). */
const importOpen = computed<boolean>({
  get: () => route.query.import !== undefined && can(ra.value.perm.edit),
  set: (value) => {
    router.replace({ query: { ...route.query, import: value ? '1' : undefined } })
  },
})
const { data: locations } = useRaLocations(() => ({ kind: ra.value.kind }))
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const hasFilters = computed(() => Boolean(query.value.q || query.value.location_id || query.value.year || query.value.reason))
function clearFilters() {
  search.value = ''
  router.replace({ query: {} })
}

const columns = computed<TableColumn<RaAssessmentSummary>[]>(() => [
  { accessorKey: 'ref_no', header: 'Ref. no.' },
  { id: 'location', header: ra.value.location.single },
  { accessorKey: 'period_year', header: 'Period' },
  { accessorKey: 'reason', header: 'Reason' },
  { id: 'renews', header: 'Renews' },
  { accessorKey: 'my_role', header: 'My role' },
  { id: 'progress', header: 'Rated', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'highest_residual_level', header: 'Highest residual', meta: RA_STATUS_COLUMN },
  { accessorKey: 'status', header: 'Status', meta: RA_STATUS_COLUMN },
  { accessorKey: 'created_by', header: 'Assessor' },
  { accessorKey: 'next_step', header: 'Next step' },
  { accessorKey: 'updated_at', header: 'Last saved' },
])
const ROLE_LABEL: Record<RaMyRole, string> = { assessor: 'Assessor', licom: 'LICOM', directorate: 'Directorate (view)' }

const locationItems = computed(() => [
  { label: `All ${ra.value.location.lowerPlural}`, value: 'all' as const },
  ...(locations.value?.items ?? []).map((location) => ({ label: location.name, value: location.id, description: location.code ?? undefined })),
])
const yearItems = [
  { label: 'All periods', value: 'all' as const },
  ...Array.from({ length: 8 }, (_, index) => THIS_YEAR + 1 - index).map((year) => ({ label: String(year), value: year })),
]

function openRow(_event: Event, row: { original: RaAssessmentSummary }) {
  navigateTo(raPath(ra.value.kind, 'manage', row.original.id))
}
</script>

<template>
  <AppPage
    :title="`Manage ${ra.title}`"
    icon="i-lucide-list-checks"
    description="The drafts being worked on, including those returned for changes. Submitted RAs are in Approval and Monitoring."
    :crumbs="[{ label: ra.title, to: raPath(ra.kind, 'monitoring') }, { label: 'Manage' }]"
  >
    <template #actions>
      <UButton
        v-if="can(ra.perm.edit)"
        color="neutral"
        variant="outline"
        icon="i-lucide-file-up"
        label="Import from Excel"
        @click="importOpen = true"
      />
      <UButton
        v-if="can(ra.perm.edit)"
        :to="raPath(ra.kind, 'manage', 'new')"
        icon="i-lucide-plus"
        label="New assessment"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="12"
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
      <!-- As SCCA. Search, then building, reason and period (ListFilterBar). -->
      <ListFilterBar
        :filtered="hasFilters"
        @clear="clearFilters"
      >
        <template #search>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="`${ra.location.single}, ID or ref. no.`"
            class="w-full"
            :aria-label="`Search ${ra.location.lower}, ID or ref. no.`"
          />
        </template>
        <USelectMenu
          v-model="locationFilter"
          value-key="value"
          :items="locationItems"
          class="w-48"
          :aria-label="`Filter by ${ra.location.lower}`"
        />
        <USelectMenu
          v-model="reasonFilter"
          value-key="value"
          :items="reasonItems"
          :search-input="false"
          class="w-44"
          aria-label="Reason for assessment"
        />
        <USelectMenu
          v-model="yearFilter"
          value-key="value"
          :items="yearItems"
          :search-input="false"
          class="w-32"
          aria-label="Filter by period"
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
            :value="row.original.status"
            size="sm"
          />
        </template>
        <template #reason-cell="{ row }">
          {{ raReasonLabel(row.original.reason) ?? '—' }}
        </template>
        <template #renews-cell="{ row }">
          <NuxtLink
            v-if="row.original.renewal_of?.can_open"
            :to="raRecordPath(ra.kind, row.original.renewal_of)"
            class="font-mono text-xs whitespace-nowrap text-primary hover:underline"
            @click.stop
          >
            {{ row.original.renewal_of.ref_no }}
          </NuxtLink>
          <span
            v-else-if="row.original.renewal_of"
            class="font-mono text-xs whitespace-nowrap"
          >{{ row.original.renewal_of.ref_no }}</span>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #my_role-cell="{ row }">
          <UBadge
            v-if="row.original.my_role === 'directorate'"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-eye"
            :label="ROLE_LABEL.directorate"
          />
          <span
            v-else
            class="whitespace-nowrap"
          >{{ row.original.my_role ? ROLE_LABEL[row.original.my_role] : '—' }}</span>
        </template>
        <template #created_by-cell="{ row }">
          {{ row.original.created_by || '—' }}
        </template>
        <template #next_step-cell="{ row }">
          <span
            class="text-sm whitespace-nowrap"
            :class="/overdue|Returned/.test(row.original.next_step ?? '') ? 'font-medium text-error' : /due in|Ready/.test(row.original.next_step ?? '') ? 'font-medium text-warning' : 'text-muted'"
          >{{ row.original.next_step || '—' }}</span>
        </template>
        <template #updated_at-cell="{ row }">
          <span class="whitespace-nowrap">{{ formatDateTime(row.original.updated_at) }}</span>
        </template>
        <template #empty>
          <p class="py-10 text-center text-sm text-muted">
            {{ hasFilters ? 'No drafts match these filters.' : 'No drafts of yours. Use New assessment to start one.' }}
          </p>
        </template>
      </UTable>

      <TablePagination
        v-if="data"
        v-model:per-page="perPage"
        page-sizes
        :page="data.page"
        :total="data.total"
        :to="(next) => ({ query: { ...route.query, page: next } })"
        label="Drafts"
      />
    </UCard>
    <RaImportModal
      v-model:open="importOpen"
      :kind="ra.kind"
      @imported="refresh()"
    />
  </AppPage>
</template>
