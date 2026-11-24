<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type {
  BiancaBoardRow,
  BiancaHistoryAction,
  BiancaHistoryRow,
  BiancaWaitLevel,
  BiancaWaiting,
} from '~/composables/useBiancaApproval'
import BiancaOnBehalfDialog from '~/components/bianca/BiancaOnBehalfDialog.vue'
import BiancaReassignDialog from '~/components/bianca/BiancaReassignDialog.vue'

/**
 * BIANCA Approval, as SCCA's and RA's: my inbox (BIAs whose current sign-off step is mine, with
 * those coming to me later), my history (what I submitted, approved or returned), and for BCM,
 * the BCM board (every BIA in approval).
 */
const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { can } = useAuth()
const reassignDialog = useOverlay().create(BiancaReassignDialog)
const onBehalfDialog = useOverlay().create(BiancaOnBehalfDialog)

const bcm = computed(() => can('bianca.approval.manage'))
type ApprovalTab = 'inbox' | 'history' | 'board'
const tab = computed<ApprovalTab>({
  get: () => {
    const value = route.query.tab
    if (value === 'history') return 'history'
    if (value === 'board' && bcm.value) return 'board'
    return 'inbox'
  },
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
const filtered = computed(() => Boolean(
  text('q') || text('action') || text('step') || text('level') || text('category') || text('approver'),
))
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

// --- BCM board ------------------------------------------------------------------------------

const { header: boardSortHeader, query: sortQuery } = useTableSort(['waiting_since', 'working_days_waiting', 'reminders_sent', 'escalated_at'])
const boardPage = computed(() => (tab.value === 'board' ? number('page') : 1))
const boardStep = computed<string>({
  get: () => text('step') ?? 'all',
  set: (value) => setQuery({ step: value === 'all' ? undefined : value, page: undefined }),
})
const boardLevel = computed<BiancaWaitLevel | 'all'>({
  get: () => {
    const value = route.query.level
    return value === 'ok' || value === 'reminder' || value === 'escalated' ? value : 'all'
  },
  set: (value) => setQuery({ level: value === 'all' ? undefined : value, page: undefined }),
})
const categoryFilter = computed<string>({
  get: () => text('category') ?? 'all',
  set: (value) => setQuery({ category: value === 'all' ? undefined : value, page: undefined }),
})
const boardApprover = computed<number | null>({
  get: () => (Number(route.query.approver) > 0 ? Number(route.query.approver) : null),
  set: (value) => setQuery({ approver: value || undefined, page: undefined }),
})

const board = bcm.value
  ? useBiancaBoard(computed(() => ({
      step: boardStep.value === 'all' ? undefined : boardStep.value,
      level: boardLevel.value === 'all' ? undefined : boardLevel.value,
      category: categoryFilter.value === 'all' ? undefined : categoryFilter.value,
      approver_id: boardApprover.value ?? undefined,
      q: tab.value === 'board' ? text('q') : undefined,
      page: boardPage.value,
      per_page: perPage.value,
      ...(tab.value === 'board' ? sortQuery.value : {}),
    })))
  : null

const boardRows = computed(() => board?.data.value?.items ?? [])
const stepItems = computed(() => {
  const seen = new Map<string, string>()
  for (const row of boardRows.value) {
    if (row.step && !seen.has(row.step)) seen.set(row.step, row.step_title || row.step)
  }
  if (boardStep.value !== 'all' && !seen.has(boardStep.value)) {
    seen.set(boardStep.value, boardStep.value)
  }
  return [
    { label: 'All steps', value: 'all' },
    ...[...seen.entries()].map(([value, label]) => ({ label, value })),
  ]
})
const levelItems = [
  { label: 'All waiting times', value: 'all' as const },
  { label: 'On track', value: 'ok' as const },
  { label: 'Reminder due', value: 'reminder' as const },
  { label: 'Escalated', value: 'escalated' as const },
]
const categoryItems = [
  { label: 'All categories', value: 'all' },
  ...Object.keys(BIANCA_CATEGORY).map((value) => ({ label: value, value })),
]

const boardColumns: TableColumn<BiancaBoardRow>[] = [
  { id: 'select', header: '' },
  { accessorKey: 'org_group', header: boardSortHeader('Group', 'org_group'), meta: { class: { th: 'min-w-44', td: 'min-w-44' } } },
  { accessorKey: 'ref_no', header: boardSortHeader('BIA ref. no.', 'ref_no'), meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  { accessorKey: 'highest_category', header: boardSortHeader('Category', 'highest_category'), meta: { class: { th: 'min-w-24', td: 'min-w-24' } } },
  { accessorKey: 'step_title', header: boardSortHeader('Current approval step', 'step_title'), meta: { class: { th: 'min-w-36', td: 'min-w-36' } } },
  { accessorKey: 'approver', header: boardSortHeader('Approver', 'approver'), meta: { class: { th: 'min-w-36', td: 'min-w-36' } } },
  { accessorKey: 'level', header: boardSortHeader('Status', 'level'), meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  { accessorKey: 'waiting_since', header: boardSortHeader('Assign date', 'waiting_since'), meta: { class: { th: 'min-w-28', td: 'min-w-28' } } },
  { accessorKey: 'working_days_waiting', header: boardSortHeader('Working days', 'working_days_waiting', true), meta: { class: { th: 'min-w-28', td: 'min-w-28' } } },
  { accessorKey: 'reminders_sent', header: boardSortHeader('Reminders sent', 'reminders_sent', true), meta: { class: { th: 'min-w-24', td: 'min-w-24' } } },
  { accessorKey: 'escalated_at', header: boardSortHeader('Escalated on', 'escalated_at'), meta: { class: { th: 'min-w-28', td: 'min-w-28' } } },
  { id: 'actions', header: '' },
]

const picked = ref<Set<number>>(new Set())
watch(boardRows, () => (picked.value = new Set()))
const pickedRows = computed(() => boardRows.value.filter((row) => picked.value.has(row.id)))
const allPicked = computed<boolean | 'indeterminate'>({
  get: () => {
    if (!boardRows.value.length || !pickedRows.value.length) return false
    return pickedRows.value.length === boardRows.value.length ? true : 'indeterminate'
  },
  set: (value) => (picked.value = new Set(value ? boardRows.value.map((row) => row.id) : [])),
})
function pick(row: BiancaBoardRow, value: boolean | 'indeterminate') {
  const next = new Set(picked.value)
  if (value === true) next.add(row.id)
  else next.delete(row.id)
  picked.value = next
}

const nudgingBulk = ref(false)
async function refreshAll() {
  await Promise.all([inbox.refresh(), upcoming.refresh(), board?.refresh()])
}

async function nudgeMany() {
  const rows = pickedRows.value
  if (!rows.length) return
  const ok = await confirm({
    title: `Send a reminder to ${rows.length} approver${rows.length === 1 ? '' : 's'}?`,
    description: 'Each current approver gets an email asking them to review the BIA. Approvers already reminded today are skipped. Each counts as a reminder.',
    confirmLabel: `Send reminder (${rows.length})`,
  })
  if (!ok) return
  nudgingBulk.value = true
  try {
    const result = await biancaBoardApi.nudgeMany(rows.map((row) => row.id))
    const sent = result.sent.length
    const skipped = result.skipped.length
    const failed = result.failed.length
    toast.add({
      title: `Sent ${sent} · skipped ${skipped} · failed ${failed}`,
      description: [
        ...result.skipped.map((row) => `${row.ref_no ?? `#${row.id}`}: ${row.reason}`),
        ...(failed ? ['Failed emails are in Audit log > Email outbox.'] : []),
      ].slice(0, 4).join(' · ') || undefined,
      color: failed ? 'warning' : sent ? 'success' : 'neutral',
      icon: failed ? 'i-lucide-mail-x' : 'i-lucide-mail-check',
    })
    picked.value = new Set()
    await refreshAll()
  } catch (failure) {
    toast.add({ title: apiErrorMessage(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    nudgingBulk.value = false
  }
}

async function nudge(row: BiancaBoardRow) {
  const ok = await confirm({
    title: `Remind ${row.approver ?? 'the approver'} now?`,
    description: `They get an email asking them to review ${row.ref_no ?? `#${row.id}`} (${row.step_title || row.step || 'current step'}). It counts as a reminder.`,
    confirmLabel: 'Send reminder',
  })
  if (!ok) return
  try {
    const result = await biancaBoardApi.nudge(row.id)
    toast.add(result.email_sent
      ? { title: 'Reminder sent', color: 'success', icon: 'i-lucide-mail-check' }
      : { title: 'The reminder email could not be sent', description: 'See Audit log > Email outbox.', color: 'warning', icon: 'i-lucide-mail-x' })
    await refreshAll()
  } catch (failure) {
    const message = (failure as { data?: { message?: string } }).data?.message
    toast.add({ title: message ?? apiErrorMessage(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

async function reassign(row: BiancaBoardRow) {
  if (await reassignDialog.open({ row }).result) await refreshAll()
}

async function onBehalf(row: BiancaBoardRow) {
  if (await onBehalfDialog.open({ row }).result) await refreshAll()
}

function boardActions(row: BiancaBoardRow): DropdownMenuItem[] {
  return [
    { label: 'Open', icon: 'i-lucide-folder-open', to: biancaApprovalPath(row.id) },
    { label: 'Send a reminder now', icon: 'i-lucide-bell-ring', onSelect: () => nudge(row) },
    { label: 'Reassign the step', icon: 'i-lucide-user-round-cog', disabled: !row.can_act, onSelect: () => reassign(row) },
    { label: 'Approve on behalf', icon: 'i-lucide-badge-check', disabled: !row.can_act, onSelect: () => onBehalf(row) },
  ]
}

const tabs = computed(() => [
  { label: 'My inbox', value: 'inbox', icon: 'i-lucide-inbox', slot: 'inbox' as const, badge: inbox.data.value?.total || undefined },
  { label: 'My history', value: 'history', icon: 'i-lucide-history', slot: 'history' as const },
  ...(bcm.value ? [{ label: 'BCM board', value: 'board', icon: 'i-lucide-kanban', slot: 'board' as const }] : []),
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

      <template
        v-if="board"
        #board
      >
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
                aria-label="Search the board"
                class="w-full"
              />
            </template>
            <USelectMenu
              v-model="boardStep"
              value-key="value"
              :items="stepItems"
              :search-input="false"
              aria-label="Step"
              class="w-48"
            />
            <USelectMenu
              v-model="boardLevel"
              value-key="value"
              :items="levelItems"
              :search-input="false"
              aria-label="Waiting time"
              class="w-44"
            />
            <USelectMenu
              v-model="categoryFilter"
              value-key="value"
              :items="categoryItems"
              :search-input="false"
              aria-label="Category"
              class="w-44"
            />
            <UserPicker
              v-model="boardApprover"
              placeholder="Any approver"
              aria-label="Approver"
              permission="bianca.access"
              class="w-56"
            />
          </ListFilterBar>
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default px-4 py-2">
            <p class="text-sm text-muted">
              Reminders and escalation follow
              <NuxtLink
                v-if="can('bianca.settings.manage') && can('bianca.config.view')"
                to="/admin/bianca-config?tab=reminders"
                class="text-primary hover:underline"
              >BIANCA configuration > Reminders and escalation</NuxtLink><span v-else>the BIANCA reminder rules</span>.
            </p>
            <UButton
              icon="i-lucide-bell-ring"
              :label="`Send reminder (${pickedRows.length})`"
              :loading="nudgingBulk"
              :disabled="!pickedRows.length || nudgingBulk"
              @click="nudgeMany"
            />
          </div>
          <UTable
            :data="boardRows"
            :columns="boardColumns"
            :loading="board.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #select-header>
              <UCheckbox
                v-if="boardRows.length"
                v-model="allPicked"
                aria-label="Select every BIA on this page"
              />
            </template>
            <template #select-cell="{ row }">
              <UCheckbox
                :model-value="picked.has(row.original.id)"
                :aria-label="`Select ${row.original.ref_no ?? `#${row.original.id}`}`"
                @update:model-value="pick(row.original, $event)"
              />
            </template>
            <template #org_group-cell="{ row }">
              <NuxtLink
                :to="biancaApprovalPath(row.original.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.org_group || 'BIA' }}
              </NuxtLink>
              <p
                v-if="row.original.directorate"
                class="text-xs text-muted"
              >
                {{ row.original.directorate }}
              </p>
            </template>
            <template #ref_no-cell="{ row }">
              <span class="font-mono text-xs">{{ row.original.ref_no || '—' }}</span>
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
            <template #step_title-cell="{ row }">
              {{ row.original.step_title || row.original.step || '—' }}
            </template>
            <template #approver-cell="{ row }">
              {{ row.original.approver || '—' }}
              <p
                v-if="!row.original.can_act"
                class="text-xs text-muted"
              >
                Your own BIA: reminders only
              </p>
            </template>
            <template #level-cell="{ row }">
              <StatusBadge
                :scale="biancaWaitLevel"
                :value="row.original.level"
                size="sm"
              />
            </template>
            <template #waiting_since-cell="{ row }">
              {{ formatDate(row.original.waiting_since) || '—' }}
            </template>
            <template #working_days_waiting-cell="{ row }">
              <span class="block text-right tabular-nums">{{ biancaWaiting(row.original.working_days_waiting) }}</span>
            </template>
            <template #reminders_sent-cell="{ row }">
              <span class="block text-right tabular-nums">{{ row.original.reminders_sent }}</span>
            </template>
            <template #escalated_at-cell="{ row }">
              <span
                v-if="row.original.escalated_at"
                class="text-error"
              >{{ formatDate(row.original.escalated_at) }}</span>
              <span
                v-else
                class="text-muted"
              >—</span>
            </template>
            <template #actions-cell="{ row }">
              <UDropdownMenu
                :items="boardActions(row.original)"
                :content="{ align: 'end' }"
              >
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  trailing-icon="i-lucide-chevron-down"
                  label="Act"
                  :aria-label="`Act on ${row.original.ref_no ?? `#${row.original.id}`}`"
                />
              </UDropdownMenu>
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                {{ filtered ? 'Nothing in approval matches these filters.' : 'Nothing is in approval.' }}
              </p>
            </template>
          </UTable>
          <TablePagination
            v-model:per-page="perPage"
            :page="boardPage"
            page-sizes
            :total="board.data.value?.total ?? 0"
            :to="pageTo"
            label="BCM board"
          />
        </UCard>
      </template>
    </UTabs>
  </AppPage>
</template>
