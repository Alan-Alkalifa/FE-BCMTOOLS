<script setup lang="ts">
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui'
import type { SccaAssessmentSummary, SccaListQuery } from '~/composables/useScca'

definePageMeta({ permission: 'scca.access' })

const { can } = useAuth()

const route = useRoute()
const router = useRouter()

const perPage = useRowsPerPage()

function asCategory(value: unknown): SccaCategory | undefined {
  return typeof value === 'string' && SCCA_CATEGORIES.includes(value as SccaCategory)
    ? value as SccaCategory
    : undefined
}

/** Manage is for drafts (including rejected ones). Submitted SCCAs live in Approval and Monitoring. */
const query = computed<SccaListQuery>(() => ({
  q: typeof route.query.q === 'string' && route.query.q.trim() ? route.query.q.trim() : undefined,
  category: asCategory(route.query.category),
  reason: typeof route.query.reason === 'string' && route.query.reason ? route.query.reason : undefined,
  status: 'draft',
  mine: '1' as const,
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: perPage.value,
}))

const search = ref(query.value.q ?? '')
const categoryFilter = ref<SccaCategory | 'all'>(query.value.category ?? 'all')

watch(
  () => [route.query.q, route.query.category],
  () => {
    search.value = query.value.q ?? ''
    categoryFilter.value = query.value.category ?? 'all'
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

watch(categoryFilter, (value) => {
  const next = value === 'all' ? undefined : value
  if (next === query.value.category) return
  router.replace({ query: { ...route.query, category: next, page: undefined } })
})

const { data: config } = useSccaConfig()
const reasonFilter = computed<string>({
  get: () => query.value.reason ?? 'all',
  set: (value) => router.replace({ query: { ...route.query, reason: value === 'all' ? undefined : value, page: undefined } }),
})
const reasonItems = computed(() => [{ label: 'All reasons', value: 'all' }, ...sccaListOptions(config.value, 'assessment_reason')])
const filtered = computed(() => !!(query.value.q || query.value.category || query.value.reason))
function clearFilters() {
  search.value = ''
  categoryFilter.value = 'all'
  router.replace({ query: {} })
}

const { data, status, error, refresh } = useSccaAssessments(query)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

const columns: TableColumn<SccaAssessmentSummary>[] = [
  { accessorKey: 'ref_no', header: 'Ref no' },
  { accessorKey: 'application_name', header: 'Application name' },
  { accessorKey: 'application_code', header: 'Application code' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'assessment_reason', header: 'Reason' },
  { id: 'renews', header: 'Renews' },
  { accessorKey: 'my_role', header: 'My role' },
  { accessorKey: 'assessor', header: 'Assessor' },
  { accessorKey: 'computed_category', header: 'Category so far' },
  { accessorKey: 'due_date', header: 'Renewal date' },
  { accessorKey: 'next_step', header: 'Next step' },
  { accessorKey: 'updated_at', header: 'Last saved' },
  { id: 'actions', header: '' },
]
const ROLE_LABEL = { assessor: 'Assessor', contributor: 'Contributor', directorate: 'Directorate (view)' } as const

function rowActions(row: SccaAssessmentSummary): DropdownMenuItem[] {
  return [
    { label: 'Open', icon: 'i-lucide-folder-open', to: sccaPath('manage', row.id) },
    { label: 'View report', icon: 'i-lucide-file-text', to: sccaPath('manage', row.id, 'report') },
  ]
}

const categoryItems = [
  { label: 'All categories', value: 'all' as const },
  ...SCCA_CATEGORIES.map((category) => ({ label: sccaCategory[category].label, value: category })),
]

function openRow(_event: Event, row: { original: SccaAssessmentSummary }) {
  navigateTo(sccaPath('manage', row.original.id))
}
</script>

<template>
  <AppPage
    title="Manage SCCAs"
    icon="i-lucide-list-checks"
    description="Your drafts: the SCCAs you assess or contribute to, until you submit them. Submitted and final SCCAs are in Monitoring; the ones you sign off are in Approval."
    :crumbs="[{ label: 'SCCA' }, { label: 'Manage' }]"
  >
    <template #actions>
      <UButton
        v-if="can('scca.create')"
        to="/scca/manage/new"
        icon="i-lucide-plus"
        label="New assessment"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="12"
      label="Loading assessments"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load assessments"
      :description="error.message"
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
            placeholder="Application, code or ref. no."
            class="w-full"
            aria-label="Search by name, code, or ref. no."
          />
        </template>
        <USelectMenu
          v-model="categoryFilter"
          value-key="value"
          :items="categoryItems"
          :search-input="false"
          class="w-44"
          aria-label="Filter by category"
        />
        <USelectMenu
          v-model="reasonFilter"
          value-key="value"
          :items="reasonItems"
          :search-input="false"
          class="w-44"
          aria-label="Filter by reason"
        />
      </ListFilterBar>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        class="cursor-pointer"
        :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4' }"
        :on-select="openRow"
      >
        <template #ref_no-cell="{ row }">
          <span class="font-mono text-xs">{{ row.original.ref_no || '—' }}</span>
        </template>
        <template #application_name-cell="{ row }">
          <NuxtLink
            :to="sccaPath('manage', row.original.id)"
            class="font-medium text-primary hover:underline"
          >
            {{ row.original.application_name }}
          </NuxtLink>
        </template>
        <template #application_code-cell="{ row }">
          <span class="font-mono text-xs">{{ row.original.application_code || '—' }}</span>
        </template>
        <template #assessment_reason-cell="{ row }">
          {{ reasonLabel(row.original.assessment_reason) || '—' }}
        </template>
        <template #renews-cell="{ row }">
          <NuxtLink
            v-if="row.original.renewal_of"
            :to="sccaPath('monitoring', row.original.renewal_of.id)"
            class="font-mono text-xs text-primary hover:underline"
            @click.stop
          >
            {{ row.original.renewal_of.ref_no }}
          </NuxtLink>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #my_role-cell="{ row }">
          <UBadge
            v-if="row.original.my_role === 'directorate'"
            color="neutral"
            variant="subtle"
            size="sm"
            icon="i-lucide-eye"
            :label="ROLE_LABEL.directorate"
          />
          <span v-else>{{ ROLE_LABEL[row.original.my_role ?? 'assessor'] }}</span>
        </template>
        <template #assessor-cell="{ row }">
          {{ row.original.assessor || row.original.created_by || '—' }}
        </template>
        <template #due_date-cell="{ row }">
          {{ formatDate(row.original.due_date) || '—' }}
        </template>
        <template #next_step-cell="{ row }">
          <span
            class="text-sm"
            :class="/overdue|Rejected/.test(row.original.next_step ?? '') ? 'font-medium text-error' : /due in|Ready/.test(row.original.next_step ?? '') ? 'font-medium text-warning' : 'text-muted'"
          >{{ row.original.next_step || '—' }}</span>
        </template>
        <template #actions-cell="{ row }">
          <UDropdownMenu
            :items="rowActions(row.original)"
            :content="{ align: 'end' }"
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis-vertical"
              :aria-label="`Actions for ${row.original.application_name}`"
              @click.stop
            />
          </UDropdownMenu>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge
            :scale="sccaStatus"
            :value="sccaStatusKey(row.original)"
            size="sm"
          />
          <UBadge
            v-if="row.original.migrated"
            class="ms-1"
            label="Migrated"
            color="neutral"
            variant="subtle"
            size="sm"
          />
        </template>
        <template #computed_category-cell="{ row }">
          <StatusBadge
            v-if="row.original.final_category ?? row.original.computed_category"
            :scale="sccaCategory"
            :value="(row.original.final_category ?? row.original.computed_category)!"
            size="sm"
          />
          <span
            v-else
            class="text-muted"
          >Not rated yet</span>
        </template>
        <template #updated_at-cell="{ row }">
          {{ formatDateTime(row.original.updated_at) || '—' }}
        </template>
      </UTable>

      <div
        v-if="data && !data.items.length"
        class="py-10 text-center"
      >
        <p class="text-sm text-muted">
          {{ query.q || query.category ? 'No drafts match these filters.' : 'You have no drafts. Create an assessment, or start a renewal from a final SCCA in Monitoring.' }}
        </p>
        <UButton
          v-if="can('scca.create') && !query.q && !query.category"
          class="mt-3"
          to="/scca/manage/new"
          icon="i-lucide-plus"
          label="New assessment"
        />
      </div>

      <TablePagination
        v-if="data"
        v-model:per-page="perPage"
        page-sizes
        :page="data.page"
        :total="data.total"
        :to="(page) => ({ query: { ...route.query, page } })"
        label="Drafts"
      />
    </UCard>
  </AppPage>
</template>
