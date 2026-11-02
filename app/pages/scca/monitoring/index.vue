<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { parseDate, type CalendarDate } from '@internationalized/date'
import type {
  SccaBottleneckRow,
  SccaGenerateResult,
  SccaMonitorRef,
  SccaMonitoringFilters,
  SccaRegisterRow,
  SccaRenewalRow,
} from '~/composables/useSccaWorkflow'
import SccaGenerateDialog from '~/components/scca/SccaGenerateDialog.vue'
import SccaHistoryDialog from '~/components/scca/SccaHistoryDialog.vue'

definePageMeta({ permission: 'scca.access' })

const route = useRoute()
const router = useRouter()
const { can } = useAuth()
const toast = useToast()
const generateDialog = useOverlay().create(SccaGenerateDialog)
const historyDialog = useOverlay().create(SccaHistoryDialog)
/** With scca.monitor (BCM, management) every SCCA; otherwise the user's own. */
const everyone = computed(() => can('scca.monitor') || can('scca.view_all'))

const TABS = ['overview', 'renewals', 'register', 'bottlenecks'] as const
type MonitorTab = (typeof TABS)[number]
// docs/design-system.md > Tables: 10, 20 (default), 50 or 100 rows, kept in the URL.
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

const filters = computed<SccaMonitoringFilters>(() => ({
  from: text('from'),
  to: text('to'),
  category: text('category'),
  status: SCCA_STATUSES.includes(text('status') as SccaStatus) ? text('status') as SccaStatus : undefined,
  department: text('department'),
  directorate: text('directorate'),
  sub_directorate: text('sub_directorate'),
  division: text('division'),
  q: text('q'),
}))
const paged = computed(() => ({ ...filters.value, page: Math.max(1, Number(route.query.page) || 1), per_page: perPage.value }))

function setQuery(patch: Record<string, string | undefined>) {
  router.replace({ query: { ...route.query, ...patch, page: undefined } })
}

const today = new Date()
const iso = (date: Date) => date.toISOString().slice(0, 10)
const period = computed<Period>({
  get: () => {
    const { from, to } = filters.value
    if (!from && !to) return 'all'
    if (from === `${today.getFullYear()}-01-01` && !to) return 'year'
    const year = new Date(today)
    year.setFullYear(year.getFullYear() - 1)
    if (from === iso(year) && !to) return '12m'
    return 'custom'
  },
  set: (value) => {
    if (value === 'all') return setQuery({ from: undefined, to: undefined })
    if (value === 'year') return setQuery({ from: `${today.getFullYear()}-01-01`, to: undefined })
    if (value === '12m') {
      const year = new Date(today)
      year.setFullYear(year.getFullYear() - 1)
      return setQuery({ from: iso(year), to: undefined })
    }
    setQuery({ from: filters.value.from ?? `${today.getFullYear()}-01-01`, to: filters.value.to ?? iso(today) })
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

const categories = computed<SccaCategory[]>({
  get: () => (filters.value.category?.split(',').filter((value) => SCCA_CATEGORIES.includes(value as SccaCategory)) ?? []) as SccaCategory[],
  set: (value) => setQuery({ category: value.length ? value.join(',') : undefined }),
})
const categoryItems = SCCA_CATEGORIES.map((category) => ({ label: sccaCategory[category].label, value: category }))

const status = computed<SccaStatus | 'any'>({
  get: () => filters.value.status ?? 'any',
  set: (value) => setQuery({ status: value === 'any' ? undefined : value }),
})
const statusItems = [
  { label: 'Any state', value: 'any' as const },
  { label: 'Has a final SCCA', value: 'final' as const },
  { label: 'Draft open', value: 'draft' as const },
  { label: 'In approval', value: 'in_approval' as const },
]

// The application owner's Directorate / Sub Directorate / Division / Department (HR fields).
const { data: orgData } = useSccaOrgValues()
type OrgField = 'directorate' | 'sub_directorate' | 'division' | 'department'
function orgFilter(field: OrgField) {
  return computed<string>({
    get: () => filters.value[field] ?? 'all',
    set: (value) => setQuery({ [field]: value === 'all' ? undefined : value }),
  })
}
const directorate = orgFilter('directorate')
const subDirectorate = orgFilter('sub_directorate')
const division = orgFilter('division')
const department = orgFilter('department')
function orgItems(all: string, values: string[] | undefined) {
  return [{ label: all, value: 'all' }, ...(values ?? []).map((name) => ({ label: name, value: name }))]
}
const directorateItems = computed(() => orgItems('All directorates', orgData.value?.directorates))
const subDirectorateItems = computed(() => orgItems('All sub directorates', orgData.value?.sub_directorates))
const divisionItems = computed(() => orgItems('All divisions', orgData.value?.divisions))
const departmentItems = computed(() => orgItems('All departments', orgData.value?.departments))

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
  return Boolean(value.from || value.to || value.category || value.status || value.department || value.directorate || value.sub_directorate || value.division || value.q)
})
function clearFilters() {
  search.value = ''
  router.replace({ query: { tab: route.query.tab } })
}

// --- data ------------------------------------------------------------------------------------

const overview = useSccaOverview(filters)
/** The renewal KPI card picked: the list shows only that bucket. */
const bucket = computed<SccaRenewalBucket | undefined>(() => {
  const value = text('bucket')
  return value === 'overdue' || value === 'due_30' || value === 'due_90' ? value : undefined
})
const renewals = useSccaRenewals(computed(() => ({ ...paged.value, bucket: bucket.value })))
const renewalCards = [
  { bucket: 'overdue' as const, label: 'Overdue', hint: 'Past the renewal date', icon: 'i-lucide-circle-alert', tone: 'error' as const },
  { bucket: 'due_30' as const, label: 'Due in 30 days', hint: 'Renewal date within 30 days', icon: 'i-lucide-calendar-clock', tone: 'warning' as const },
  { bucket: 'due_90' as const, label: 'Due in 31–90 days', hint: 'Renewal date in 31 to 90 days', icon: 'i-lucide-calendar', tone: 'info' as const },
]
const register = useSccaRegister(paged)
const bottlenecks = useSccaBottlenecks(paged)

const cards = computed(() => {
  const value = overview.data.value?.cards
  return [
    { key: 'applications_assessed', label: 'Applications assessed', hint: 'With a final SCCA', icon: 'i-lucide-shield-check', value: value?.applications_assessed, to: { tab: 'register', status: 'final' }, tone: 'neutral' },
    { key: 'in_approval', label: 'In approval', hint: 'SCCAs being signed off', icon: 'i-lucide-hourglass', value: value?.in_approval, to: { tab: 'bottlenecks' }, tone: 'neutral' },
    { key: 'drafts', label: 'Drafts', hint: 'Applications with a draft open', icon: 'i-lucide-file-pen', value: value?.drafts, to: { tab: 'register', status: 'draft' }, tone: 'neutral' },
    { key: 'overdue_renewals', label: 'Overdue renewals', hint: 'Past the 2-year renewal date', icon: 'i-lucide-circle-alert', value: value?.overdue_renewals, to: { tab: 'renewals' }, tone: 'error' },
    { key: 'due_in_90_days', label: 'Due in 90 days', hint: 'Renewals coming up', icon: 'i-lucide-calendar-clock', value: value?.due_in_90_days, to: { tab: 'renewals' }, tone: 'warning' },
    { key: 'stuck_approvals', label: 'Stuck approvals', hint: 'Waiting past the escalation threshold', icon: 'i-lucide-siren', value: value?.stuck_approvals, to: { tab: 'bottlenecks' }, tone: 'error' },
  ] as const
})

function cardLink(target: Record<string, string>) {
  return { query: { ...route.query, ...target, page: undefined } }
}

const categoryBars = computed(() =>
  (overview.data.value?.by_category ?? []).map((row) => ({ label: sccaCategory[row.category].label, value: row.applications })),
)
const monthPoints = computed(() =>
  (overview.data.value?.finalised_per_month ?? []).map((row) => ({ month: row.month, value: row.sccas })),
)
// Only steps that were approved in the period have an average; the rest have no data yet.
const stepRows = computed(() => (bottlenecks.data.value?.step_averages ?? []).filter((row) => row.approvals > 0 && row.average_working_days !== null))
const stepBars = computed(() =>
  stepRows.value.map((row) => ({ label: signoffRoleLabel(row.step, true), value: row.average_working_days ?? 0 })),
)

/** Same-day approvals average under a day: show them to two decimals. */
const stepDigits = computed(() => (stepRows.value.some((row) => (row.average_working_days ?? 0) >= 1) ? 1 : 2))

function plural(count: number, one: string, many = `${one}s`) {
  return `${formatNumber(count, 0)} ${count === 1 ? one : many}`
}

const categorySummary = computed(() => {
  const total = categoryBars.value.reduce((sum, row) => sum + row.value, 0)
  const top = [...categoryBars.value].sort((a, b) => b.value - a.value)[0]
  return top && total ? `${plural(total, 'application')} with a final SCCA; the most are ${top.label} (${formatNumber(top.value, 0)}).` : ''
})
const monthSummary = computed(() => {
  const total = monthPoints.value.reduce((sum, row) => sum + row.value, 0)
  const top = [...monthPoints.value].sort((a, b) => b.value - a.value)[0]
  return top && total ? `${plural(total, 'SCCA')} finalised in ${plural(monthPoints.value.length, 'month')}; the busiest was ${formatMonth(top.month)} (${formatNumber(top.value, 0)}).` : ''
})
const stepSummary = computed(() => {
  const slowest = [...stepRows.value].sort((a, b) => (b.average_working_days ?? 0) - (a.average_working_days ?? 0))[0]
  const approvals = stepRows.value.reduce((sum, row) => sum + row.approvals, 0)
  return slowest ? `Slowest step: ${signoffRoleLabel(slowest.step, true)}, ${formatNumber(slowest.average_working_days, stepDigits.value)} working days on average, over ${plural(approvals, 'approval')}.` : ''
})

function refLabel(ref: SccaMonitorRef | null) {
  return ref ? ref.ref_no ?? `#${ref.id}` : '—'
}

function daysLeft(row: SccaRenewalRow) {
  if (row.days_left < 0) return `${-row.days_left} days overdue`
  if (row.days_left === 0) return 'Due today'
  return `${row.days_left} days left`
}

const renewalColumns: TableColumn<SccaRenewalRow>[] = [
  { id: 'select', header: '' },
  { accessorKey: 'application_name', header: 'Application name' },
  { accessorKey: 'application_code', header: 'Application code' },
  { accessorKey: 'category', header: 'Category' },
  { id: 'last_final', header: 'Last final SCCA' },
  { id: 'last_final_date', header: 'Last final SCCA date' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { accessorKey: 'days_left', header: 'Due' },
  { accessorKey: 'owner', header: 'Owner' },
  { accessorKey: 'assessor', header: 'Assessor' },
  { accessorKey: 'contributor', header: 'Contributor' },
  { accessorKey: 'renewal_status', header: 'Renewal' },
  { id: 'actions', header: '' },
]
const registerColumns: TableColumn<SccaRegisterRow>[] = [
  { accessorKey: 'application_name', header: 'Application name' },
  { accessorKey: 'application_code', header: 'Application code' },
  { accessorKey: 'directorate', header: 'Directorate' },
  { accessorKey: 'department', header: 'Department' },
  { accessorKey: 'category', header: 'Category' },
  { id: 'latest_final', header: 'Latest final SCCA' },
  { id: 'latest_final_date', header: 'Latest final SCCA date' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { id: 'open', header: 'Open SCCA' },
  { accessorKey: 'owner', header: 'Owner' },
  { accessorKey: 'assessor', header: 'Assessor' },
  { accessorKey: 'contributor', header: 'Contributor' },
  { accessorKey: 'scca_count', header: 'SCCA(s)' },
]
const bottleneckColumns: TableColumn<SccaBottleneckRow>[] = [
  { accessorKey: 'application_name', header: 'Application name' },
  { accessorKey: 'ref_no', header: 'SCCA ref. no.' },
  { accessorKey: 'step_title', header: 'Current step' },
  { accessorKey: 'approver', header: 'Approver' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
  { accessorKey: 'reminders_sent', header: 'Reminders' },
  { accessorKey: 'escalated_at', header: 'Escalated on' },
  { accessorKey: 'working_days_in_approval', header: 'In approval' },
]

// --- Renewals: Act menu and Generate annual review (one row or the selected rows) -------------

const selected = ref<Set<string>>(new Set())
const renewalRows = computed(() => renewals.data.value?.items ?? [])
const selectable = computed(() => renewalRows.value.filter((row) => row.can_generate))
const selectedRows = computed(() => selectable.value.filter((row) => selected.value.has(row.key)))
// A new page or filter starts with nothing selected.
watch(renewalRows, () => (selected.value = new Set()))
const allSelected = computed<boolean | 'indeterminate'>({
  get: () => {
    if (!selectable.value.length || !selectedRows.value.length) return false
    return selectedRows.value.length === selectable.value.length ? true : 'indeterminate'
  },
  set: (value) => (selected.value = new Set(value ? selectable.value.map((row) => row.key) : [])),
})
function toggle(row: SccaRenewalRow, value: boolean | 'indeterminate') {
  const next = new Set(selected.value)
  if (value === true) next.add(row.key)
  else next.delete(row.key)
  selected.value = next
}

function plain(count: number, one: string) {
  return `${count} ${one}${count === 1 ? '' : 's'}`
}

function announce(result: SccaGenerateResult) {
  const created = result.created.length
  const skipped = result.skipped.length + result.refused.length
  const why = [...result.skipped, ...result.refused].map((row) => `${row.ref_no ?? `#${row.id}`}: ${row.reason}`)
  toast.add({
    title: `Created ${created}, skipped ${skipped}`,
    description: why.length ? why.slice(0, 3).join(' · ') + (why.length > 3 ? ` · and ${why.length - 3} more` : '') : `${plain(created, 'draft')} waiting in Manage, with you as the assessor.`,
    color: created ? 'success' : 'warning',
    icon: created ? 'i-lucide-circle-check' : 'i-lucide-circle-alert',
    actions: created
      ? [{
          label: 'Open in Manage',
          color: 'neutral',
          variant: 'outline',
          onClick: () => {
            navigateTo(created === 1 ? sccaPath('manage', result.created[0]!.id) : '/scca/manage')
          },
        }]
      : undefined,
  })
}

async function generate(rows: SccaRenewalRow[]) {
  if (!rows.length) return
  const result = await generateDialog.open({ rows, levels: renewals.data.value?.contributor_levels ?? ['D-2'] }).result
  if (!result) return
  announce(result)
  selected.value = new Set()
  await Promise.all([renewals.refresh(), overview.refresh()])
}

function renewalActions(row: SccaRenewalRow): DropdownMenuItem[] {
  return [
    { label: 'Open last final', icon: 'i-lucide-file-check', to: sccaPath('monitoring', row.last_final.id) },
    {
      label: 'Open renewal',
      icon: 'i-lucide-file-pen',
      disabled: !row.renewal,
      to: row.renewal ? sccaPath('monitoring', row.renewal.id) : undefined,
    },
    {
      label: 'Generate annual review',
      icon: 'i-lucide-file-plus-2',
      disabled: !row.can_generate,
      onSelect: () => generate([row]),
    },
  ]
}

function openHistory(row: SccaRegisterRow) {
  historyDialog.open({ row })
}

const tabs = [
  { label: 'Overview', value: 'overview', icon: 'i-lucide-layout-dashboard', slot: 'overview' as const },
  { label: 'Renewals', value: 'renewals', icon: 'i-lucide-calendar-clock', slot: 'renewals' as const },
  { label: 'List', value: 'register', icon: 'i-lucide-list', slot: 'register' as const },
  { label: 'Approval', value: 'bottlenecks', icon: 'i-lucide-hourglass', slot: 'bottlenecks' as const },
]

const page = computed(() => Math.max(1, Number(route.query.page) || 1))
function pageTo(next: number) {
  return { query: { ...route.query, page: next > 1 ? next : undefined } }
}
</script>

<template>
  <AppPage
    title="SCCA monitoring"
    icon="i-lucide-chart-column"
    :description="everyone
      ? 'Every application\'s latest SCCA: categories, renewals due and approvals that are stuck. Read-only.'
      : 'The SCCAs you assess, contribute to or sign, and the renewals your access scope opens: where each one is, renewals due and approvals waiting.'"
    :crumbs="[{ label: 'SCCA' }, { label: 'Monitoring' }]"
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
            placeholder="Application, code or ref. no."
            aria-label="Search applications"
            class="w-full"
          />
        </template>
        <USelectMenu
          v-model="status"
          value-key="value"
          :items="statusItems"
          :search-input="false"
          class="w-44"
          aria-label="State"
        />
        <USelectMenu
          v-model="categories"
          value-key="value"
          multiple
          :items="categoryItems"
          :search-input="false"
          placeholder="All categories"
          class="w-48"
          aria-label="Category"
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
          v-model="division"
          value-key="value"
          :items="divisionItems"
          class="w-52"
          aria-label="Division"
        />
        <USelectMenu
          v-model="department"
          value-key="value"
          :items="departmentItems"
          class="w-52"
          aria-label="Department"
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
            <KpiCard
              v-for="card in cards"
              :key="card.key"
              :to="cardLink(card.to)"
              :label="card.label"
              :value="card.value"
              :hint="card.hint"
              :icon="card.icon"
              :tone="card.tone"
            />
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            <SccaBarChart
              title="Applications by final category"
              measure="Applications"
              :height="260"
              :items="categoryBars"
              :summary="categorySummary"
              :loading="overview.status.value === 'pending' && !overview.data.value"
              :empty="categorySummary ? null : 'No application has a final SCCA yet for these filters.'"
            />
            <SccaLineChart
              title="SCCAs finalised per month"
              measure="SCCAs finalised"
              :points="monthPoints"
              :summary="monthSummary"
              :loading="overview.status.value === 'pending' && !overview.data.value"
              :empty="monthSummary ? null : 'No SCCA was finalised in these months.'"
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
            :value="renewals.data.value?.counts[card.bucket] ?? null"
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
              {{ bucket ? `${sccaRenewalBucket[bucket].label}, soonest first.` : 'Overdue and due within 90 days, soonest first.' }}
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
                :to="sccaExportUrl('renewals', filters)"
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
                :model-value="selected.has(row.original.key)"
                :disabled="!row.original.can_generate"
                :aria-label="`Select ${row.original.application_name}`"
                @update:model-value="toggle(row.original, $event)"
              />
            </template>
            <template #application_name-cell="{ row }">
              <NuxtLink
                :to="sccaPath('monitoring', row.original.last_final.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.application_name }}
              </NuxtLink>
              <p
                v-if="row.original.directorate"
                class="text-xs text-muted"
              >
                {{ row.original.directorate }}
              </p>
            </template>
            <template #application_code-cell="{ row }">
              <span class="font-mono text-xs">{{ row.original.application_code || '—' }}</span>
            </template>
            <template #category-cell="{ row }">
              <StatusBadge
                v-if="row.original.category"
                :scale="sccaCategory"
                :value="row.original.category"
                size="sm"
              />
            </template>
            <template #last_final-cell="{ row }">
              <span class="font-mono text-xs">{{ refLabel(row.original.last_final) }}</span>
            </template>
            <template #last_final_date-cell="{ row }">
              {{ formatDate(row.original.last_final.finalised_at) || '—' }}
            </template>
            <template #renewal_date-cell="{ row }">
              {{ formatDate(row.original.renewal_date) }}
            </template>
            <template #days_left-cell="{ row }">
              <StatusBadge
                :scale="sccaRenewalBucket"
                :value="row.original.bucket"
                size="sm"
              />
              <p class="mt-1 text-xs text-muted">
                {{ daysLeft(row.original) }}
              </p>
            </template>
            <template #owner-cell="{ row }">
              <p class="max-w-48 truncate">
                {{ row.original.owner || '—' }}
              </p>
            </template>
            <template #assessor-cell="{ row }">
              {{ row.original.assessor || '—' }}
            </template>
            <template #contributor-cell="{ row }">
              {{ row.original.contributor || '—' }}
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
                  :aria-label="`Act on ${row.original.application_name}`"
                />
              </UDropdownMenu>
            </template>
            <template #renewal_status-cell="{ row }">
              <NuxtLink
                v-if="row.original.renewal"
                :to="sccaPath('monitoring', row.original.renewal.id)"
                class="hover:underline"
              >
                <StatusBadge
                  :scale="sccaStatus"
                  :value="row.original.renewal.status"
                  size="sm"
                />
                <span class="ms-1 font-mono text-xs">{{ refLabel(row.original.renewal) }}</span>
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
            :page="page"
            page-sizes
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
              {{ register.data.value?.total ?? 0 }} applications
            </p>
            <UButton
              :to="sccaExportUrl('register', filters)"
              external
              download
              color="neutral"
              variant="outline"
              icon="i-lucide-file-spreadsheet"
              label="Export to Excel"
            />
          </div>
          <UTable
            :data="register.data.value?.items ?? []"
            :columns="registerColumns"
            :loading="register.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #application_name-cell="{ row }">
              <NuxtLink
                :to="sccaPath('monitoring', (row.original.latest_final ?? row.original.open ?? row.original.history[0])!.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.application_name }}
              </NuxtLink>
            </template>
            <template #application_code-cell="{ row }">
              <span class="font-mono text-xs">{{ row.original.application_code || '—' }}</span>
            </template>
            <template #directorate-cell="{ row }">
              <span :class="row.original.directorate ? '' : 'text-muted'">{{ row.original.directorate || '—' }}</span>
            </template>
            <template #department-cell="{ row }">
              <span :class="row.original.department ? '' : 'text-muted'">{{ row.original.department || 'Unknown' }}</span>
            </template>
            <template #category-cell="{ row }">
              <StatusBadge
                v-if="row.original.category"
                :scale="sccaCategory"
                :value="row.original.category"
                size="sm"
              />
              <span
                v-else
                class="text-muted"
              >Not final yet</span>
            </template>
            <template #latest_final-cell="{ row }">
              <span
                v-if="row.original.latest_final"
                class="font-mono text-xs"
              >{{ refLabel(row.original.latest_final) }}</span>
              <span
                v-else
                class="text-muted"
              >—</span>
            </template>
            <template #latest_final_date-cell="{ row }">
              {{ formatDate(row.original.latest_final?.finalised_at) || '—' }}
            </template>
            <template #renewal_date-cell="{ row }">
              {{ formatDate(row.original.renewal_date) || '—' }}
            </template>
            <template #open-cell="{ row }">
              <NuxtLink
                v-if="row.original.open"
                :to="sccaPath('monitoring', row.original.open.id)"
                class="hover:underline"
              >
                <StatusBadge
                  :scale="sccaStatus"
                  :value="row.original.open.status"
                  size="sm"
                />
                <p
                  v-if="row.original.open.pending_step"
                  class="mt-1 text-xs text-muted"
                >
                  {{ signoffRoleLabel(row.original.open.pending_role, true) }}
                </p>
              </NuxtLink>
              <span
                v-else
                class="text-muted"
              >—</span>
            </template>
            <template #owner-cell="{ row }">
              <p class="max-w-48 truncate">
                {{ row.original.owner || '—' }}
              </p>
            </template>
            <template #assessor-cell="{ row }">
              {{ row.original.assessor || '—' }}
            </template>
            <template #contributor-cell="{ row }">
              {{ row.original.contributor || '—' }}
            </template>
            <template #scca_count-cell="{ row }">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                trailing-icon="i-lucide-history"
                :label="String(row.original.scca_count)"
                :aria-label="`SCCA history of ${row.original.application_name}`"
                @click="openHistory(row.original)"
              />
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                {{ filtered ? 'No applications match these filters.' : 'No SCCAs yet.' }}
              </p>
            </template>
          </UTable>
          <TablePagination
            v-model:per-page="perPage"
            :page="page"
            page-sizes
            :total="register.data.value?.total ?? 0"
            :to="pageTo"
            label="Register"
          />
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
            :loading="bottlenecks.status.value === 'pending' && !bottlenecks.data.value"
            :empty="stepSummary ? null : 'No sign-off step was approved in this period, so there are no averages yet. They appear as approvals come in.'"
          />
          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-4">
              <p class="text-sm text-muted">
                <template v-if="bottlenecks.data.value?.total">
                  {{ bottlenecks.data.value.total }} SCCA{{ bottlenecks.data.value.total === 1 ? '' : 's' }} in approval, longest-waiting first.
                </template>
                <template v-else>
                  No SCCA is in approval.
                </template>
                <template v-if="can('scca.approval.manage') && bottlenecks.data.value?.total">
                  <NuxtLink
                    to="/scca/approval?tab=board"
                    class="text-primary hover:underline"
                  >Act on them in the BCM board</NuxtLink>.
                </template>
              </p>
              <UButton
                :to="sccaExportUrl('bottlenecks', filters)"
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
              <template #application_name-cell="{ row }">
                <NuxtLink
                  :to="{ path: sccaPath('monitoring', row.original.id), query: { tab: 'result' } }"
                  class="font-medium text-primary hover:underline"
                >
                  {{ row.original.application_name }}
                </NuxtLink>
              </template>
              <template #ref_no-cell="{ row }">
                <span class="font-mono text-xs">{{ row.original.ref_no || '—' }}</span>
              </template>
              <template #step_title-cell="{ row }">
                {{ signoffRoleLabel(row.original.step, true) }}
              </template>
              <template #approver-cell="{ row }">
                {{ row.original.approver || '—' }}
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
              <template #working_days_in_approval-cell="{ row }">
                {{ workingDays(row.original.working_days_in_approval) }}
              </template>
              <template #empty>
                <p class="py-6 text-center text-sm text-muted">
                  Nothing is in approval{{ filtered ? ' for these filters' : '' }}.
                </p>
              </template>
            </UTable>
            <TablePagination
              v-model:per-page="perPage"
              :page="page"
              page-sizes
              :total="bottlenecks.data.value?.total ?? 0"
              :to="pageTo"
              label="Bottlenecks"
            />
          </UCard>
        </div>
      </template>
    </UTabs>
  </AppPage>
</template>
