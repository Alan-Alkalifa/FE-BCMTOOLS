<script setup lang="ts">
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui'
import type { BiancaSummary, BiancaListQuery } from '~/composables/useBianca'

definePageMeta({ permission: 'bianca.access' })

const { can } = useAuth()
const route = useRoute()
const router = useRouter()
const perPage = useRowsPerPage()

/** Manage is for drafts (including rejected ones). Submitted BIAs live in Approval and Monitoring. */
const query = computed<BiancaListQuery>(() => ({
  q: typeof route.query.q === 'string' && route.query.q.trim() ? route.query.q.trim() : undefined,
  status: 'draft',
  mine: '1' as const,
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: perPage.value,
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

const filtered = computed(() => !!query.value.q)
function clearFilters() {
  search.value = ''
  router.replace({ query: {} })
}

const { data, status, error, refresh } = useBiancaAssessments(query)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const uploading = ref(false)

const columns: TableColumn<BiancaSummary>[] = [
  { accessorKey: 'ref_no', header: 'Ref no' },
  { accessorKey: 'org_group', header: 'Group' },
  { accessorKey: 'sub_directorate', header: 'Sub directorate' },
  { accessorKey: 'directorate', header: 'Directorate' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'functions', header: 'Functions' },
  { accessorKey: 'input_method', header: 'Input' },
  { accessorKey: 'created_by', header: 'Created by' },
  { accessorKey: 'updated_at', header: 'Last saved' },
  { id: 'actions', header: '' },
]

function rowActions(row: BiancaSummary): DropdownMenuItem[] {
  return [{ label: 'Open', icon: 'i-lucide-folder-open', to: biancaPath(row.id) }]
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
    description="Your drafts: the business impact analyses you prepare, until you submit them. Submitted and final BIAs are in Monitoring; the ones you sign off are in Approval."
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
      :columns="9"
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
          {{ query.q ? 'No drafts match this search.' : 'You have no drafts. Create a BIA on the web, or upload the Excel template.' }}
        </p>
        <UButton
          v-if="can('bianca.create') && !query.q"
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
