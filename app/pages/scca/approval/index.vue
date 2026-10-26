<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type {
  SccaBottleneckRow,
  SccaHistoryKind,
  SccaHistoryRow,
  SccaInboxRow,
} from '~/composables/useSccaWorkflow'
import { parseDate, type CalendarDate } from '@internationalized/date'
import SccaOnBehalfDialog from '~/components/scca/SccaOnBehalfDialog.vue'
import SccaReassignDialog from '~/components/scca/SccaReassignDialog.vue'

definePageMeta({ permission: 'scca.access' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { can } = useAuth()
const reassignDialog = useOverlay().create(SccaReassignDialog)
const onBehalfDialog = useOverlay().create(SccaOnBehalfDialog)

const bcm = computed(() => can('scca.approval.manage'))
type ApprovalTab = 'inbox' | 'history' | 'board'
const tab = computed<ApprovalTab>({
  get: () => {
    const value = route.query.tab
    if (value === 'history') return 'history'
    if (value === 'board' && bcm.value) return 'board'
    return 'inbox'
  },
  // Each tab starts with its own filters.
  set: (value) => router.replace({ query: { tab: value === 'inbox' ? undefined : value } }),
})

// Server-paginated, 25 rows a page; the page (and the filters) are kept in the URL, so the
// tab's page survives a reload and can be shared. `?coming=` pages the Coming up list.
const PER_PAGE = 25
const COMING_PER_PAGE = 10
function number(name: string) {
  return Math.max(1, Number(route.query[name]) || 1)
}
function setQuery(patch: Record<string, string | number | undefined>) {
  router.replace({ query: { ...route.query, ...patch } })
}
function text(name: string) {
  const value = route.query[name]
  return typeof value === 'string' && value ? value : undefined
}

// --- filters shared by My history and the BCM board, kept in the URL ------------------------

const { data: activeConfig } = useSccaConfig()
const search = ref(text('q') ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (value.trim() !== (text('q') ?? '')) setQuery({ q: value.trim() || undefined, page: undefined })
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))
// Switching tabs clears the filters (the URL keeps only the tab).
watch(() => route.query.tab, () => {
  clearTimeout(searchTimer)
  search.value = text('q') ?? ''
})
const categoryFilter = computed<string>({
  get: () => text('category') ?? 'all',
  set: (value) => setQuery({ category: value === 'all' ? undefined : value, page: undefined }),
})
const categoryItems = computed(() => [
  { label: 'All categories', value: 'all' },
  ...SCCA_CATEGORIES.map((category) => ({ label: sccaCategory[category].label, value: category as string })),
])
const reasonFilter = computed<string>({
  get: () => text('reason') ?? 'all',
  set: (value) => setQuery({ reason: value === 'all' ? undefined : value, page: undefined }),
})
const reasonItems = computed(() => [
  { label: 'All reasons', value: 'all' },
  ...sccaListOptions(activeConfig.value, 'assessment_reason'),
])
const fromDate = computed<CalendarDate | undefined>({
  get: () => (text('from') ? parseDate(text('from')!) : undefined),
  set: (value) => setQuery({ from: value?.toString(), page: undefined }),
})
const toDate = computed<CalendarDate | undefined>({
  get: () => (text('to') ? parseDate(text('to')!) : undefined),
  set: (value) => setQuery({ to: value?.toString(), page: undefined }),
})
// The steps of the active configuration version (its titles also label older versions' steps).
const stepCodes = computed(() => activeConfig.value?.steps.map((step) => step.code) ?? SCCA_SIGNOFF_ROLES.map((role) => role.value))
const stepItems = computed(() => [
  { label: 'Every step', value: 'all' as const },
  ...stepCodes.value.map((code) => ({ label: signoffRoleLabel(code, true), value: code })),
])
const FILTER_KEYS = ['q', 'decision', 'step', 'level', 'category', 'reason', 'approver', 'from', 'to'] as const
const filtered = computed(() => FILTER_KEYS.some((key) => !!route.query[key]))
function clearFilters() {
  search.value = ''
  router.replace({ query: { tab: route.query.tab } })
}
function pageTo(page: number) {
  return { query: { ...route.query, page: page > 1 ? page : undefined } }
}
function comingTo(page: number) {
  return { query: { ...route.query, coming: page > 1 ? page : undefined } }
}
/** The page of the given tab's table (page 1 for the tabs not shown). */
const pageOf = (name: ApprovalTab) => computed(() => (tab.value === name ? number('page') : 1))

// --- my inbox -------------------------------------------------------------------------------

const inboxPage = pageOf('inbox')
const comingPage = computed(() => (tab.value === 'inbox' ? number('coming') : 1))
const inbox = useSccaInbox(computed(() => ({ page: inboxPage.value, per_page: PER_PAGE })))
const upcoming = useSccaUpcoming(computed(() => ({ page: comingPage.value, per_page: COMING_PER_PAGE })))

const inboxColumns: TableColumn<SccaInboxRow>[] = [
  { accessorKey: 'application_name', header: 'SCCA' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'step', header: 'My step' },
  { accessorKey: 'submitted_by', header: 'Submitted by' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
]

function openReview(_event: Event, row: { original: { id: number } }) {
  navigateTo({ path: sccaPath('approval', row.original.id), query: { tab: 'result' } })
}

// --- my history -----------------------------------------------------------------------------

const HISTORY_KINDS: SccaHistoryKind[] = ['approved', 'rejected', 'approved_on_behalf', 'reassigned', 'comment']
const decision = computed<SccaHistoryKind | 'all'>({
  get: () => (HISTORY_KINDS.includes(route.query.decision as SccaHistoryKind) ? route.query.decision as SccaHistoryKind : 'all'),
  set: (value) => setQuery({ decision: value === 'all' ? undefined : value, page: undefined }),
})
const historyPage = pageOf('history')
const historyStep = computed<string>({
  get: () => (stepCodes.value.includes(String(route.query.step)) ? String(route.query.step) : 'all'),
  set: (value) => setQuery({ step: value === 'all' ? undefined : value, page: undefined }),
})
const history = useSccaHistory(computed(() => ({
  decision: decision.value === 'all' ? undefined : decision.value,
  step: tab.value === 'history' && historyStep.value !== 'all' ? historyStep.value : undefined,
  category: tab.value === 'history' ? text('category') : undefined,
  reason: tab.value === 'history' ? text('reason') : undefined,
  q: tab.value === 'history' ? text('q') : undefined,
  from: tab.value === 'history' ? text('from') : undefined,
  to: tab.value === 'history' ? text('to') : undefined,
  page: historyPage.value,
  per_page: PER_PAGE,
})))
const decisionItems = [
  { label: 'All decisions', value: 'all' as const },
  { label: 'Approved', value: 'approved' as const },
  { label: 'Rejected', value: 'rejected' as const },
  { label: 'Approved on my behalf', value: 'approved_on_behalf' as const },
  { label: 'Reassigned away from me', value: 'reassigned' as const },
  { label: 'My comments', value: 'comment' as const },
]
const DECISION_TONE: Record<SccaHistoryKind, 'success' | 'error' | 'info' | 'neutral' | 'warning'> = {
  approved: 'success',
  rejected: 'error',
  approved_on_behalf: 'info',
  reassigned: 'warning',
  comment: 'neutral',
}
const historyColumns: TableColumn<SccaHistoryRow>[] = [
  { accessorKey: 'at', header: 'When' },
  { accessorKey: 'application_name', header: 'SCCA' },
  { accessorKey: 'step_title', header: 'Step' },
  { accessorKey: 'decision', header: 'Decision' },
  { accessorKey: 'status_now', header: 'Status now' },
]

// --- BCM board ------------------------------------------------------------------------------

const boardStep = computed<SccaSignoffRole | 'all'>({
  get: () => (stepCodes.value.includes(String(route.query.step)) ? route.query.step as SccaSignoffRole : 'all'),
  set: (value) => setQuery({ step: value === 'all' ? undefined : value, page: undefined }),
})
const boardPage = pageOf('board')
const LEVELS: SccaWaitLevel[] = ['ok', 'reminder', 'escalated']
const boardLevel = computed<SccaWaitLevel | 'all'>({
  get: () => (LEVELS.includes(route.query.level as SccaWaitLevel) ? route.query.level as SccaWaitLevel : 'all'),
  set: (value) => setQuery({ level: value === 'all' ? undefined : value, page: undefined }),
})
const levelItems = [
  { label: 'Any waiting time', value: 'all' as const },
  ...LEVELS.map((level) => ({ label: sccaWaitLevel[level].label, value: level })),
]
const boardApprover = computed<number | null>({
  get: () => Number(route.query.approver) || null,
  set: (value) => setQuery({ approver: value || undefined, page: undefined }),
})
const board = bcm.value
  ? useSccaBoard(computed(() => ({
      step: boardStep.value === 'all' ? undefined : boardStep.value,
      level: boardLevel.value === 'all' ? undefined : boardLevel.value,
      approver_id: boardApprover.value ?? undefined,
      category: tab.value === 'board' ? text('category') : undefined,
      reason: tab.value === 'board' ? text('reason') : undefined,
      q: tab.value === 'board' ? text('q') : undefined,
      from: tab.value === 'board' ? text('from') : undefined,
      to: tab.value === 'board' ? text('to') : undefined,
      page: boardPage.value,
      per_page: PER_PAGE,
    })))
  : null
const boardColumns: TableColumn<SccaBottleneckRow>[] = [
  { accessorKey: 'application_name', header: 'SCCA' },
  { accessorKey: 'step', header: 'Current step' },
  { accessorKey: 'approver', header: 'Approver' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
  { accessorKey: 'reminders_sent', header: 'Reminders' },
  { id: 'actions', header: '' },
]

async function refreshAll() {
  await Promise.all([inbox.refresh(), upcoming.refresh(), board?.refresh()])
}

async function nudge(row: SccaBottleneckRow) {
  const ok = await confirm({
    title: `Remind ${row.approver ?? 'the approver'} now?`,
    description: `They get an email asking them to review ${row.ref_no} (${signoffRoleLabel(row.step, true)}). It counts as a reminder.`,
    confirmLabel: 'Send reminder',
  })
  if (!ok) return
  try {
    const result = await sccaApi.nudge(row.id)
    toast.add(result.email_sent
      ? { title: 'Reminder sent', color: 'success', icon: 'i-lucide-mail-check' }
      : { title: 'The reminder email could not be sent', description: 'See Audit log > Email outbox.', color: 'warning', icon: 'i-lucide-mail-x' })
    await refreshAll()
  } catch (failure) {
    const message = (failure as { data?: { message?: string } }).data?.message
    toast.add({ title: message ?? apiErrorMessage(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

async function reassign(row: SccaBottleneckRow) {
  if (await reassignDialog.open({ row }).result) await refreshAll()
}

async function onBehalf(row: SccaBottleneckRow) {
  if (await onBehalfDialog.open({ row }).result) await refreshAll()
}

function boardActions(row: SccaBottleneckRow): DropdownMenuItem[] {
  return [
    { label: 'Open', icon: 'i-lucide-folder-open', to: { path: sccaPath('approval', row.id), query: { tab: 'result' } } },
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
    title="SCCA approval"
    icon="i-lucide-badge-check"
    description="SCCAs waiting for your sign-off, what you decided before, and for BCM, every approval in progress."
    :crumbs="[{ label: 'SCCA' }, { label: 'Approval' }]"
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
              <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold text-highlighted">
                  Waiting for my approval
                </h2>
                <span class="text-sm text-muted">Longest-waiting first</span>
              </div>
            </template>
            <UTable
              :data="inbox.data.value?.items ?? []"
              :columns="inboxColumns"
              :loading="inbox.status.value === 'pending'"
              class="cursor-pointer"
              :on-select="openReview"
              :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
            >
              <template #application_name-cell="{ row }">
                <NuxtLink
                  :to="{ path: sccaPath('approval', row.original.id), query: { tab: 'result' } }"
                  class="font-medium text-primary hover:underline"
                >
                  {{ row.original.application_name }}
                </NuxtLink>
                <p class="font-mono text-xs text-muted">
                  {{ row.original.ref_no }}
                </p>
              </template>
              <template #category-cell="{ row }">
                <StatusBadge
                  v-if="row.original.category"
                  :scale="sccaCategory"
                  :value="row.original.category"
                  size="sm"
                />
              </template>
              <template #step-cell="{ row }">
                {{ signoffRoleLabel(row.original.step, true) }}
              </template>
              <template #submitted_by-cell="{ row }">
                {{ row.original.submitted_by || '—' }}
                <p class="text-xs text-muted">
                  {{ formatDate(row.original.submitted_at) }}
                </p>
              </template>
              <template #working_days_waiting-cell="{ row }">
                <StatusBadge
                  :scale="sccaWaitLevel"
                  :value="row.original.level"
                  size="sm"
                />
                <p class="mt-1 text-xs text-muted">
                  {{ workingDays(row.original.working_days_waiting) }}<span v-if="row.original.reminders_sent"> · {{ row.original.reminders_sent }} reminder{{ row.original.reminders_sent === 1 ? '' : 's' }}</span>
                </p>
              </template>
              <template #empty>
                <div class="py-8 text-center">
                  <UIcon
                    name="i-lucide-inbox"
                    class="size-6 text-dimmed"
                  />
                  <p class="mt-2 text-sm text-muted">
                    Nothing is waiting for your approval.
                  </p>
                </div>
              </template>
            </UTable>
            <TablePagination
              :page="inboxPage"
              :per-page="PER_PAGE"
              :total="inbox.data.value?.total ?? 0"
              :to="pageTo"
              label="My inbox"
            />
          </UCard>

          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Coming up
              </h2>
              <p class="text-sm text-muted">
                In approval, with your step later in the order.
              </p>
            </template>
            <div
              v-if="!upcoming.data.value?.total"
              class="py-8 text-center"
            >
              <UIcon
                name="i-lucide-calendar-clock"
                class="size-6 text-dimmed"
              />
              <p class="mt-2 text-sm text-muted">
                {{ upcoming.status.value === 'pending' ? 'Loading…' : 'Nothing coming up: no SCCA in approval has a later step for you.' }}
              </p>
            </div>
            <ul
              v-else
              class="divide-y divide-default"
            >
              <li
                v-for="item in upcoming.data.value.items"
                :key="item.id"
                class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6"
              >
                <NuxtLink
                  :to="`/scca/${item.id}`"
                  class="min-w-0"
                >
                  <span class="font-medium text-highlighted hover:underline">{{ item.application_name }}</span>
                  <span class="block text-xs text-muted">{{ item.ref_no }} · now at {{ signoffRoleLabel(item.current_step, true) }}</span>
                </NuxtLink>
                <span class="text-sm text-muted">
                  Your step: <span class="font-medium text-highlighted">{{ signoffRoleLabel(item.my_step, true) }}</span>,
                  {{ item.steps_before_mine }} step{{ item.steps_before_mine === 1 ? '' : 's' }} away
                </span>
              </li>
            </ul>
            <TablePagination
              v-if="upcoming.data.value?.total"
              :page="comingPage"
              :per-page="COMING_PER_PAGE"
              :total="upcoming.data.value.total"
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
                placeholder="Application, code or ref. no."
                aria-label="Search my history"
                class="w-full"
              />
            </template>
            <USelectMenu
              v-model="decision"
              value-key="value"
              :items="decisionItems"
              :search-input="false"
              aria-label="Decision"
              class="w-56"
            />
            <USelectMenu
              v-model="historyStep"
              value-key="value"
              :items="stepItems"
              :search-input="false"
              aria-label="Step"
              class="w-48"
            />
            <USelectMenu
              v-model="categoryFilter"
              value-key="value"
              :items="categoryItems"
              :search-input="false"
              aria-label="Category"
              class="w-44"
            />
            <USelectMenu
              v-model="reasonFilter"
              value-key="value"
              :items="reasonItems"
              :search-input="false"
              aria-label="Reason for assessment"
              class="w-44"
            />
            <DatePicker
              v-model="fromDate"
              class="w-40"
              placeholder="From"
              aria-label="From"
            />
            <DatePicker
              v-model="toDate"
              class="w-40"
              placeholder="To"
              aria-label="To"
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
            <template #application_name-cell="{ row }">
              <NuxtLink
                :to="`/scca/${row.original.id}`"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.application_name }}
              </NuxtLink>
              <p class="text-xs text-muted">
                <span class="font-mono">{{ row.original.ref_no }}</span><template v-if="row.original.category">
                  · {{ sccaCategory[row.original.category]?.label ?? row.original.category }}
                </template>
              </p>
            </template>
            <template #step_title-cell="{ row }">
              {{ row.original.step ? signoffRoleLabel(row.original.step, true) : '—' }}
            </template>
            <template #decision-cell="{ row }">
              <UBadge
                :color="DECISION_TONE[row.original.kind]"
                variant="subtle"
                size="sm"
                :label="row.original.decision"
              />
              <p
                v-if="row.original.by"
                class="mt-1 text-xs text-muted"
              >
                by {{ row.original.by }}
              </p>
              <p
                v-if="row.original.note"
                class="mt-1 max-w-md whitespace-pre-line text-xs text-muted"
              >
                “{{ row.original.note }}”
              </p>
            </template>
            <template #status_now-cell="{ row }">
              <StatusBadge
                :scale="sccaStatus"
                :value="row.original.status_now"
                size="sm"
              />
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                {{ filtered ? 'No decisions match these filters.' : 'No decisions yet.' }}
              </p>
            </template>
          </UTable>
          <TablePagination
            :page="historyPage"
            :per-page="PER_PAGE"
            :total="history.data.value?.total ?? 0"
            :to="pageTo"
            label="My history"
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
                placeholder="Application, code or ref. no."
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
            <USelectMenu
              v-model="reasonFilter"
              value-key="value"
              :items="reasonItems"
              :search-input="false"
              aria-label="Reason for assessment"
              class="w-44"
            />
            <UserPicker
              v-model="boardApprover"
              placeholder="Any approver"
              aria-label="Approver"
              permission="scca.access"
              class="w-56"
            />
          </ListFilterBar>
          <div class="border-b border-default px-4 py-2">
            <p class="text-sm text-muted">
              Reminders and escalation follow
              <NuxtLink
                v-if="can('scca.settings.manage') && can('scca.config.view')"
                to="/admin/scca-config?tab=reminders"
                class="text-primary hover:underline"
              >SCCA configuration > Reminders and escalation</NuxtLink><span v-else>the SCCA reminder rules</span>.
            </p>
          </div>
          <UTable
            :data="board.data.value?.items ?? []"
            :columns="boardColumns"
            :loading="board.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #application_name-cell="{ row }">
              <NuxtLink
                :to="{ path: sccaPath('approval', row.original.id), query: { tab: 'result' } }"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.application_name }}
              </NuxtLink>
              <p class="font-mono text-xs text-muted">
                {{ row.original.ref_no }}
              </p>
            </template>
            <template #step-cell="{ row }">
              {{ signoffRoleLabel(row.original.step, true) }}
            </template>
            <template #approver-cell="{ row }">
              {{ row.original.approver || '—' }}
              <p
                v-if="!row.original.can_act"
                class="text-xs text-muted"
              >
                Your own SCCA: reminders only
              </p>
            </template>
            <template #working_days_waiting-cell="{ row }">
              <StatusBadge
                :scale="sccaWaitLevel"
                :value="row.original.level"
                size="sm"
              />
              <p class="mt-1 text-xs text-muted">
                {{ workingDays(row.original.working_days_waiting) }} since {{ formatDate(row.original.waiting_since) }}
              </p>
            </template>
            <template #reminders_sent-cell="{ row }">
              {{ row.original.reminders_sent }}
              <p
                v-if="row.original.escalated_at"
                class="text-xs text-error"
              >
                Escalated {{ formatDate(row.original.escalated_at) }}
              </p>
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
                  :aria-label="`Act on ${row.original.ref_no}`"
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
            :page="boardPage"
            :per-page="PER_PAGE"
            :total="board.data.value?.total ?? 0"
            :to="pageTo"
            label="BCM board"
          />
        </UCard>
      </template>
    </UTabs>
  </AppPage>
</template>
