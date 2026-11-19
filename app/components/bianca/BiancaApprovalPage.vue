<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BiancaHistoryAction, BiancaHistoryRow, BiancaWaiting } from '~/composables/useBiancaApproval'

/**
 * BIANCA Approval, as SCCA's and RA's: my inbox (BIAs whose current sign-off step is mine, with
 * those coming to me later) and my history (what I submitted, approved or returned). A row opens
 * the BIA, where its signer approves it or returns it for changes.
 */
const route = useRoute()
const router = useRouter()

type ApprovalTab = 'inbox' | 'history'
const tab = computed<ApprovalTab>({
  get: () => (route.query.tab === 'history' ? 'history' : 'inbox'),
  set: (value) => router.replace({ query: { tab: value === 'inbox' ? undefined : value } }),
})

const perPage = useRowsPerPage()
const COMING_PER_PAGE = 10
function number(name: string) {
  return Math.max(1, Number(route.query[name]) || 1)
}
function text(name: string) {
  const value = route.query[name]
  return typeof value === 'string' && value ? value : undefined
}
function setQuery(patch: Record<string, string | number | undefined>) {
  router.replace({ query: { ...route.query, ...patch } })
}
function pageTo(page: number) {
  return { query: { ...route.query, page: page > 1 ? page : undefined } }
}
function comingTo(page: number) {
  return { query: { ...route.query, coming: page > 1 ? page : undefined } }
}

// --- my inbox -------------------------------------------------------------------------------

const inboxPage = computed(() => (tab.value === 'inbox' ? number('page') : 1))
const comingPage = computed(() => (tab.value === 'inbox' ? number('coming') : 1))
const inbox = useBiancaInbox(computed(() => ({ page: inboxPage.value, per_page: perPage.value })))
const upcoming = useBiancaUpcoming(computed(() => ({ page: comingPage.value, per_page: COMING_PER_PAGE })))

const waitingColumns: TableColumn<BiancaWaiting>[] = [
  { id: 'bia', header: 'BIA' },
  { accessorKey: 'highest_category', header: 'Highest category' },
  { accessorKey: 'step', header: 'My step' },
  { accessorKey: 'submitted_by', header: 'Submitted by' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
]
const comingColumns: TableColumn<BiancaWaiting>[] = [
  { id: 'bia', header: 'BIA' },
  { accessorKey: 'step', header: 'Now at' },
  { accessorKey: 'signer', header: 'With' },
  { accessorKey: 'my_step', header: 'My step' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
]

function openReview(_event: Event, row: { original: { id: number } }) {
  navigateTo(biancaApprovalPath(row.original.id))
}

// --- my history -----------------------------------------------------------------------------

const ACTIONS = ['submitted', 'approved', 'rejected'] as const
const action = computed<BiancaHistoryAction | 'all'>({
  get: () => (ACTIONS.includes(route.query.action as BiancaHistoryAction) ? route.query.action as BiancaHistoryAction : 'all'),
  set: (value) => setQuery({ action: value === 'all' ? undefined : value, page: undefined }),
})
const actionItems = [
  { label: 'All actions', value: 'all' as const },
  { label: 'Approved', value: 'approved' as const },
  { label: 'Returned for changes', value: 'rejected' as const },
  { label: 'Submitted', value: 'submitted' as const },
]

const search = ref(text('q') ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (value.trim() !== (text('q') ?? '')) setQuery({ q: value.trim() || undefined, page: undefined })
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))
watch(() => route.query.tab, () => {
  clearTimeout(searchTimer)
  search.value = text('q') ?? ''
})
const filtered = computed(() => Boolean(text('q') || text('action')))
function clearFilters() {
  search.value = ''
  router.replace({ query: { tab: route.query.tab } })
}

const historyPage = computed(() => (tab.value === 'history' ? number('page') : 1))
const history = useBiancaApprovalHistory(computed(() => ({
  action: action.value === 'all' ? undefined : action.value,
  q: tab.value === 'history' ? text('q') : undefined,
  page: historyPage.value,
  per_page: perPage.value,
})))
const historyColumns: TableColumn<BiancaHistoryRow>[] = [
  { accessorKey: 'at', header: 'When' },
  { id: 'bia', header: 'BIA' },
  { accessorKey: 'role', header: 'Step' },
  { accessorKey: 'action', header: 'Action' },
  { id: 'status_now', header: 'Status now' },
]

const tabs = computed(() => [
  { label: 'My inbox', value: 'inbox', icon: 'i-lucide-inbox', slot: 'inbox' as const, badge: inbox.data.value?.total || undefined },
  { label: 'My history', value: 'history', icon: 'i-lucide-history', slot: 'history' as const },
])
</script>

<template>
  <AppPage
    title="BIANCA approval"
    icon="i-lucide-badge-check"
    description="BIAs waiting for your sign-off, the ones coming to you, and the ones you've acted on."
    :crumbs="[{ label: 'BIANCA' }, { label: 'Approval' }]"
  >
    <UTabs
      v-model="tab"
      :items="tabs"
      variant="link"
      :unmount-on-hide="false"
    >
      <template #inbox>
        <div class="mt-4 space-y-6">
          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <h2 class="text-lg font-semibold">
                Waiting for my sign-off
              </h2>
              <p class="text-sm text-muted">
                Open one to approve it or return it for changes.
              </p>
            </template>
            <UTable
              :data="inbox.data.value?.items ?? []"
              :columns="waitingColumns"
              :loading="inbox.status.value === 'pending'"
              class="cursor-pointer"
              :on-select="openReview"
              :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
            >
              <template #bia-cell="{ row }">
                <NuxtLink
                  :to="biancaApprovalPath(row.original.id)"
                  class="font-medium text-primary hover:underline"
                >
                  {{ row.original.org_group ?? 'BIA' }}
                </NuxtLink>
                <p class="text-xs text-muted">
                  <span class="font-mono">{{ row.original.ref_no ?? `#${row.original.id}` }}</span>
                  · {{ row.original.functions }} {{ row.original.functions === 1 ? 'function' : 'functions' }}
                </p>
              </template>
              <template #highest_category-cell="{ row }">
                <StatusBadge
                  v-if="row.original.highest_category"
                  :scale="BIANCA_CATEGORY"
                  :value="row.original.highest_category as keyof typeof BIANCA_CATEGORY"
                  size="sm"
                />
                <span
                  v-else
                  class="text-muted"
                >—</span>
              </template>
              <template #step-cell="{ row }">
                {{ row.original.step_title ?? '—' }}
              </template>
              <template #submitted_by-cell="{ row }">
                {{ row.original.submitted_by ?? '—' }}
                <p class="text-xs text-muted">
                  {{ formatDate(row.original.submitted_at) }}
                </p>
              </template>
              <template #working_days_waiting-cell="{ row }">
                {{ biancaWaiting(row.original.working_days_waiting) }}
              </template>
              <template #empty>
                <p class="py-8 text-center text-sm text-muted">
                  Nothing is waiting for your sign-off.
                </p>
              </template>
            </UTable>
            <TablePagination
              v-model:per-page="perPage"
              page-sizes
              :page="inboxPage"
              :total="inbox.data.value?.total ?? 0"
              :to="pageTo"
              label="Inbox"
            />
          </UCard>

          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <h2 class="text-lg font-semibold">
                Coming up
              </h2>
              <p class="text-sm text-muted">
                BIAs in approval where you sign a later step.
              </p>
            </template>
            <UTable
              :data="upcoming.data.value?.items ?? []"
              :columns="comingColumns"
              :loading="upcoming.status.value === 'pending'"
              :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
            >
              <template #bia-cell="{ row }">
                <NuxtLink
                  :to="biancaApprovalPath(row.original.id)"
                  class="font-medium text-primary hover:underline"
                >
                  {{ row.original.org_group ?? 'BIA' }}
                </NuxtLink>
                <p class="font-mono text-xs text-muted">
                  {{ row.original.ref_no ?? `#${row.original.id}` }}
                </p>
              </template>
              <template #step-cell="{ row }">
                {{ row.original.step_title ?? '—' }}
              </template>
              <template #signer-cell="{ row }">
                {{ row.original.signer ?? '—' }}
              </template>
              <template #my_step-cell="{ row }">
                {{ row.original.my_step_title ?? '—' }}
              </template>
              <template #working_days_waiting-cell="{ row }">
                {{ biancaWaiting(row.original.working_days_waiting) }}
              </template>
              <template #empty>
                <p class="py-6 text-center text-sm text-muted">
                  Nothing is on its way to you.
                </p>
              </template>
            </UTable>
            <TablePagination
              :per-page="COMING_PER_PAGE"
              :page="comingPage"
              :total="upcoming.data.value?.total ?? 0"
              :to="comingTo"
              label="Coming up"
            />
          </UCard>
        </div>
      </template>

      <template #history>
        <UCard
          class="mt-4"
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
                placeholder="Group, directorate or ref. no."
                aria-label="Search my history"
                class="w-full"
              />
            </template>
            <USelectMenu
              v-model="action"
              value-key="value"
              :items="actionItems"
              :search-input="false"
              class="w-56"
              aria-label="Action"
            />
          </ListFilterBar>
          <UTable
            :data="history.data.value?.items ?? []"
            :columns="historyColumns"
            :loading="history.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #at-cell="{ row }">
              <span class="whitespace-nowrap">{{ formatDateTime(row.original.at) }}</span>
            </template>
            <template #bia-cell="{ row }">
              <NuxtLink
                :to="biancaApprovalPath(row.original.assessment.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.assessment.org_group ?? 'BIA' }}
              </NuxtLink>
              <p class="font-mono text-xs text-muted">
                {{ row.original.assessment.ref_no ?? `#${row.original.assessment.id}` }}
              </p>
            </template>
            <template #role-cell="{ row }">
              {{ row.original.role_title ?? '—' }}
            </template>
            <template #action-cell="{ row }">
              <StatusBadge
                :scale="biancaHistoryAction"
                :value="row.original.action"
                size="sm"
              />
              <p
                v-if="row.original.note"
                class="mt-1 max-w-72 text-xs whitespace-pre-line text-muted"
              >
                {{ row.original.note }}
              </p>
            </template>
            <template #status_now-cell="{ row }">
              <StatusBadge
                :scale="biancaStatus"
                :value="biancaStatusKey(row.original.assessment)"
                size="sm"
              />
            </template>
            <template #empty>
              <p class="py-8 text-center text-sm text-muted">
                {{ action === 'all' ? 'You haven\'t submitted, approved or returned a BIA yet.' : 'Nothing of this kind.' }}
              </p>
            </template>
          </UTable>
          <TablePagination
            v-model:per-page="perPage"
            page-sizes
            :page="historyPage"
            :total="history.data.value?.total ?? 0"
            :to="pageTo"
            label="History"
          />
        </UCard>
      </template>
    </UTabs>
  </AppPage>
</template>
