<script setup lang="ts">
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui'
import type { BiancaSummary, BiancaListQuery } from '~/composables/useBianca'

definePageMeta({ permission: 'bianca.access' })

const { can } = useAuth()
const route = useRoute()
const router = useRouter()
const perPage = useRowsPerPage()

/**
 * Manage is for drafts (including the ones returned for changes): yours, and your Group's to read.
 * Submitted BIAs live in Approval and Monitoring. Filters and the sort are in the address.
 */
const { query: sortQuery, header: sortable } = useTableSort(['updated_at'])
const pick = <T extends string>(value: unknown, allowed: readonly T[]) =>
  (typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : undefined)
const query = computed<BiancaListQuery>(() => ({
  q: typeof route.query.q === 'string' && route.query.q.trim() ? route.query.q.trim() : undefined,
  status: 'draft',
  scope: 'manage',
  role: pick(route.query.role, ['owner', 'group'] as const),
  state: pick(route.query.state, ['new', 'renewal', 'returned'] as const),
  input_method: pick(route.query.input, ['web', 'excel'] as const),
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: perPage.value,
  ...sortQuery.value,
}))

const search = ref(query.value.q ?? '')
watch(() => route.query.q, () => {
  search.value = query.value.q ?? ''
})
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

/** A filter kept in the address (`key`), "all" when not set. */
function filterModel(key: string) {
  return computed<string>({
    get: () => (typeof route.query[key] === 'string' ? String(route.query[key]) : 'all'),
    set: (value) => router.replace({ query: { ...route.query, [key]: value === 'all' ? undefined : value, page: undefined } }),
  })
}
const roleFilter = filterModel('role')
const stateFilter = filterModel('state')
const inputFilter = filterModel('input')
const roleItems = [
  { label: 'Mine and my Group\'s', value: 'all' },
  { label: 'Mine', value: 'owner' },
  { label: 'My Group\'s (view)', value: 'group' },
]
const stateItems = [
  { label: 'All drafts', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Renewals', value: 'renewal' },
  { label: 'Returned for changes', value: 'returned' },
]
const inputItems = [
  { label: 'Web and Excel', value: 'all' },
  { label: 'Web form', value: 'web' },
  { label: 'Excel upload', value: 'excel' },
]
const filtered = computed(() => !!(query.value.q || query.value.role || query.value.state || query.value.input_method))
function clearFilters() {
  search.value = ''
  router.replace({ query: {} })
}

const { data, status, error, refresh } = useBiancaAssessments(query)
// The tab stays open in the background: coming back to it shows BIAs made or saved since.
onActivated(() => {
  if (data.value) refresh()
})
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const uploading = ref(false)

function column(key: string, label: string, cls = '', sortKey?: string): TableColumn<BiancaSummary> {
  return {
    accessorKey: key,
    header: sortKey ? sortable(label, sortKey) : label,
    meta: { class: { th: cls, td: cls } },
  }
}
const columns: TableColumn<BiancaSummary>[] = [
  column('ref_no', 'Ref no', 'min-w-32', 'ref_no'),
  column('org_group', 'Group', 'min-w-40', 'org_group'),
  column('sub_directorate', 'Sub directorate', 'min-w-36'),
  column('directorate', 'Directorate', 'min-w-36'),
  column('status', 'Status', 'min-w-28'),
  column('my_role', 'My role', 'min-w-32'),
  column('renewal_of', 'Renews', 'min-w-32'),
  column('due_date', 'Renewal date', 'min-w-32'),
  column('functions', 'Functions', 'text-right'),
  column('input_method', 'Input', 'min-w-28'),
  column('created_by', 'Owner', 'min-w-36'),
  column('next_step', 'Next step', 'min-w-40'),
  column('updated_at', 'Last saved', 'min-w-36', 'updated_at'),
  { id: 'actions', header: '' },
]
const ROLE_LABEL = { owner: 'Owner', group: 'Group (view)' } as const
const TONE = { error: 'font-medium text-error', warning: 'font-medium text-warning', neutral: 'text-muted' } as const

const exporter = useBiancaExport()
const pdf = useBiancaPdf()
function rowActions(row: BiancaSummary): DropdownMenuItem[] {
  return [
    { label: 'Open', icon: 'i-lucide-folder-open', to: biancaPath(row.id) },
    { label: 'View report', icon: 'i-lucide-file-text', to: biancaReportPath(row.id) },
    { label: 'Download PDF', icon: 'i-lucide-file-down', onSelect: () => pdf.run(row.id) },
    { label: 'Export to Excel', icon: 'i-lucide-file-spreadsheet', onSelect: () => exporter.run(row.id) },
  ]
}

function openRow(_event: Event, row: { original: BiancaSummary }) {
  navigateTo(biancaPath(row.original.id))
}

function onImported(assessment: { id: number }) {
  return navigateTo(biancaPath(assessment.id))
}
</script>

<template>
  <AppPage
    title="Manage BIA"
    icon="i-lucide-list-checks"
    description="Your BIA drafts and your Group's (to read), until they are submitted. Submitted and final BIAs are in Monitoring; the ones you sign off are in Approval."
    :crumbs="[{ label: 'BIANCA' }, { label: 'Manage' }]"
  >
    <template #actions>
      <template v-if="can('bianca.create')">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-file-spreadsheet"
          label="Upload Excel"
          @click="uploading = true"
        />
        <UButton
          to="/bianca/manage/new"
          icon="i-lucide-plus"
          label="New BIA"
        />
      </template>
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="13"
      label="Loading BIAs"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load BIAs"
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
            placeholder="Ref. no., group or directorate"
            class="w-full"
            aria-label="Search by ref. no., group or directorate"
          />
        </template>
        <USelectMenu
          v-model="roleFilter"
          value-key="value"
          :items="roleItems"
          :search-input="false"
          class="w-48"
          aria-label="Filter by whose draft"
        />
        <USelectMenu
          v-model="stateFilter"
          value-key="value"
          :items="stateItems"
          :search-input="false"
          class="w-48"
          aria-label="Filter by kind of draft"
        />
        <USelectMenu
          v-model="inputFilter"
          value-key="value"
          :items="inputItems"
          :search-input="false"
          class="w-40"
          aria-label="Filter by input"
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
          <NuxtLink
            :to="biancaPath(row.original.id)"
            class="font-mono text-xs font-medium text-primary hover:underline"
          >
            {{ row.original.ref_no || '—' }}
          </NuxtLink>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge
            :scale="biancaStatus"
            :value="biancaStatusKey(row.original)"
            size="sm"
          />
        </template>
        <template #my_role-cell="{ row }">
          <UBadge
            v-if="row.original.my_role === 'group'"
            color="neutral"
            variant="subtle"
            size="sm"
            icon="i-lucide-eye"
            :label="ROLE_LABEL.group"
          />
          <span v-else>{{ ROLE_LABEL.owner }}</span>
        </template>
        <template #renewal_of-cell="{ row }">
          <NuxtLink
            v-if="row.original.renewal_of"
            :to="biancaPath(row.original.renewal_of.id)"
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
        <template #due_date-cell="{ row }">
          {{ formatDate(row.original.due_date) || '—' }}
        </template>
        <template #functions-cell="{ row }">
          <span class="tabular-nums">{{ row.original.functions }}</span>
        </template>
        <template #next_step-cell="{ row }">
          <span
            class="text-sm"
            :class="TONE[row.original.next_tone ?? 'neutral']"
          >{{ row.original.next_step || '—' }}</span>
        </template>
        <template #input_method-cell="{ row }">
          {{ BIANCA_INPUT_METHOD[row.original.input_method] }}
        </template>
        <template #created_by-cell="{ row }">
          {{ row.original.created_by || '—' }}
        </template>
        <template #updated_at-cell="{ row }">
          {{ formatDateTime(row.original.updated_at) || '—' }}
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
              :aria-label="`Actions for ${row.original.ref_no}`"
              @click.stop
            />
          </UDropdownMenu>
        </template>
      </UTable>

      <div
        v-if="data && !data.items.length"
        class="py-10 text-center"
      >
        <p class="text-sm text-muted">
          {{ filtered ? 'No drafts match these filters.' : 'You have no drafts. Create a BIA on the web, upload the Excel template, or start a renewal from a final BIA.' }}
        </p>
        <UButton
          v-if="can('bianca.create') && !filtered"
          class="mt-3"
          to="/bianca/manage/new"
          icon="i-lucide-plus"
          label="New BIA"
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

    <BiancaUploadDialog
      v-model:open="uploading"
      @saved="onImported"
    />
  </AppPage>
</template>
