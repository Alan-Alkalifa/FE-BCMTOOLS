<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { parseDate, today as todayIn, type CalendarDate } from '@internationalized/date'
import type {
  BiaGenerateResult,
  BiaMonitoringFilters,
  BiaMonitorGroupRow,
  BiaRenewalBucket,
  BiaSignoffWaitingRow,
} from '~/composables/useBiaWorkflow'
import BiaHistoryDialog from '~/components/bia/BiaHistoryDialog.vue'

definePageMeta({ permission: 'bianca.access' })

const route = useRoute()
const router = useRouter()
const { user, can } = useAuth()
const toast = useToast()
const confirm = useConfirm()
const historyDialog = useOverlay().create(BiaHistoryDialog)

const TABS = ['overview', 'renewals', 'register', 'bottlenecks'] as const
type MonitorTab = (typeof TABS)[number]
const perPage = useRowsPerPage()

const tab = computed<MonitorTab>({
  get: () => (TABS.includes(route.query.tab as MonitorTab) ? route.query.tab as MonitorTab : 'overview'),
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'overview' ? undefined : value, page: undefined } }),
})

function text(name: string) {
  const value = route.query[name]
  return typeof value === 'string' && value ? value : undefined
}

// --- filters, kept in the URL so a filtered view can be shared -------------------------------

type Period = 'all' | 'year' | '12m' | 'custom'

const CATEGORY_FILTERS = [...BIA_CATEGORIES, 'none'] as const
const STATES = ['approved', 'draft', 'need_revision', 'in_revision', 'returned', 'in_signoff', 'none'] as const

const filters = computed<BiaMonitoringFilters>(() => ({
  q: text('q'),
  category: (CATEGORY_FILTERS.includes(text('category') as BiaCategory) ? text('category') as BiaMonitoringFilters['category'] : undefined),
  state: (STATES.includes(text('state') as (typeof STATES)[number]) ? text('state') as BiaMonitoringFilters['state'] : undefined),
  reason: BIA_REASONS.some((reason) => reason.value === text('reason')) ? text('reason') as BiaReason : undefined,
  from: text('from'),
  to: text('to'),
  directorate: text('directorate'),
  sub_directorate: text('sub_directorate'),
  org_group: text('org_group'),
}))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))

function setQuery(patch: Record<string, string | undefined>) {
  router.replace({ query: { ...route.query, ...patch, page: undefined } })
}

const today = todayIn('Asia/Jakarta')
const yearStart = `${today.year}-01-01`
const yearAgo = today.subtract({ years: 1 }).toString()
const period = computed<Period>({
  get: () => {
    const { from, to } = filters.value
    if (!from && !to) return 'all'
    if (from === yearStart && !to) return 'year'
    if (from === yearAgo && !to) return '12m'
    return 'custom'
  },
  set: (value) => {
    if (value === 'all') return setQuery({ from: undefined, to: undefined })
    if (value === 'year') return setQuery({ from: yearStart, to: undefined })
    if (value === '12m') return setQuery({ from: yearAgo, to: undefined })
    setQuery({ from: filters.value.from ?? yearStart, to: filters.value.to ?? today.toString() })
  },
})
const periodItems = [
  { label: 'All dates', value: 'all' as const },
  { label: 'This year', value: 'year' as const },
  { label: 'Last 12 months', value: '12m' as const },
  { label: 'Custom range', value: 'custom' as const },
]
const fromDate = computed<CalendarDate | undefined>({
  get: () => (filters.value.from ? parseDate(filters.value.from) : undefined),
  set: (value) => setQuery({ from: value?.toString() }),
})
const toDate = computed<CalendarDate | undefined>({
  get: () => (filters.value.to ? parseDate(filters.value.to) : undefined),
  set: (value) => setQuery({ to: value?.toString() }),
})

const category = computed<string>({
  get: () => filters.value.category ?? 'any',
  set: (value) => setQuery({ category: value === 'any' ? undefined : value }),
})
const categoryItems = [
  { label: 'Any category', value: 'any' },
  ...BIA_CATEGORIES.map((value) => ({ label: biaCategory[value].label, value })),
  { label: 'Not rated', value: 'none' },
]

const state = computed<string>({
  get: () => filters.value.state ?? 'any',
  set: (value) => setQuery({ state: value === 'any' ? undefined : value }),
})
const stateItems = [
  { label: 'Any state', value: 'any' },
  { label: 'Has a final BIA', value: 'approved' },
  { label: 'Draft open', value: 'draft' },
  { label: 'Need revision', value: 'need_revision' },
  { label: 'In revision', value: 'in_revision' },
  { label: 'In approval', value: 'in_signoff' },
  { label: 'No final BIA yet', value: 'none' },
]

const reasonFilter = computed<string>({
  get: () => filters.value.reason ?? 'any',
  set: (value) => setQuery({ reason: value === 'any' ? undefined : value }),
})
const reasonItems = [
  { label: 'Any reason', value: 'any' },
  ...BIA_REASONS.map((reason) => ({ label: reason.label, value: reason.value as string })),
]

const { data: orgData } = useBiaMonitoringOrgValues(filters)
type OrgField = 'directorate' | 'sub_directorate' | 'org_group'
function orgFilter(field: OrgField) {
  return computed<string>({
    get: () => filters.value[field] ?? 'all',
    set: (value) => setQuery({ [field]: value === 'all' ? undefined : value }),
  })
}
const directorate = orgFilter('directorate')
const subDirectorate = orgFilter('sub_directorate')
const group = orgFilter('org_group')
function orgItems(all: string, values: string[] | undefined) {
  return [{ label: all, value: 'all' }, ...(values ?? []).map((name) => ({ label: name, value: name }))]
}
const directorateItems = computed(() => orgItems('All directorates', orgData.value?.directorates))
const subDirectorateItems = computed(() => orgItems('All sub directorates', orgData.value?.sub_directorates))
const groupItems = computed(() => orgItems('All groups', orgData.value?.groups))

const search = ref(filters.value.q ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (value.trim() !== (filters.value.q ?? '')) setQuery({ q: value.trim() || undefined })
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const filtered = computed(() => {
  const value = filters.value
  return Boolean(
    value.q || value.category || value.state || value.reason || value.from || value.to
    || value.directorate || value.sub_directorate || value.org_group,
  )
})
function clearFilters() {
  search.value = ''
  router.replace({ query: { tab: route.query.tab, from: undefined, to: undefined } })
}

// --- data ------------------------------------------------------------------------------------

const overview = useBiaOverview(filters)
const bucket = computed<Exclude<BiaRenewalBucket, 'later'> | undefined>(() => {
  const value = text('bucket')
  return value === 'overdue' || value === 'due_30' || value === 'due_90' ? value : undefined
})
const renewals = useBiaRenewals(computed(() => ({
  ...filters.value,
  page: page.value,
  per_page: perPage.value,
  bucket: bucket.value,
})))
const renewalCards = [
  { bucket: 'overdue' as const, label: 'Overdue', hint: 'Past the renewal date', icon: 'i-lucide-circle-alert', tone: 'error' as const },
  { bucket: 'due_30' as const, label: 'Due in 30 days', hint: 'Renewal date within 30 days', icon: 'i-lucide-calendar-clock', tone: 'warning' as const },
  { bucket: 'due_90' as const, label: 'Due in 31–90 days', hint: 'Renewal date in 31 to 90 days', icon: 'i-lucide-calendar', tone: 'info' as const },
]
const register = useBiaRegister(computed(() => ({
  ...filters.value,
  page: page.value,
  per_page: perPage.value,
})))
const bottlenecks = useBiaBottlenecks(computed(() => ({
  ...filters.value,
  page: page.value,
  per_page: perPage.value,
})))
const stepAverages = useBiaBottlenecksStepAverages(filters)

const cards = computed(() => {
  const value = overview.data.value?.cards
  return [
    { key: 'stuck_approvals', label: 'Stuck approvals', hint: 'Waiting past the escalation threshold', icon: 'i-lucide-siren', value: value?.stuck_approvals ?? 0, to: { tab: 'bottlenecks' }, tone: 'error' as const },
    { key: 'overdue_renewals', label: 'Overdue renewals', hint: 'BIA past its renewal date', icon: 'i-lucide-circle-alert', value: value?.overdue_renewals, to: { tab: 'renewals' }, tone: 'error' as const },
    { key: 'due_in_90_days', label: 'Due in 90 days', hint: 'Renewals coming up', icon: 'i-lucide-calendar-clock', value: value?.due_in_90_days, to: { tab: 'renewals' }, tone: 'warning' as const },
    { key: 'assessed', label: 'Groups assessed', hint: 'With a final BIA', icon: 'i-lucide-shield-check', value: value?.assessed, to: { tab: 'register', state: 'approved' }, tone: 'neutral' as const },
    { key: 'not_assessed', label: 'No final BIA yet', hint: 'Active groups without a final BIA', icon: 'i-lucide-circle-dashed', value: value?.not_assessed, to: { tab: 'register', state: 'none' }, tone: 'warning' as const },
    { key: 'in_signoff', label: 'In approval', hint: 'BIAs waiting for their signers', icon: 'i-lucide-hourglass', value: value?.in_signoff, to: { tab: 'bottlenecks' }, tone: 'neutral' as const },
    { key: 'drafts', label: 'Drafts', hint: 'BIAs being worked on', icon: 'i-lucide-file-pen', value: value?.drafts, to: { tab: 'register', state: 'draft' }, tone: 'neutral' as const },
    { key: 'need_revision', label: 'Need revision', hint: 'Returned, not accepted yet', icon: 'i-lucide-undo-2', value: value?.need_revision, to: { tab: 'register', state: 'need_revision' }, tone: 'error' as const },
    { key: 'in_revision', label: 'In revision', hint: 'Accepted, being changed', icon: 'i-lucide-pencil-line', value: value?.in_revision, to: { tab: 'register', state: 'in_revision' }, tone: 'warning' as const },
  ] as const
})

function cardLink(target: Record<string, string>) {
  return { query: { ...route.query, ...target, page: undefined } }
}

const categoryBars = computed(() =>
  (overview.data.value?.by_category ?? []).map((row) => ({
    label: row.category === 'none' ? 'Not rated' : biaCategory[row.category].label,
    value: row.groups,
  })),
)
const monthPoints = computed(() =>
  (overview.data.value?.approved_per_month ?? []).map((row) => ({ month: row.month, value: row.assessments })),
)

const stepRows = computed(() => (stepAverages.data.value?.items ?? []).filter((row) => row.approvals > 0 && row.average_working_days !== null))
const stepBars = computed(() =>
  stepRows.value.map((row) => ({ label: row.step_title || biaStepTitle(row.step), value: row.average_working_days ?? 0 })),
)

function plural(count: number, one: string, many = `${one}s`) {
  return `${formatNumber(count, 0)} ${count === 1 ? one : many}`
}

const categorySummary = computed(() => {
  const total = categoryBars.value.reduce((sum, row) => sum + row.value, 0)
  const critical = overview.data.value?.cards.business_critical ?? 0
  return total
    ? `${plural(total, 'group')} with a final BIA; ${formatNumber(critical, 0)} with Business Critical functions.`
    : ''
})
const monthSummary = computed(() => {
  const total = monthPoints.value.reduce((sum, row) => sum + row.value, 0)
  const top = [...monthPoints.value].sort((a, b) => b.value - a.value)[0]
  return top && total ? `${plural(total, 'BIA')} approved in the last 12 months. The most in ${formatMonth(top.month)} (${formatNumber(top.value, 0)}).` : ''
})
const stepSummary = computed(() => {
  const slowest = [...stepRows.value].sort((a, b) => (b.average_working_days ?? 0) - (a.average_working_days ?? 0))[0]
  const approvals = stepRows.value.reduce((sum, row) => sum + row.approvals, 0)
  return slowest ? `Slowest step: ${slowest.step_title || biaStepTitle(slowest.step)}, ${formatNumber(slowest.average_working_days, 1)} working days on average, over ${plural(approvals, 'approval')}.` : ''
})

function refLabel(ref: { id: number, ref_no: string | null } | null) {
  return ref ? ref.ref_no ?? `#${ref.id}` : '—'
}

function daysLeft(row: BiaMonitorGroupRow) {
  if (row.days_left === null) return ''
  if (row.days_left < 0) return `${-row.days_left} days overdue`
  if (row.days_left === 0) return 'Due today'
  return `${row.days_left} days left`
}

const renewalColumns: TableColumn<BiaMonitorGroupRow>[] = [
  { id: 'select', header: '', meta: { class: { th: 'w-0', td: 'w-0' } } },
  { id: 'group', header: 'Group' },
  { id: 'code', header: 'Group ID' },
  { id: 'category', header: 'Highest category' },
  { id: 'approved', header: 'Last final BIA' },
  { id: 'approved_date', header: 'Last final BIA date' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { accessorKey: 'days_left', header: 'Due' },
  { id: 'assessor', header: 'BCM Coordinator' },
  { id: 'alt_coordinator', header: 'Alternate' },
  { id: 'renewal', header: 'Renewal' },
  { id: 'actions', header: '' },
]

// --- Renewals: Act menu and Generate annual review -------------------------------------------

const selected = ref<Set<number>>(new Set())
const renewalRows = computed(() => renewals.data.value?.items ?? [])
const selectable = computed(() => renewalRows.value.filter((row) => row.can_generate))
const selectedRows = computed(() => selectable.value.filter((row) => selected.value.has(row.group.id)))
watch(renewalRows, () => (selected.value = new Set()))
const allSelected = computed<boolean | 'indeterminate'>({
  get: () => {
    if (!selectable.value.length || !selectedRows.value.length) return false
    return selectedRows.value.length === selectable.value.length ? true : 'indeterminate'
  },
  set: (value) => (selected.value = new Set(value ? selectable.value.map((row) => row.group.id) : [])),
})
function toggle(row: BiaMonitorGroupRow, value: boolean | 'indeterminate') {
  const next = new Set(selected.value)
  if (value === true) next.add(row.group.id)
  else next.delete(row.group.id)
  selected.value = next
}

function announce(result: BiaGenerateResult) {
  const created = result.created.length
  const skipped = result.skipped.length + result.refused.length
  const why = [...result.skipped, ...result.refused].map((row) => `${row.group ?? row.ref_no ?? `#${row.id}`}: ${row.reason}`)
  toast.add({
    title: `Created ${created}, skipped ${skipped}`,
    description: why.length
      ? why.slice(0, 3).join(' · ') + (why.length > 3 ? ` · and ${why.length - 3} more` : '')
      : `${plural(created, 'draft')} generated and linked to the last final BIA.`,
    color: created ? 'success' : 'warning',
    icon: created ? 'i-lucide-circle-check' : 'i-lucide-circle-alert',
  })
}

async function generate(rows: BiaMonitorGroupRow[]) {
  if (!rows.length) return
  const first = rows[0]!
  const ok = await confirm({
    title: rows.length === 1 ? 'Generate annual review' : `Generate ${rows.length} annual reviews`,
    description: rows.length === 1
      ? `${first.group.name}, from ${refLabel(first.approved)}. You become its BCM Coordinator. Business functions, dependencies, recovery strategies and signers are copied, dated today.`
      : `One draft per group, from its last final BIA. Business functions, dependencies, recovery strategies and signers are copied, dated today.`,
    confirmLabel: rows.length === 1 ? 'Generate' : `Generate ${rows.length}`,
  })
  if (!ok) return
  const result = await biaGenerateRenewals(
    rows.map((row) => row.approved!.id),
    user.value?.name || user.value?.email,
  )
  announce(result)
  selected.value = new Set()
}

function renewalActions(row: BiaMonitorGroupRow): DropdownMenuItem[] {
  return [
    { label: 'Open last final', icon: 'i-lucide-file-check', to: record(row.approved!.id) },
    {
      label: 'Open renewal',
      icon: 'i-lucide-file-pen',
      disabled: !row.open,
      to: row.open ? record(row.open.id) : undefined,
    },
    {
      label: 'Generate annual review',
      icon: 'i-lucide-file-plus-2',
      disabled: !can('bianca.create') || !row.can_generate,
      onSelect: () => generate([row]),
    },
    ...(can('bianca.approval.manage')
      ? [{
          label: 'Send renewal reminder',
          icon: 'i-lucide-bell-ring',
          onSelect: () => remindRenewals([row]),
        }]
      : []),
  ]
}

const remindingRenewals = ref(false)
async function remindRenewals(rows: BiaMonitorGroupRow[]) {
  const ids = rows.map((row) => row.approved?.id).filter((id): id is number => Boolean(id))
  if (!ids.length) return
  remindingRenewals.value = true
  try {
    const res = await biaRemindRenewals(ids)
    const sent = res.reminded.length
    const names = res.reminded.map((r) => r.group).slice(0, 3).join(', ')
    toast.add({
      title: `Sent ${plural(sent, 'renewal reminder')}`,
      description: names || undefined,
      color: sent ? 'success' : 'warning',
      icon: sent ? 'i-lucide-bell-ring' : 'i-lucide-circle-alert',
    })
    selected.value = new Set()
  } catch (failure) {
    toast.add({
      title: 'Could not send renewal reminder',
      description: apiErrorMessage(failure),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  } finally {
    remindingRenewals.value = false
  }
}

const registerColumns: TableColumn<BiaMonitorGroupRow>[] = [
  { id: 'select', header: '', meta: { class: { th: 'w-0', td: 'w-0' } } },
  { id: 'group', header: 'Group' },
  { id: 'group_status', header: 'Status' },
  { id: 'bia_users', header: 'BIA users & PIC' },
  { id: 'category', header: 'Highest category' },
  { id: 'shortest_mtd', header: 'Shortest MTD' },
  { id: 'functions', header: 'Functions' },
  { id: 'approved', header: 'Last final BIA' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { id: 'directorate', header: 'Directorate' },
  { accessorKey: 'assessment_count', header: 'BIA(s)' },
]

const picked = ref<Map<number, string>>(new Map())
const pickedIds = computed(() => [...picked.value.keys()])
const pageRows = computed(() => register.data.value?.items ?? [])
const pageState = computed<boolean | 'indeterminate'>({
  get: () => {
    const ticked = pageRows.value.filter((row) => picked.value.has(row.group.id)).length
    if (!ticked) return false
    return ticked === pageRows.value.length ? true : 'indeterminate'
  },
  set: (value) => pickPage(value),
})
function pick(row: BiaMonitorGroupRow, value: boolean | 'indeterminate') {
  const next = new Map(picked.value)
  if (value === true) next.set(row.group.id, row.group.name)
  else next.delete(row.group.id)
  picked.value = next
}
function pickPage(value: boolean | 'indeterminate') {
  const next = new Map(picked.value)
  for (const row of pageRows.value) {
    if (value === true) next.set(row.group.id, row.group.name)
    else next.delete(row.group.id)
  }
  picked.value = next
}
function clearPicked() {
  picked.value = new Map()
}

function registerRecord(row: BiaMonitorGroupRow) {
  return row.approved ?? row.open ?? row.history?.[0] ?? null
}

function openHistory(row: BiaMonitorGroupRow) {
  historyDialog.open({ row })
}

const bottleneckColumns: TableColumn<BiaSignoffWaitingRow>[] = [
  { id: 'select', header: '', meta: { class: { th: 'w-0', td: 'w-0' } } },
  { id: 'assessment', header: 'Group' },
  { accessorKey: 'ref_no', header: 'BIA ref. no.' },
  { accessorKey: 'step', header: 'Current step' },
  { id: 'coordinator', header: 'BCM Coordinator' },
  { id: 'signer', header: 'Waiting signer' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
  { accessorKey: 'reminders_sent', header: 'Reminders' },
  { accessorKey: 'escalated_at', header: 'Escalated on' },
  { accessorKey: 'working_days_in_signoff', header: 'In approval' },
  { id: 'actions', header: '' },
]

const selectedBottlenecks = ref<Set<number>>(new Set())
const bottleneckRows = computed(() => bottlenecks.data.value?.items ?? [])
const selectedBottleneckRows = computed(() =>
  bottleneckRows.value.filter((row) => selectedBottlenecks.value.has(row.id)),
)
watch(bottleneckRows, () => (selectedBottlenecks.value = new Set()))
const allBottlenecksSelected = computed<boolean | 'indeterminate'>({
  get: () => {
    if (!bottleneckRows.value.length || !selectedBottleneckRows.value.length) return false
    return selectedBottleneckRows.value.length === bottleneckRows.value.length ? true : 'indeterminate'
  },
  set: (value) => (selectedBottlenecks.value = new Set(value ? bottleneckRows.value.map((row) => row.id) : [])),
})
function toggleBottleneck(row: BiaSignoffWaitingRow, value: boolean | 'indeterminate') {
  const next = new Set(selectedBottlenecks.value)
  if (value === true) next.add(row.id)
  else next.delete(row.id)
  selectedBottlenecks.value = next
}

const remindingBottlenecks = ref(false)
async function remindApprovals(rows: BiaSignoffWaitingRow[]) {
  const ids = rows.map((row) => row.id)
  if (!ids.length) return
  remindingBottlenecks.value = true
  try {
    const res = await biaRemindBottlenecks(ids)
    const sent = res.reminded.length
    const details = res.reminded.map((r) => `${r.group} (${r.signer || 'Signer'})`).slice(0, 3).join(' · ')
    toast.add({
      title: `Sent ${plural(sent, 'approval reminder')}`,
      description: details || undefined,
      color: sent ? 'success' : 'warning',
      icon: sent ? 'i-lucide-bell-ring' : 'i-lucide-circle-alert',
    })
    selectedBottlenecks.value = new Set()
  } catch (failure) {
    toast.add({
      title: 'Could not send approval reminder',
      description: apiErrorMessage(failure),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  } finally {
    remindingBottlenecks.value = false
  }
}

const tabs = [
  { label: 'Overview', value: 'overview', icon: 'i-lucide-layout-dashboard', slot: 'overview' as const },
  { label: 'Renewals', value: 'renewals', icon: 'i-lucide-calendar-clock', slot: 'renewals' as const },
  { label: 'List', value: 'register', icon: 'i-lucide-list', slot: 'register' as const },
  { label: 'Approval', value: 'bottlenecks', icon: 'i-lucide-hourglass', slot: 'bottlenecks' as const },
]

function pageTo(next: number) {
  return { query: { ...route.query, page: next > 1 ? next : undefined } }
}

function record(id: number) {
  return biaPath('monitoring', id)
}
</script>

<template>
  <AppPage
    title="BIA monitoring"
    icon="i-lucide-chart-column"
    description="Every group's Business Impact Analysis: criticality categories, renewals due and sign-offs that are waiting."
    :crumbs="[{ label: 'BIANCA' }, { label: 'Monitoring' }]"
  >
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <ListFilterBar
        :filtered="filtered"
        :bordered="false"
        @clear="clearFilters"
      >
        <template #search>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Group, ID, ref. no. or user"
            aria-label="Search groups"
            class="w-full"
          />
        </template>
        <USelectMenu
          v-model="state"
          value-key="value"
          :items="stateItems"
          :search-input="false"
          class="w-48"
          aria-label="State"
        />
        <USelectMenu
          v-model="category"
          value-key="value"
          :items="categoryItems"
          :search-input="false"
          class="w-48"
          aria-label="Highest category"
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
          v-model="directorate"
          value-key="value"
          :items="directorateItems"
          class="w-56"
          aria-label="Directorate"
        />
        <USelectMenu
          v-model="subDirectorate"
          value-key="value"
          :items="subDirectorateItems"
          class="w-52"
          aria-label="Sub Directorate"
        />
        <USelectMenu
          v-model="group"
          value-key="value"
          :items="groupItems"
          class="w-52"
          aria-label="Group"
        />
        <USelectMenu
          v-model="period"
          value-key="value"
          :items="periodItems"
          :search-input="false"
          class="w-40"
          aria-label="Assessment date"
        />
        <template v-if="period === 'custom'">
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
        </template>
      </ListFilterBar>
    </UCard>

    <UTabs
      v-model="tab"
      :items="tabs"
      variant="link"
      :unmount-on-hide="false"
    >
      <template #overview>
        <div class="mt-4 space-y-6">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ULink
              v-for="card in cards"
              :key="card.key"
              :to="cardLink(card.to)"
              class="group rounded-lg border border-default bg-default p-4 transition hover:border-accented hover:bg-elevated/40"
              :aria-label="`${card.label}: ${card.value ?? 'loading'}`"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm text-muted">
                    {{ card.label }}
                  </p>
                  <p
                    class="mt-1 text-3xl font-semibold tabular-nums"
                    :class="card.tone === 'error' && card.value ? 'text-error' : card.tone === 'warning' && card.value ? 'text-warning' : 'text-highlighted'"
                  >
                    {{ card.value ?? '—' }}
                  </p>
                  <p class="mt-1 text-xs text-muted">
                    {{ card.hint }}
                  </p>
                </div>
                <UIcon
                  :name="card.icon"
                  class="size-5 text-dimmed group-hover:text-muted"
                />
              </div>
            </ULink>
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            <SccaBarChart
              title="Groups by highest category"
              measure="Groups"
              :height="260"
              :items="categoryBars"
              :summary="categorySummary"
              :loading="overview.status.value === 'pending' && !overview.data.value"
              :empty="categorySummary ? null : 'No group has a final BIA yet for these filters.'"
            />
            <SccaLineChart
              title="BIAs approved per month"
              measure="BIAs approved"
              :points="monthPoints"
              :summary="monthSummary"
              :loading="overview.status.value === 'pending' && !overview.data.value"
              :empty="monthSummary ? null : 'No BIA was approved in the last 12 months.'"
            />
          </div>
        </div>
      </template>

      <template #renewals>
        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <KpiCard
            v-for="card in renewalCards"
            :key="card.bucket"
            :to="{ query: { ...route.query, bucket: bucket === card.bucket ? undefined : card.bucket, page: undefined } }"
            :label="card.label"
            :value="renewals.data.value?.counts?.[card.bucket] ?? null"
            :hint="bucket === card.bucket ? 'Showing only these. Click again to show all.' : card.hint"
            :icon="card.icon"
            :tone="card.tone"
            :active="bucket === card.bucket"
          />
        </div>
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-4">
            <p class="text-sm text-muted">
              {{ bucket ? `${biaRenewalBucket[bucket].label}, soonest first.` : 'Overdue and due within 90 days, soonest first.' }}
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="can('bianca.approval.manage') && selectable.length"
                color="neutral"
                variant="outline"
                icon="i-lucide-bell-ring"
                :label="`Send reminder (${selectedRows.length})`"
                :loading="remindingRenewals"
                :disabled="!selectedRows.length"
                @click="remindRenewals(selectedRows)"
              />
              <UButton
                v-if="can('bianca.create') && selectable.length"
                icon="i-lucide-file-plus-2"
                :label="`Generate annual review (${selectedRows.length})`"
                :disabled="!selectedRows.length"
                @click="generate(selectedRows)"
              />
              <UButton
                v-if="can('bianca.report.download')"
                :to="biaExportUrl(filters, selectedRows.map((row) => row.group.id))"
                external
                download
                color="neutral"
                variant="outline"
                icon="i-lucide-file-spreadsheet"
                label="Export to Excel"
              />
            </div>
          </div>
          <UTable
            :data="renewalRows"
            :columns="renewalColumns"
            :loading="renewals.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #select-header>
              <UCheckbox
                v-if="selectable.length"
                v-model="allSelected"
                aria-label="Select every row you can generate for"
              />
            </template>
            <template #select-cell="{ row }">
              <UCheckbox
                :model-value="selected.has(row.original.group.id)"
                :disabled="!row.original.can_generate"
                :aria-label="`Select ${row.original.group.name}`"
                @update:model-value="toggle(row.original, $event)"
              />
            </template>
            <template #group-cell="{ row }">
              <NuxtLink
                :to="record(row.original.approved!.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.group.name }}
              </NuxtLink>
              <p
                v-if="row.original.group.directorate"
                class="text-xs text-muted"
              >
                {{ row.original.group.directorate }}
              </p>
            </template>
            <template #code-cell="{ row }">
              <span class="font-mono text-xs">{{ row.original.group.code || '—' }}</span>
            </template>
            <template #category-cell="{ row }">
              <StatusBadge
                v-if="row.original.approved?.highest_category"
                :scale="biaCategory"
                :value="row.original.approved.highest_category"
                size="sm"
              />
              <span
                v-else
                class="text-muted"
              >Not rated</span>
            </template>
            <template #approved-cell="{ row }">
              <span class="font-mono text-xs">{{ refLabel(row.original.approved) }}</span>
            </template>
            <template #approved_date-cell="{ row }">
              {{ formatDate(row.original.approved?.approved_at) || '—' }}
            </template>
            <template #renewal_date-cell="{ row }">
              {{ formatDate(row.original.renewal_date) }}
            </template>
            <template #days_left-cell="{ row }">
              <StatusBadge
                v-if="row.original.bucket"
                :scale="biaRenewalBucket"
                :value="row.original.bucket"
                size="sm"
              />
              <p class="mt-1 text-xs text-muted">
                {{ daysLeft(row.original) }}
              </p>
            </template>
            <template #assessor-cell="{ row }">
              <p class="max-w-56 truncate">
                {{ row.original.assessor || row.original.group_users?.[0]?.name || '—' }}
              </p>
              <BiaGroupUsersPopover
                v-if="row.original.group_users?.length"
                :group-name="row.original.group.name"
                :users="row.original.group_users"
                variant="link"
              />
            </template>
            <template #alt_coordinator-cell="{ row }">
              <p class="max-w-56 truncate">
                {{ row.original.alt_coordinator || '—' }}
              </p>
            </template>
            <template #renewal-cell="{ row }">
              <NuxtLink
                v-if="row.original.open"
                :to="record(row.original.open.id)"
                class="hover:underline"
              >
                <StatusBadge
                  :scale="biaStatus"
                  :value="biaStatusKey(row.original.open)"
                  size="sm"
                />
                <span class="ms-1 font-mono text-xs">{{ refLabel(row.original.open) }}</span>
              </NuxtLink>
              <span
                v-else
                class="text-muted"
              >Not started</span>
            </template>
            <template #actions-cell="{ row }">
              <UDropdownMenu
                :items="renewalActions(row.original)"
                :content="{ align: 'end' }"
              >
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  trailing-icon="i-lucide-chevron-down"
                  label="Act"
                  :aria-label="`Act on ${row.original.group.name}`"
                />
              </UDropdownMenu>
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                No renewals are due in the next 90 days{{ filtered ? ' for these filters' : '' }}.
              </p>
            </template>
          </UTable>
          <TablePagination
            v-model:per-page="perPage"
            page-sizes
            :page="page"
            :total="renewals.data.value?.total ?? 0"
            :to="pageTo"
            label="Renewals"
          />
        </UCard>
      </template>

      <template #register>
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-4">
            <p class="text-sm text-muted">
              {{ plural(register.data.value?.total ?? 0, 'group') }}<template v-if="pickedIds.length">
                · <span class="font-medium text-highlighted">{{ pickedIds.length }} selected</span>
              </template>
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                v-if="pickedIds.length"
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                label="Clear selection"
                @click="clearPicked"
              />
              <UButton
                v-if="can('bianca.report.download')"
                :to="biaExportUrl(filters, pickedIds)"
                external
                download
                color="neutral"
                variant="outline"
                icon="i-lucide-file-spreadsheet"
                :label="pickedIds.length ? `Export selected (${pickedIds.length})` : 'Export to Excel'"
              />
            </div>
          </div>
          <UTable
            :data="register.data.value?.items ?? []"
            :columns="registerColumns"
            :get-row-id="(row: BiaMonitorGroupRow) => String(row.group.id)"
            :loading="register.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #select-header>
              <UCheckbox
                :model-value="pageState"
                aria-label="Select every group on this page"
                @update:model-value="pickPage"
              />
            </template>
            <template #select-cell="{ row }">
              <UCheckbox
                :model-value="picked.has(row.original.group.id)"
                :aria-label="`Select ${row.original.group.name}`"
                @update:model-value="(value: boolean | 'indeterminate') => pick(row.original, value)"
              />
            </template>
            <template #group-cell="{ row }">
              <NuxtLink
                v-if="registerRecord(row.original)"
                :to="record(registerRecord(row.original)!.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.group.name }}
              </NuxtLink>
              <span
                v-else
                class="font-medium text-highlighted"
              >{{ row.original.group.name }}</span>
              <p class="text-xs text-muted">
                <span class="font-mono">{{ row.original.group.code || '—' }}</span>
                <template v-if="row.original.group.main_building && row.original.group.main_building !== '—'">
                  · {{ row.original.group.main_building }}
                </template>
              </p>
            </template>
            <template #group_status-cell="{ row }">
              <NuxtLink
                v-if="row.original.open ?? row.original.approved"
                :to="record((row.original.open ?? row.original.approved)!.id)"
                class="inline-block hover:underline"
              >
                <StatusBadge
                  :scale="biaGroupStatus"
                  :value="biaGroupStatusKey(row.original)"
                  size="sm"
                />
              </NuxtLink>
              <StatusBadge
                v-else
                :scale="biaGroupStatus"
                :value="biaGroupStatusKey(row.original)"
                size="sm"
              />
              <p class="mt-1 text-xs text-muted">
                <template v-if="row.original.open?.status === 'in_signoff' && row.original.open.current_signoff_role">
                  <NuxtLink
                    :to="record(row.original.open.id)"
                    class="font-mono hover:underline"
                  >
                    {{ refLabel(row.original.open) }}
                  </NuxtLink>
                  · Waiting: {{ biaStepTitle(row.original.open.current_signoff_role, row.original.open.current_step_title) }}
                </template>
                <template v-else-if="row.original.open">
                  <NuxtLink
                    :to="record(row.original.open.id)"
                    class="font-mono hover:underline"
                  >
                    {{ refLabel(row.original.open) }}
                  </NuxtLink>
                  <template v-if="row.original.approved">
                    · Renewal in progress
                  </template>
                </template>
                <template v-else-if="row.original.approved && (row.original.bucket === 'overdue' || row.original.bucket === 'due_30' || row.original.bucket === 'due_90')">
                  {{ daysLeft(row.original) }}
                </template>
                <template v-else-if="!row.original.approved">
                  No BIA submitted yet
                </template>
              </p>
            </template>
            <template #bia_users-cell="{ row }">
              <div class="space-y-1">
                <p class="max-w-56 truncate text-sm font-medium text-highlighted">
                  {{ row.original.assessor || row.original.group_users?.[0]?.name || '—' }}
                </p>
                <p
                  v-if="row.original.alt_coordinator && row.original.alt_coordinator !== row.original.assessor"
                  class="max-w-56 truncate text-xs text-muted"
                >
                  Alt: {{ row.original.alt_coordinator }}
                </p>
                <BiaGroupUsersPopover
                  v-if="row.original.group_users?.length"
                  :group-name="row.original.group.name"
                  :users="row.original.group_users"
                />
                <p
                  v-else-if="!row.original.assessor"
                  class="text-xs text-muted"
                >
                  No user assigned
                </p>
              </div>
            </template>
            <template #functions-cell="{ row }">
              <span class="tabular-nums">{{ (row.original.approved ?? row.original.open)?.function_count ?? '—' }}</span>
            </template>
            <template #category-cell="{ row }">
              <template v-if="row.original.approved?.highest_category">
                <StatusBadge
                  :scale="biaCategory"
                  :value="row.original.approved.highest_category"
                  size="sm"
                />
              </template>
              <template v-else-if="row.original.open?.highest_category">
                <StatusBadge
                  :scale="biaCategory"
                  :value="row.original.open.highest_category"
                  size="sm"
                />
                <p class="mt-1 text-xs text-muted">
                  Preliminary
                </p>
              </template>
              <span
                v-else
                class="text-muted"
              >Not rated</span>
            </template>
            <template #shortest_mtd-cell="{ row }">
              <span :class="(row.original.approved ?? row.original.open)?.shortest_mtd ? '' : 'text-muted'">
                {{ (row.original.approved ?? row.original.open)?.shortest_mtd || '—' }}
              </span>
            </template>
            <template #approved-cell="{ row }">
              <template v-if="row.original.approved">
                <NuxtLink
                  :to="record(row.original.approved.id)"
                  class="font-mono text-xs text-primary hover:underline"
                >
                  {{ refLabel(row.original.approved) }}
                </NuxtLink>
                <p class="text-xs text-muted">
                  {{ formatDate(row.original.approved.approved_at) || '—' }}<template v-if="row.original.approved.reason">
                    · {{ biaReasonLabel(row.original.approved.reason) }}
                  </template>
                </p>
              </template>
              <span
                v-else
                class="text-muted"
              >—</span>
            </template>
            <template #renewal_date-cell="{ row }">
              {{ formatDate(row.original.renewal_date) || '—' }}
            </template>
            <template #directorate-cell="{ row }">
              <p class="max-w-52 truncate">
                {{ row.original.group.directorate || '—' }}
              </p>
              <p
                v-if="row.original.group.sub_directorate && row.original.group.sub_directorate !== '—'"
                class="max-w-52 truncate text-xs text-muted"
              >
                {{ row.original.group.sub_directorate }}
              </p>
            </template>
            <template #assessment_count-cell="{ row }">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                trailing-icon="i-lucide-history"
                :label="String(row.original.assessment_count)"
                :disabled="!row.original.assessment_count"
                :aria-label="`BIA history of ${row.original.group.name}`"
                @click="openHistory(row.original)"
              />
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                No group matches these filters.
              </p>
            </template>
          </UTable>
          <TablePagination
            v-model:per-page="perPage"
            page-sizes
            :page="page"
            :total="register.data.value?.total ?? 0"
            :to="pageTo"
            label="List"
          />
        </UCard>
      </template>

      <template #bottlenecks>
        <div class="mt-4 space-y-4">
          <SccaBarChart
            title="Average working days per sign-off step"
            measure="Working days"
            :digits="1"
            :items="stepBars"
            :summary="stepSummary"
            :loading="stepAverages.status.value === 'pending' && !stepAverages.data.value"
            :empty="stepBars.length ? null : 'No sign-off step was approved in this period, so there are no averages yet. They appear as approvals come in.'"
          />

          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-4">
              <p class="text-sm text-muted">
                BIAs in approval, the longest-waiting step first. Waiting is in working days (Monday to Friday) since the submission or the last approval.
              </p>
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-if="can('bianca.approval.manage') && bottleneckRows.length"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-bell-ring"
                  :label="`Send reminder (${selectedBottleneckRows.length})`"
                  :loading="remindingBottlenecks"
                  :disabled="!selectedBottleneckRows.length"
                  @click="remindApprovals(selectedBottleneckRows)"
                />
              </div>
            </div>
            <UTable
              :data="bottlenecks.data.value?.items ?? []"
              :columns="bottleneckColumns"
              :loading="bottlenecks.status.value === 'pending'"
              :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
            >
              <template #select-header>
                <UCheckbox
                  v-if="bottleneckRows.length"
                  v-model="allBottlenecksSelected"
                  aria-label="Select every waiting BIA on this page"
                />
              </template>
              <template #select-cell="{ row }">
                <UCheckbox
                  :model-value="selectedBottlenecks.has(row.original.id)"
                  :aria-label="`Select ${row.original.group.name}`"
                  @update:model-value="toggleBottleneck(row.original, $event)"
                />
              </template>
              <template #assessment-cell="{ row }">
                <NuxtLink
                  :to="record(row.original.id)"
                  class="font-medium text-primary hover:underline"
                >
                  {{ row.original.group.name }}
                </NuxtLink>
              </template>
              <template #ref_no-cell="{ row }">
                <span class="font-mono text-xs">{{ refLabel(row.original) }}</span>
              </template>
              <template #step-cell="{ row }">
                {{ biaStepTitle(row.original.step, row.original.step_title) }}
              </template>
              <template #coordinator-cell="{ row }">
                <span :class="row.original.coordinator ? '' : 'text-muted'">
                  {{ row.original.coordinator || '—' }}
                </span>
              </template>
              <template #signer-cell="{ row }">
                <template v-if="row.original.signer?.name">
                  {{ row.original.signer.name }}
                  <p
                    v-if="row.original.signer.job_title"
                    class="text-xs text-muted"
                  >
                    {{ row.original.signer.job_title }}
                  </p>
                </template>
                <span
                  v-else
                  class="text-xs text-muted"
                >Unassigned (via Coordinator)</span>
              </template>
              <template #working_days_waiting-cell="{ row }">
                <span :class="row.original.working_days_waiting >= 5 ? 'font-medium text-warning' : ''">{{ biaWaiting(row.original.working_days_waiting) }}</span>
              </template>
              <template #reminders_sent-cell="{ row }">
                <span class="tabular-nums">{{ row.original.reminders_sent }}</span>
              </template>
              <template #escalated_at-cell="{ row }">
                <span v-if="row.original.escalated_at">{{ formatDate(row.original.escalated_at) }}</span>
                <StatusBadge
                  v-else-if="row.original.level !== 'ok'"
                  :scale="biaWaitLevel"
                  :value="row.original.level"
                  size="sm"
                />
                <span
                  v-else
                  class="text-muted"
                >—</span>
              </template>
              <template #working_days_in_signoff-cell="{ row }">
                {{ biaWaiting(row.original.working_days_in_signoff) }}
              </template>
              <template #actions-cell="{ row }">
                <UButton
                  v-if="can('bianca.approval.manage')"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  icon="i-lucide-bell-ring"
                  label="Remind"
                  :loading="remindingBottlenecks"
                  :aria-label="`Send reminder for ${row.original.group.name}`"
                  @click="remindApprovals([row.original])"
                />
              </template>
              <template #empty>
                <p class="py-6 text-center text-sm text-muted">
                  No BIA is in approval.
                </p>
              </template>
            </UTable>
            <TablePagination
              v-model:per-page="perPage"
              page-sizes
              :page="page"
              :total="bottlenecks.data.value?.total ?? 0"
              :to="pageTo"
              label="Approval"
            />
          </UCard>
        </div>
      </template>
    </UTabs>
  </AppPage>
</template>
