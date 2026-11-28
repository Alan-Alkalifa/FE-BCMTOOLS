<script setup lang="ts">
import type { TableColumn, DropdownMenuItem } from '@nuxt/ui'
import type { BcpEligible, BcpListQuery, BcpPlanSummary } from '~/composables/useBcp'

/**
 * BCP › Manage, as SCCA Manage: the BCPs of the Groups the user coordinates (drafts, and until BCP
 * Monitor exists also those in approval or invalid, read-only, D49). Above them, the
 * Groups whose latest final BIA has a business critical function and no BCP yet (as the
 * production BIANCA's "Waiting For Submission Task"), each with Create BCP.
 */
definePageMeta({ permission: 'bcp.access' })

const { can } = useAuth()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const perPage = useRowsPerPage()
const { query: sortQuery, header: sortable } = useTableSort(['updated_at'])

const query = computed<BcpListQuery>(() => ({
  q: typeof route.query.q === 'string' && route.query.q.trim() ? route.query.q.trim() : undefined,
  directorate: typeof route.query.directorate === 'string' && route.query.directorate ? route.query.directorate : undefined,
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

const { data, status, error, refresh } = useBcpPlans(query)
const eligible = useBcpEligible()
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

const directorateFilter = computed<string>({
  get: () => query.value.directorate ?? 'all',
  set: (value) => router.replace({ query: { ...route.query, directorate: value === 'all' ? undefined : value, page: undefined } }),
})
const directorateItems = computed(() => {
  const names = new Set((data.value?.items ?? []).map((row) => row.directorate).filter((name): name is string => !!name))
  if (query.value.directorate) names.add(query.value.directorate)
  return [{ label: 'All directorates', value: 'all' }, ...[...names].sort().map((name) => ({ label: name, value: name }))]
})
const filtered = computed(() => !!(query.value.q || query.value.directorate))
function clearFilters() {
  search.value = ''
  router.replace({ query: {} })
}

function column(key: string, label: string, cls = ''): TableColumn<BcpPlanSummary> {
  return { accessorKey: key, header: sortable(label, key), meta: { class: { th: cls, td: cls } } }
}
const columns: TableColumn<BcpPlanSummary>[] = [
  column('ref_no', 'Current BCP ref. no.', 'min-w-36'),
  column('name', 'BCP name', 'min-w-40'),
  column('org_group', 'Group', 'min-w-40'),
  column('directorate', 'Directorate', 'min-w-40'),
  { accessorKey: 'status', header: 'Status', meta: { class: { th: 'min-w-24', td: 'min-w-24' } } },
  column('bia_ref_no', 'Source BIA ref. no.', 'min-w-36'),
  { accessorKey: 'critical', header: 'Critical functions', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'coordinator', header: 'Coordinator', meta: { class: { th: 'min-w-36', td: 'min-w-36' } } },
  { accessorKey: 'config_code', header: 'Config version' },
  { accessorKey: 'next_step', header: 'Next step', meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  column('updated_at', 'Last saved', 'min-w-32'),
  { id: 'actions', header: '' },
]
function rowActions(row: BcpPlanSummary): DropdownMenuItem[] {
  return [{ label: 'Open', icon: 'i-lucide-folder-open', to: bcpPath('manage', row.id) }]
}
function openRow(_event: Event, row: { original: BcpPlanSummary }) {
  navigateTo(bcpPath('manage', row.original.id))
}

const creating = ref<number | null>(null)
async function create(item: BcpEligible) {
  creating.value = item.bia_id
  try {
    const plan = await bcpApi.create(item.bia_id)
    toast.add({ title: `${plan.ref_no} created`, description: 'Check the summary of the BIA, then fill in each condition.', color: 'success', icon: 'i-lucide-circle-check' })
    await navigateTo(bcpPath('manage', plan.id))
  } catch (failure) {
    toast.add({ title: bcpErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert', duration: 10000 })
    void eligible.refresh()
  } finally {
    creating.value = null
  }
}
</script>

<template>
  <AppPage
    title="Manage BCPs"
    icon="i-lucide-list-checks"
    description="The BCPs of the Groups you coordinate: drafts to fill in, and those in approval or invalid to read. Groups with a final BIA that still need a BCP are listed first."
    :crumbs="[{ label: 'BCP' }, { label: 'Manage' }]"
  >
    <template #actions>
      <UButton
        v-if="can('bcp.create')"
        to="/bcp/manage/new"
        icon="i-lucide-plus"
        label="New BCP"
      />
    </template>

    <div class="space-y-6">
      <UCard
        v-if="eligible.data.value?.items.length"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <h2 class="font-semibold text-highlighted">
            Waiting to start
          </h2>
          <p class="mt-1 text-sm text-muted">
            Groups you coordinate whose latest final BIA has a business critical function and no BCP yet.
          </p>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[48rem] text-sm">
            <caption class="sr-only">
              Groups waiting to start their BCP
            </caption>
            <thead class="bg-muted text-left text-xs uppercase text-muted">
              <tr>
                <th class="px-4 py-2">
                  Group
                </th>
                <th class="px-3 py-2">
                  Source BIA ref. no.
                </th>
                <th class="px-3 py-2">
                  Final on
                </th>
                <th class="px-3 py-2 text-right">
                  Critical functions
                </th>
                <th class="px-4 py-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="item in eligible.data.value.items"
                :key="item.bia_id"
              >
                <td class="px-4 py-2">
                  <p class="font-medium text-highlighted">
                    {{ item.org_group || '—' }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ [item.directorate, item.sub_directorate].filter(Boolean).join(' › ') || '—' }}
                  </p>
                </td>
                <td class="px-3 py-2 font-mono text-xs">
                  {{ item.bia_ref_no || '—' }}
                </td>
                <td class="px-3 py-2">
                  {{ formatDate(item.finalised_at) || '—' }}
                </td>
                <td class="px-3 py-2 text-right tabular-nums">
                  {{ item.critical }} of {{ item.functions }}
                </td>
                <td class="px-4 py-2 text-right">
                  <UButton
                    v-if="can('bcp.create')"
                    size="sm"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-file-plus"
                    label="Create BCP"
                    :aria-label="`Create BCP for ${item.org_group}`"
                    :loading="creating === item.bia_id"
                    :disabled="creating !== null"
                    @click="create(item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <SkeletonTable
        v-if="showSkeleton"
        toolbar
        :columns="10"
        label="Loading BCPs"
      />

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load the BCPs"
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
              placeholder="Group, BCP name or ref. no."
              class="w-full"
              aria-label="Search by group, BCP name or ref. no."
            />
          </template>
          <USelectMenu
            v-model="directorateFilter"
            value-key="value"
            :items="directorateItems"
            :search-input="false"
            class="w-56"
            aria-label="Filter by directorate"
          />
        </ListFilterBar>
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default px-4 py-2">
          <p class="text-sm text-muted">
            {{ data?.total ?? 0 }} BCP{{ data?.total === 1 ? '' : 's' }}
          </p>
        </div>

        <UTable
          :data="data?.items ?? []"
          :columns="columns"
          :loading="status === 'pending'"
          class="cursor-pointer"
          :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4' }"
          :on-select="openRow"
        >
          <template #ref_no-cell="{ row }">
            <span class="font-mono text-xs">{{ row.original.ref_no }}</span>
          </template>
          <template #name-cell="{ row }">
            <NuxtLink
              :to="bcpPath('manage', row.original.id)"
              class="font-medium text-primary hover:underline"
            >
              {{ row.original.name }}
            </NuxtLink>
          </template>
          <template #org_group-cell="{ row }">
            {{ row.original.org_group || '—' }}
          </template>
          <template #directorate-cell="{ row }">
            {{ row.original.directorate || '—' }}
          </template>
          <template #status-cell="{ row }">
            <div class="flex flex-wrap items-center gap-1">
              <StatusBadge
                :scale="bcpStatus"
                :value="row.original.status"
                size="sm"
              />
              <UBadge
                v-if="row.original.no_longer_required"
                color="warning"
                variant="subtle"
                size="sm"
                icon="i-lucide-triangle-alert"
                label="No longer required"
              />
            </div>
          </template>
          <template #bia_ref_no-cell="{ row }">
            <span class="font-mono text-xs">{{ row.original.bia_ref_no || '—' }}</span>
          </template>
          <template #critical-cell="{ row }">
            <span class="tabular-nums">{{ row.original.critical }}</span>
          </template>
          <template #coordinator-cell="{ row }">
            {{ row.original.coordinator || '—' }}
          </template>
          <template #next_step-cell="{ row }">
            <span class="text-sm text-muted">{{ row.original.next_step }}</span>
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
                :aria-label="`Actions for ${row.original.name}`"
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
            {{ filtered ? 'No BCPs match these filters.' : 'You have no BCPs yet. Create one from your Group\'s final BIA.' }}
          </p>
          <UButton
            v-if="can('bcp.create') && !filtered"
            class="mt-3"
            to="/bcp/manage/new"
            icon="i-lucide-plus"
            label="New BCP"
          />
        </div>

        <TablePagination
          v-if="data"
          v-model:per-page="perPage"
          page-sizes
          :page="data.page"
          :total="data.total"
          :to="(page) => ({ query: { ...route.query, page } })"
          label="BCPs"
        />
      </UCard>
    </div>
  </AppPage>
</template>
