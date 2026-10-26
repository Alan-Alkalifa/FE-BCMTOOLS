<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { RaAssessment, RaHistoryRow, RaSignoffWaiting } from '~/composables/useRa'

/**
 * RA (or RA Branch) Approval, as SCCA Approval: my inbox (RAs whose current sign-off step is
 * mine, with those coming to me next), my history, and for BCM (ra.manage) the board of every
 * RA in sign-off. A row opens the RA on its Sign-off tab, where the signer (or BCM, on their
 * behalf) approves it or returns it with a comment.
 */
const ra = useRaModule()
const route = useRoute()
const router = useRouter()
const { can } = useAuth()
const confirm = useConfirm()
const toast = useToast()

const bcm = computed(() => can('ra.manage'))
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

const PER_PAGE = 25
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
const kind = computed(() => ra.value.kind)

// --- my inbox -------------------------------------------------------------------------------

const inboxPage = pageOf('inbox')
const comingPage = computed(() => (tab.value === 'inbox' ? number('coming') : 1))
const inbox = useRaInbox(computed(() => ({ kind: kind.value, page: inboxPage.value, per_page: PER_PAGE })))
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

const ACTIONS = ['approved', 'returned', 'submitted'] as const
const action = computed<RaHistoryRow['action'] | 'all'>({
  get: () => (ACTIONS.includes(route.query.action as RaHistoryRow['action']) ? route.query.action as RaHistoryRow['action'] : 'all'),
  set: (value) => setQuery({ action: value === 'all' ? undefined : value, page: undefined }),
})
const historyPage = pageOf('history')
const history = useRaHistory(computed(() => ({
  kind: kind.value,
  action: action.value === 'all' ? undefined : action.value,
  page: historyPage.value,
  per_page: PER_PAGE,
})))
const actionItems = [
  { label: 'All actions', value: 'all' as const },
  { label: 'Approved', value: 'approved' as const },
  { label: 'Returned for changes', value: 'returned' as const },
  { label: 'Submitted', value: 'submitted' as const },
]
const raAction = defineStatusScale<RaHistoryRow['action']>({
  approved: { label: 'Approved', color: 'success', icon: 'i-lucide-badge-check' },
  returned: { label: 'Returned', color: 'warning', icon: 'i-lucide-undo-2' },
  submitted: { label: 'Submitted', color: 'info', icon: 'i-lucide-send' },
})
const historyColumns: TableColumn<RaHistoryRow>[] = [
  { accessorKey: 'at', header: 'When' },
  { id: 'assessment', header: 'RA' },
  { accessorKey: 'role', header: 'Step' },
  { accessorKey: 'action', header: 'Action' },
  { id: 'status_now', header: 'Status now' },
]

// --- BCM board ------------------------------------------------------------------------------

const boardStep = computed<string>({
  get: () => (ra.value.signoffRoles.some((role) => role.value === route.query.step) ? String(route.query.step) : 'all'),
  set: (value) => setQuery({ step: value === 'all' ? undefined : value, page: undefined }),
})
const boardPage = pageOf('board')
const board = useRaBoard(
  computed(() => ({ kind: kind.value, step: boardStep.value === 'all' ? undefined : boardStep.value, page: boardPage.value, per_page: PER_PAGE })),
  bcm,
)
const stepItems = computed(() => [
  { label: 'Every step', value: 'all' },
  ...ra.value.signoffRoles.map((role) => ({ label: role.hint, value: role.value })),
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

function boardActions(row: RaSignoffWaiting): DropdownMenuItem[] {
  return [
    { label: 'Open sign-off', icon: 'i-lucide-folder-open', to: raPath(ra.value.kind, 'approval', row.id) },
    { label: 'Send a reminder now', icon: 'i-lucide-bell-ring', disabled: !row.signer, onSelect: () => nudge(row) },
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
    description="RAs waiting for your sign-off, the ones you've acted on and, for BCM, every RA in sign-off."
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
                  {{ row.original.ref_no ?? `#${row.original.id}` }}
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
              :page="inboxPage"
              :per-page="PER_PAGE"
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
                RAs in sign-off where you sign a later step.
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
              :page="comingPage"
              :per-page="COMING_PER_PAGE"
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
          <div class="flex flex-wrap items-center gap-2 border-b border-default p-4">
            <USelectMenu
              v-model="action"
              value-key="value"
              :items="actionItems"
              :search-input="false"
              class="w-56"
              aria-label="Action"
            />
          </div>
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
                :value="row.original.action"
                size="sm"
              />
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
                {{ action === 'all' ? 'You haven\'t submitted, approved or returned an RA yet.' : 'No actions of this kind.' }}
              </p>
            </template>
          </UTable>
          <TablePagination
            :page="historyPage"
            :per-page="PER_PAGE"
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
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-4">
            <USelectMenu
              v-model="boardStep"
              value-key="value"
              :items="stepItems"
              :search-input="false"
              class="w-56"
              aria-label="Step"
            />
            <p class="text-sm text-muted">
              Send the signer a reminder, or open an RA to approve or return its step on the signer's behalf.
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
                No RA is in sign-off{{ boardStep === 'all' ? '' : ' at this step' }}.
              </p>
            </template>
          </UTable>
          <TablePagination
            :page="boardPage"
            :per-page="PER_PAGE"
            :total="board.data.value?.total ?? 0"
            :to="pageTo"
            label="Board"
          />
        </UCard>
      </template>
    </UTabs>
  </AppPage>
</template>
