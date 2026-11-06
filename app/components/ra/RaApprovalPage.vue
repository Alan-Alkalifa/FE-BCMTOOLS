<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { RaAssessment, RaHistoryAction, RaHistoryRow, RaSignoffWaiting } from '~/composables/useRa'
import RaChangeSignerModal, { type RaWaitingStep } from '~/components/ra/RaChangeSignerModal.vue'
import RaOnBehalfModal from '~/components/ra/RaOnBehalfModal.vue'

/**
 * RA (or RA Branch) Approval, as SCCA Approval: my inbox (RAs whose current sign-off step is
 * mine, with those coming to me next), my history, and for BCM (ra.manage) the board of every
 * RA in sign-off. A row opens the RA on its Sign-off tab, where the signer approves it or returns
 * it with a comment. From the board BCM also, as SCCA's, sends a reminder, changes the signer of
 * the waiting step or approves it on the signer's behalf (with the evidence).
 */
const ra = useRaModule()
const route = useRoute()
const router = useRouter()
const { can } = useAuth()
const confirm = useConfirm()
const toast = useToast()
const changeSignerDialog = useOverlay().create(RaChangeSignerModal)
const onBehalfDialog = useOverlay().create(RaOnBehalfModal)

const bcm = computed(() => can(ra.value.perm.manage))
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
function setQuery(patch: Record<string, string | number | undefined>) {
  router.replace({ query: { ...route.query, ...patch } })
}
function pageTo(page: number) {
  return { query: { ...route.query, page: page > 1 ? page : undefined } }
}
function comingTo(page: number) {
  return { query: { ...route.query, coming: page > 1 ? page : undefined } }
}
const pageOf = (name: ApprovalTab) => computed(() => (tab.value === name ? number('page') : 1))

// --- search and filters of My history and the BCM board, kept in the URL (as SCCA's) --------
function text(name: string) {
  const value = route.query[name]
  return typeof value === 'string' && value ? value : undefined
}
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
const filtered = computed(() => Boolean(text('q') || text('action') || text('step')))
function clearFilters() {
  search.value = ''
  router.replace({ query: { tab: route.query.tab } })
}
const kind = computed(() => ra.value.kind)

// --- my inbox -------------------------------------------------------------------------------

const inboxPage = pageOf('inbox')
const comingPage = computed(() => (tab.value === 'inbox' ? number('coming') : 1))
const inbox = useRaInbox(computed(() => ({ kind: kind.value, page: inboxPage.value, per_page: perPage.value })))
const upcoming = useRaUpcoming(computed(() => ({ kind: kind.value, page: comingPage.value, per_page: COMING_PER_PAGE })))

/** Who signs the step ("Location Incident Coordinator (LIC)"), like SCCA shows it. */
function stepLabel(role: string | null, title?: string | null) {
  return role ? (title || raStepTitle(role, ra.value.signoffRoles)) : '—'
}

const waitingColumns = computed<TableColumn<RaSignoffWaiting>[]>(() => [
  { id: 'assessment', header: 'RA' },
  { accessorKey: 'highest_residual_level', header: 'Highest residual' },
  { accessorKey: 'step', header: 'Step' },
  { accessorKey: 'submitted_by', header: 'Submitted by' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
])
const comingColumns = computed<TableColumn<RaSignoffWaiting>[]>(() => [
  { id: 'assessment', header: 'RA' },
  { accessorKey: 'step', header: 'Now at' },
  { id: 'signer', header: 'With' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
])

function openReview(_event: Event, row: { original: { id: number } }) {
  navigateTo(raPath(ra.value.kind, 'approval', row.original.id))
}

// --- my history -----------------------------------------------------------------------------

const ACTIONS: RaHistoryAction[] = ['approved', 'returned', 'submitted', 'on_behalf', 'reassigned']
const action = computed<RaHistoryAction | 'all'>({
  get: () => (ACTIONS.includes(route.query.action as RaHistoryAction) ? route.query.action as RaHistoryAction : 'all'),
  set: (value) => setQuery({ action: value === 'all' ? undefined : value, page: undefined }),
})
const historyPage = pageOf('history')
const history = useRaHistory(computed(() => ({
  kind: kind.value,
  action: action.value === 'all' ? undefined : action.value,
  q: tab.value === 'history' ? text('q') : undefined,
  page: historyPage.value,
  per_page: perPage.value,
})))
const actionItems = [
  { label: 'All actions', value: 'all' as const },
  { label: 'Approved', value: 'approved' as const },
  { label: 'Returned for changes', value: 'returned' as const },
  { label: 'Submitted', value: 'submitted' as const },
  { label: 'Approved on my behalf', value: 'on_behalf' as const },
  { label: 'Signer changed', value: 'reassigned' as const },
]
const raAction = defineStatusScale<RaHistoryAction>({
  approved: { label: 'Approved', color: 'success', icon: 'i-lucide-badge-check' },
  on_behalf: { label: 'Approved on behalf', color: 'info', icon: 'i-lucide-badge-check' },
  returned: { label: 'Returned', color: 'warning', icon: 'i-lucide-undo-2' },
  submitted: { label: 'Submitted', color: 'info', icon: 'i-lucide-send' },
  reassigned: { label: 'Signer changed', color: 'warning', icon: 'i-lucide-user-round-cog' },
})
/** The row's badge: an approval BCM gave for someone shows as "Approved on behalf". */
function historyKind(row: RaHistoryRow): RaHistoryAction {
  return row.on_behalf ? 'on_behalf' : row.action
}
/** Who did what for whom, under the badge. */
function historyNote(row: RaHistoryRow) {
  if (row.action === 'reassigned') return `${row.for_user ?? 'Nobody'} → ${row.to_user ?? '—'}, by ${row.user ?? 'BCM'}`
  if (row.on_behalf) return `For ${row.for_user ?? 'the signer'}, by ${row.user ?? 'BCM'}`
  return null
}
const historyColumns: TableColumn<RaHistoryRow>[] = [
  { accessorKey: 'at', header: 'When' },
  { id: 'assessment', header: 'RA' },
  { accessorKey: 'role', header: 'Step' },
  { accessorKey: 'action', header: 'Action' },
  { id: 'status_now', header: 'Status now', meta: RA_STATUS_COLUMN },
]

// --- BCM board ------------------------------------------------------------------------------

/** The steps of the active configuration version (RA configuration can add steps). */
const { data: activeFormula } = useRaFormula(kind)
const steps = computed(() => raRoleOptions(activeFormula.value, ra.value.signoffRoles))

const boardStep = computed<string>({
  get: () => (route.query.step && (steps.value.some((role) => role.value === route.query.step) || !activeFormula.value) ? String(route.query.step) : 'all'),
  set: (value) => setQuery({ step: value === 'all' ? undefined : value, page: undefined }),
})
const boardPage = pageOf('board')
const board = useRaBoard(
  computed(() => ({
    kind: kind.value,
    step: boardStep.value === 'all' ? undefined : boardStep.value,
    q: tab.value === 'board' ? text('q') : undefined,
    page: boardPage.value,
    per_page: perPage.value,
  })),
  bcm,
)
const stepItems = computed(() => [
  { label: 'Every step', value: 'all' },
  ...steps.value.map((role) => ({ label: role.hint, value: role.value })),
])
const boardColumns = computed<TableColumn<RaSignoffWaiting>[]>(() => [
  { id: 'assessment', header: 'RA' },
  { accessorKey: 'step', header: 'Current step' },
  { id: 'signer', header: 'Signer' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
  { accessorKey: 'reminders_sent', header: 'Reminders' },
  { id: 'actions', header: '' },
])

/** BCM board: email the signer now, as SCCA's "Send a reminder now". It counts as a reminder. */
async function nudge(row: RaSignoffWaiting) {
  const ok = await confirm({
    title: `Remind ${row.signer?.name ?? 'the signer'} now?`,
    description: `They get an email asking them to sign off ${row.ref_no ?? row.location.name} (${stepLabel(row.step, row.step_title)}). It counts as a reminder.`,
    confirmLabel: 'Send reminder',
  })
  if (!ok) return
  try {
    const result = await $fetch<{ sent: boolean, assessment: RaAssessment }>(`/api/ra/assessments/${row.id}/nudge`, { method: 'POST' })
    toast.add(result.sent
      ? { title: 'Reminder sent', color: 'success', icon: 'i-lucide-mail-check' }
      : { title: 'The reminder email could not be sent', description: 'See Audit log > Email outbox.', color: 'warning', icon: 'i-lucide-mail-x' })
    await board.refresh()
  } catch (failure) {
    toast.add({ title: apiErrorMessage(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

function waitingStep(row: RaSignoffWaiting): RaWaitingStep {
  return {
    id: row.id,
    kind: ra.value.kind,
    ref: row.ref_no ?? `#${row.id}`,
    location: row.location.name,
    step: stepLabel(row.step, row.step_title),
    signer: row.signer?.name ?? null,
    working_days_waiting: row.working_days_waiting,
  }
}

async function changeSigner(row: RaSignoffWaiting) {
  if (await changeSignerDialog.open({ step: waitingStep(row) }).result) await board.refresh()
}

async function onBehalf(row: RaSignoffWaiting) {
  if (await onBehalfDialog.open({ step: waitingStep(row) }).result) await board.refresh()
}

function boardActions(row: RaSignoffWaiting): DropdownMenuItem[] {
  return [
    { label: 'Open sign-off', icon: 'i-lucide-folder-open', to: raPath(ra.value.kind, 'approval', row.id) },
    { label: 'Send a reminder now', icon: 'i-lucide-bell-ring', disabled: !row.signer, onSelect: () => nudge(row) },
    // As SCCA's: nobody acts for the signer of an RA they made (reminders only).
    { label: 'Change the signer', icon: 'i-lucide-user-round-cog', disabled: row.can_act === false, onSelect: () => changeSigner(row) },
    { label: 'Approve on behalf', icon: 'i-lucide-badge-check', disabled: row.can_act === false, onSelect: () => onBehalf(row) },
  ]
}

const tabs = computed(() => [
  { label: 'My inbox', value: 'inbox', icon: 'i-lucide-inbox', slot: 'inbox' as const, badge: inbox.data.value?.total || undefined },
  { label: 'My history', value: 'history', icon: 'i-lucide-history', slot: 'history' as const },
  ...(bcm.value ? [{ label: 'BCM board', value: 'board', icon: 'i-lucide-layout-list', slot: 'board' as const }] : []),
])
</script>

<template>
  <AppPage
    :title="`${ra.title} approval`"
    icon="i-lucide-badge-check"
    description="RAs waiting for your sign-off, the ones you've acted on and, for BCM, every RA in approval."
    :crumbs="[{ label: ra.title, to: raPath(ra.kind, 'monitoring') }, { label: 'Approval' }]"
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
              <template #assessment-cell="{ row }">
                <NuxtLink
                  :to="raPath(ra.kind, 'approval', row.original.id)"
                  class="font-medium text-primary hover:underline"
                >
                  {{ row.original.location.name }}
                </NuxtLink>
                <p class="font-mono text-xs text-muted">
                  {{ row.original.ref_no ?? `#${row.original.id}` }}<span
                    v-if="row.original.reason"
                    class="font-sans"
                  > · {{ raReasonLabel(row.original.reason) }}</span>
                </p>
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
              <template #step-cell="{ row }">
                {{ stepLabel(row.original.step, row.original.step_title) }}
              </template>
              <template #submitted_by-cell="{ row }">
                {{ row.original.submitted_by ?? '—' }}
                <p class="text-xs text-muted">
                  {{ formatDate(row.original.submitted_at) }}
                </p>
              </template>
              <template #working_days_waiting-cell="{ row }">
                {{ raWaiting(row.original.working_days_waiting) }}
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
                RAs in approval where you sign a later step.
              </p>
            </template>
            <UTable
              :data="upcoming.data.value?.items ?? []"
              :columns="comingColumns"
              :loading="upcoming.status.value === 'pending'"
              :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
            >
              <template #assessment-cell="{ row }">
                <NuxtLink
                  :to="raPath(ra.kind, 'monitoring', row.original.id)"
                  class="font-medium text-primary hover:underline"
                >
                  {{ row.original.location.name }}
                </NuxtLink>
                <p class="font-mono text-xs text-muted">
                  {{ row.original.ref_no ?? `#${row.original.id}` }}
                </p>
              </template>
              <template #step-cell="{ row }">
                {{ stepLabel(row.original.step, row.original.step_title) }}
              </template>
              <template #signer-cell="{ row }">
                {{ row.original.signer?.name ?? '—' }}
              </template>
              <template #working_days_waiting-cell="{ row }">
                {{ raWaiting(row.original.working_days_waiting) }}
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
                :placeholder="`${ra.location.single}, ID or ref. no.`"
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
            <template #assessment-cell="{ row }">
              <NuxtLink
                :to="raRecordPath(ra.kind, row.original.assessment)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.assessment.location.name }}
              </NuxtLink>
              <p class="font-mono text-xs text-muted">
                {{ row.original.assessment.ref_no ?? `#${row.original.assessment.id}` }}
              </p>
            </template>
            <template #role-cell="{ row }">
              {{ stepLabel(row.original.role, row.original.role_title) }}
            </template>
            <template #action-cell="{ row }">
              <StatusBadge
                :scale="raAction"
                :value="historyKind(row.original)"
                size="sm"
              />
              <p
                v-if="historyNote(row.original)"
                class="mt-1 text-xs text-muted"
              >
                {{ historyNote(row.original) }}
              </p>
              <p
                v-if="row.original.comment"
                class="mt-1 max-w-72 text-xs whitespace-pre-line text-muted"
              >
                {{ row.original.comment }}
              </p>
            </template>
            <template #status_now-cell="{ row }">
              <StatusBadge
                :scale="raStatus"
                :value="raStatusKey(row.original.assessment)"
                size="sm"
              />
            </template>
            <template #empty>
              <p class="py-8 text-center text-sm text-muted">
                {{ action === 'all' ? 'You haven\'t submitted, approved or returned an RA yet.' : 'Nothing of this kind.' }}
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
        v-if="bcm"
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
                :placeholder="`${ra.location.single}, ID or ref. no.`"
                aria-label="Search the board"
                class="w-full"
              />
            </template>
            <USelectMenu
              v-model="boardStep"
              value-key="value"
              :items="stepItems"
              :search-input="false"
              class="w-56"
              aria-label="Step"
            />
          </ListFilterBar>
          <div class="border-b border-default px-4 py-2">
            <p class="text-sm text-muted">
              Send the signer a reminder, change the signer, or approve the step on the signer's behalf. Reminders and escalation follow
              <NuxtLink
                v-if="can('ra.config.view')"
                to="/admin/ra-config?tab=reminders"
                class="text-primary hover:underline"
              >RA configuration > Reminders and escalation</NuxtLink><span v-else>the RA reminder rules</span>.
            </p>
          </div>
          <UTable
            :data="board.data.value?.items ?? []"
            :columns="boardColumns"
            :loading="board.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #assessment-cell="{ row }">
              <NuxtLink
                :to="raPath(ra.kind, 'approval', row.original.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.location.name }}
              </NuxtLink>
              <p class="font-mono text-xs text-muted">
                {{ row.original.ref_no ?? `#${row.original.id}` }}<span
                  v-if="row.original.reason"
                  class="font-sans"
                > · {{ raReasonLabel(row.original.reason) }}</span>
              </p>
            </template>
            <template #step-cell="{ row }">
              {{ stepLabel(row.original.step, row.original.step_title) }}
            </template>
            <template #signer-cell="{ row }">
              {{ row.original.signer?.name ?? '—' }}
              <p
                v-if="row.original.can_act === false"
                class="text-xs text-muted"
              >
                Your own RA: reminders only
              </p>
            </template>
            <template #working_days_waiting-cell="{ row }">
              <StatusBadge
                :scale="raWaitLevel"
                :value="row.original.level"
                size="sm"
              />
              <p class="mt-1 text-xs text-muted">
                {{ raWaiting(row.original.working_days_waiting) }}
              </p>
            </template>
            <template #reminders_sent-cell="{ row }">
              <span class="tabular-nums">{{ row.original.reminders_sent }}</span>
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
                  :aria-label="`Act on ${row.original.ref_no ?? row.original.location.name}`"
                />
              </UDropdownMenu>
            </template>
            <template #empty>
              <p class="py-8 text-center text-sm text-muted">
                No RA is in approval{{ boardStep === 'all' ? '' : ' at this step' }}.
              </p>
            </template>
          </UTable>
          <TablePagination
            v-model:per-page="perPage"
            page-sizes
            :page="boardPage"
            :total="board.data.value?.total ?? 0"
            :to="pageTo"
            label="Board"
          />
        </UCard>
      </template>
    </UTabs>
  </AppPage>
</template>
