<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { parseDate, today as todayIn, type CalendarDate } from '@internationalized/date'
import type {
  BiaDirectorateRow,
  BiaDirectorateSort,
  BiaGenerateResult,
  BiaMonitorAssessmentRow,
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
const { query: sortQuery, header: sortable } = useTableSort([
  'waiting_since',
  'working_days_waiting',
  'working_days_in_signoff',
  'reminders_sent',
  'escalated_at',
])

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
const STATES = [
  'approved',
  'full_approved',
  'in_renewal',
  'valid',
  'overdue',
  'due_soon',
  'due_30',
  'due_60',
  'due_90',
  'open',
  'draft_group',
  'draft',
  'waiting_submission',
  'need_revision',
  'in_revision',
  'returned',
  'in_signoff',
  'waiting_approval',
  'escalated',
  'expired',
  'cancelled',
  'none',
  'not_started',
] as const

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
  { label: 'Final: Full Approved', value: 'full_approved' },
  { label: 'In Renewal: All', value: 'in_renewal' },
  { label: 'In Renewal: Due in 90 days', value: 'due_90' },
  { label: 'In Renewal: Due in 60 days', value: 'due_60' },
  { label: 'In Renewal: Due in 30 days', value: 'due_30' },
  { label: 'In Renewal: Overdue', value: 'overdue' },
  { label: 'Draft: All', value: 'draft_group' },
  { label: 'Draft: Waiting for Submission Task', value: 'waiting_submission' },
  { label: 'Draft: Need Revision', value: 'need_revision' },
  { label: 'Draft: In Revision', value: 'in_revision' },
  { label: 'In Approval: All', value: 'in_signoff' },
  { label: 'In Approval: Waiting for Approval', value: 'waiting_approval' },
  { label: 'In Approval: Escalated', value: 'escalated' },
  { label: 'Final: Expired', value: 'expired' },
  { label: 'Final: Cancelled', value: 'cancelled' },
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
  return value === 'overdue' || value === 'due_30' || value === 'due_60' || value === 'due_90' ? value : undefined
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
  { bucket: 'due_60' as const, label: 'Due in 60 days', hint: 'Renewal date in 31 to 60 days', icon: 'i-lucide-calendar', tone: 'info' as const },
  { bucket: 'due_90' as const, label: 'Due in 90 days', hint: 'Renewal date in 61 to 90 days', icon: 'i-lucide-calendar', tone: 'info' as const },
]
const listView = computed<'directorates' | 'flat' | 'assessments'>({
  get: () => {
    const v = text('view')
    if (v === 'directorates') return 'directorates'
    if (v === 'assessments') return 'assessments'
    return 'flat'
  },
  set: (value) => setQuery({ view: value === 'flat' ? undefined : value }),
})
const dirSort = computed<BiaDirectorateSort>({
  get: () => {
    const s = text('sort')
    return s === 'name' || s === 'groups' ? s : 'urgent'
  },
  set: (value) => setQuery({ sort: value === 'urgent' ? undefined : value }),
})
const attentionOnly = computed<boolean>({
  get: () => text('attention_only') === '1',
  set: (value) => setQuery({ attention_only: value ? '1' : undefined }),
})
const dirSortItems = [
  { label: 'Most urgent', value: 'urgent' },
  { label: 'Name (A–Z)', value: 'name' },
  { label: 'Most groups', value: 'groups' },
]
const smartFlat = computed(() =>
  listView.value === 'directorates' && Boolean(filters.value.q || filters.value.org_group),
)
const effectiveListMode = computed<'directorates' | 'flat' | 'assessments'>(() => {
  if (listView.value === 'assessments') return 'assessments'
  return listView.value === 'flat' || smartFlat.value ? 'flat' : 'directorates'
})

const directorates = useBiaDirectorates(computed(() => ({
  ...filters.value,
  sort: dirSort.value,
  attention_only: attentionOnly.value,
  page: page.value,
  per_page: perPage.value,
})))
const register = useBiaRegister(computed(() => ({
  ...filters.value,
  ...(tab.value === 'register' && effectiveListMode.value === 'flat' ? sortQuery.value : {}),
  page: page.value,
  per_page: perPage.value,
})))
const assessmentsList = useBiaAssessments(computed(() => ({
  ...filters.value,
  ...(tab.value === 'register' && effectiveListMode.value === 'assessments' ? sortQuery.value : {}),
  page: page.value,
  per_page: perPage.value,
})))
const bottlenecks = useBiaBottlenecks(computed(() => ({
  ...filters.value,
  ...(tab.value === 'bottlenecks' ? sortQuery.value : {}),
  page: page.value,
  per_page: perPage.value,
})))
const stepAverages = useBiaBottlenecksStepAverages(filters)

const cardSections = computed(() => {
  const value = overview.data.value?.cards
  return [
    {
      groupKey: 'draft',
      title: 'Draft',
      cols: 'sm:grid-cols-3',
      cards: [
        { key: 'need_revision', label: 'Need Revision', hint: 'Rejected by approver; no action yet', icon: 'i-lucide-undo-2', value: value?.need_revision ?? 0, to: { tab: 'register', state: 'need_revision', bucket: undefined }, tone: 'error' as const },
        { key: 'in_revision', label: 'In Revision', hint: 'Rejected by approver; revision in progress', icon: 'i-lucide-pencil-line', value: value?.in_revision ?? 0, to: { tab: 'register', state: 'in_revision', bucket: undefined }, tone: 'warning' as const },
        { key: 'waiting_submission', label: 'Waiting for Submission Task', hint: 'Unsubmitted drafts & pending initial tasks', icon: 'i-lucide-file-pen', value: value?.waiting_submission ?? value?.drafts ?? 0, to: { tab: 'register', state: 'waiting_submission', bucket: undefined }, tone: 'neutral' as const },
      ],
    },
    {
      groupKey: 'in_approval',
      title: 'In Approval',
      cols: 'sm:grid-cols-2',
      cards: [
        { key: 'in_approval', label: 'In Approval', hint: 'All BIAs waiting for sign-off (incl. escalated)', icon: 'i-lucide-hourglass', value: value?.in_signoff ?? 0, to: { tab: 'bottlenecks', state: undefined, bucket: undefined }, tone: 'warning' as const },
        { key: 'escalated', label: 'Escalated', hint: 'In approval ≥ 7 working days without approval', icon: 'i-lucide-siren', value: value?.stuck_approvals ?? 0, to: { tab: 'bottlenecks', state: undefined, bucket: undefined }, tone: 'error' as const },
      ],
    },
    {
      groupKey: 'final',
      title: 'Final',
      cols: 'sm:grid-cols-3',
      cards: [
        { key: 'full_approved', label: 'Full Approved', hint: 'Active final BIA (> 90 days before renewal)', icon: 'i-lucide-badge-check', value: value?.full_approved ?? 0, to: { tab: 'register', view: undefined, state: 'full_approved', bucket: undefined }, tone: 'neutral' as const },
        { key: 'expired', label: 'Expired', hint: 'Prior final BIAs superseded by a newer final', icon: 'i-lucide-archive', value: value?.expired ?? 0, to: { tab: 'register', view: 'assessments', state: 'expired', bucket: undefined }, tone: 'neutral' as const },
        { key: 'cancelled', label: 'Cancelled', hint: 'Cancelled BIA assessments', icon: 'i-lucide-ban', value: value?.cancelled ?? 0, to: { tab: 'register', view: 'assessments', state: 'cancelled', bucket: undefined }, tone: 'neutral' as const },
      ],
    },
    {
      groupKey: 'in_renewal',
      title: 'In Renewal',
      cols: 'sm:grid-cols-2 xl:grid-cols-4',
      cards: [
        { key: 'overdue_renewals', label: 'Overdue', hint: 'Final BIA past its renewal date', icon: 'i-lucide-circle-alert', value: value?.overdue_renewals ?? 0, to: { tab: 'renewals', bucket: 'overdue', state: undefined }, tone: 'error' as const },
        { key: 'due_30', label: 'Due in 30 days', hint: 'Renewal date within 0–30 days', icon: 'i-lucide-calendar-clock', value: value?.due_30 ?? 0, to: { tab: 'renewals', bucket: 'due_30', state: undefined }, tone: 'warning' as const },
        { key: 'due_60', label: 'Due in 60 days', hint: 'Renewal date in 31–60 days', icon: 'i-lucide-calendar', value: value?.due_60 ?? 0, to: { tab: 'renewals', bucket: 'due_60', state: undefined }, tone: 'neutral' as const },
        { key: 'due_90', label: 'Due in 90 days', hint: 'Renewal date in 61–90 days', icon: 'i-lucide-calendar', value: value?.due_90 ?? 0, to: { tab: 'renewals', bucket: 'due_90', state: undefined }, tone: 'neutral' as const },
      ],
    },
  ]
})

function cardLink(target: Record<string, string | undefined>) {
  return { query: { ...route.query, ...target, page: undefined } }
}

const statusGroupColors: Record<string, string> = {
  draft: '#94a3b8',
  in_approval: '#f59e0b',
  final: '#16a34a',
  in_renewal: '#dc2626',
}

const statusGroupTarget: Record<string, Record<string, string | undefined>> = {
  draft: { tab: 'register', state: 'draft_group', bucket: undefined },
  in_approval: { tab: 'bottlenecks', state: undefined, bucket: undefined },
  final: { tab: 'register', state: 'full_approved', bucket: undefined },
  in_renewal: { tab: 'renewals', state: undefined, bucket: undefined },
}

const statusGroupPieItems = computed(() => {
  const rows = overview.data.value?.by_status_group ?? []
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  return rows.map((row) => {
    const section = cardSections.value.find((s) => s.groupKey === row.group)
    return {
      key: row.group,
      label: row.label,
      value: row.count,
      pct: total ? Math.round((row.count / total) * 100) : 0,
      color: statusGroupColors[row.group] ?? '#94a3b8',
      details: section?.cards.map((c) => ({ label: c.label, value: c.value })),
    }
  })
})

const totalStatusGroups = computed(() =>
  (overview.data.value?.by_status_group ?? []).reduce((sum, r) => sum + r.count, 0),
)

function inspectStatusGroup(groupKey: string) {
  const target = statusGroupTarget[groupKey] ?? { tab: 'register' }
  navigateTo(cardLink(target))
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
const stepDigits = computed(() => (stepRows.value.some((row) => (row.average_working_days ?? 0) >= 1) ? 1 : 2))

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
  { id: 'renewal', header: 'Renewal' },
  { accessorKey: 'days_left', header: 'Due' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { id: 'category', header: 'Highest category' },
  { id: 'approved', header: 'Last final BIA' },
  { id: 'approved_date', header: 'Last final BIA date' },
  { id: 'code', header: 'Group ID' },
  { id: 'assessor', header: 'BCM Coordinator' },
  { id: 'alt_coordinator', header: 'Alternate' },
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

const picked = ref<Map<number, string>>(new Map())
const pickedIds = computed(() => [...picked.value.keys()])
const pickedIdSet = computed(() => new Set(picked.value.keys()))
function pick(row: BiaMonitorGroupRow, value: boolean | 'indeterminate') {
  const next = new Map(picked.value)
  if (value === true) next.set(row.group.id, row.group.name)
  else next.delete(row.group.id)
  picked.value = next
}
function pickManyRows(rows: BiaMonitorGroupRow[], value: boolean | 'indeterminate') {
  const next = new Map(picked.value)
  for (const row of rows) {
    if (value === true) next.set(row.group.id, row.group.name)
    else next.delete(row.group.id)
  }
  picked.value = next
}
function clearPicked() {
  picked.value = new Map()
}

const pickedBias = ref<Set<number>>(new Set())
const pickedBiaIds = computed(() => [...pickedBias.value])
function pickBia(row: BiaMonitorAssessmentRow, value: boolean | 'indeterminate') {
  const next = new Set(pickedBias.value)
  if (value === true) next.add(row.id)
  else next.delete(row.id)
  pickedBias.value = next
}
function pickManyBias(rows: BiaMonitorAssessmentRow[], value: boolean | 'indeterminate') {
  const next = new Set(pickedBias.value)
  for (const row of rows) {
    if (value === true) next.add(row.id)
    else next.delete(row.id)
  }
  pickedBias.value = next
}
function clearPickedBias() {
  pickedBias.value = new Set()
}

function openHistory(row: BiaMonitorGroupRow) {
  historyDialog.open({ row })
}

function directorateLink(name: string) {
  return {
    path: '/bianca/monitoring/directorate',
    query: {
      name,
      sort: dirSort.value === 'urgent' ? undefined : dirSort.value,
      attention_only: attentionOnly.value ? '1' : undefined,
      state: filters.value.state,
      category: filters.value.category,
      reason: filters.value.reason,
      from: filters.value.from,
      to: filters.value.to,
    },
  }
}

function openDirectorate(row: BiaDirectorateRow) {
  router.push(directorateLink(row.name))
}

function displayOrgName(value: string | null | undefined) {
  return !value || value === '—' ? 'Unassigned' : value
}

function directorateSeverityBar(severity: BiaDirectorateRow['severity']) {
  if (severity === 'error') return 'border-s-2 border-s-error'
  return 'border-s-2 border-s-transparent'
}

function coverageBarColor(pct: number) {
  if (pct >= 100) return 'bg-success'
  return 'bg-neutral-700 dark:bg-neutral-300'
}

function directorateCategoryMix(row: BiaDirectorateRow) {
  const cc = row.category_counts
  if (!cc) return row.highest_category || 'Not rated'
  const parts: string[] = []
  if (cc.critical) parts.push(`${cc.critical} Critical`)
  if (cc.important) parts.push(`${cc.important} Important`)
  if (cc.others) parts.push(`${cc.others} Others`)
  return parts.length ? parts.join(' · ') : 'Not rated'
}

function coverageTooltip(dir: BiaDirectorateRow) {
  const c = dir.coverage
  const parts = [`${c.valid_final} valid`]
  if (c.due_soon) parts.push(`${c.due_soon} due soon`)
  if (c.overdue) parts.push(`${c.overdue} overdue`)
  if (c.no_final) parts.push(`${c.no_final} no final BIA`)
  return `${c.pct}% valid (${parts.join(' · ')})`
}

function directorateOpenLabel(row: BiaDirectorateRow) {
  const oc = row.open_counts
  if (!oc.total) return '—'
  if (oc.in_signoff === oc.total) return `${oc.in_signoff} in approval`
  if (oc.draft === oc.total) return `${oc.draft} draft`
  if (oc.returned === oc.total) return `${oc.returned} returned`
  return `${oc.total} open`
}

function renewalDisabledReason(row: BiaMonitorGroupRow) {
  if (row.open) return `${refLabel(row.open)} is already open for this group`
  return 'No final BIA available to renew'
}

const activeFilterChips = computed(() => {
  const chips: string[] = []
  if (filters.value.state) {
    const found = stateItems.find((i) => i.value === filters.value.state)
    chips.push(found ? found.label.replace(/^(Existing|Open BIA): /, '') : filters.value.state)
  }
  if (filters.value.category) {
    const found = categoryItems.find((i) => i.value === filters.value.category)
    chips.push(found ? found.label : filters.value.category)
  }
  if (filters.value.reason) {
    const label = biaReasonLabel(filters.value.reason)
    if (label) chips.push(label)
  }
  if (filters.value.directorate) chips.push(filters.value.directorate)
  if (filters.value.sub_directorate) chips.push(filters.value.sub_directorate)
  if (filters.value.from || filters.value.to) chips.push('Date range')
  return chips
})

function col(id: string, label: string, width = 'min-w-28', right = false): TableColumn<BiaSignoffWaitingRow> {
  return {
    id,
    accessorKey: id,
    header: sortable(label, id, right),
    meta: { class: { th: `${width}${right ? ' text-right' : ''}`, td: width } },
  }
}

const bottleneckColumns: TableColumn<BiaSignoffWaitingRow>[] = [
  { id: 'select', header: '', meta: { class: { th: 'w-0', td: 'w-0' } } },
  col('group', 'Group', 'min-w-44'),
  col('ref_no', 'BIA ref. no.', 'min-w-32'),
  col('step_title', 'Current approval step', 'min-w-40'),
  { id: 'signer', header: 'Approver', meta: { class: { th: 'min-w-40', td: 'min-w-40' } } },
  { accessorKey: 'level', header: 'Status', meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  col('waiting_since', 'Assess since', 'min-w-32'),
  col('working_days_waiting', 'Assess days', 'min-w-32', true),
  col('reminders_sent', 'Reminders sent', 'min-w-28', true),
  col('escalated_at', 'Escalated on', 'min-w-32'),
  col('working_days_in_signoff', 'Working days in approval', 'min-w-36', true),
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

const remindingBulk = ref(false)
const remindingBottleneckIds = ref<Set<number>>(new Set())
const remindingBottlenecks = computed(() => remindingBulk.value || remindingBottleneckIds.value.size > 0)
async function remindApprovals(rows: BiaSignoffWaitingRow[], bulk = false) {
  const ids = rows.map((row) => row.id)
  if (!ids.length) return
  if (bulk) remindingBulk.value = true
  else remindingBottleneckIds.value = new Set(ids)
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
    remindingBulk.value = false
    remindingBottleneckIds.value = new Set()
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
  return { path: biaPath('monitoring', id), query: { from: tab.value } }
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
          <BiancaPieChart
            title="BIA status by group"
            :summary="`4 standardized status groups across ${plural(totalStatusGroups, 'group')}. Click a slice to inspect.`"
            measure="Groups"
            :height="260"
            :items="statusGroupPieItems"
            :loading="overview.status.value === 'pending' && !overview.data.value"
            empty="No groups match these filters."
            @select="inspectStatusGroup"
          />

          <div
            v-for="section in cardSections"
            :key="section.title"
            class="space-y-2.5"
          >
            <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
              {{ section.title }}
            </h3>
            <div
              class="grid gap-4"
              :class="section.cols"
            >
              <KpiCard
                v-for="card in section.cards"
                :key="card.key"
                :to="cardLink(card.to)"
                :label="card.label"
                :value="card.value"
                :hint="card.hint"
                :icon="card.icon"
                :tone="card.tone"
              />
            </div>
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
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              {{ bucket ? `${biaRenewalBucket[bucket].label}, soonest first.` : 'Final BIAs overdue or expiring within 90 days, soonest first. Select rows to send reminders or generate a renewal draft.' }}
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
                :to="biaExportUrl({ ...filters, bucket }, selectedRows.map((row) => row.group.id), 'renewals')"
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
              <UTooltip
                :disabled="row.original.can_generate"
                :text="renewalDisabledReason(row.original)"
              >
                <span class="inline-flex">
                  <UCheckbox
                    :model-value="selected.has(row.original.group.id)"
                    :disabled="!row.original.can_generate"
                    :aria-label="`Select ${row.original.group.name}`"
                    @update:model-value="toggle(row.original, $event)"
                  />
                </span>
              </UTooltip>
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
                v-if="row.original.assessor || row.original.group_users?.length || row.original.directorate_users?.length"
                :group-name="row.original.group.name"
                :users="row.original.group_users ?? []"
                :directorate-users="row.original.directorate_users ?? []"
                :coordinator="row.original.assessor"
                :alt-coordinator="row.original.alt_coordinator"
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
                class="inline-flex flex-col items-start gap-1 hover:underline"
              >
                <StatusBadge
                  v-if="row.original.open.status_group"
                  :scale="biaStatusGroup"
                  :value="row.original.open.status_group"
                  size="sm"
                />
                <StatusBadge
                  v-else
                  :scale="biaStatus"
                  :value="biaStatusKey(row.original.open)"
                  size="sm"
                />
                <span class="text-xs text-muted">
                  {{ row.original.open.status_detail_label || biaStatus[biaStatusKey(row.original.open)].label }} · <span class="font-mono">{{ refLabel(row.original.open) }}</span>
                </span>
              </NuxtLink>
              <span
                v-else
                class="text-xs text-muted"
              >No renewal draft yet</span>
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
          <!-- Top toolbar -->
          <div class="space-y-3 border-b border-default p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <template v-if="effectiveListMode === 'directorates' && directorates.data.value?.summary">
                  <span class="font-medium tabular-nums text-highlighted">
                    {{ plural(directorates.data.value.summary.total_groups, 'group') }}
                  </span>
                  <span class="text-dimmed">/</span>
                  <button
                    type="button"
                    class="tabular-nums text-highlighted hover:underline"
                    @click="setQuery({ state: filters.state === 'valid' ? undefined : 'valid' })"
                  >
                    {{ directorates.data.value.summary.valid_final }} valid
                  </button>
                  <template v-if="directorates.data.value.summary.overdue">
                    <span class="text-dimmed">/</span>
                    <button
                      type="button"
                      class="font-medium tabular-nums text-error hover:underline"
                      @click="setQuery({ state: filters.state === 'overdue' ? undefined : 'overdue' })"
                    >
                      {{ directorates.data.value.summary.overdue }} overdue
                    </button>
                  </template>
                  <template v-if="directorates.data.value.summary.returned">
                    <span class="text-dimmed">/</span>
                    <button
                      type="button"
                      class="font-medium tabular-nums text-error hover:underline"
                      @click="setQuery({ state: filters.state === 'returned' ? undefined : 'returned' })"
                    >
                      {{ directorates.data.value.summary.returned }} returned
                    </button>
                  </template>
                  <template v-if="directorates.data.value.summary.stuck">
                    <span class="text-dimmed">/</span>
                    <NuxtLink
                      :to="cardLink({ tab: 'bottlenecks' })"
                      class="font-medium tabular-nums text-warning hover:underline"
                    >
                      {{ directorates.data.value.summary.stuck }} stuck approval
                    </NuxtLink>
                  </template>
                  <template v-if="directorates.data.value.summary.due_soon">
                    <span class="text-dimmed">/</span>
                    <button
                      type="button"
                      class="tabular-nums text-muted hover:text-highlighted hover:underline"
                      @click="setQuery({ state: filters.state === 'due_soon' ? undefined : 'due_soon' })"
                    >
                      {{ directorates.data.value.summary.due_soon }} due soon
                    </button>
                  </template>
                  <template v-if="directorates.data.value.summary.not_started">
                    <span class="text-dimmed">/</span>
                    <button
                      type="button"
                      class="tabular-nums text-muted hover:text-highlighted hover:underline"
                      @click="setQuery({ state: filters.state === 'not_started' ? undefined : 'not_started' })"
                    >
                      {{ directorates.data.value.summary.not_started }} not started
                    </button>
                  </template>
                  <span class="text-xs text-dimmed">
                    (as of {{ formatDate(directorates.data.value.summary.as_of) }})
                  </span>
                </template>
                <template v-else-if="effectiveListMode === 'directorates'">
                  <span>
                    {{ plural(directorates.data.value?.total ?? 0, 'directorate') }} · {{ plural(directorates.data.value?.total_groups ?? 0, 'group') }}
                  </span>
                </template>
                <template v-else-if="effectiveListMode === 'assessments'">
                  <span>{{ plural(assessmentsList.data.value?.total ?? 0, 'BIA') }}</span>
                  <template v-if="pickedBiaIds.length">
                    · <span class="font-medium text-highlighted">{{ pickedBiaIds.length }} selected</span>
                  </template>
                </template>
                <template v-else>
                  <span>{{ plural(register.data.value?.total ?? 0, 'group') }}</span>
                  <template v-if="pickedIds.length">
                    · <span class="font-medium text-highlighted">{{ pickedIds.length }} selected</span>
                  </template>
                </template>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <template v-if="effectiveListMode === 'directorates'">
                  <UButton
                    size="xs"
                    :color="attentionOnly ? 'warning' : 'neutral'"
                    :variant="attentionOnly ? 'soft' : 'outline'"
                    icon="i-lucide-triangle-alert"
                    label="Needs attention only"
                    :aria-pressed="attentionOnly"
                    @click="attentionOnly = !attentionOnly"
                  />
                  <div class="flex items-center gap-1.5 text-xs text-muted">
                    <span>Sort:</span>
                    <USelect
                      v-model="dirSort"
                      :items="dirSortItems"
                      size="xs"
                      class="w-36"
                      aria-label="Sort directorates"
                    />
                  </div>
                </template>

                <div
                  class="inline-flex rounded-md border border-default p-0.5 text-xs"
                  role="group"
                  aria-label="List display mode"
                >
                  <button
                    type="button"
                    class="rounded px-2.5 py-1 font-medium transition"
                    :class="listView === 'directorates' ? 'bg-elevated text-highlighted shadow-xs' : 'text-muted hover:text-highlighted'"
                    @click="listView = 'directorates'"
                  >
                    By directorate
                  </button>
                  <button
                    type="button"
                    class="rounded px-2.5 py-1 font-medium transition"
                    :class="listView === 'flat' ? 'bg-elevated text-highlighted shadow-xs' : 'text-muted hover:text-highlighted'"
                    @click="listView = 'flat'"
                  >
                    All groups
                  </button>
                  <button
                    type="button"
                    class="rounded px-2.5 py-1 font-medium transition"
                    :class="listView === 'assessments' ? 'bg-elevated text-highlighted shadow-xs' : 'text-muted hover:text-highlighted'"
                    @click="listView = 'assessments'"
                  >
                    All BIA
                  </button>
                </div>

                <UButton
                  v-if="(effectiveListMode === 'flat' && pickedIds.length) || (effectiveListMode === 'assessments' && pickedBiaIds.length)"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-x"
                  label="Clear selection"
                  @click="effectiveListMode === 'assessments' ? clearPickedBias() : clearPicked()"
                />
                <UButton
                  v-if="can('bianca.report.download')"
                  :to="effectiveListMode === 'assessments'
                    ? biaExportUrl(filters, pickedBiaIds, 'assessments')
                    : biaExportUrl(filters, effectiveListMode === 'flat' ? pickedIds : undefined)"
                  external
                  download
                  color="neutral"
                  variant="outline"
                  size="xs"
                  icon="i-lucide-file-spreadsheet"
                  :label="effectiveListMode === 'assessments' && pickedBiaIds.length
                    ? `Export selected (${pickedBiaIds.length})`
                    : effectiveListMode === 'flat' && pickedIds.length
                      ? `Export selected (${pickedIds.length})`
                      : 'Export to Excel'"
                />
              </div>
            </div>

            <!-- Active filter / Smart search notice banner -->
            <div
              v-if="smartFlat || activeFilterChips.length"
              class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-elevated/60 px-3 py-1.5 text-xs"
            >
              <div class="flex flex-wrap items-center gap-1.5 text-muted">
                <UIcon
                  :name="smartFlat ? 'i-lucide-search' : 'i-lucide-filter'"
                  class="size-3.5 text-primary"
                />
                <span v-if="smartFlat">
                  Showing matching groups directly for <strong class="text-highlighted">{{ filters.q || filters.org_group }}</strong>
                </span>
                <span v-if="activeFilterChips.length">
                  <template v-if="smartFlat"> · </template>Filtered:
                  <strong class="text-highlighted">{{ activeFilterChips.join(' · ') }}</strong>
                </span>
              </div>
              <UButton
                color="neutral"
                variant="link"
                size="xs"
                label="Clear"
                class="px-0"
                @click="clearFilters"
              />
            </div>
          </div>

          <!-- Level 1: By Directorate View -->
          <template v-if="effectiveListMode === 'directorates'">
            <div
              v-if="directorates.status.value === 'pending' && !directorates.data.value"
              class="space-y-2 p-4"
            >
              <USkeleton
                v-for="i in 5"
                :key="i"
                class="h-14 rounded-md"
              />
            </div>

            <div
              v-else-if="!(directorates.data.value?.items?.length)"
              class="py-10 text-center"
            >
              <p class="text-sm text-muted">
                No directorate matches these filters.
              </p>
              <UButton
                v-if="filtered || attentionOnly"
                class="mt-3"
                color="neutral"
                variant="outline"
                size="xs"
                label="Clear filters"
                @click="attentionOnly = false; clearFilters()"
              />
            </div>

            <template v-else>
              <!-- Mobile stacked cards -->
              <ul class="divide-y divide-default sm:hidden">
                <li
                  v-for="dir in directorates.data.value.items"
                  :key="dir.name"
                  class="space-y-2 p-4 transition hover:bg-elevated/50"
                  :class="directorateSeverityBar(dir.severity)"
                  @click="openDirectorate(dir)"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <NuxtLink
                        :to="directorateLink(dir.name)"
                        class="font-semibold text-highlighted hover:text-primary hover:underline"
                        @click.stop
                      >
                        {{ displayOrgName(dir.name) }}
                      </NuxtLink>
                      <p class="mt-0.5 text-xs text-muted">
                        {{ plural(dir.sub_directorate_count, 'sub-directorate') }} · {{ plural(dir.group_count, 'group') }}
                      </p>
                    </div>
                    <span class="text-xs font-medium text-muted">
                      {{ directorateCategoryMix(dir) }}
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div class="w-36 space-y-1">
                      <div class="flex items-baseline justify-between gap-2 tabular-nums">
                        <span class="font-semibold text-highlighted">{{ dir.coverage.pct }}%</span>
                        <span class="text-muted">{{ dir.coverage.valid_final }} of {{ dir.coverage.total }} valid</span>
                      </div>
                      <div
                        class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                        :title="coverageTooltip(dir)"
                      >
                        <div
                          v-if="dir.coverage.pct > 0"
                          class="h-full rounded-full transition-all"
                          :class="coverageBarColor(dir.coverage.pct)"
                          :style="{ width: `${dir.coverage.pct}%` }"
                        />
                      </div>
                    </div>
                    <span class="text-muted">Open: {{ directorateOpenLabel(dir) }}</span>
                  </div>
                  <div @click.stop>
                    <BiancaHealthChips
                      :alerts="dir.alerts"
                      :escalation-days="directorates.data.value?.escalation_days"
                      :in-progress-count="dir.status_counts.no_final"
                      size="xs"
                    />
                  </div>
                </li>
              </ul>

              <!-- Desktop table -->
              <div class="hidden overflow-x-auto sm:block">
                <table class="w-full text-left text-sm">
                  <thead class="border-b border-default bg-elevated/40 text-xs font-medium uppercase text-muted">
                    <tr>
                      <th class="py-2.5 ps-4 pe-3">
                        <UTooltip text="Click a Directorate to open its Sub-Directorates and Groups.">
                          <span class="cursor-help underline decoration-dotted underline-offset-4">Directorate</span>
                        </UTooltip>
                      </th>
                      <th class="px-3 py-2.5">
                        <UTooltip text="Percentage of groups with an approved Final BIA that has not expired.">
                          <span class="cursor-help underline decoration-dotted underline-offset-4">Final coverage</span>
                        </UTooltip>
                      </th>
                      <th class="px-3 py-2.5">
                        <UTooltip :text="`Issues requiring follow-up: Overdue, Returned, Stuck approval (waiting ≥ ${directorates.data.value?.escalation_days ?? 5} working days), Due soon (≤ 30 days), or Not started. Hover any item for group names.`">
                          <span class="cursor-help underline decoration-dotted underline-offset-4">Needs attention</span>
                        </UTooltip>
                      </th>
                      <th class="px-3 py-2.5">
                        <UTooltip text="Active drafts, revisions, or submissions currently in approval.">
                          <span class="cursor-help underline decoration-dotted underline-offset-4">Open BIA</span>
                        </UTooltip>
                      </th>
                      <th class="py-2.5 ps-3 pe-4 text-right">
                        <UTooltip text="Distribution of Business Function Categories across groups in this Directorate.">
                          <span class="cursor-help underline decoration-dotted underline-offset-4">Criticality mix</span>
                        </UTooltip>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default">
                    <tr
                      v-for="dir in directorates.data.value.items"
                      :key="dir.name"
                      tabindex="0"
                      role="link"
                      :aria-label="`Open ${displayOrgName(dir.name)} (${dir.sub_directorate_count} sub-directorates, ${dir.group_count} groups)`"
                      class="cursor-pointer transition hover:bg-elevated/50 focus-visible:bg-elevated/60 focus-visible:outline-none"
                      @click="openDirectorate(dir)"
                      @keydown.enter.prevent="openDirectorate(dir)"
                    >
                      <td
                        class="py-3.5 ps-3.5 pe-3 align-middle"
                        :class="directorateSeverityBar(dir.severity)"
                      >
                        <NuxtLink
                          :to="directorateLink(dir.name)"
                          class="font-semibold text-highlighted hover:text-primary hover:underline"
                          @click.stop
                        >
                          {{ displayOrgName(dir.name) }}
                        </NuxtLink>
                        <p class="mt-0.5 text-xs text-muted">
                          {{ plural(dir.sub_directorate_count, 'sub-directorate') }} · {{ plural(dir.group_count, 'group') }}
                          <template v-if="dir.shortest_mtd">
                            · Shortest MTD {{ dir.shortest_mtd }}
                          </template>
                        </p>
                      </td>

                      <td class="px-3 py-3.5 align-middle">
                        <div
                          class="w-40 space-y-1.5"
                          :title="coverageTooltip(dir)"
                        >
                          <div class="flex items-baseline justify-between gap-2 tabular-nums">
                            <span class="text-base font-semibold text-highlighted">{{ dir.coverage.pct }}%</span>
                            <span class="text-xs text-muted">{{ dir.coverage.valid_final }} of {{ dir.coverage.total }} valid</span>
                          </div>
                          <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                            <div
                              v-if="dir.coverage.pct > 0"
                              class="h-full rounded-full transition-all"
                              :class="coverageBarColor(dir.coverage.pct)"
                              :style="{ width: `${dir.coverage.pct}%` }"
                            />
                          </div>
                        </div>
                      </td>

                      <td
                        class="px-3 py-3.5 align-middle"
                        @click.stop
                      >
                        <BiancaHealthChips
                          :alerts="dir.alerts"
                          :escalation-days="directorates.data.value?.escalation_days"
                          :in-progress-count="dir.status_counts.no_final"
                        />
                      </td>

                      <td class="px-3 py-3.5 align-middle">
                        <span
                          class="tabular-nums"
                          :class="dir.open_counts.total ? 'text-sm font-semibold text-highlighted' : 'text-xs text-muted'"
                        >
                          {{ directorateOpenLabel(dir) }}
                        </span>
                        <p
                          v-if="dir.open_counts.longest_working_days != null"
                          class="mt-0.5 text-xs text-muted tabular-nums"
                        >
                          waiting up to {{ plural(dir.open_counts.longest_working_days, 'working day') }}
                        </p>
                      </td>

                      <td class="py-3.5 ps-3 pe-4 text-right align-middle">
                        <div class="inline-flex items-center justify-end gap-2">
                          <span class="text-xs font-medium tabular-nums text-muted">
                            {{ directorateCategoryMix(dir) }}
                          </span>
                          <UIcon
                            name="i-lucide-chevron-right"
                            class="size-4 text-dimmed"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

            <TablePagination
              v-model:per-page="perPage"
              page-sizes
              :page="page"
              :total="directorates.data.value?.total ?? 0"
              :to="pageTo"
              label="Directorates"
            />
          </template>

          <!-- All BIA Assessments View -->
          <template v-else-if="effectiveListMode === 'assessments'">
            <BiancaAssessmentsTable
              :rows="assessmentsList.data.value?.items ?? []"
              :picked-ids="pickedBias"
              :loading="assessmentsList.status.value === 'pending'"
              @pick="pickBia"
              @pick-all="pickManyBias"
            />
            <TablePagination
              v-model:per-page="perPage"
              page-sizes
              :page="page"
              :total="assessmentsList.data.value?.total ?? 0"
              :to="pageTo"
              label="All BIA"
            />
          </template>

          <!-- Flat / Smart Search View -->
          <template v-else>
            <BiancaRegisterGroupTable
              :rows="register.data.value?.items ?? []"
              :picked-ids="pickedIdSet"
              :loading="register.status.value === 'pending'"
              :show-org-path="false"
              @pick="pick"
              @pick-all="pickManyRows"
              @open-history="openHistory"
            />
            <TablePagination
              v-model:per-page="perPage"
              page-sizes
              :page="page"
              :total="register.data.value?.total ?? 0"
              :to="pageTo"
              label="List"
            />
          </template>
        </UCard>
      </template>

      <template #bottlenecks>
        <div class="mt-4 space-y-4">
          <SccaBarChart
            title="Average working days per sign-off step"
            measure="Working days"
            :digits="stepDigits"
            :items="stepBars"
            :summary="stepSummary"
            :loading="stepAverages.status.value === 'pending' && !stepAverages.data.value"
            :empty="stepBars.length ? null : 'No sign-off step was approved in this period, so there are no averages yet. They appear as approvals come in.'"
          />

          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-4">
              <p class="text-sm text-muted">
                <template v-if="bottlenecks.data.value?.total">
                  {{ plural(bottlenecks.data.value.total, 'BIA') }} in approval, longest-waiting first.
                </template>
                <template v-else>
                  No BIA is in approval.
                </template>
                <template v-if="can('bianca.approval.manage') && bottlenecks.data.value?.total">
                  <NuxtLink
                    to="/bianca/approval"
                    class="text-primary hover:underline"
                  >Act on them in BIANCA approval</NuxtLink>.
                </template>
              </p>
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-if="can('bianca.approval.manage') && bottleneckRows.length"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-bell-ring"
                  :label="`Send reminder (${selectedBottleneckRows.length})`"
                  :loading="remindingBulk"
                  :disabled="!selectedBottleneckRows.length || remindingBottlenecks"
                  @click="remindApprovals(selectedBottleneckRows, true)"
                />
                <UButton
                  v-if="can('bianca.report.download')"
                  :to="biaExportUrl(filters, undefined, 'bottlenecks')"
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
              :data="bottlenecks.data.value?.items ?? []"
              :columns="bottleneckColumns"
              :loading="bottlenecks.status.value === 'pending'"
              :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
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
              <template #group-cell="{ row }">
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
              <template #step_title-cell="{ row }">
                {{ biaStepTitle(row.original.step, row.original.step_title) }}
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
              <template #level-cell="{ row }">
                <StatusBadge
                  :scale="biaWaitLevel"
                  :value="row.original.level"
                  size="sm"
                />
                <p
                  v-if="row.original.status_detail_label"
                  class="mt-1 text-xs text-muted"
                >
                  {{ row.original.status_detail_label }}
                </p>
              </template>
              <template #waiting_since-cell="{ row }">
                {{ formatDate(row.original.waiting_since) || '—' }}
              </template>
              <template #working_days_waiting-cell="{ row }">
                <span class="block text-right tabular-nums">{{ biaWaiting(row.original.working_days_waiting) }}</span>
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
              <template #working_days_in_signoff-cell="{ row }">
                <span class="block text-right tabular-nums">{{ biaWaiting(row.original.working_days_in_signoff) }}</span>
              </template>
              <template #actions-cell="{ row }">
                <UButton
                  v-if="can('bianca.approval.manage')"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  icon="i-lucide-bell-ring"
                  label="Remind"
                  :loading="remindingBottleneckIds.has(row.original.id)"
                  :disabled="remindingBottlenecks && !remindingBottleneckIds.has(row.original.id)"
                  :aria-label="`Send reminder for ${row.original.group.name}`"
                  @click="remindApprovals([row.original])"
                />
              </template>
              <template #empty>
                <p class="py-6 text-center text-sm text-muted">
                  Nothing is in approval{{ filtered ? ' for these filters' : '' }}.
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
