<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { parseDate, type CalendarDate } from '@internationalized/date'
import type {
  SccaBottleneckRow,
  SccaMonitorRef,
  SccaMonitoringFilters,
  SccaRegisterRow,
  SccaRenewalRow,
} from '~/composables/useSccaWorkflow'

definePageMeta({ permission: 'scca.access' })

const route = useRoute()
const router = useRouter()
const { can } = useAuth()
/** With scca.monitor (BCM, management) every SCCA; otherwise the user's own. */
const everyone = computed(() => can('scca.monitor') || can('scca.view_all'))

const TABS = ['overview', 'renewals', 'register', 'bottlenecks'] as const
type MonitorTab = (typeof TABS)[number]
const PER_PAGE = 25 // docs/design-system.md > Tables

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
  q: text('q'),
}))
const paged = computed(() => ({ ...filters.value, page: Math.max(1, Number(route.query.page) || 1), per_page: PER_PAGE }))

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

const { data: departmentData } = useSccaDepartments()
const department = computed<string>({
  get: () => filters.value.department ?? 'all',
  set: (value) => setQuery({ department: value === 'all' ? undefined : value }),
})
const departmentItems = computed(() => [
  { label: 'All departments', value: 'all' },
  ...(departmentData.value?.items ?? []).map((name) => ({ label: name, value: name })),
])

const search = ref(filters.value.q ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (value.trim() !== (filters.value.q ?? '')) setQuery({ q: value.trim() || undefined })
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const filtered = computed(() => Boolean(filters.value.from || filters.value.to || filters.value.category || filters.value.status || filters.value.department || filters.value.q))
function clearFilters() {
  search.value = ''
  router.replace({ query: { tab: route.query.tab } })
}

// --- data ------------------------------------------------------------------------------------

const overview = useSccaOverview(filters)
const renewals = useSccaRenewals(paged)
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
  return slowest ? `Slowest step: ${signoffRoleLabel(slowest.step, true)}, ${formatNumber(slowest.average_working_days, 1)} working days on average, over ${plural(approvals, 'approval')}.` : ''
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
  { accessorKey: 'application_name', header: 'Application' },
  { accessorKey: 'category', header: 'Category' },
  { id: 'last_final', header: 'Last final SCCA' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { accessorKey: 'days_left', header: 'Due' },
  { accessorKey: 'owner', header: 'Owner / assessor' },
  { accessorKey: 'renewal_status', header: 'Renewal' },
]
const registerColumns: TableColumn<SccaRegisterRow>[] = [
  { accessorKey: 'application_name', header: 'Application' },
  { accessorKey: 'department', header: 'Department' },
  { accessorKey: 'category', header: 'Category' },
  { id: 'latest_final', header: 'Latest final SCCA' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { id: 'open', header: 'Open SCCA' },
  { accessorKey: 'owner', header: 'Owner / assessor' },
  { accessorKey: 'scca_count', header: 'SCCAs' },
]
const bottleneckColumns: TableColumn<SccaBottleneckRow>[] = [
  { accessorKey: 'application_name', header: 'SCCA' },
  { accessorKey: 'step_title', header: 'Current step' },
  { accessorKey: 'approver', header: 'Approver' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
  { accessorKey: 'reminders_sent', header: 'Reminders' },
  { accessorKey: 'working_days_in_approval', header: 'In approval' },
]

const tabs = [
  { label: 'Overview', value: 'overview', icon: 'i-lucide-layout-dashboard', slot: 'overview' as const },
  { label: 'Renewals', value: 'renewals', icon: 'i-lucide-calendar-clock', slot: 'renewals' as const },
  { label: 'Register', value: 'register', icon: 'i-lucide-list', slot: 'register' as const },
  { label: 'Bottlenecks', value: 'bottlenecks', icon: 'i-lucide-hourglass', slot: 'bottlenecks' as const },
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
      : 'The SCCAs you assess, contribute to or sign: where each one is, renewals due and approvals waiting. Read-only.'"
    :crumbs="[{ label: 'SCCA' }, { label: 'Monitoring' }]"
  >
    <UCard :ui="{ body: 'p-4 sm:p-4' }">
      <div
        class="flex flex-wrap items-end gap-2"
        role="search"
        aria-label="Monitoring filters"
      >
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
          v-model="status"
          value-key="value"
          :items="statusItems"
          :search-input="false"
          class="w-44"
          aria-label="State"
        />
        <USelectMenu
          v-model="department"
          value-key="value"
          :items="departmentItems"
          class="w-52"
          aria-label="Department"
        />
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Application, code or ref. no."
          aria-label="Search applications"
          class="w-full sm:w-64"
        />
        <UButton
          v-if="filtered"
          color="neutral"
          variant="link"
          icon="i-lucide-x"
          label="Clear filters"
          @click="clearFilters"
        />
      </div>
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
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-4">
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="bucket in (['overdue', 'due_30', 'due_90'] as const)"
                :key="bucket"
                :color="sccaRenewalBucket[bucket].color"
                variant="subtle"
                :icon="sccaRenewalBucket[bucket].icon"
                :label="`${sccaRenewalBucket[bucket].label}: ${renewals.data.value?.counts[bucket] ?? 0}`"
              />
            </div>
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
          <UTable
            :data="renewals.data.value?.items ?? []"
            :columns="renewalColumns"
            :loading="renewals.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #application_name-cell="{ row }">
              <NuxtLink
                :to="sccaPath('monitoring', row.original.last_final.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.application_name }}
              </NuxtLink>
              <p class="text-xs text-muted">
                {{ row.original.application_code || '—' }}
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
            <template #last_final-cell="{ row }">
              <span class="font-mono text-xs">{{ refLabel(row.original.last_final) }}</span>
              <p class="text-xs text-muted">
                {{ formatDate(row.original.last_final.assessment_date) }}
              </p>
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
              <p class="max-w-56 truncate">
                {{ row.original.owner || '—' }}
              </p>
              <p class="text-xs text-muted">
                {{ row.original.assessor || '—' }}
              </p>
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
            :page="page"
            :per-page="PER_PAGE"
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
            :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #application_name-cell="{ row }">
              <NuxtLink
                :to="sccaPath('monitoring', (row.original.latest_final ?? row.original.open ?? row.original.history[0])!.id)"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.application_name }}
              </NuxtLink>
              <p class="text-xs text-muted">
                {{ row.original.application_code || '—' }}
              </p>
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
              <template v-if="row.original.latest_final">
                <span class="font-mono text-xs">{{ refLabel(row.original.latest_final) }}</span>
                <p class="text-xs text-muted">
                  {{ formatDate(row.original.latest_final.finalised_at) }}
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
              <p class="max-w-56 truncate">
                {{ row.original.owner || '—' }}
              </p>
              <p class="text-xs text-muted">
                {{ row.original.assessor || '—' }}
              </p>
            </template>
            <template #scca_count-cell="{ row }">
              <UPopover :content="{ align: 'end' }">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  trailing-icon="i-lucide-chevron-down"
                  :label="String(row.original.scca_count)"
                  :aria-label="`SCCA history of ${row.original.application_name}`"
                />
                <template #content>
                  <ul class="w-72 divide-y divide-default text-sm">
                    <li
                      v-for="item in row.original.history"
                      :key="item.id"
                    >
                      <NuxtLink
                        :to="sccaPath('monitoring', item.id)"
                        class="flex items-center justify-between gap-2 px-3 py-2 hover:bg-elevated/50"
                      >
                        <span>
                          <span class="font-mono text-xs">{{ refLabel(item) }}</span>
                          <span class="block text-xs text-muted">{{ formatDate(item.assessment_date) || '—' }}</span>
                        </span>
                        <StatusBadge
                          :scale="sccaStatus"
                          :value="item.status"
                          size="sm"
                        />
                      </NuxtLink>
                    </li>
                  </ul>
                </template>
              </UPopover>
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                {{ filtered ? 'No applications match these filters.' : 'No SCCAs yet.' }}
              </p>
            </template>
          </UTable>
          <TablePagination
            :page="page"
            :per-page="PER_PAGE"
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
            :digits="1"
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
                <p class="font-mono text-xs text-muted">
                  {{ row.original.ref_no }}
                </p>
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
                <p
                  v-if="row.original.escalated_at"
                  class="text-xs text-error"
                >
                  Escalated {{ formatDate(row.original.escalated_at) }}
                </p>
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
              :page="page"
              :per-page="PER_PAGE"
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
