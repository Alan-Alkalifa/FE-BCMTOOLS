<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { parseDate, today as todayIn, type CalendarDate } from '@internationalized/date'
import type { RaGenerateResult, RaMonitorLocation, RaMonitoringFilters, RaRenewalBucket, RaSignoffWaiting, RaStepAverage } from '~/composables/useRa'
import RaHistoryDialog from '~/components/ra/RaHistoryDialog.vue'
import RaGenerateDialog from '~/components/ra/RaGenerateDialog.vue'
/**
 * RA (or RA Branch) Monitoring, as SCCA Monitoring: KPI cards and charts, renewals due (with
 * Generate annual review for the selected rows), the list of every location with its RA in
 * force (RA(s) opens its history; the checkboxes pick buildings for the Excel export), and RAs
 * waiting in sign-off. Outside BCM it shows the RAs the user takes part in, and Renewals also
 * what their access scope opens. Filters include the location's organization, as SCCA's.
 */
const ra = useRaModule()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const historyDialog = useOverlay().create(RaHistoryDialog)
const generateDialog = useOverlay().create(RaGenerateDialog)

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

const filters = computed<RaMonitoringFilters>(() => ({
  kind: ra.value.kind,
  q: text('q'),
  region: text('region'),
  level: (LEVEL_FILTERS.includes(text('level') as RaLevel) ? text('level') as RaMonitoringFilters['level'] : undefined),
  state: (STATES.includes(text('state') as (typeof STATES)[number]) ? text('state') as RaMonitoringFilters['state'] : undefined),
  reason: RA_REASONS.some((reason) => reason.value === text('reason')) ? text('reason') as RaReason : undefined,
  from: text('from'),
  to: text('to'),
  directorate: text('directorate'),
  sub_directorate: text('sub_directorate'),
  org_group: text('org_group'),
  division: text('division'),
}))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))

function setQuery(patch: Record<string, string | undefined>) {
  router.replace({ query: { ...route.query, ...patch, page: undefined } })
}

// Today in WIB, so "This year" and "Last 12 months" don't shift a day early in the morning.
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
  get: () => filters.value.from ? parseDate(filters.value.from) : undefined,
  set: (value) => setQuery({ from: value?.toString() }),
})
const toDate = computed<CalendarDate | undefined>({
  get: () => filters.value.to ? parseDate(filters.value.to) : undefined,
  set: (value) => setQuery({ to: value?.toString() }),
})

const LEVEL_FILTERS = [...RA_LEVELS, 'none'] as const
const STATES = ['approved', 'draft', 'need_revision', 'in_revision', 'returned', 'in_signoff', 'none'] as const

const level = computed<string>({
  get: () => filters.value.level ?? 'any',
  set: (value) => setQuery({ level: value === 'any' ? undefined : value }),
})
const levelItems = [
  { label: 'Any residual level', value: 'any' },
  ...RA_LEVELS.map((value) => ({ label: `${raRiskLevel[value].label} residual`, value })),
  { label: 'Not rated', value: 'none' },
]
const state = computed<string>({
  get: () => filters.value.state ?? 'any',
  set: (value) => setQuery({ state: value === 'any' ? undefined : value }),
})
const reasonFilter = computed<string>({
  get: () => filters.value.reason ?? 'any',
  set: (value) => setQuery({ reason: value === 'any' ? undefined : value }),
})
const reasonItems = [
  { label: 'Any reason', value: 'any' },
  ...RA_REASONS.map((reason) => ({ label: reason.label, value: reason.value as string })),
]
const stateItems = [
  { label: 'Any state', value: 'any' },
  { label: 'Has a final RA', value: 'approved' },
  { label: 'Draft open', value: 'draft' },
  { label: 'Need revision', value: 'need_revision' },
  { label: 'In revision', value: 'in_revision' },
  { label: 'In approval', value: 'in_signoff' },
  { label: 'No final RA yet', value: 'none' },
]
const { data: regionData } = useRaRegions(() => ra.value.kind)
const region = computed<string>({
  get: () => filters.value.region ?? 'all',
  set: (value) => setQuery({ region: value === 'all' ? undefined : value }),
})
const regionItems = computed(() => [
  { label: 'All regions', value: 'all' },
  ...(regionData.value?.items ?? []).map((name) => ({ label: name, value: name })),
])

// The location's Directorate / Sub Directorate / Group (a branch's area) / Division, as SCCA's
// org filters.
const { data: orgData } = useRaMonitoringOrgValues(filters)
type OrgField = 'directorate' | 'sub_directorate' | 'org_group' | 'division'
function orgFilter(field: OrgField) {
  return computed<string>({
    get: () => filters.value[field] ?? 'all',
    set: (value) => setQuery({ [field]: value === 'all' ? undefined : value }),
  })
}
const directorate = orgFilter('directorate')
const subDirectorate = orgFilter('sub_directorate')
const group = orgFilter('org_group')
const division = orgFilter('division')
function orgItems(all: string, values: string[] | undefined) {
  return [{ label: all, value: 'all' }, ...(values ?? []).map((name) => ({ label: name, value: name }))]
}
const directorateItems = computed(() => orgItems('All directorates', orgData.value?.directorates))
const subDirectorateItems = computed(() => orgItems('All sub directorates', orgData.value?.sub_directorates))
const groupItems = computed(() => orgItems('All groups / areas', orgData.value?.groups))
const divisionItems = computed(() => orgItems('All divisions', orgData.value?.divisions))

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
  return Boolean(value.q || value.region || value.level || value.state || value.reason || value.from || value.to
    || value.directorate || value.sub_directorate || value.org_group || value.division)
})
function clearFilters() {
  search.value = ''
  router.replace({ query: { tab: route.query.tab, from: undefined, to: undefined } })
}

// --- data ------------------------------------------------------------------------------------

const overview = useRaOverview(filters)
/** The renewal KPI card picked: the list shows only that bucket. */
const bucket = computed<Exclude<RaRenewalBucket, 'later'> | undefined>(() => {
  const value = text('bucket')
  return value === 'overdue' || value === 'due_30' || value === 'due_90' ? value : undefined
})
const renewals = useRaRenewals(computed(() => ({
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
const register = useRaRegister(computed(() => ({
  ...filters.value,
  page: page.value,
  per_page: perPage.value,
})))
/** The List's Sub directorate: the location's (a branch's region is its Sub Directorate). */
function subDirectorateOf(row: RaMonitorLocation) {
  return row.location.sub_directorate || (row.location.kind === 'branch' ? row.location.region : null) || null
}

/** The List's Group / Area: the location's Group (a branch's area). */
function groupOf(row: RaMonitorLocation) {
  return row.location.org_group || row.location.area || null
}

/** List > RA(s): every RA of the location, as SCCA's SCCA(s). */
function openHistory(row: RaMonitorLocation) {
  historyDialog.open({ row, kind: ra.value.kind })
}
const bottlenecks = useRaBottlenecks(computed(() => ({
  ...filters.value,
  page: page.value,
  per_page: perPage.value,
})))
const stepAverages = useRaBottlenecksStepAverages(filters)

const places = computed(() => ra.value.location.lowerPlural)
const cards = computed(() => {
  const value = overview.data.value?.cards
  return [
    { key: 'stuck_approvals', label: 'Stuck approvals', hint: 'Waiting past the escalation threshold', icon: 'i-lucide-siren', value: value?.stuck_approvals ?? 0, to: { tab: 'bottlenecks' }, tone: 'error' },
    { key: 'overdue_renewals', label: 'Overdue renewals', hint: 'RA past its renewal date', icon: 'i-lucide-circle-alert', value: value?.overdue_renewals, to: { tab: 'renewals' }, tone: 'error' },
    { key: 'due_in_90_days', label: 'Due in 90 days', hint: 'Renewals coming up', icon: 'i-lucide-calendar-clock', value: value?.due_in_90_days, to: { tab: 'renewals' }, tone: 'warning' },
    { key: 'assessed', label: `${ra.value.location.plural} assessed`, hint: 'With a final RA', icon: 'i-lucide-shield-check', value: value?.assessed, to: { tab: 'register', state: 'approved' }, tone: 'neutral' },
    { key: 'not_assessed', label: 'No final RA yet', hint: `Active ${places.value} without a final RA`, icon: 'i-lucide-circle-dashed', value: value?.not_assessed, to: { tab: 'register', state: 'none' }, tone: 'warning' },
    { key: 'in_signoff', label: 'In approval', hint: 'RAs waiting for their signers', icon: 'i-lucide-hourglass', value: value?.in_signoff, to: { tab: 'bottlenecks' }, tone: 'neutral' },
    { key: 'drafts', label: 'Drafts', hint: 'RAs being worked on', icon: 'i-lucide-file-pen', value: value?.drafts, to: { tab: 'register', state: 'draft' }, tone: 'neutral' },
    { key: 'need_revision', label: 'Need revision', hint: 'Returned, not accepted yet', icon: 'i-lucide-undo-2', value: value?.need_revision, to: { tab: 'register', state: 'need_revision' }, tone: 'error' },
    { key: 'in_revision', label: 'In revision', hint: 'Accepted, being changed', icon: 'i-lucide-pencil-line', value: value?.in_revision, to: { tab: 'register', state: 'in_revision' }, tone: 'warning' },
  ] as const
})

function cardLink(target: Record<string, string>) {
  return { query: { ...route.query, ...target, page: undefined } }
}

const levelBars = computed(() =>
  (overview.data.value?.by_level ?? []).map((row) => ({
    label: row.level === 'none' ? 'Not rated' : raRiskLevel[row.level].label,
    value: row.locations,
  })),
)
const monthPoints = computed(() =>
  (overview.data.value?.approved_per_month ?? []).map((row) => ({ month: row.month, value: row.assessments })),
)

const stepRows = computed(() => (stepAverages.data.value?.items ?? []).filter((row) => row.approvals > 0 && row.average_working_days !== null))
/** A step by its short name ("LIC"), else its title. */
function stepShort(row: RaStepAverage) {
  return row.step_short || row.step_title || stepLabel(row.step)
}
const stepBars = computed(() =>
  stepRows.value.map((row) => ({ label: stepShort(row), value: row.average_working_days ?? 0 })),
)

function plural(count: number, one: string, many = `${one}s`) {
  return `${formatNumber(count, 0)} ${count === 1 ? one : many}`
}

const levelSummary = computed(() => {
  const total = levelBars.value.reduce((sum, row) => sum + row.value, 0)
  const high = overview.data.value?.cards.high_residual ?? 0
  return total
    ? `${plural(total, ra.value.location.lower, ra.value.location.lowerPlural)} with a final RA; ${formatNumber(high, 0)} with a High residual risk.`
    : ''
})
const monthSummary = computed(() => {
  const total = monthPoints.value.reduce((sum, row) => sum + row.value, 0)
  const top = [...monthPoints.value].sort((a, b) => b.value - a.value)[0]
  return top && total ? `${plural(total, 'RA')} approved in the last 12 months. The most in ${formatMonth(top.month)} (${formatNumber(top.value, 0)}).` : ''
})
const stepSummary = computed(() => {
  const slowest = [...stepRows.value].sort((a, b) => (b.average_working_days ?? 0) - (a.average_working_days ?? 0))[0]
  const approvals = stepRows.value.reduce((sum, row) => sum + row.approvals, 0)
  return slowest ? `Slowest step: ${stepShort(slowest)}, ${formatNumber(slowest.average_working_days, 1)} working days on average, over ${plural(approvals, 'approval')}.` : ''
})

function refLabel(ref: { id: number, ref_no: string | null } | null) {
  return ref ? ref.ref_no ?? `#${ref.id}` : '—'
}

function daysLeft(row: RaMonitorLocation) {
  if (row.days_left === null) return ''
  if (row.days_left < 0) return `${-row.days_left} days overdue`
  if (row.days_left === 0) return 'Due today'
  return `${row.days_left} days left`
}

/** As SCCA's Renewals: the row picks for Generate annual review, then the columns, then Act. */
const renewalColumns = computed<TableColumn<RaMonitorLocation>[]>(() => [
  { id: 'select', header: '', meta: { class: { th: 'w-0', td: 'w-0' } } },
  { id: 'location', header: locationColumn.value },
  { id: 'code', header: `${locationColumn.value} ID` },
  { id: 'level', header: 'Highest residual', meta: RA_STATUS_COLUMN },
  { id: 'approved', header: 'Last final RA' },
  { id: 'approved_date', header: 'Last final RA date' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { accessorKey: 'days_left', header: 'Due' },
  { id: 'assessor', header: 'Assessor' },
  { id: 'licom', header: 'LICOM' },
  { id: 'renewal', header: 'Renewal' },
  { id: 'actions', header: '' },
])

// --- Renewals: Act menu and Generate annual review (one row or the selected rows) ------------

const selected = ref<Set<number>>(new Set())
const renewalRows = computed(() => renewals.data.value?.items ?? [])
const selectable = computed(() => renewalRows.value.filter((row) => row.can_generate))
const selectedRows = computed(() => selectable.value.filter((row) => selected.value.has(row.location.id)))
// A new page or filter starts with nothing selected.
watch(renewalRows, () => (selected.value = new Set()))
const allSelected = computed<boolean | 'indeterminate'>({
  get: () => {
    if (!selectable.value.length || !selectedRows.value.length) return false
    return selectedRows.value.length === selectable.value.length ? true : 'indeterminate'
  },
  set: (value) => (selected.value = new Set(value ? selectable.value.map((row) => row.location.id) : [])),
})
function toggle(row: RaMonitorLocation, value: boolean | 'indeterminate') {
  const next = new Set(selected.value)
  if (value === true) next.add(row.location.id)
  else next.delete(row.location.id)
  selected.value = next
}

function announce(result: RaGenerateResult) {
  const created = result.created.length
  const skipped = result.skipped.length + result.refused.length
  const why = [...result.skipped, ...result.refused].map((row) => `${row.location ?? row.ref_no ?? `#${row.id}`}: ${row.reason}`)
  toast.add({
    title: `Created ${created}, skipped ${skipped}`,
    description: why.length
      ? why.slice(0, 3).join(' · ') + (why.length > 3 ? ` · and ${why.length - 3} more` : '')
      : `${plural(created, 'draft')} waiting in Manage, with you as the assessor and LIC.`,
    color: created ? 'success' : 'warning',
    icon: created ? 'i-lucide-circle-check' : 'i-lucide-circle-alert',
    actions: created
      ? [{
          label: 'Open in Manage',
          color: 'neutral',
          variant: 'outline',
          onClick: () => {
            navigateTo(created === 1 ? raPath(ra.value.kind, 'manage', result.created[0]!.id) : raPath(ra.value.kind, 'manage'))
          },
        }]
      : undefined,
  })
}

/** One draft per location, copying its last final RA. The user becomes assessor and LIC and
 *  picks the LICOM (RaGenerateDialog). */
async function generate(rows: RaMonitorLocation[]) {
  if (!rows.length) return
  const result = await generateDialog.open({
    rows,
    levels: renewals.data.value?.contributor_levels ?? ['D-2'],
    kind: ra.value.kind,
    noun: ra.value.location.lower,
  }).result
  if (!result) return
  announce(result)
  selected.value = new Set()
  await Promise.all([renewals.refresh(), overview.refresh()])
}

function renewalActions(row: RaMonitorLocation): DropdownMenuItem[] {
  return [
    {
      label: 'Open last final',
      icon: 'i-lucide-file-check',
      disabled: !openable(row.approved),
      to: openable(row.approved) ? record(row.approved!.id) : undefined,
    },
    {
      label: 'Open renewal',
      icon: 'i-lucide-file-pen',
      disabled: !openable(row.open),
      to: row.open && openable(row.open) ? record(row.open.id) : undefined,
    },
    {
      label: 'Generate annual review',
      icon: 'i-lucide-file-plus-2',
      disabled: !row.can_generate,
      onSelect: () => generate([row]),
    },
  ]
}

/** The step's title ("Prepared by Location Incident Coordinator (LIC)"), like SCCA shows it;
 *  the rows carry the title from their own configuration version. */
function stepLabel(role: string, title?: string | null) {
  return title || raStepTitle(role, ra.value.signoffRoles)
}

const locationColumn = computed(() => ra.value.location.single)
/** Like SCCA's List: one row per building, judged by its last final (approved) RA, with its
 *  organization; the checkboxes pick buildings for the Excel export. */
const registerColumns = computed<TableColumn<RaMonitorLocation>[]>(() => [
  { id: 'select', header: '', meta: { class: { th: 'w-0', td: 'w-0' } } },
  { id: 'location', header: locationColumn.value },
  { id: 'code', header: `${locationColumn.value} ID` },
  { id: 'directorate', header: 'Directorate' },
  { id: 'sub_directorate', header: 'Sub directorate' },
  { id: 'group', header: 'Group / Area' },
  { id: 'level', header: 'Highest residual', meta: RA_STATUS_COLUMN },
  { id: 'approved', header: 'Last final RA' },
  { id: 'approved_date', header: 'Last final RA date' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { id: 'open', header: 'Open RA', meta: RA_STATUS_COLUMN },
  { id: 'open_step', header: 'Waiting for' },
  { id: 'assessor', header: 'Assessor' },
  { id: 'licom', header: 'LICOM' },
  { accessorKey: 'assessment_count', header: 'RA(s)' },
])

/** Buildings ticked for the Excel export, kept across pages and filters until cleared. */
const picked = ref<Map<number, string>>(new Map())
const pickedIds = computed(() => [...picked.value.keys()])
const pageRows = computed(() => register.data.value?.items ?? [])
const pageState = computed<boolean | 'indeterminate'>(() => {
  const ticked = pageRows.value.filter((row) => picked.value.has(row.location.id)).length
  if (!ticked) return false
  return ticked === pageRows.value.length ? true : 'indeterminate'
})
function pick(row: RaMonitorLocation, value: boolean | 'indeterminate') {
  const next = new Map(picked.value)
  if (value === true) next.set(row.location.id, row.location.name)
  else next.delete(row.location.id)
  picked.value = next
}
function pickPage(value: boolean | 'indeterminate') {
  const next = new Map(picked.value)
  for (const row of pageRows.value) {
    if (value === true) next.set(row.location.id, row.location.name)
    else next.delete(row.location.id)
  }
  picked.value = next
}
function clearPicked() {
  picked.value = new Map()
}

/** The building's name opens its last final RA, else the open one, else the newest (as SCCA). */
function registerRecord(row: RaMonitorLocation) {
  return row.approved ?? row.open ?? row.history?.[0] ?? null
}
/** As SCCA's Approval tab. */
const bottleneckColumns = computed<TableColumn<RaSignoffWaiting>[]>(() => [
  { id: 'assessment', header: locationColumn.value },
  { accessorKey: 'ref_no', header: 'RA ref. no.' },
  { accessorKey: 'step', header: 'Current step' },
  { id: 'signer', header: 'Signer' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
  { accessorKey: 'reminders_sent', header: 'Reminders' },
  { accessorKey: 'escalated_at', header: 'Escalated on' },
  { accessorKey: 'working_days_in_signoff', header: 'In approval' },
])

const tabs = [
  { label: 'Overview', value: 'overview', icon: 'i-lucide-layout-dashboard', slot: 'overview' as const },
  { label: 'Renewals', value: 'renewals', icon: 'i-lucide-calendar-clock', slot: 'renewals' as const },
  { label: 'List', value: 'register', icon: 'i-lucide-list', slot: 'register' as const },
  { label: 'Approval', value: 'bottlenecks', icon: 'i-lucide-hourglass', slot: 'bottlenecks' as const },
]

function pageTo(next: number) {
  return { query: { ...route.query, page: next > 1 ? next : undefined } }
}

/** The user may open the RA (the API's can_open): a link, else plain text. */
function openable(ref: { can_open?: boolean } | null | undefined) {
  return !!ref && ref.can_open !== false
}

function record(id: number) {
  return raPath(ra.value.kind, 'monitoring', id)
}
</script>

<template>
  <AppPage
    :title="`${ra.title} monitoring`"
    icon="i-lucide-chart-column"
    :description="`Every ${ra.location.lower}'s residual risk, renewals due and sign-offs that are waiting.`"
    :crumbs="[{ label: ra.title }, { label: 'Monitoring' }]"
  >
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- As SCCA: search, then state → level → reason → region → dates (ListFilterBar). -->
      <ListFilterBar
        :filtered="filtered"
        :bordered="false"
        @clear="clearFilters"
      >
        <template #search>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="ra.hasRegion ? 'Branch, ID, region or address' : 'Building, ID or address'"
            :aria-label="`Search ${ra.location.lowerPlural}`"
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
          v-model="level"
          value-key="value"
          :items="levelItems"
          :search-input="false"
          class="w-48"
          aria-label="Highest residual level"
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
          v-if="ra.hasRegion"
          v-model="region"
          value-key="value"
          :items="regionItems"
          class="w-48"
          aria-label="Region"
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
          aria-label="Group / Area"
        />
        <USelectMenu
          v-model="division"
          value-key="value"
          :items="divisionItems"
          class="w-52"
          aria-label="Division"
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
          <UAlert
            v-if="overview.error.value"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="Could not load the overview"
            :description="apiErrorMessage(overview.error.value)"
          >
            <template #actions>
              <UButton
                color="neutral"
                variant="outline"
                label="Try again"
                @click="overview.refresh()"
              />
            </template>
          </UAlert>
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
              :title="`${ra.location.plural} by highest residual risk`"
              :measure="ra.location.plural"
              :height="260"
              :items="levelBars"
              :summary="levelSummary"
              :loading="overview.status.value === 'pending' && !overview.data.value"
              :empty="levelSummary ? null : `No ${ra.location.lower} has a final RA yet for these filters.`"
            />
            <SccaLineChart
              title="RAs approved per month"
              measure="RAs approved"
              :points="monthPoints"
              :summary="monthSummary"
              :loading="overview.status.value === 'pending' && !overview.data.value"
              :empty="monthSummary ? null : 'No RA was approved in the last 12 months.'"
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
              {{ bucket ? `${raRenewalBucket[bucket].label}, soonest first.` : 'Overdue and due within 90 days, soonest first.' }}
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="selectable.length"
                icon="i-lucide-file-plus-2"
                :label="`Generate annual review (${selectedRows.length})`"
                :disabled="!selectedRows.length"
                @click="generate(selectedRows)"
              />
              <UButton
                :to="raExportUrl('renewals', filters)"
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
                :model-value="selected.has(row.original.location.id)"
                :disabled="!row.original.can_generate"
                :aria-label="`Select ${row.original.location.name}`"
                @update:model-value="toggle(row.original, $event)"
              />
            </template>
            <template #location-cell="{ row }">
              <NuxtLink
                v-if="openable(row.original.approved)"
                :to="record(row.original.approved!.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.location.name }}
              </NuxtLink>
              <span
                v-else
                class="font-medium text-highlighted"
              >{{ row.original.location.name }}</span>
              <p
                v-if="row.original.location.directorate"
                class="text-xs text-muted"
              >
                {{ row.original.location.directorate }}
              </p>
            </template>
            <template #code-cell="{ row }">
              <span class="font-mono text-xs">{{ row.original.location.code || '—' }}</span>
            </template>
            <template #approved-cell="{ row }">
              <span class="font-mono text-xs">{{ refLabel(row.original.approved) }}</span>
            </template>
            <template #approved_date-cell="{ row }">
              {{ formatDate(row.original.approved?.approved_at) || '—' }}
            </template>
            <template #licom-cell="{ row }">
              <p class="max-w-56 truncate">
                {{ row.original.licom || '—' }}
              </p>
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
                  :aria-label="`Act on ${row.original.location.name}`"
                />
              </UDropdownMenu>
            </template>
            <template #level-cell="{ row }">
              <StatusBadge
                v-if="row.original.approved?.highest_residual_level"
                :scale="raRiskLevel"
                :value="row.original.approved.highest_residual_level"
                size="sm"
              />
              <span
                v-else
                class="text-muted"
              >Not rated</span>
            </template>
            <template #renewal_date-cell="{ row }">
              {{ formatDate(row.original.renewal_date) }}
            </template>
            <template #days_left-cell="{ row }">
              <StatusBadge
                v-if="row.original.bucket"
                :scale="raRenewalBucket"
                :value="row.original.bucket"
                size="sm"
              />
              <p class="mt-1 text-xs text-muted">
                {{ daysLeft(row.original) }}
              </p>
            </template>
            <template #assessor-cell="{ row }">
              <p class="max-w-56 truncate">
                {{ row.original.assessor || '—' }}
              </p>
            </template>
            <template #renewal-cell="{ row }">
              <NuxtLink
                v-if="row.original.open && openable(row.original.open)"
                :to="record(row.original.open.id)"
                class="hover:underline"
              >
                <StatusBadge
                  :scale="raStatus"
                  :value="raStatusKey(row.original.open)"
                  size="sm"
                />
                <span class="ms-1 font-mono text-xs">{{ refLabel(row.original.open) }}</span>
              </NuxtLink>
              <span v-else-if="row.original.open">
                <StatusBadge
                  :scale="raStatus"
                  :value="raStatusKey(row.original.open)"
                  size="sm"
                />
                <span class="ms-1 font-mono text-xs">{{ refLabel(row.original.open) }}</span>
              </span>
              <span
                v-else
                class="text-muted"
              >Not started</span>
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
              {{ plural(register.data.value?.total ?? 0, ra.location.lower, ra.location.lowerPlural) }}<template v-if="pickedIds.length">
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
              <!-- Every RA of each building (one row per RA): the ticked ones, else all that match. -->
              <UButton
                :to="raExportUrl('register', filters, pickedIds)"
                external
                download
                color="neutral"
                variant="outline"
                icon="i-lucide-file-spreadsheet"
                :label="pickedIds.length ? `Export ${pickedIds.length} selected to Excel` : 'Export to Excel'"
              />
            </div>
          </div>
          <UTable
            :data="register.data.value?.items ?? []"
            :columns="registerColumns"
            :get-row-id="(row: RaMonitorLocation) => String(row.location.id)"
            :loading="register.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #select-header>
              <UCheckbox
                :model-value="pageState"
                :aria-label="`Select every ${ra.location.lower} on this page for the Excel export`"
                @update:model-value="pickPage"
              />
            </template>
            <template #select-cell="{ row }">
              <UCheckbox
                :model-value="picked.has(row.original.location.id)"
                :aria-label="`Select ${row.original.location.name} for the Excel export`"
                @update:model-value="(value: boolean | 'indeterminate') => pick(row.original, value)"
              />
            </template>
            <template #location-cell="{ row }">
              <NuxtLink
                v-if="openable(registerRecord(row.original))"
                :to="record(registerRecord(row.original)!.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.location.name }}
              </NuxtLink>
              <span
                v-else
                class="font-medium text-highlighted"
              >{{ row.original.location.name }}</span>
              <p
                v-if="row.original.location.region"
                class="text-xs text-muted"
              >
                {{ row.original.location.region }}
              </p>
            </template>
            <template #code-cell="{ row }">
              <span class="font-mono text-xs">{{ row.original.location.code || '—' }}</span>
            </template>
            <template #directorate-cell="{ row }">
              <span :class="row.original.location.directorate ? '' : 'text-muted'">{{ row.original.location.directorate || '—' }}</span>
            </template>
            <template #sub_directorate-cell="{ row }">
              <span :class="subDirectorateOf(row.original) ? '' : 'text-muted'">{{ subDirectorateOf(row.original) || '—' }}</span>
            </template>
            <!-- The location's Group, as the user master names it; a branch's is its area. -->
            <template #group-cell="{ row }">
              <span :class="groupOf(row.original) ? '' : 'text-muted'">{{ groupOf(row.original) || '—' }}</span>
            </template>
            <template #approved_date-cell="{ row }">
              {{ formatDate(row.original.approved?.approved_at) || '—' }}
            </template>
            <template #licom-cell="{ row }">
              <p class="max-w-56 truncate">
                {{ row.original.licom || '—' }}
              </p>
            </template>
            <template #level-cell="{ row }">
              <StatusBadge
                v-if="row.original.approved?.highest_residual_level"
                :scale="raRiskLevel"
                :value="row.original.approved.highest_residual_level"
                size="sm"
              />
              <span
                v-else
                class="text-muted"
              >{{ row.original.approved ? 'Not rated' : 'Not final yet' }}</span>
            </template>
            <template #approved-cell="{ row }">
              <template v-if="row.original.approved">
                <span class="font-mono text-xs">{{ refLabel(row.original.approved) }}</span>
                <p
                  v-if="row.original.approved.reason"
                  class="text-xs text-muted"
                >
                  {{ raReasonLabel(row.original.approved.reason) }}
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
            <!-- The open RA's status and, apart, whose step it waits for. -->
            <template #open-cell="{ row }">
              <NuxtLink
                v-if="row.original.open && openable(row.original.open)"
                :to="record(row.original.open.id)"
                class="inline-block hover:underline"
                :aria-label="`${refLabel(row.original.open)}: ${raStatus[raStatusKey(row.original.open)].label}`"
              >
                <StatusBadge
                  :scale="raStatus"
                  :value="raStatusKey(row.original.open)"
                  size="sm"
                />
              </NuxtLink>
              <StatusBadge
                v-else-if="row.original.open"
                :scale="raStatus"
                :value="raStatusKey(row.original.open)"
                size="sm"
              />
              <span
                v-else
                class="text-muted"
              >—</span>
            </template>
            <template #open_step-cell="{ row }">
              <span
                v-if="row.original.open?.status === 'in_signoff' && row.original.open.current_signoff_role"
                class="text-sm"
              >
                {{ stepLabel(row.original.open.current_signoff_role, row.original.open.current_step_title) }}
              </span>
              <span
                v-else
                class="text-muted"
              >—</span>
            </template>
            <template #assessment_count-cell="{ row }">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                trailing-icon="i-lucide-history"
                :label="String(row.original.assessment_count)"
                :disabled="!row.original.assessment_count"
                :aria-label="`RA history of ${row.original.location.name}`"
                @click="openHistory(row.original)"
              />
            </template>
            <template #assessor-cell="{ row }">
              <p class="max-w-56 truncate">
                {{ row.original.assessor || '—' }}
              </p>
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                No {{ ra.location.lower }} matches these filters.
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
                RAs in approval, the longest-waiting step first. Waiting is in working days (Monday to Friday) since the submission or the last approval.
              </p>
              <UButton
                :to="raExportUrl('bottlenecks', filters)"
                external
                download
                color="neutral"
                variant="outline"
                icon="i-lucide-file-spreadsheet"
                label="Export to Excel"
              />
            </div>
            <UTable
              :data="bottlenecks.data.value?.items ?? []"
              :columns="bottleneckColumns"
              :loading="bottlenecks.status.value === 'pending'"
              :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
            >
              <template #assessment-cell="{ row }">
                <NuxtLink
                  v-if="openable(row.original)"
                  :to="record(row.original.id)"
                  class="font-medium text-primary hover:underline"
                >
                  {{ row.original.location.name }}
                </NuxtLink>
                <span
                  v-else
                  class="font-medium text-highlighted"
                >{{ row.original.location.name }}</span>
              </template>
              <template #ref_no-cell="{ row }">
                <span class="font-mono text-xs">{{ refLabel(row.original) }}</span>
              </template>
              <template #step-cell="{ row }">
                {{ stepLabel(row.original.step, row.original.step_title) }}
              </template>
              <template #signer-cell="{ row }">
                {{ row.original.signer?.name ?? '—' }}
                <p
                  v-if="row.original.signer?.job_title"
                  class="text-xs text-muted"
                >
                  {{ row.original.signer.job_title }}
                </p>
              </template>
              <template #working_days_waiting-cell="{ row }">
                <span :class="row.original.working_days_waiting >= 5 ? 'font-medium text-warning' : ''">{{ raWaiting(row.original.working_days_waiting) }}</span>
              </template>
              <template #reminders_sent-cell="{ row }">
                <span class="tabular-nums">{{ row.original.reminders_sent }}</span>
              </template>
              <template #escalated_at-cell="{ row }">
                <span v-if="row.original.escalated_at">{{ formatDate(row.original.escalated_at) }}</span>
                <StatusBadge
                  v-else-if="row.original.level !== 'ok'"
                  :scale="raWaitLevel"
                  :value="row.original.level"
                  size="sm"
                />
                <span
                  v-else
                  class="text-muted"
                >—</span>
              </template>
              <template #working_days_in_signoff-cell="{ row }">
                {{ raWaiting(row.original.working_days_in_signoff) }}
              </template>
              <template #empty>
                <p class="py-6 text-center text-sm text-muted">
                  No RA is in approval.
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
