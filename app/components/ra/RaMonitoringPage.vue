<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { parseDate, today as todayIn, type CalendarDate } from '@internationalized/date'
import type { RaMonitorLocation, RaMonitoringFilters, RaRenewalBucket, RaSignoffWaiting } from '~/composables/useRa'
/**
 * RA (or RA Branch) Monitoring, as SCCA Monitoring: KPI cards and charts, renewals due, the
 * register of every location with its RA in force, and RAs waiting in sign-off. Read-only;
 * a row opens the assessment in Monitoring.
 */
const ra = useRaModule()
const route = useRoute()
const router = useRouter()

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
const STATES = ['approved', 'draft', 'in_signoff', 'none'] as const

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

// RA uses region filter instead of department filter

const search = ref(filters.value.q ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (value.trim() !== (filters.value.q ?? '')) setQuery({ q: value.trim() || undefined })
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const filtered = computed(() => Boolean(filters.value.q || filters.value.region || filters.value.level || filters.value.state || filters.value.reason || filters.value.from || filters.value.to))
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
/** List: buildings whose RAs are shown under their row ("Show in the table" in RA(s)). */
const expanded = ref<Record<string, boolean>>({})
function toggleRow(row: RaMonitorLocation, open: boolean) {
  const id = String(row.location.id)
  const others = Object.fromEntries(Object.entries(expanded.value).filter(([key]) => key !== id))
  expanded.value = open ? { ...others, [id]: true } : others
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
const stepBars = computed(() =>
  stepRows.value.map((row) => ({ label: row.step_title || stepLabel(row.step), value: row.average_working_days ?? 0 })),
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
  return slowest ? `Slowest step: ${slowest.step_title || stepLabel(slowest.step)}, ${formatNumber(slowest.average_working_days, 1)} working days on average, over ${plural(approvals, 'approval')}.` : ''
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

const renewalColumns = computed<TableColumn<RaMonitorLocation>[]>(() => [
  { id: 'location', header: locationColumn.value },
  { id: 'level', header: 'Highest residual' },
  { id: 'approved', header: 'Last final RA' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { accessorKey: 'days_left', header: 'Due' },
  { id: 'assessor', header: 'Assessor' },
  { id: 'renewal', header: 'Renewal' },
])

/** Who signs the step ("Location Incident Coordinator (LIC)"), like SCCA shows it; the rows
 *  carry the title from their own configuration version. */
function stepLabel(role: string, title?: string | null) {
  return title || raStepTitle(role, ra.value.signoffRoles)
}

const locationColumn = computed(() => ra.value.location.single)
/** Like SCCA's Register: one row per building, judged by its last final (approved) RA. */
const registerColumns = computed<TableColumn<RaMonitorLocation>[]>(() => [
  { id: 'select', header: '', meta: { class: { th: 'w-0', td: 'w-0' } } },
  { id: 'location', header: locationColumn.value },
  { id: 'level', header: 'Highest residual' },
  { id: 'approved', header: 'Last final RA' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { id: 'open', header: 'Open RA', meta: RA_STATUS_COLUMN },
  { id: 'open_step', header: 'Waiting for' },
  { id: 'assessor', header: 'Assessor' },
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
const bottleneckColumns = computed<TableColumn<RaSignoffWaiting>[]>(() => [
  { id: 'assessment', header: 'RA' },
  { accessorKey: 'step', header: 'Current step' },
  { id: 'signer', header: 'Signer' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
  { accessorKey: 'reminders_sent', header: 'Reminders' },
  { accessorKey: 'escalated_at', header: 'Escalated' },
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

function record(id: number) {
  return raPath(ra.value.kind, 'monitoring', id)
}
</script>

<template>
  <AppPage
    :title="`${ra.title} monitoring`"
    icon="i-lucide-chart-column"
    :description="`Every ${ra.location.lower}'s residual risk, renewals due and sign-offs that are waiting. Read-only.`"
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
          <UTable
            :data="renewals.data.value?.items ?? []"
            :columns="renewalColumns"
            :loading="renewals.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #location-cell="{ row }">
              <NuxtLink
                :to="record(row.original.approved!.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.location.name }}
              </NuxtLink>
              <p
                v-if="raLocationLine(row.original.location)"
                class="text-xs text-muted"
              >
                {{ raLocationLine(row.original.location) }}
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
                v-if="row.original.open"
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
            v-model:expanded="expanded"
            :data="register.data.value?.items ?? []"
            :columns="registerColumns"
            :get-row-id="(row: RaMonitorLocation) => String(row.location.id)"
            :loading="register.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #expanded="{ row }">
              <RaLocationAssessments
                :location="row.original.location"
                @hide="toggleRow(row.original, false)"
              />
            </template>
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
                v-if="registerRecord(row.original)"
                :to="record(registerRecord(row.original)!.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.location.name }}
              </NuxtLink>
              <span
                v-else
                class="font-medium text-highlighted"
              >{{ row.original.location.name }}</span>
              <p class="text-xs text-muted">
                {{ raLocationLine(row.original.location) || '—' }}
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
                <p class="text-xs text-muted">
                  {{ formatDate(row.original.approved.approved_at) || formatDate(row.original.approved.assessment_date) || '—' }}
                </p>
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
                v-if="row.original.open"
                :to="record(row.original.open.id)"
                class="inline-block hover:underline"
                :aria-label="`${refLabel(row.original.open)}: ${raStatus[row.original.open.status].label}`"
              >
                <StatusBadge
                  :scale="raStatus"
                  :value="raStatusKey(row.original.open)"
                  size="sm"
                />
              </NuxtLink>
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
              <UPopover :content="{ align: 'end' }">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  trailing-icon="i-lucide-chevron-down"
                  :label="String(row.original.assessment_count)"
                  :aria-label="`RA history of ${row.original.location.name}`"
                />
                <template #content>
                  <div class="border-b border-default p-2">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      block
                      :icon="expanded[String(row.original.location.id)] ? 'i-lucide-chevron-up' : 'i-lucide-table-properties'"
                      :label="expanded[String(row.original.location.id)] ? 'Hide from the table' : 'Show in the table'"
                      @click="toggleRow(row.original, !expanded[String(row.original.location.id)])"
                    />
                  </div>
                  <ul class="w-72 divide-y divide-default text-sm">
                    <li
                      v-for="item in row.original.history"
                      :key="item.id"
                    >
                      <NuxtLink
                        :to="record(item.id)"
                        class="flex items-center justify-between gap-2 px-3 py-2 hover:bg-elevated/50"
                      >
                        <span>
                          <span class="font-mono text-xs">{{ refLabel(item) }}</span>
                          <span class="block text-xs text-muted">{{ formatDate(item.assessment_date) || '—' }}</span>
                        </span>
                        <StatusBadge
                          :scale="raStatus"
                          :value="raStatusKey(item)"
                          size="sm"
                        />
                      </NuxtLink>
                    </li>
                  </ul>
                </template>
              </UPopover>
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
                  :to="record(row.original.id)"
                  class="font-medium text-primary hover:underline"
                >
                  {{ row.original.location.name }}
                </NuxtLink>
                <p class="font-mono text-xs text-muted">
                  {{ refLabel(row.original) }}
                </p>
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
                {{ row.original.reminders_sent }}
                <p
                  v-if="row.original.escalated_at"
                  class="text-xs text-error"
                >
                  Escalated {{ formatDate(row.original.escalated_at) }}
                </p>
              </template>
              <template #escalated_at-cell="{ row }">
                <StatusBadge
                  v-if="row.original.level !== 'ok'"
                  :scale="raWaitLevel"
                  :value="row.original.level"
                  size="sm"
                />
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
