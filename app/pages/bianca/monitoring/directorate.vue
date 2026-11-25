<script setup lang="ts">
import type {
  BiaDirectorateDetailParams,
  BiaDirectorateSort,
  BiaGenerateResult,
  BiaMonitoringFilters,
  BiaMonitorGroupRow,
  BiaNeedsActionItem,
  BiaSubDirectorateRow,
} from '~/composables/useBiaWorkflow'
import BiaHistoryDialog from '~/components/bia/BiaHistoryDialog.vue'

definePageMeta({ permission: 'bianca.access' })

const route = useRoute()
const router = useRouter()
const { user, can } = useAuth()
const toast = useToast()
const confirm = useConfirm()
const historyDialog = useOverlay().create(BiaHistoryDialog)

function text(name: string) {
  const value = route.query[name]
  return typeof value === 'string' && value ? value : undefined
}

const directorateName = computed(() => text('name') ?? '')
const sort = computed<BiaDirectorateSort>(() => {
  const s = text('sort')
  return s === 'name' || s === 'groups' ? s : 'urgent'
})
const attentionOnly = computed(() => text('attention_only') === '1')

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
  'in_signoff',
  'waiting_approval',
  'escalated',
  'draft_group',
  'draft',
  'waiting_submission',
  'returned',
  'in_revision',
  'need_revision',
  'none',
  'not_started',
] as const

const filters = computed<BiaMonitoringFilters>(() => ({
  q: text('q'),
  category: CATEGORY_FILTERS.includes(text('category') as BiaCategory) ? text('category') as BiaMonitoringFilters['category'] : undefined,
  state: STATES.includes(text('state') as (typeof STATES)[number]) ? text('state') as BiaMonitoringFilters['state'] : undefined,
  reason: BIA_REASONS.some((r) => r.value === text('reason')) ? text('reason') as BiaReason : undefined,
  from: text('from'),
  to: text('to'),
}))

const queryParams = computed<BiaDirectorateDetailParams>(() => ({
  name: directorateName.value,
  ...filters.value,
  sort: sort.value,
  attention_only: attentionOnly.value,
}))

const detail = await useBiaDirectorateDetail(queryParams)

const backToList = computed(() => ({
  path: '/bianca/monitoring',
  query: {
    tab: 'register',
    sort: sort.value === 'urgent' ? undefined : sort.value,
    attention_only: attentionOnly.value ? '1' : undefined,
    state: filters.value.state,
    category: filters.value.category,
    reason: filters.value.reason,
    from: filters.value.from,
    to: filters.value.to,
  },
}))

function plural(count: number, one: string, many = `${one}s`) {
  return `${formatNumber(count, 0)} ${count === 1 ? one : many}`
}

function setQuery(patch: Record<string, string | string[] | undefined>) {
  router.replace({ query: { ...route.query, ...patch } })
}

// --- search & local filters ----------------------------------------------------------------

const search = ref(filters.value.q ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(() => filters.value.q, (value) => {
  if ((value ?? '') !== search.value) search.value = value ?? ''
})
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const clean = value.trim() || undefined
    if (clean !== filters.value.q) setQuery({ q: clean })
  }, 250)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const stateItems = [
  { label: 'Any state', value: '__all__' },
  { label: 'Final: Full Approved', value: 'full_approved' },
  { label: 'In Renewal: All', value: 'in_renewal' },
  { label: 'In Renewal: Due in 90 days', value: 'due_90' },
  { label: 'In Renewal: Due in 60 days', value: 'due_60' },
  { label: 'In Renewal: Due in 30 days', value: 'due_30' },
  { label: 'In Renewal: Overdue', value: 'overdue' },
  { label: 'Draft: Waiting for Submission Task', value: 'waiting_submission' },
  { label: 'Draft: Need Revision', value: 'need_revision' },
  { label: 'Draft: In Revision', value: 'in_revision' },
  { label: 'In Approval: Waiting for Approval', value: 'waiting_approval' },
  { label: 'In Approval: Escalated', value: 'escalated' },
  { label: 'No final BIA yet', value: 'none' },
]
const stateModel = computed({
  get: () => filters.value.state ?? '__all__',
  set: (value: string) => setQuery({ state: value === '__all__' ? undefined : value }),
})

const categoryItems = [
  { label: 'Any category', value: '__all__' },
  ...BIA_CATEGORIES.map((c) => ({ label: biaCategory[c].label, value: c })),
  { label: 'Not rated', value: 'none' },
]
const categoryModel = computed({
  get: () => filters.value.category ?? '__all__',
  set: (value: string) => setQuery({ category: value === '__all__' ? undefined : value }),
})

const hasLocalFilters = computed(() => Boolean(filters.value.q || filters.value.state || filters.value.category || filters.value.reason))

function clearLocalFilters() {
  search.value = ''
  setQuery({ q: undefined, state: undefined, category: undefined, reason: undefined })
}

function toggleKpiFilter(target: BiaMonitoringFilters['state']) {
  setQuery({ state: filters.value.state === target ? undefined : target })
}

// --- directorate switcher (Prev / Switch / Next) -------------------------------------------

const switcherList = computed(() => detail.data.value?.directorates ?? [])
const currentIndex = computed(() => switcherList.value.findIndex((item) => item.name === directorateName.value))
const prevDirectorate = computed(() => currentIndex.value > 0 ? switcherList.value[currentIndex.value - 1] : null)
const nextDirectorate = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < switcherList.value.length - 1
    ? switcherList.value[currentIndex.value + 1]
    : null,
)

const switcherItems = computed(() => switcherList.value.map((item) => ({
  label: `${item.name} (${item.group_count})`,
  value: item.name,
})))

function switchDirectorate(targetName: string) {
  if (!targetName || targetName === directorateName.value) return
  picked.value = new Map()
  router.push({
    path: '/bianca/monitoring/directorate',
    query: {
      ...route.query,
      name: targetName,
      open: undefined,
    },
  })
}

// --- smart accordion state synced to URL (?open=...) ---------------------------------------

const NONE_SENTINEL = '__none__'

const subDirectorates = computed(() => detail.data.value?.sub_directorates ?? [])

function parseOpenQuery(): string[] | null {
  const raw = route.query.open
  if (raw === undefined) return null
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string' && v.length > 0)
  return typeof raw === 'string' && raw.length > 0 ? [raw] : null
}

const openSet = computed<Set<string>>(() => {
  const explicit = parseOpenQuery()
  if (explicit !== null) {
    if (explicit.includes(NONE_SENTINEL)) return new Set()
    return new Set(explicit)
  }
  // Smart default: auto-open sub-directorates with warnings (or all if actively filtering)
  if (hasLocalFilters.value) {
    return new Set(subDirectorates.value.map((s) => s.name))
  }
  const withWarnings = subDirectorates.value.filter((s) => s.needs_attention).map((s) => s.name)
  if (withWarnings.length) return new Set(withWarnings)
  // If every sub-directorate is all on track, open the first one when there is only 1
  return subDirectorates.value.length === 1 ? new Set([subDirectorates.value[0]!.name]) : new Set()
})

function isSubOpen(name: string) {
  return openSet.value.has(name)
}

function toggleSub(name: string) {
  const next = new Set(openSet.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  setQuery({ open: next.size ? [...next] : NONE_SENTINEL })
}

function expandAll() {
  const all = subDirectorates.value.map((s) => s.name)
  setQuery({ open: all.length ? all : undefined })
}

function collapseAll() {
  setQuery({ open: NONE_SENTINEL })
}

// --- Needs Action collapsible panel --------------------------------------------------------

const needsAction = computed(() => detail.data.value?.needs_action ?? [])
const needsActionOpen = ref(true)
const needsActionShowAll = ref(false)
const visibleNeedsAction = computed(() =>
  needsActionShowAll.value ? needsAction.value : needsAction.value.slice(0, 5),
)
const busyActionKey = ref<string | null>(null)

function displayOrgName(value: string | null | undefined) {
  return !value || value === '—' ? 'Unassigned' : value
}

function actionKindBadge(kind: BiaNeedsActionItem['kind']) {
  const map: Record<BiaNeedsActionItem['kind'], { label: string, color: 'error' | 'warning' | 'neutral', icon: string }> = {
    overdue: { label: 'Overdue', color: 'error', icon: 'i-lucide-alert-circle' },
    returned: { label: 'Returned', color: 'error', icon: 'i-lucide-undo-2' },
    stuck: { label: 'Stuck approval', color: 'error', icon: 'i-lucide-flame' },
    due_soon: { label: 'Due soon', color: 'warning', icon: 'i-lucide-clock-alert' },
    not_started: { label: 'Not started', color: 'neutral', icon: 'i-lucide-circle-dashed' },
  }
  return map[kind]
}

function announceGenerate(result: BiaGenerateResult) {
  const created = result.created.length
  const why = [...result.skipped, ...result.refused].map((row) => `${row.group ?? row.ref_no ?? `#${row.id}`}: ${row.reason}`)
  if (created) {
    toast.add({
      title: `Created ${plural(created, 'annual review draft')}`,
      description: why.length ? `${plural(why.length, 'group')} skipped — ${why[0]}` : 'Opened as Draft in Manage.',
      color: why.length ? 'warning' : 'success',
      icon: 'i-lucide-file-plus-2',
    })
  } else {
    toast.add({
      title: 'No annual review created',
      description: why.join(' · ') || 'Every selected group already has an open BIA.',
      color: 'warning',
      icon: 'i-lucide-info',
    })
  }
}

async function runGenerate(sourceIds: number[], label: string, key: string) {
  if (!sourceIds.length || busyActionKey.value) return
  const ok = await confirm({
    title: `Generate ${plural(sourceIds.length, 'annual review')}?`,
    description: `Creates a new Draft BIA copied from ${label}, ready to edit and submit in Manage.`,
    confirmLabel: 'Generate',
  })
  if (!ok) return
  busyActionKey.value = key
  try {
    const result = await biaGenerateRenewals(sourceIds, user.value?.name || user.value?.email)
    announceGenerate(result)
    await detail.refresh()
  } catch (err) {
    toast.add({ title: 'Could not generate annual review', description: apiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busyActionKey.value = null
  }
}

async function runRemindRenewal(sourceIds: number[], label: string, key: string) {
  if (!sourceIds.length || busyActionKey.value) return
  const ok = await confirm({
    title: `Send renewal reminder for ${label}?`,
    description: 'Emails the group BCM Coordinator and Alternate Coordinator with the renewal due date.',
    confirmLabel: 'Send reminder',
  })
  if (!ok) return
  busyActionKey.value = key
  try {
    const result = await biaRemindRenewals(sourceIds)
    const sent = result.reminded.length
    toast.add({
      title: sent ? `Sent ${plural(sent, 'renewal reminder')}` : 'No reminder sent',
      description: sent ? 'The group coordinators have been emailed.' : result.skipped[0]?.reason,
      color: sent ? 'success' : 'warning',
      icon: 'i-lucide-bell-ring',
    })
    await detail.refresh()
  } catch (err) {
    toast.add({ title: 'Could not send renewal reminder', description: apiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busyActionKey.value = null
  }
}

async function runRemindApproval(biaIds: number[], label: string, key: string) {
  if (!biaIds.length || busyActionKey.value) return
  const ok = await confirm({
    title: `Send approval reminder for ${label}?`,
    description: 'Emails the active waiting signer and the group BCM Coordinator.',
    confirmLabel: 'Send reminder',
  })
  if (!ok) return
  busyActionKey.value = key
  try {
    const result = await biaRemindBottlenecks(biaIds)
    const sent = result.reminded.length
    toast.add({
      title: sent ? `Sent ${plural(sent, 'approval reminder')}` : 'No reminder sent',
      description: sent ? 'The waiting signers have been emailed.' : result.skipped[0]?.reason,
      color: sent ? 'success' : 'warning',
      icon: 'i-lucide-bell-ring',
    })
    await detail.refresh()
  } catch (err) {
    toast.add({ title: 'Could not send approval reminder', description: apiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busyActionKey.value = null
  }
}

// --- cross-sub-directorate selection & sticky action bar -----------------------------------

const picked = ref<Map<number, BiaMonitorGroupRow>>(new Map())
const pickedIdSet = computed(() => new Set(picked.value.keys()))
const pickedIds = computed(() => [...picked.value.keys()])
const pickedRows = computed(() => [...picked.value.values()])

function pickRow(row: BiaMonitorGroupRow, value: boolean | 'indeterminate') {
  const next = new Map(picked.value)
  if (value === true) next.set(row.group.id, row)
  else next.delete(row.group.id)
  picked.value = next
}

function pickMany(rows: BiaMonitorGroupRow[], value: boolean | 'indeterminate') {
  const next = new Map(picked.value)
  for (const row of rows) {
    if (value === true) next.set(row.group.id, row)
    else next.delete(row.group.id)
  }
  picked.value = next
}

function clearPicked() {
  picked.value = new Map()
}

function subCheckState(sub: BiaSubDirectorateRow): boolean | 'indeterminate' {
  if (!sub.groups.length) return false
  const count = sub.groups.filter((g) => picked.value.has(g.group.id)).length
  if (!count) return false
  return count === sub.groups.length ? true : 'indeterminate'
}

const pickedGeneratableIds = computed(() =>
  pickedRows.value.filter((r) => r.can_generate && r.approved).map((r) => r.approved!.id),
)
const pickedRemindRenewalIds = computed(() =>
  pickedRows.value.filter((r) => r.approved).map((r) => r.approved!.id),
)

const exportFilters = computed<BiaMonitoringFilters>(() => ({
  ...filters.value,
  directorate: directorateName.value || undefined,
}))

function severityBorderClass(sev: 'error' | 'warning' | 'ok') {
  if (sev === 'error') return 'border-s-3 border-s-error'
  if (sev === 'warning') return 'border-s-3 border-s-warning'
  return 'border-s-3 border-s-transparent'
}

function openHistory(row: BiaMonitorGroupRow) {
  historyDialog.open({ row })
}

function openSummaryLabel(sub: BiaSubDirectorateRow) {
  const oc = sub.open_counts
  if (!oc.total) return '—'
  const parts: string[] = []
  if (oc.in_signoff) parts.push(`${oc.in_signoff} in approval`)
  if (oc.draft) parts.push(`${oc.draft} draft`)
  if (oc.returned) parts.push(`${oc.returned} returned`)
  return parts.join(' · ') || `${oc.total} open`
}

const baseSummary = computed(() => detail.data.value?.base_summary)
const summary = computed(() => detail.data.value?.summary)
</script>

<template>
  <UDashboardPanel id="bianca-monitoring-directorate">
    <template #header>
      <PageHeader :title="directorateName || 'Directorate'">
        <template #right>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              :to="backToList"
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-arrow-left"
              label="Back to List"
            />
            <div
              v-if="switcherList.length > 1"
              class="flex items-center gap-1"
            >
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-chevron-left"
                :disabled="!prevDirectorate"
                aria-label="Previous directorate"
                @click="prevDirectorate && switchDirectorate(prevDirectorate.name)"
              />
              <USelect
                :model-value="directorateName"
                :items="switcherItems"
                size="sm"
                class="w-56"
                aria-label="Switch directorate"
                @update:model-value="(val: string) => switchDirectorate(val)"
              />
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-chevron-right"
                :disabled="!nextDirectorate"
                aria-label="Next directorate"
                @click="nextDirectorate && switchDirectorate(nextDirectorate.name)"
              />
            </div>
          </div>
        </template>
      </PageHeader>
    </template>

    <template #body>
      <div class="space-y-5 pb-20">
        <!-- Breadcrumb & subtitle -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <nav
            aria-label="Breadcrumb"
            class="flex flex-wrap items-center gap-1.5 text-sm text-muted"
          >
            <NuxtLink
              to="/bianca/monitoring"
              class="hover:text-highlighted hover:underline"
            >
              BIA monitoring
            </NuxtLink>
            <UIcon
              name="i-lucide-chevron-right"
              class="size-3.5"
            />
            <NuxtLink
              :to="backToList"
              class="hover:text-highlighted hover:underline"
            >
              List
            </NuxtLink>
            <UIcon
              name="i-lucide-chevron-right"
              class="size-3.5"
            />
            <span class="font-medium text-highlighted">{{ directorateName || '—' }}</span>
          </nav>
          <p
            v-if="baseSummary"
            class="text-sm text-muted"
          >
            {{ plural(baseSummary.sub_directorate_count, 'sub-directorate') }} · {{ plural(baseSummary.group_count, 'group') }}
          </p>
        </div>

        <!-- Loading skeleton -->
        <div
          v-if="detail.status.value === 'pending' && !detail.data.value"
          class="space-y-4"
        >
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <USkeleton
              v-for="i in 4"
              :key="i"
              class="h-20 rounded-lg"
            />
          </div>
          <USkeleton class="h-32 rounded-lg" />
          <USkeleton class="h-24 rounded-lg" />
        </div>

        <!-- Missing / not found -->
        <UCard v-else-if="detail.data.value && !detail.data.value.exists">
          <div class="py-8 text-center">
            <p class="font-medium text-highlighted">
              No groups found for "{{ directorateName }}".
            </p>
            <p class="mt-1 text-sm text-muted">
              It may have been renamed or fall outside your monitoring access scope.
            </p>
            <UButton
              :to="backToList"
              class="mt-4"
              color="neutral"
              variant="outline"
              icon="i-lucide-arrow-left"
              label="Return to Directorate list"
            />
          </div>
        </UCard>

        <template v-else-if="detail.data.value && baseSummary && summary">
          <!-- Clickable mini-KPI tiles -->
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              class="rounded-lg border p-3.5 text-left transition hover:bg-elevated/60"
              :class="filters.state === 'approved' ? 'border-primary ring-1 ring-primary' : 'border-default bg-default'"
              @click="toggleKpiFilter('approved')"
            >
              <div class="flex items-center justify-between text-xs text-muted">
                <span>Final coverage</span>
                <UIcon
                  name="i-lucide-circle-check"
                  class="size-4 text-success"
                />
              </div>
              <div class="mt-1 flex items-baseline gap-2">
                <span class="text-2xl font-semibold tabular-nums text-highlighted">
                  {{ baseSummary.coverage.valid_final }}/{{ baseSummary.coverage.total }}
                </span>
                <span class="text-xs text-muted">{{ baseSummary.coverage.pct }}% valid</span>
              </div>
            </button>

            <button
              type="button"
              class="rounded-lg border p-3.5 text-left transition hover:bg-elevated/60"
              :class="filters.state === 'overdue' ? 'border-error ring-1 ring-error' : 'border-default bg-default'"
              @click="toggleKpiFilter('overdue')"
            >
              <div class="flex items-center justify-between text-xs text-muted">
                <span>Overdue</span>
                <UIcon
                  name="i-lucide-alert-circle"
                  class="size-4"
                  :class="baseSummary.alert_counts.overdue ? 'text-error' : 'text-muted'"
                />
              </div>
              <div class="mt-1 flex items-baseline gap-2">
                <span
                  class="text-2xl font-semibold tabular-nums"
                  :class="baseSummary.alert_counts.overdue ? 'text-error' : 'text-highlighted'"
                >
                  {{ baseSummary.alert_counts.overdue }}
                </span>
                <span class="text-xs text-muted">past renewal date</span>
              </div>
            </button>

            <button
              type="button"
              class="rounded-lg border p-3.5 text-left transition hover:bg-elevated/60"
              :class="filters.state === 'due_soon' ? 'border-warning ring-1 ring-warning' : 'border-default bg-default'"
              @click="toggleKpiFilter('due_soon')"
            >
              <div class="flex items-center justify-between text-xs text-muted">
                <span>Due soon</span>
                <UIcon
                  name="i-lucide-clock-alert"
                  class="size-4"
                  :class="baseSummary.alert_counts.due_soon ? 'text-warning' : 'text-muted'"
                />
              </div>
              <div class="mt-1 flex items-baseline gap-2">
                <span
                  class="text-2xl font-semibold tabular-nums"
                  :class="baseSummary.alert_counts.due_soon ? 'text-warning' : 'text-highlighted'"
                >
                  {{ baseSummary.alert_counts.due_soon }}
                </span>
                <span class="text-xs text-muted">within 30 days</span>
              </div>
            </button>

            <button
              type="button"
              class="rounded-lg border p-3.5 text-left transition hover:bg-elevated/60"
              :class="filters.state === 'open' ? 'border-primary ring-1 ring-primary' : 'border-default bg-default'"
              @click="toggleKpiFilter('open')"
            >
              <div class="flex items-center justify-between text-xs text-muted">
                <span>Open BIA</span>
                <UIcon
                  name="i-lucide-hourglass"
                  class="size-4 text-muted"
                />
              </div>
              <div class="mt-1 flex items-baseline gap-2">
                <span class="text-2xl font-semibold tabular-nums text-highlighted">
                  {{ baseSummary.open_counts.total }}
                </span>
                <span class="text-xs text-muted">
                  <template v-if="baseSummary.open_counts.longest_working_days != null">
                    waiting up to {{ plural(baseSummary.open_counts.longest_working_days, 'working day') }}
                  </template>
                  <template v-else>
                    in draft / approval
                  </template>
                </span>
              </div>
            </button>
          </div>

          <!-- Needs Action panel -->
          <UCard
            v-if="needsAction.length"
            :ui="{ header: 'py-3 px-4', body: needsActionOpen ? 'p-0 sm:p-0' : 'hidden' }"
            class="border-s-4 border-s-error"
          >
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 text-left"
                  :aria-expanded="needsActionOpen"
                  @click="needsActionOpen = !needsActionOpen"
                >
                  <UIcon
                    name="i-lucide-triangle-alert"
                    class="size-4 text-error"
                  />
                  <span class="text-sm font-semibold text-highlighted">
                    Needs action ({{ needsAction.length }})
                  </span>
                </button>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :icon="needsActionOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  :label="needsActionOpen ? 'Collapse' : 'Expand'"
                  @click="needsActionOpen = !needsActionOpen"
                />
              </div>
            </template>

            <ul class="divide-y divide-default">
              <li
                v-for="(item, idx) in visibleNeedsAction"
                :key="`${item.kind}-${item.group_id}-${item.bia_id ?? idx}`"
                class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div class="min-w-0 space-y-0.5">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge
                      :color="actionKindBadge(item.kind).color"
                      variant="subtle"
                      size="xs"
                      :icon="actionKindBadge(item.kind).icon"
                      :label="actionKindBadge(item.kind).label"
                    />
                    <span class="font-medium text-highlighted">{{ item.group_name }}</span>
                    <span class="text-xs text-muted">· {{ displayOrgName(item.sub_directorate) }}</span>
                  </div>
                  <p class="text-xs text-muted">
                    {{ item.summary }}
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                  <UButton
                    v-if="can('bianca.create') && item.can_generate && item.approved_id"
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-lucide-file-plus-2"
                    label="Generate annual review"
                    :loading="busyActionKey === `gen-${item.group_id}-${item.kind}`"
                    @click="runGenerate([item.approved_id], item.group_name, `gen-${item.group_id}-${item.kind}`)"
                  />
                  <UButton
                    v-if="can('bianca.approval.manage') && item.can_remind_renewal && item.approved_id"
                    size="xs"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-bell-ring"
                    label="Send reminder"
                    :loading="busyActionKey === `rem-ren-${item.group_id}-${item.kind}`"
                    @click="runRemindRenewal([item.approved_id], item.group_name, `rem-ren-${item.group_id}-${item.kind}`)"
                  />
                  <UButton
                    v-if="can('bianca.approval.manage') && item.can_remind_approval && item.open_id"
                    size="xs"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-bell-ring"
                    label="Send reminder"
                    :loading="busyActionKey === `rem-app-${item.group_id}-${item.kind}`"
                    @click="runRemindApproval([item.open_id], item.group_name, `rem-app-${item.group_id}-${item.kind}`)"
                  />
                  <UButton
                    v-if="item.bia_id"
                    :to="{ path: biaPath('monitoring', item.bia_id), query: { from: 'directorate' } }"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    trailing-icon="i-lucide-arrow-up-right"
                    label="Open BIA"
                  />
                </div>
              </li>
            </ul>
            <div
              v-if="needsAction.length > 5"
              class="border-t border-default px-4 py-2 text-center"
            >
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                :label="needsActionShowAll ? 'Show top 5' : `Show all (${needsAction.length})`"
                @click="needsActionShowAll = !needsActionShowAll"
              />
            </div>
          </UCard>

          <!-- Toolbar: local search, filters, expand/collapse, export -->
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <UInput
                v-model="search"
                icon="i-lucide-search"
                placeholder="Search group or PIC"
                size="sm"
                class="w-56"
              />
              <USelect
                v-model="stateModel"
                :items="stateItems"
                size="sm"
                class="w-44"
              />
              <USelect
                v-model="categoryModel"
                :items="categoryItems"
                size="sm"
                class="w-40"
              />
              <UButton
                v-if="hasLocalFilters"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-x"
                label="Clear"
                @click="clearLocalFilters"
              />
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-chevrons-up-down"
                label="Expand all"
                :disabled="!subDirectorates.length"
                @click="expandAll"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-chevrons-down-up"
                label="Collapse all"
                :disabled="!subDirectorates.length"
                @click="collapseAll"
              />
              <UButton
                v-if="can('bianca.report.download')"
                :to="biaExportUrl(exportFilters, pickedIds)"
                external
                download
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-file-spreadsheet"
                :label="pickedIds.length ? `Export selected (${pickedIds.length})` : 'Export to Excel'"
              />
            </div>
          </div>

          <!-- Empty filtered state -->
          <UCard v-if="!subDirectorates.length">
            <div class="py-8 text-center">
              <p class="text-sm text-muted">
                No sub-directorate or group matches these filters in {{ directorateName }}.
              </p>
              <UButton
                v-if="hasLocalFilters"
                class="mt-3"
                color="neutral"
                variant="outline"
                size="sm"
                label="Clear filters"
                @click="clearLocalFilters"
              />
            </div>
          </UCard>

          <!-- Smart Sub-Directorate Accordion -->
          <div
            v-else
            class="space-y-3"
          >
            <UCard
              v-for="sub in subDirectorates"
              :key="sub.name"
              :ui="{ body: 'p-0 sm:p-0' }"
              class="overflow-hidden"
              :class="severityBorderClass(sub.severity)"
            >
              <!-- Accordion header -->
              <div class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex min-w-0 items-start gap-3 sm:items-center">
                  <UCheckbox
                    :model-value="subCheckState(sub)"
                    :aria-label="`Select all groups in ${sub.name}`"
                    class="mt-0.5 sm:mt-0"
                    @update:model-value="(val: boolean | 'indeterminate') => pickMany(sub.groups, val)"
                  />
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 items-center gap-2 text-left"
                    :aria-expanded="isSubOpen(sub.name)"
                    @click="toggleSub(sub.name)"
                  >
                    <UIcon
                      :name="isSubOpen(sub.name) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                      class="size-4 shrink-0 text-muted"
                    />
                    <div class="min-w-0">
                      <p class="truncate font-semibold text-highlighted">
                        {{ displayOrgName(sub.name) }}
                      </p>
                      <p class="text-xs text-muted">
                        {{ plural(sub.group_count, 'group') }} · {{ sub.coverage.valid_final }} of {{ sub.coverage.total }} valid
                        <template v-if="sub.shortest_mtd">
                          · Shortest MTD {{ sub.shortest_mtd }}
                        </template>
                      </p>
                    </div>
                  </button>
                </div>

                <div class="flex flex-wrap items-center gap-3 ps-7 sm:ps-0">
                  <BiancaHealthChips
                    :alerts="sub.alerts"
                    :escalation-days="detail.data.value?.escalation_days"
                    :in-progress-count="sub.status_counts.no_final"
                    size="xs"
                  />
                  <span class="text-xs text-muted whitespace-nowrap">
                    {{ openSummaryLabel(sub) }}
                  </span>
                  <StatusBadge
                    v-if="sub.highest_category"
                    :scale="biaCategory"
                    :value="sub.highest_category"
                    size="sm"
                  />
                </div>
              </div>

              <!-- Uncollapsed Group Table -->
              <div
                v-if="isSubOpen(sub.name)"
                class="border-t border-default"
              >
                <BiancaRegisterGroupTable
                  :rows="sub.groups"
                  :picked-ids="pickedIdSet"
                  :show-directorate-column="false"
                  origin="directorate"
                  @pick="pickRow"
                  @pick-all="pickMany"
                  @open-history="openHistory"
                />
              </div>
            </UCard>
          </div>
        </template>
      </div>

      <!-- Sticky bottom bulk action bar -->
      <div
        v-if="pickedIds.length"
        class="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl border border-default bg-default/95 px-4 py-2.5 shadow-lg backdrop-blur"
      >
        <span class="text-sm font-medium text-highlighted">
          {{ plural(pickedIds.length, 'group') }} selected
        </span>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-if="can('bianca.approval.manage') && pickedRemindRenewalIds.length"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-bell-ring"
            :label="`Send reminder (${pickedRemindRenewalIds.length})`"
            :loading="busyActionKey === 'bulk-remind'"
            @click="runRemindRenewal(pickedRemindRenewalIds, plural(pickedRemindRenewalIds.length, 'selected group'), 'bulk-remind')"
          />
          <UButton
            v-if="can('bianca.create') && pickedGeneratableIds.length"
            size="sm"
            color="primary"
            icon="i-lucide-file-plus-2"
            :label="`Generate annual review (${pickedGeneratableIds.length})`"
            :loading="busyActionKey === 'bulk-gen'"
            @click="runGenerate(pickedGeneratableIds, plural(pickedGeneratableIds.length, 'selected group'), 'bulk-gen')"
          />
          <UButton
            v-if="can('bianca.report.download')"
            :to="biaExportUrl(exportFilters, pickedIds)"
            external
            download
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-file-spreadsheet"
            label="Export"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            label="Clear"
            @click="clearPicked"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
