<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaMonitorLocation, RaMonitoringFilters, RaSignoffWaiting } from '~/composables/useRa'

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
const PER_PAGE = 25 // docs/design-system.md > Tables

const tab = computed<MonitorTab>({
  get: () => (TABS.includes(route.query.tab as MonitorTab) ? route.query.tab as MonitorTab : 'overview'),
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'overview' ? undefined : value, page: undefined } }),
})

function text(name: string) {
  const value = route.query[name]
  return typeof value === 'string' && value ? value : undefined
}

const LEVEL_FILTERS = [...RA_LEVELS, 'none'] as const
const STATES = ['approved', 'draft', 'in_signoff', 'none'] as const

const filters = computed<RaMonitoringFilters>(() => ({
  kind: ra.value.kind,
  q: text('q'),
  region: text('region'),
  level: LEVEL_FILTERS.includes(text('level') as RaLevel) ? text('level') as RaMonitoringFilters['level'] : undefined,
  state: STATES.includes(text('state') as (typeof STATES)[number]) ? text('state') as RaMonitoringFilters['state'] : undefined,
}))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const paged = computed(() => ({ ...filters.value, page: page.value, per_page: PER_PAGE }))

function setQuery(patch: Record<string, string | undefined>) {
  router.replace({ query: { ...route.query, ...patch, page: undefined } })
}

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
const stateItems = [
  { label: 'Any state', value: 'any' },
  { label: 'Has an approved RA', value: 'approved' },
  { label: 'Draft open', value: 'draft' },
  { label: 'In sign-off', value: 'in_signoff' },
  { label: 'Never approved', value: 'none' },
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

const search = ref(filters.value.q ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (value.trim() !== (filters.value.q ?? '')) setQuery({ q: value.trim() || undefined })
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const filtered = computed(() => Boolean(filters.value.q || filters.value.region || filters.value.level || filters.value.state))
function clearFilters() {
  search.value = ''
  router.replace({ query: { tab: route.query.tab } })
}

// --- data ------------------------------------------------------------------------------------

const overview = useRaOverview(filters)
const renewals = useRaRenewals(paged)
const register = useRaRegister(paged)
const bottlenecks = useRaBottlenecks(computed(() => ({ kind: ra.value.kind, q: filters.value.q, page: page.value, per_page: PER_PAGE })))

const places = computed(() => ra.value.location.lowerPlural)
const cards = computed(() => {
  const value = overview.data.value?.cards
  return [
    { key: 'assessed', label: `${ra.value.location.plural} assessed`, hint: 'With an approved RA in force', icon: 'i-lucide-shield-check', value: value?.assessed, to: { tab: 'register', state: 'approved' }, tone: 'neutral' },
    { key: 'not_assessed', label: 'Never approved', hint: `Active ${places.value} without an approved RA`, icon: 'i-lucide-circle-dashed', value: value?.not_assessed, to: { tab: 'register', state: 'none' }, tone: 'warning' },
    { key: 'in_signoff', label: 'In sign-off', hint: 'RAs being signed off', icon: 'i-lucide-hourglass', value: value?.in_signoff, to: { tab: 'bottlenecks' }, tone: 'neutral' },
    { key: 'drafts', label: 'Drafts', hint: 'RAs being worked on', icon: 'i-lucide-file-pen', value: value?.drafts, to: { tab: 'register', state: 'draft' }, tone: 'neutral' },
    { key: 'overdue_renewals', label: 'Overdue renewals', hint: 'RA in force past its renewal date', icon: 'i-lucide-circle-alert', value: value?.overdue_renewals, to: { tab: 'renewals' }, tone: 'error' },
    { key: 'due_in_90_days', label: 'Due in 90 days', hint: 'Renewals coming up', icon: 'i-lucide-calendar-clock', value: value?.due_in_90_days, to: { tab: 'renewals' }, tone: 'warning' },
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

function plural(count: number, one: string, many = `${one}s`) {
  return `${formatNumber(count, 0)} ${count === 1 ? one : many}`
}

const levelSummary = computed(() => {
  const total = levelBars.value.reduce((sum, row) => sum + row.value, 0)
  const high = overview.data.value?.cards.high_residual ?? 0
  return total
    ? `${plural(total, ra.value.location.lower, ra.value.location.lowerPlural)} with an approved RA; ${formatNumber(high, 0)} with a High residual risk.`
    : ''
})
const monthSummary = computed(() => {
  const total = monthPoints.value.reduce((sum, row) => sum + row.value, 0)
  const top = [...monthPoints.value].sort((a, b) => b.value - a.value)[0]
  return top && total ? `${plural(total, 'RA')} approved in the last 12 months; the most in ${formatMonth(top.month)} (${formatNumber(top.value, 0)}).` : ''
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

function stepLabel(role: string) {
  return raSignoffLabel(role as RaSignoffRole, ra.value.signoffRoles)
}

const locationColumn = computed(() => ra.value.location.single)
const renewalColumns = computed<TableColumn<RaMonitorLocation>[]>(() => [
  { id: 'location', header: locationColumn.value },
  { id: 'approved', header: 'RA in force' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { accessorKey: 'days_left', header: 'Due' },
  { id: 'renewal', header: 'Renewal' },
])
const registerColumns = computed<TableColumn<RaMonitorLocation>[]>(() => [
  { id: 'location', header: locationColumn.value },
  { id: 'level', header: 'Highest residual' },
  { id: 'approved', header: 'RA in force' },
  { accessorKey: 'renewal_date', header: 'Renewal date' },
  { id: 'open', header: 'Being worked on' },
  { accessorKey: 'assessment_count', header: 'RAs', meta: { class: { th: 'text-right', td: 'text-right' } } },
])
const bottleneckColumns = computed<TableColumn<RaSignoffWaiting>[]>(() => [
  { id: 'assessment', header: 'RA' },
  { accessorKey: 'step', header: 'Current step' },
  { id: 'signer', header: 'Signer' },
  { accessorKey: 'working_days_waiting', header: 'Waiting' },
  { accessorKey: 'working_days_in_signoff', header: 'In sign-off' },
])

const tabs = [
  { label: 'Overview', value: 'overview', icon: 'i-lucide-layout-dashboard', slot: 'overview' as const },
  { label: 'Renewals', value: 'renewals', icon: 'i-lucide-calendar-clock', slot: 'renewals' as const },
  { label: 'Register', value: 'register', icon: 'i-lucide-list', slot: 'register' as const },
  { label: 'Bottlenecks', value: 'bottlenecks', icon: 'i-lucide-hourglass', slot: 'bottlenecks' as const },
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
    :description="`Every ${ra.location.lower}'s RA in force: residual risk, renewals due and sign-offs that are waiting. Read-only.`"
    :crumbs="[{ label: ra.title }, { label: 'Monitoring' }]"
  >
    <UCard :ui="{ body: 'p-4 sm:p-4' }">
      <div
        class="flex flex-wrap items-end gap-2"
        role="search"
        aria-label="Monitoring filters"
      >
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="ra.hasRegion ? 'Branch, region or address' : 'Location or address'"
          :aria-label="`Search ${ra.location.lowerPlural}`"
          class="w-full sm:w-64"
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
          v-model="level"
          value-key="value"
          :items="levelItems"
          :search-input="false"
          class="w-48"
          aria-label="Highest residual level"
        />
        <USelectMenu
          v-model="state"
          value-key="value"
          :items="stateItems"
          :search-input="false"
          class="w-48"
          aria-label="State"
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
              :empty="levelSummary ? null : `No ${ra.location.lower} has an approved RA yet for these filters.`"
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
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="flex flex-wrap gap-2 border-b border-default p-4">
            <UBadge
              v-for="bucket in (['overdue', 'due_30', 'due_90'] as const)"
              :key="bucket"
              :color="raRenewalBucket[bucket].color"
              variant="subtle"
              :icon="raRenewalBucket[bucket].icon"
              :label="`${raRenewalBucket[bucket].label}: ${renewals.data.value?.counts?.[bucket] ?? 0}`"
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
                v-if="row.original.location.region"
                class="text-xs text-muted"
              >
                {{ row.original.location.region }}
              </p>
            </template>
            <template #approved-cell="{ row }">
              <span class="font-mono text-xs">{{ refLabel(row.original.approved) }}</span>
              <p class="text-xs text-muted">
                {{ formatDate(row.original.approved?.approved_at) || '—' }}
              </p>
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
          <p class="border-b border-default p-4 text-sm text-muted">
            {{ plural(register.data.value?.total ?? 0, ra.location.lower, ra.location.lowerPlural) }}
          </p>
          <UTable
            :data="register.data.value?.items ?? []"
            :columns="registerColumns"
            :loading="register.status.value === 'pending'"
            :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #location-cell="{ row }">
              <NuxtLink
                :to="`${ra.base}/locations/${row.original.location.id}`"
                class="font-medium text-primary hover:underline"
              >
                {{ row.original.location.name }}
              </NuxtLink>
              <p
                v-if="row.original.location.region"
                class="text-xs text-muted"
              >
                {{ row.original.location.region }}
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
              >{{ row.original.approved ? 'Not rated' : 'Never approved' }}</span>
            </template>
            <template #approved-cell="{ row }">
              <NuxtLink
                v-if="row.original.approved"
                :to="record(row.original.approved.id)"
                class="font-mono text-xs text-primary hover:underline"
              >
                {{ refLabel(row.original.approved) }}
              </NuxtLink>
              <span
                v-else
                class="text-muted"
              >—</span>
            </template>
            <template #renewal_date-cell="{ row }">
              <span :class="row.original.bucket === 'overdue' ? 'text-error' : ''">{{ formatDate(row.original.renewal_date) || '—' }}</span>
            </template>
            <template #open-cell="{ row }">
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
              >—</span>
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                No {{ ra.location.lower }} matches these filters.
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
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <p class="border-b border-default p-4 text-sm text-muted">
            RAs in sign-off, the longest-waiting step first. Waiting is in working days (Monday to Friday) since the submission or the last approval.
          </p>
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
              {{ stepLabel(row.original.step) }}
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
            <template #working_days_in_signoff-cell="{ row }">
              {{ raWaiting(row.original.working_days_in_signoff) }}
            </template>
            <template #empty>
              <p class="py-6 text-center text-sm text-muted">
                No RA is in sign-off.
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
      </template>
    </UTabs>
  </AppPage>
</template>
