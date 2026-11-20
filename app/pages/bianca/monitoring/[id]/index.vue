<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BiaFunctionItem } from '~/composables/useBiaWorkflow'
import { BIANCA_ALT_SITE_BY_CATEGORY } from '~/utils/biancaNotes'

definePageMeta({ permission: 'bianca.access' })

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id) || 1)
const { data: detail, status, error, refresh } = useBiaAssessmentDetail(id)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !detail.value)

const depsFilter = ref<'all' | 'issues'>('all')
const expandedRecovery = ref<Set<number>>(new Set())

watch(
  () => detail.value?.id,
  () => {
    const fns = detail.value?.functions ?? []
    expandedRecovery.value = fns.length <= 5
      ? new Set(fns.map((fn) => fn.seq_no))
      : new Set()
  },
  { immediate: true },
)

function toggleRecoveryRow(seqNo: number) {
  const next = new Set(expandedRecovery.value)
  if (next.has(seqNo)) next.delete(seqNo)
  else next.add(seqNo)
  expandedRecovery.value = next
}

function expandAllRecovery() {
  expandedRecovery.value = new Set((detail.value?.functions ?? []).map((fn) => fn.seq_no))
}

function collapseAllRecovery() {
  expandedRecovery.value = new Set()
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${formatNumber(count, 0)} ${count === 1 ? one : many}`
}

function isWfhStrategy(fn: BiaFunctionItem) {
  const code = (fn.alt_site_strategy_code || fn.alt_site_strategy || '').toLowerCase()
  return code.includes('work from home') || code.includes('wfh')
}

function altSiteOffRecommendation(fn: BiaFunctionItem) {
  const rec = BIANCA_ALT_SITE_BY_CATEGORY[fn.category]
  const chosen = fn.alt_site_strategy_code || fn.alt_site_strategy
  if (!rec || !chosen || chosen === '—') return null
  return rec.strategies.includes(chosen) ? null : rec.strategies.join(' / ')
}

function fnHasDepIssue(fn: BiaFunctionItem) {
  return fn.it_dependencies.some((d) => d.daat_negative || d.daat.startsWith('-') || d.rto_reaches_mtd || (d.workaround_gap_required && !d.critical_gap))
    || fn.non_it_dependencies.some((nd) => Boolean(nd.alignment_warnings?.length))
}

function nonItDependencySections(fn: BiaFunctionItem) {
  return [
    {
      key: 'upstream',
      title: 'Upstream dependencies (Part 2b)',
      empty: 'No upstream dependency (NA).',
      rows: fn.non_it_dependencies.filter((nd) => nd.direction === 'Upstream'),
    },
    {
      key: 'downstream',
      title: 'Downstream dependencies (Part 2b)',
      empty: 'No downstream dependency (NA).',
      rows: fn.non_it_dependencies.filter((nd) => nd.direction === 'Downstream'),
    },
  ]
}

const displayedDepFunctions = computed(() => {
  const fns = detail.value?.functions ?? []
  if (depsFilter.value === 'issues') return fns.filter(fnHasDepIssue)
  return fns
})

const hasPart1Notes = computed(() => Boolean(
  detail.value?.notes?.loss_formula
  || detail.value?.notes?.justification_regulatory
  || detail.value?.notes?.justification_customer,
))

const TABS = ['details', 'impact', 'dependencies', 'recovery', 'timings', 'signoff'] as const
type DetailTab = (typeof TABS)[number]
const tab = computed<DetailTab>({
  get: () => (TABS.includes(route.query.tab as DetailTab) ? route.query.tab as DetailTab : 'details'),
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'details' ? undefined : value } }),
})

const DEFAULT_IMPACT_PERIODS = ['4 Hours', 'Day 1', 'Day 2', 'Day 3', 'Week 1', 'Week 2', 'Week 3', 'Week 4']
const impactPeriods = computed(() =>
  detail.value?.periods?.length ? detail.value.periods : DEFAULT_IMPACT_PERIODS,
)
const peakPeriodLabel = computed(() =>
  detail.value?.loss_totals?.peak_period
  || impactPeriods.value[impactPeriods.value.length - 1]
  || 'Peak',
)
const scoreRangeLabel = computed(() => {
  const scores = detail.value?.impact_reference?.scores
  if (scores?.length) {
    return `${Math.min(...scores)}–${Math.max(...scores)}`
  }
  return '1–3'
})

const impactColumns = computed<TableColumn<BiaFunctionItem>[]>(() => [
  { accessorKey: 'seq_no', header: 'No' },
  { accessorKey: 'name', header: 'Business function' },
  { accessorKey: 'suggested_mtd', header: 'Suggested MTD' },
  { accessorKey: 'expected_mtd', header: 'Expected MTD' },
  { accessorKey: 'category', header: 'Category' },
  { id: 'peak_loss', header: `Peak loss (${peakPeriodLabel.value})`, meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } },
  { id: 'scores', header: 'Max Reg (A) / Cust (B)' },
])

const timingColumns: TableColumn<BiaFunctionItem>[] = [
  { accessorKey: 'seq_no', header: 'No' },
  { accessorKey: 'name', header: 'Business function' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'description', header: 'Brief description' },
  { accessorKey: 'frequency', header: 'Frequency' },
  { accessorKey: 'critical_timing', header: 'Critical timing' },
  { accessorKey: 'critical_activity', header: 'Activity performed' },
]

const signoffStatus = defineStatusScale<'approved' | 'pending' | 'rejected'>({
  approved: { label: 'Approved', color: 'success', icon: 'i-lucide-circle-check' },
  pending: { label: 'Waiting', color: 'warning', icon: 'i-lucide-hourglass' },
  rejected: { label: 'Returned', color: 'error', icon: 'i-lucide-undo-2' },
})

function scoreTone(score: number | null | undefined) {
  const alertScore = detail.value?.impact_reference?.score_alert ?? 3
  const scores = detail.value?.impact_reference?.scores
  const minScore = scores?.length ? Math.min(...scores) : 1
  if ((score ?? 0) >= alertScore) return 'font-semibold text-error'
  if ((score ?? 0) > minScore) return 'font-medium text-warning'
  return 'text-muted'
}

function lossTone(amount: number | null | undefined) {
  const alertIdr = detail.value?.impact_reference?.loss_alert_idr
  if (alertIdr != null && (amount ?? 0) > alertIdr) return 'font-semibold text-error'
  return ''
}

function lossCellTitle(amount: number | null | undefined) {
  const alertIdr = detail.value?.impact_reference?.loss_alert_idr
  if (alertIdr != null && (amount ?? 0) > alertIdr) {
    return `Exceeds financial loss alert (> ${formatCurrency(alertIdr)}) — triggers Suggested MTD`
  }
  return undefined
}

function impactScoreTitle(kind: 'regulatory' | 'customer', score: number | null | undefined) {
  const row = detail.value?.impact_reference?.impact_matrix?.find((m) => m.score === score)
  if (!row) return undefined
  return `Score ${row.score}: ${kind === 'regulatory' ? row.regulatory : row.customer}`
}

function triggerSummary(fn: BiaFunctionItem) {
  const triggers = fn.suggested_triggers ?? []
  if (!triggers.length) {
    return fn.computed_suggested_mtd ? `No threshold met · fallback: ${fn.computed_suggested_mtd}` : null
  }
  const alertIdr = detail.value?.impact_reference?.loss_alert_idr
  const alertScore = detail.value?.impact_reference?.score_alert ?? 3
  const labels = triggers.map((t) => {
    if (t === 'loss') return alertIdr != null ? `Loss > ${formatCurrency(alertIdr)}` : 'Loss'
    if (t === 'regulatory') return `Regulatory ≥ ${alertScore}`
    return `Customer ≥ ${alertScore}`
  })
  return `Triggered at ${fn.suggested_trigger_period || fn.computed_suggested_mtd} (${labels.join(', ')})`
}

function isTriggerPeriod(fn: BiaFunctionItem, idx: number) {
  return Boolean(fn.suggested_triggers?.length) && fn.suggested_trigger_index === idx
}

const detailSummary = computed(() => {
  const fns = detail.value?.functions ?? []
  let itGapCount = 0
  let rtoReachesMtdCount = 0
  let missingCriticalGapNote = 0
  let unalignedNonItCount = 0
  let seatGap = 0
  let missingVitalCritical = 0
  let staffAnomalyCount = 0
  let altSiteMismatchCount = 0
  let mtdExceedCount = 0
  let suggestedMismatchCount = 0
  let critical = 0
  let important = 0
  let others = 0

  for (const fn of fns) {
    if (fn.category === 'Business Critical') critical += 1
    else if (fn.category === 'Important') important += 1
    else others += 1

    if (fn.expected_within_suggested === false) mtdExceedCount += 1
    if (fn.suggested_mtd_matches === false) suggestedMismatchCount += 1

    for (const dep of fn.it_dependencies) {
      if (dep.daat_negative || dep.daat.startsWith('-')) itGapCount += 1
      if (dep.rto_reaches_mtd) rtoReachesMtdCount += 1
      if (dep.workaround_gap_required && !dep.critical_gap) missingCriticalGapNote += 1
    }
    for (const ndep of fn.non_it_dependencies) {
      if (ndep.alignment_warnings?.length) unalignedNonItCount += 1
    }
    if (!isWfhStrategy(fn) && fn.bcp_seats_current < fn.bcp_seats_required) {
      seatGap += fn.bcp_seats_required - fn.bcp_seats_current
    }
    if (
      fn.category === 'Business Critical'
      && ((!fn.vital_record || fn.vital_record === '—') || (!fn.vital_record_location || fn.vital_record_location === '—'))
    ) {
      missingVitalCritical += 1
    }
    if (fn.required_staff > fn.total_staff && fn.total_staff > 0) {
      staffAnomalyCount += 1
    }
    if (altSiteOffRecommendation(fn)) {
      altSiteMismatchCount += 1
    }
  }

  const ra = detail.value?.ra_questionnaire
  const notes = detail.value?.notes
  const missingRaJustification = Boolean(ra?.ra_justification_required && !notes?.ra_justification)
  const missingRtoJustification = Boolean(rtoReachesMtdCount > 0 && !notes?.justification_rto)
  const missingDepJustification = Boolean(unalignedNonItCount > 0 && !notes?.justification_dependency)

  return {
    fnCount: fns.length,
    critical,
    important,
    others,
    itGapCount,
    rtoReachesMtdCount,
    missingCriticalGapNote,
    unalignedNonItCount,
    seatGap,
    missingVitalCritical,
    staffAnomalyCount,
    altSiteMismatchCount,
    mtdExceedCount,
    suggestedMismatchCount,
    missingRaJustification,
    missingRtoJustification,
    missingDepJustification,
  }
})

const attentionItems = computed(() => {
  const s = detailSummary.value
  const items: { text: string, targetTab: DetailTab, tabLabel: string, severity: 'error' | 'warning' }[] = []
  if (s.missingRaJustification) {
    items.push({ text: 'Risk assessment justification is required (BC not considered and no BC controls included)', targetTab: 'details', tabLabel: 'Details', severity: 'error' })
  }
  if (s.mtdExceedCount > 0) {
    items.push({ text: `${plural(s.mtdExceedCount, 'business function')} has Expected MTD longer than Suggested MTD`, targetTab: 'impact', tabLabel: 'Impact', severity: 'error' })
  }
  if (s.suggestedMismatchCount > 0) {
    items.push({ text: `${plural(s.suggestedMismatchCount, 'business function')} has Suggested MTD differing from the impact rule`, targetTab: 'impact', tabLabel: 'Impact', severity: 'warning' })
  }
  if (s.itGapCount > 0) {
    items.push({ text: `${plural(s.itGapCount, 'IT application')} has a negative DAAT (RTO + backlog exceeds Expected MTD)`, targetTab: 'dependencies', tabLabel: 'Dependencies', severity: 'error' })
  }
  if (s.missingCriticalGapNote > 0) {
    items.push({ text: `${plural(s.missingCriticalGapNote, 'IT application')} requires a mandatory Workaround Critical Gap note`, targetTab: 'dependencies', tabLabel: 'Dependencies', severity: 'error' })
  }
  if (s.missingRtoJustification) {
    items.push({ text: 'Part 2a RTO justification is missing (at least one IT RTO reaches or exceeds Expected MTD)', targetTab: 'dependencies', tabLabel: 'Dependencies', severity: 'error' })
  }
  if (s.missingDepJustification) {
    items.push({ text: 'Part 2b dependency justification is missing for misaligned upstream/downstream rows', targetTab: 'dependencies', tabLabel: 'Dependencies', severity: 'error' })
  } else if (s.unalignedNonItCount > 0) {
    items.push({ text: `${plural(s.unalignedNonItCount, 'upstream/downstream dependency row')} has lower capacity or longer MTD than the function`, targetTab: 'dependencies', tabLabel: 'Dependencies', severity: 'warning' })
  }
  if (s.seatGap > 0) {
    items.push({ text: `BCP seat shortage of ${plural(s.seatGap, 'seat')} at alternate site (excluding WFH)`, targetTab: 'recovery', tabLabel: 'Recovery', severity: 'warning' })
  }
  if (s.missingVitalCritical > 0) {
    items.push({ text: `${plural(s.missingVitalCritical, 'Business Critical function')} missing vital record or storage location`, targetTab: 'recovery', tabLabel: 'Recovery', severity: 'error' })
  }
  if (s.altSiteMismatchCount > 0) {
    items.push({ text: `${plural(s.altSiteMismatchCount, 'function')} uses an alternate site strategy outside category guidance`, targetTab: 'recovery', tabLabel: 'Recovery', severity: 'warning' })
  }
  if (s.staffAnomalyCount > 0) {
    items.push({ text: `${plural(s.staffAnomalyCount, 'function')} has required recovery staff exceeding total staff`, targetTab: 'recovery', tabLabel: 'Recovery', severity: 'warning' })
  }
  return items
})

const tabAlertCounts = computed<Record<DetailTab, number>>(() => {
  const counts: Record<DetailTab, number> = {
    details: 0,
    impact: 0,
    dependencies: 0,
    recovery: 0,
    timings: 0,
    signoff: 0,
  }
  for (const item of attentionItems.value) {
    counts[item.targetTab] += 1
  }
  return counts
})

const tabs = computed(() => [
  { label: 'Details & personnel', value: 'details', icon: 'i-lucide-building-2', slot: 'details' as const, badge: tabAlertCounts.value.details || undefined },
  { label: 'Impact assessment', value: 'impact', icon: 'i-lucide-chart-column', slot: 'impact' as const, badge: tabAlertCounts.value.impact || undefined },
  { label: 'IT & non-IT dependencies', value: 'dependencies', icon: 'i-lucide-network', slot: 'dependencies' as const, badge: tabAlertCounts.value.dependencies || undefined },
  { label: 'Recovery strategies', value: 'recovery', icon: 'i-lucide-life-buoy', slot: 'recovery' as const, badge: tabAlertCounts.value.recovery || undefined },
  { label: 'Critical timings', value: 'timings', icon: 'i-lucide-calendar', slot: 'timings' as const, badge: tabAlertCounts.value.timings || undefined },
  { label: 'Sign-off', value: 'signoff', icon: 'i-lucide-badge-check', slot: 'signoff' as const, badge: tabAlertCounts.value.signoff || undefined },
])

const lossPeriodTotals = computed(() =>
  impactPeriods.value.map((_, idx) =>
    (detail.value?.functions ?? []).reduce((sum, fn) => sum + (fn.losses?.[idx] ?? 0), 0),
  ),
)
</script>

<template>
  <SkeletonCard
    v-if="showSkeleton"
    fields
    :lines="8"
  />

  <UAlert
    v-else-if="error || !detail"
    color="error"
    variant="subtle"
    icon="i-lucide-circle-alert"
    title="Could not load BIA"
    :description="error ? apiErrorMessage(error) : 'BIA assessment not found.'"
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-arrow-left"
        label="Back to monitoring"
        to="/bianca/monitoring"
      />
      <UButton
        color="neutral"
        variant="outline"
        label="Try again"
        @click="refresh()"
      />
    </template>
  </UAlert>

  <AppPage
    v-else
    :title="`${detail.group.name} (${detail.ref_no})`"
    icon="i-lucide-chart-column"
    :description="`${detail.group.directorate} › ${detail.group.sub_directorate} · Assessment date ${formatDate(detail.assessment_date)}`"
    :crumbs="[
      { label: 'BIANCA' },
      { label: 'Monitoring', to: '/bianca/monitoring' },
      ...(detail.group.directorate && detail.group.directorate !== '—'
        ? [{ label: detail.group.directorate, to: `/bianca/monitoring/directorate?name=${encodeURIComponent(detail.group.directorate)}` }]
        : []),
      { label: detail.ref_no },
    ]"
  >
    <template #actions>
      <UBadge
        v-if="detail.config_version"
        color="neutral"
        variant="subtle"
      >
        Config {{ detail.config_version }}
      </UBadge>
      <StatusBadge
        :scale="biaStatus"
        :value="biaStatusKey(detail)"
      />
      <StatusBadge
        v-if="detail.highest_category"
        :scale="biaCategory"
        :value="detail.highest_category"
      />
      <UButton
        v-if="detail.can_edit"
        :to="biaPath('manage', detail.id)"
        color="neutral"
        variant="outline"
        icon="i-lucide-file-pen"
        label="Edit draft in Manage"
      />
      <UButton
        to="/bianca/monitoring"
        color="neutral"
        variant="outline"
        icon="i-lucide-arrow-left"
        label="Back to monitoring"
      />
    </template>

    <div class="mb-6 space-y-4">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          class="rounded-lg border border-default bg-default p-3.5 text-left transition hover:bg-elevated/60"
          @click="tab = 'impact'"
        >
          <p class="text-xs text-muted">
            Business functions
          </p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-highlighted">
            {{ detailSummary.fnCount }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ detailSummary.critical }} Critical · {{ detailSummary.important }} Important · {{ detailSummary.others }} Others
          </p>
        </button>
        <button
          type="button"
          class="rounded-lg border border-default bg-default p-3.5 text-left transition hover:bg-elevated/60"
          @click="tab = 'impact'"
        >
          <p class="text-xs text-muted">
            Shortest Expected MTD
          </p>
          <p class="mt-1 text-2xl font-semibold text-highlighted">
            {{ detail.shortest_mtd || '—' }}
          </p>
          <p class="mt-1 text-xs text-muted">
            Highest priority recovery target
          </p>
        </button>
        <button
          type="button"
          class="rounded-lg border border-default bg-default p-3.5 text-left transition hover:bg-elevated/60"
          @click="tab = 'dependencies'"
        >
          <p class="text-xs text-muted">
            IT DAAT gaps
          </p>
          <p
            class="mt-1 text-2xl font-semibold tabular-nums"
            :class="detailSummary.itGapCount > 0 ? 'text-error' : 'text-highlighted'"
          >
            {{ detailSummary.itGapCount }}
          </p>
          <p class="mt-1 text-xs text-muted">
            Apps exceeding Expected MTD
          </p>
        </button>
        <button
          type="button"
          class="rounded-lg border border-default bg-default p-3.5 text-left transition hover:bg-elevated/60"
          @click="tab = 'recovery'"
        >
          <p class="text-xs text-muted">
            BCP seat shortage
          </p>
          <p
            class="mt-1 text-2xl font-semibold tabular-nums"
            :class="detailSummary.seatGap > 0 ? 'text-error' : 'text-highlighted'"
          >
            {{ detailSummary.seatGap }}
          </p>
          <p class="mt-1 text-xs text-muted">
            Seats short at alternate site
          </p>
        </button>
      </div>

      <UAlert
        v-if="attentionItems.length"
        :color="attentionItems.some((i) => i.severity === 'error') ? 'error' : 'warning'"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Needs attention (${attentionItems.length})`"
      >
        <template #description>
          <ul class="mt-1.5 space-y-1.5 text-xs">
            <li
              v-for="item in attentionItems"
              :key="item.text"
              class="flex flex-wrap items-center justify-between gap-2"
            >
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="size-1.5 shrink-0 rounded-full"
                  :class="item.severity === 'error' ? 'bg-error' : 'bg-warning'"
                />
                <span>{{ item.text }}</span>
              </span>
              <UButton
                size="xs"
                :color="item.severity === 'error' ? 'error' : 'warning'"
                variant="link"
                class="p-0"
                :label="`Review in ${item.tabLabel}`"
                trailing-icon="i-lucide-arrow-right"
                @click="tab = item.targetTab"
              />
            </li>
          </ul>
        </template>
      </UAlert>
    </div>

    <UTabs
      v-model="tab"
      :items="tabs"
      variant="link"
      :unmount-on-hide="false"
    >
      <template #details>
        <div class="mt-4 grid gap-6 lg:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="text-base font-semibold text-highlighted">
                Group & work locations
              </h2>
            </template>
            <dl class="divide-y divide-default text-sm">
              <div class="grid grid-cols-3 gap-4 py-2.5">
                <dt class="text-muted">
                  Group
                </dt>
                <dd class="col-span-2 font-medium text-highlighted">
                  {{ detail.group.name }} ({{ detail.group.code }})
                </dd>
              </div>
              <div class="grid grid-cols-3 gap-4 py-2.5">
                <dt class="text-muted">
                  Directorate
                </dt>
                <dd class="col-span-2">
                  {{ detail.group.directorate }}
                </dd>
              </div>
              <div class="grid grid-cols-3 gap-4 py-2.5">
                <dt class="text-muted">
                  Sub directorate
                </dt>
                <dd class="col-span-2">
                  {{ detail.group.sub_directorate }}
                </dd>
              </div>
              <div class="grid grid-cols-3 gap-4 py-2.5">
                <dt class="text-muted">
                  Group description
                </dt>
                <dd class="col-span-2 whitespace-pre-line text-muted">
                  {{ detail.group.description }}
                </dd>
              </div>
              <div class="grid grid-cols-3 gap-4 py-2.5">
                <dt class="text-muted">
                  Main work location
                </dt>
                <dd class="col-span-2">
                  <p class="font-medium text-highlighted">
                    {{ detail.group.main_building }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ detail.group.main_address }}
                  </p>
                </dd>
              </div>
              <div class="grid grid-cols-3 gap-4 py-2.5">
                <dt class="text-muted">
                  Alternate work location
                </dt>
                <dd class="col-span-2">
                  <p class="font-medium text-highlighted">
                    {{ detail.group.alt_building }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ detail.group.alt_address }}
                  </p>
                </dd>
              </div>
              <div class="grid grid-cols-3 gap-4 py-2.5">
                <dt class="text-muted">
                  Group recovery strategy
                </dt>
                <dd class="col-span-2">
                  {{ detail.group.recovery_strategy }}
                </dd>
              </div>
            </dl>
          </UCard>

          <div class="space-y-6">
            <UCard>
              <template #header>
                <h2 class="text-base font-semibold text-highlighted">
                  BCM coordinators & BIA users
                </h2>
              </template>
              <dl class="divide-y divide-default text-sm">
                <div
                  v-if="detail.created_by"
                  class="grid grid-cols-3 gap-4 py-2.5"
                >
                  <dt class="text-muted">
                    Created by
                  </dt>
                  <dd class="col-span-2 font-medium text-highlighted">
                    {{ detail.created_by }}
                  </dd>
                </div>
                <div class="grid grid-cols-3 gap-4 py-2.5">
                  <dt class="text-muted">
                    BCM Coordinator
                  </dt>
                  <dd class="col-span-2">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <p class="font-medium text-highlighted">
                        {{ detail.coordinator.name }} ({{ detail.coordinator.nik }})
                      </p>
                      <UBadge
                        v-if="detail.coordinator.id"
                        color="neutral"
                        variant="subtle"
                        size="xs"
                        icon="i-lucide-user-check"
                        label="Directory"
                      />
                    </div>
                    <p class="text-xs text-muted">
                      {{ detail.coordinator.email }} · {{ detail.coordinator.phone }}
                    </p>
                  </dd>
                </div>
                <div class="grid grid-cols-3 gap-4 py-2.5">
                  <dt class="text-muted">
                    Alternate coordinator
                  </dt>
                  <dd class="col-span-2">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <p class="font-medium text-highlighted">
                        {{ detail.alt_coordinator.name }} ({{ detail.alt_coordinator.nik }})
                      </p>
                      <UBadge
                        v-if="detail.alt_coordinator.id"
                        color="neutral"
                        variant="subtle"
                        size="xs"
                        icon="i-lucide-user-check"
                        label="Directory"
                      />
                    </div>
                    <p class="text-xs text-muted">
                      {{ detail.alt_coordinator.email }} · {{ detail.alt_coordinator.phone }}
                    </p>
                  </dd>
                </div>
                <div class="grid grid-cols-3 gap-4 py-2.5">
                  <dt class="text-muted">
                    Group BIA users
                  </dt>
                  <dd class="col-span-2">
                    <div
                      v-if="detail.group_users?.length"
                      class="flex flex-wrap gap-1.5"
                    >
                      <UBadge
                        v-for="member in detail.group_users"
                        :key="member.id"
                        color="neutral"
                        variant="subtle"
                      >
                        {{ member.name }}<template v-if="member.org_level">
                          ({{ member.org_level }})
                        </template><template v-if="member.roles.length">
                          · {{ member.roles[0] }}
                        </template>
                      </UBadge>
                    </div>
                    <span
                      v-else
                      class="text-muted"
                    >No active BIANCA user assigned to this group</span>
                  </dd>
                </div>
                <div
                  v-if="detail.directorate_users?.length"
                  class="grid grid-cols-3 gap-4 py-2.5"
                >
                  <dt class="text-muted">
                    Directorate / Sub
                  </dt>
                  <dd class="col-span-2">
                    <div class="flex flex-wrap gap-1.5">
                      <UBadge
                        v-for="leader in detail.directorate_users"
                        :key="`dir-${leader.id}`"
                        color="neutral"
                        variant="outline"
                      >
                        {{ leader.name }}<template v-if="leader.org_level">
                          ({{ leader.org_level }})
                        </template><template v-if="leader.sub_directorate">
                          · {{ leader.sub_directorate }}
                        </template>
                      </UBadge>
                    </div>
                  </dd>
                </div>
              </dl>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="text-base font-semibold text-highlighted">
                  Personnel & risk assessment questionnaire
                </h2>
              </template>
              <dl class="divide-y divide-default text-sm">
                <div class="grid grid-cols-3 gap-4 py-2.5">
                  <dt class="text-muted">
                    Total personnel
                  </dt>
                  <dd class="col-span-2 font-medium tabular-nums text-highlighted">
                    {{ formatNumber(detail.ra_questionnaire.total_staff, 0) }} staff
                    <span
                      v-if="detail.ra_questionnaire.personnel_breakdown?.length"
                      class="font-normal text-muted"
                    >
                      ({{ detail.ra_questionnaire.personnel_breakdown.map((g) => `${g.label}: ${g.count}`).join(', ') }})
                    </span>
                    <span
                      v-else
                      class="font-normal text-muted"
                    >
                      (U1–U3: {{ detail.ra_questionnaire.senior_mgmt }}, U4–U5: {{ detail.ra_questionnaire.middle_mgmt }}, U6–U9: {{ detail.ra_questionnaire.executive_mgr }}, U10–U11: {{ detail.ra_questionnaire.staff }})
                    </span>
                    <template v-if="detail.ra_questionnaire.personnel_breakdown?.some((g) => g.note)">
                      <p
                        v-for="grade in detail.ra_questionnaire.personnel_breakdown.filter((g) => g.note)"
                        :key="`note-${grade.code}`"
                        class="mt-1 text-xs font-normal text-muted"
                      >
                        {{ grade.label }} note: {{ grade.note }}
                      </p>
                    </template>
                    <p
                      v-else-if="detail.ra_questionnaire.others_note"
                      class="mt-1 text-xs font-normal text-muted"
                    >
                      Others note: {{ detail.ra_questionnaire.others_note }}
                    </p>
                  </dd>
                </div>
                <div class="grid grid-cols-3 gap-4 py-2.5">
                  <dt class="text-muted">
                    BC considered in RA
                  </dt>
                  <dd class="col-span-2">
                    {{ detail.ra_questionnaire.considered_bc }}
                  </dd>
                </div>
                <div class="grid grid-cols-3 gap-4 py-2.5">
                  <dt class="text-muted">
                    Risk assessment tools
                  </dt>
                  <dd class="col-span-2">
                    {{ detail.ra_questionnaire.tools_used }} (BC controls included: {{ detail.ra_questionnaire.controls_included }})
                  </dd>
                </div>
                <div class="grid grid-cols-3 gap-4 py-2.5">
                  <dt class="text-muted">
                    Location RA completed
                  </dt>
                  <dd class="col-span-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <span>{{ detail.ra_questionnaire.location_ra_completed }}</span>
                      <UBadge
                        v-if="detail.ra_questionnaire.location_ra_completed_flag === false"
                        color="warning"
                        variant="subtle"
                        size="xs"
                        label="Follow up with Head of Sub-Directorate / BCM"
                      />
                    </div>
                  </dd>
                </div>
                <div
                  v-if="detail.notes?.ra_justification || detail.ra_questionnaire.ra_justification_required"
                  class="grid grid-cols-3 gap-4 py-2.5"
                >
                  <dt class="text-muted">
                    RA justification
                  </dt>
                  <dd class="col-span-2">
                    <span v-if="detail.notes?.ra_justification">{{ detail.notes.ra_justification }}</span>
                    <UBadge
                      v-else
                      color="error"
                      variant="subtle"
                      size="xs"
                      label="Required when BC is not considered/included"
                    />
                  </dd>
                </div>
              </dl>
            </UCard>
          </div>
        </div>
      </template>

      <template #impact>
        <div class="mt-4 space-y-6">
          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-4">
              <p class="text-sm text-muted">
                Part 1 &amp; Part 2a: Suggested vs Expected MTD, Business Function Category, peak financial loss, and maximum impact scores ({{ scoreRangeLabel }}).
              </p>
              <p
                v-if="detail.loss_totals"
                class="text-xs text-muted tabular-nums"
              >
                Total peak loss ({{ peakPeriodLabel }}):
                <span class="font-semibold text-highlighted">{{ formatCurrency(detail.loss_totals.peak_loss ?? detail.loss_totals.fin_loss_w4) }}</span>
              </p>
            </div>
            <UTable
              :data="detail.functions"
              :columns="impactColumns"
              :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
            >
              <template #suggested_mtd-header>
                <span class="inline-flex items-center gap-1">
                  <span>Suggested MTD</span>
                  <UTooltip text="Recommended Maximum Tolerable Downtime derived from financial loss and regulatory/customer impact.">
                    <UIcon
                      name="i-lucide-info"
                      class="size-3.5 text-muted"
                    />
                  </UTooltip>
                </span>
              </template>
              <template #expected_mtd-header>
                <span class="inline-flex items-center gap-1">
                  <span>Expected MTD</span>
                  <UTooltip text="Committed Maximum Tolerable Downtime target for this business function.">
                    <UIcon
                      name="i-lucide-info"
                      class="size-3.5 text-muted"
                    />
                  </UTooltip>
                </span>
              </template>
              <template #name-cell="{ row }">
                <span class="font-medium text-highlighted">{{ row.original.name }}</span>
              </template>
              <template #suggested_mtd-cell="{ row }">
                <div class="inline-flex items-center gap-1.5">
                  <span>{{ row.original.suggested_mtd }}</span>
                  <UTooltip
                    v-if="row.original.suggested_mtd_matches === false && row.original.computed_suggested_mtd"
                    :text="`Rule suggests ${row.original.computed_suggested_mtd}${triggerSummary(row.original) ? ` · ${triggerSummary(row.original)}` : ''}`"
                  >
                    <UIcon
                      name="i-lucide-triangle-alert"
                      class="size-3.5 text-warning"
                    />
                  </UTooltip>
                  <UTooltip
                    v-else-if="triggerSummary(row.original)"
                    :text="triggerSummary(row.original)!"
                  >
                    <UIcon
                      name="i-lucide-calculator"
                      class="size-3.5 text-muted"
                    />
                  </UTooltip>
                </div>
              </template>
              <template #expected_mtd-cell="{ row }">
                <div class="inline-flex items-center gap-1.5">
                  <span :class="row.original.expected_within_suggested === false ? 'font-medium text-error' : ''">
                    {{ row.original.expected_mtd }}
                  </span>
                  <UTooltip
                    v-if="row.original.expected_within_suggested === true"
                    text="Expected MTD is equal to or shorter than Suggested MTD"
                  >
                    <UIcon
                      name="i-lucide-circle-check"
                      class="size-3.5 text-success"
                    />
                  </UTooltip>
                  <UTooltip
                    v-else-if="row.original.expected_within_suggested === false"
                    text="Expected MTD exceeds Suggested MTD"
                  >
                    <UIcon
                      name="i-lucide-triangle-alert"
                      class="size-3.5 text-error"
                    />
                  </UTooltip>
                </div>
              </template>
              <template #category-cell="{ row }">
                <StatusBadge
                  :scale="biaCategory"
                  :value="row.original.category"
                  size="sm"
                />
              </template>
              <template #peak_loss-cell="{ row }">
                <span :class="lossTone(row.original.peak_loss ?? row.original.fin_loss_w4)">
                  {{ formatCurrency(row.original.peak_loss ?? row.original.fin_loss_w4) }}
                </span>
              </template>
              <template #scores-cell="{ row }">
                <span class="tabular-nums">A: {{ row.original.reg_score_max }} · B: {{ row.original.cust_score_max }}</span>
              </template>
            </UTable>
          </UCard>

          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <h2 class="text-base font-semibold text-highlighted">
                Potential cumulative financial loss (IDR) — {{ impactPeriods[0] }} to {{ impactPeriods[impactPeriods.length - 1] }}
              </h2>
            </template>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-default text-xs font-medium uppercase tracking-wide text-muted">
                    <th class="py-3 ps-4 pe-3 whitespace-nowrap">
                      No
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      Business function
                    </th>
                    <th
                      v-for="periodLabel in impactPeriods"
                      :key="`loss-h-${periodLabel}`"
                      class="py-3 px-3 text-right whitespace-nowrap"
                    >
                      {{ periodLabel }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr
                    v-for="fn in detail.functions"
                    :key="`loss-${fn.seq_no}`"
                  >
                    <td class="py-3 ps-4 pe-3 tabular-nums text-muted">
                      {{ fn.seq_no }}
                    </td>
                    <td class="py-3 px-3 font-medium text-highlighted whitespace-nowrap">
                      {{ fn.name }}
                    </td>
                    <td
                      v-for="(periodLabel, idx) in impactPeriods"
                      :key="`loss-${fn.seq_no}-${periodLabel}`"
                      class="py-3 px-3 text-right tabular-nums whitespace-nowrap"
                      :class="[lossTone(fn.losses?.[idx]), isTriggerPeriod(fn, idx) ? 'bg-error/10 ring-1 ring-inset ring-error/30' : '']"
                      :title="lossCellTitle(fn.losses?.[idx])"
                    >
                      {{ formatCurrency(fn.losses?.[idx] ?? 0) }}
                    </td>
                  </tr>
                </tbody>
                <tfoot v-if="detail.functions.length">
                  <tr class="border-t border-default bg-elevated/40 font-semibold text-highlighted">
                    <td class="py-3 ps-4 pe-3" />
                    <td class="py-3 px-3 whitespace-nowrap">
                      Total
                    </td>
                    <td
                      v-for="(totalVal, idx) in lossPeriodTotals"
                      :key="`loss-total-${idx}`"
                      class="py-3 px-3 text-right tabular-nums whitespace-nowrap"
                    >
                      {{ formatCurrency(totalVal) }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </UCard>

          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="text-base font-semibold text-highlighted">
                  Potential regulatory (A) &amp; customer service (B) impact (Score {{ scoreRangeLabel }}) — {{ impactPeriods[0] }} to {{ impactPeriods[impactPeriods.length - 1] }}
                </h2>
                <span class="text-xs text-muted">A = Regulatory Impact · B = Customer Service Impact</span>
              </div>
            </template>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-default text-xs font-medium uppercase tracking-wide text-muted">
                    <th class="py-3 ps-4 pe-3 whitespace-nowrap">
                      No
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      Business function
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      Impact
                    </th>
                    <th
                      v-for="periodLabel in impactPeriods"
                      :key="`score-h-${periodLabel}`"
                      class="py-3 px-3 text-center whitespace-nowrap"
                    >
                      {{ periodLabel }}
                    </th>
                    <th class="py-3 px-3 text-right whitespace-nowrap">
                      Suggested MTD
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <template
                    v-for="fn in detail.functions"
                    :key="`score-${fn.seq_no}`"
                  >
                    <tr>
                      <td
                        rowspan="2"
                        class="py-3 ps-4 pe-3 align-top tabular-nums text-muted"
                      >
                        {{ fn.seq_no }}
                      </td>
                      <td
                        rowspan="2"
                        class="py-3 px-3 align-top font-medium text-highlighted whitespace-nowrap"
                      >
                        {{ fn.name }}
                      </td>
                      <td class="py-2 px-3 text-xs font-medium text-muted whitespace-nowrap">
                        Regulatory (A)
                      </td>
                      <td
                        v-for="(periodLabel, idx) in impactPeriods"
                        :key="`reg-${fn.seq_no}-${periodLabel}`"
                        class="py-2 px-3 text-center tabular-nums"
                        :class="[scoreTone(fn.regulatory_scores?.[idx]), isTriggerPeriod(fn, idx) ? 'bg-error/10 ring-1 ring-inset ring-error/30' : '']"
                        :title="impactScoreTitle('regulatory', fn.regulatory_scores?.[idx])"
                      >
                        {{ fn.regulatory_scores?.[idx] ?? '—' }}
                      </td>
                      <td
                        rowspan="2"
                        class="py-3 px-3 text-right align-top"
                      >
                        <p class="font-medium text-highlighted whitespace-nowrap">
                          {{ fn.suggested_mtd }}
                        </p>
                        <p
                          v-if="fn.suggested_mtd_matches === false && fn.computed_suggested_mtd"
                          class="mt-1 text-[11px] font-medium text-warning whitespace-nowrap"
                        >
                          Rule suggests: {{ fn.computed_suggested_mtd }}
                        </p>
                        <p
                          v-if="triggerSummary(fn)"
                          class="mt-1 max-w-56 text-[11px] leading-snug text-muted"
                        >
                          {{ triggerSummary(fn) }}
                        </p>
                      </td>
                    </tr>
                    <tr class="bg-elevated/30">
                      <td class="py-2 px-3 text-xs font-medium text-muted whitespace-nowrap">
                        Customer (B)
                      </td>
                      <td
                        v-for="(periodLabel, idx) in impactPeriods"
                        :key="`cust-${fn.seq_no}-${periodLabel}`"
                        class="py-2 px-3 text-center tabular-nums"
                        :class="[scoreTone(fn.customer_scores?.[idx]), isTriggerPeriod(fn, idx) ? 'bg-error/10 ring-1 ring-inset ring-error/30' : '']"
                        :title="impactScoreTitle('customer', fn.customer_scores?.[idx])"
                      >
                        {{ fn.customer_scores?.[idx] ?? '—' }}
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </UCard>

          <UCard v-if="detail.impact_reference">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="text-base font-semibold text-highlighted">
                  Impact reference matrix (Config {{ detail.config_version || 'active' }})
                </h2>
                <span class="text-xs text-muted">
                  Alert threshold: &gt; {{ formatCurrency(detail.impact_reference.loss_alert_idr) }} or Score ≥ {{ detail.impact_reference.score_alert }}
                </span>
              </div>
            </template>
            <div class="grid gap-6 lg:grid-cols-2">
              <div v-if="detail.impact_reference.financial_bands.length">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
                  Potential cumulative financial loss matrix
                </h3>
                <dl class="mt-2 divide-y divide-default text-sm">
                  <div
                    v-for="band in detail.impact_reference.financial_bands"
                    :key="band.code"
                    class="flex items-baseline justify-between gap-4 py-2"
                  >
                    <dt class="font-medium text-highlighted">
                      {{ band.label }}
                    </dt>
                    <dd class="text-right text-muted tabular-nums">
                      {{ band.description }}
                    </dd>
                  </div>
                </dl>
              </div>
              <div v-if="detail.impact_reference.impact_matrix.length">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
                  Regulatory (A) &amp; customer service (B) matrix
                </h3>
                <div class="mt-2 divide-y divide-default text-xs">
                  <div
                    v-for="item in detail.impact_reference.impact_matrix"
                    :key="item.score"
                    class="py-2"
                  >
                    <p
                      class="font-semibold"
                      :class="scoreTone(item.score)"
                    >
                      Score {{ item.score }}
                    </p>
                    <p class="mt-0.5 text-muted">
                      <span class="font-medium text-highlighted">Regulatory (A):</span> {{ item.regulatory }}
                    </p>
                    <p class="mt-0.5 text-muted">
                      <span class="font-medium text-highlighted">Customer (B):</span> {{ item.customer }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="detail.impact_reference.expected_mtd?.length"
              class="mt-4 border-t border-default pt-4"
            >
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
                Expected MTD → Business Function Category mapping (Config {{ detail.config_version || 'active' }})
              </h3>
              <div class="mt-2 flex flex-wrap gap-2">
                <div
                  v-for="row in detail.impact_reference.expected_mtd"
                  :key="row.value"
                  class="inline-flex items-center gap-1.5 rounded-md border border-default px-2.5 py-1 text-xs"
                >
                  <span class="font-medium text-highlighted">{{ row.value }}</span>
                  <span class="text-muted">→</span>
                  <StatusBadge
                    :scale="biaCategory"
                    :value="row.category"
                    size="sm"
                  />
                </div>
              </div>
            </div>
            <div
              v-if="detail.guides?.suggested_mtd || detail.guides?.expected_mtd"
              class="mt-4 space-y-1.5 border-t border-default pt-3 text-xs text-muted"
            >
              <p v-if="detail.guides?.suggested_mtd">
                <span class="font-medium text-highlighted">Suggested MTD guide:</span> {{ detail.guides.suggested_mtd }}
              </p>
              <p v-if="detail.guides?.expected_mtd">
                <span class="font-medium text-highlighted">Expected MTD guide:</span> {{ detail.guides.expected_mtd }}
              </p>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="text-base font-semibold text-highlighted">
                Financial loss formula &amp; rating justifications (Part 1)
              </h2>
            </template>
            <dl class="divide-y divide-default text-sm">
              <div class="grid grid-cols-3 gap-4 py-2.5">
                <dt class="text-muted">
                  Financial loss formula
                </dt>
                <dd class="col-span-2 whitespace-pre-line">
                  <span v-if="detail.notes?.loss_formula">{{ detail.notes.loss_formula }}</span>
                  <UBadge
                    v-else
                    color="warning"
                    variant="subtle"
                    size="xs"
                    label="Not provided"
                  />
                </dd>
              </div>
              <div
                v-if="detail.notes?.justification_regulatory || !hasPart1Notes"
                class="grid grid-cols-3 gap-4 py-2.5"
              >
                <dt class="text-muted">
                  Regulatory impact (A)
                </dt>
                <dd class="col-span-2 whitespace-pre-line text-muted">
                  {{ detail.notes?.justification_regulatory || '—' }}
                </dd>
              </div>
              <div
                v-if="detail.notes?.justification_customer || !hasPart1Notes"
                class="grid grid-cols-3 gap-4 py-2.5"
              >
                <dt class="text-muted">
                  Customer service impact (B)
                </dt>
                <dd class="col-span-2 whitespace-pre-line text-muted">
                  {{ detail.notes?.justification_customer || '—' }}
                </dd>
              </div>
            </dl>
          </UCard>
        </div>
      </template>

      <template #dependencies>
        <div class="mt-4 space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div
              v-if="detail.guides?.it_dependency || detail.guides?.non_it_dependency"
              class="min-w-0 flex-1 space-y-1 text-xs text-muted"
            >
              <p v-if="detail.guides?.it_dependency">
                <span class="font-medium text-highlighted">IT dependency guide:</span> {{ detail.guides.it_dependency }}
              </p>
              <p v-if="detail.guides?.non_it_dependency">
                <span class="font-medium text-highlighted">Non-IT dependency guide:</span> {{ detail.guides.non_it_dependency }}
              </p>
            </div>
            <div
              class="inline-flex shrink-0 rounded-md border border-default p-0.5 text-xs"
              role="group"
              aria-label="Filter dependency functions"
            >
              <button
                type="button"
                class="rounded px-2.5 py-1 font-medium transition"
                :class="depsFilter === 'all' ? 'bg-elevated text-highlighted shadow-xs' : 'text-muted hover:text-highlighted'"
                @click="depsFilter = 'all'"
              >
                All functions ({{ detail.functions.length }})
              </button>
              <button
                type="button"
                class="rounded px-2.5 py-1 font-medium transition"
                :class="depsFilter === 'issues' ? 'bg-elevated text-highlighted shadow-xs' : 'text-muted hover:text-highlighted'"
                @click="depsFilter = 'issues'"
              >
                With gaps / alerts ({{ detail.functions.filter(fnHasDepIssue).length }})
              </button>
            </div>
          </div>

          <UCard v-if="!displayedDepFunctions.length">
            <p class="py-6 text-center text-sm text-muted">
              No business function has IT or non-IT dependency gaps or alerts.
            </p>
          </UCard>

          <UCard
            v-for="fn in displayedDepFunctions"
            :key="fn.seq_no"
          >
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 class="text-base font-semibold text-highlighted">
                    {{ fn.seq_no }}. {{ fn.name }}
                  </h2>
                  <p class="text-xs text-muted">
                    Expected MTD: {{ fn.expected_mtd }} · Planned capacity: {{ fn.planned_capacity }}
                  </p>
                </div>
                <StatusBadge
                  :scale="biaCategory"
                  :value="fn.category"
                  size="sm"
                />
              </div>
            </template>

            <div class="space-y-4">
              <div>
                <h3 class="text-sm font-semibold text-highlighted">
                  IT application systems (Part 2a)
                </h3>
                <div class="mt-2 overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead class="border-b border-default bg-muted text-xs uppercase text-muted">
                      <tr>
                        <th class="px-3 py-2">
                          Application
                        </th>
                        <th class="px-3 py-2">
                          <span class="inline-flex items-center gap-1">
                            <span>Committed RTO</span>
                            <UTooltip text="Recovery Time Objective — target maximum time to restore the IT application.">
                              <UIcon
                                name="i-lucide-info"
                                class="size-3.5 text-muted"
                              />
                            </UTooltip>
                          </span>
                        </th>
                        <th class="px-3 py-2">
                          <span class="inline-flex items-center gap-1">
                            <span>Committed RPO</span>
                            <UTooltip text="Recovery Point Objective — maximum acceptable data loss (LST, LSB, or LDB).">
                              <UIcon
                                name="i-lucide-info"
                                class="size-3.5 text-muted"
                              />
                            </UTooltip>
                          </span>
                        </th>
                        <th class="px-3 py-2">
                          Workaround
                        </th>
                        <th class="px-3 py-2">
                          Backlog clear
                        </th>
                        <th class="px-3 py-2">
                          <span class="inline-flex items-center gap-1">
                            <span>DAAT</span>
                            <UTooltip text="Damage Assessment & Activation Time (Expected MTD − RTO − Backlog). Negative means RTO + backlog exceeds MTD.">
                              <UIcon
                                name="i-lucide-info"
                                class="size-3.5 text-muted"
                              />
                            </UTooltip>
                          </span>
                        </th>
                        <th class="px-3 py-2">
                          System usage
                        </th>
                        <th class="px-3 py-2">
                          Workaround critical gaps
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-default">
                      <tr v-if="!fn.it_dependencies.length">
                        <td
                          colspan="8"
                          class="px-3 py-3 text-xs text-muted"
                        >
                          No IT application dependency (NA).
                        </td>
                      </tr>
                      <tr
                        v-for="dep in fn.it_dependencies"
                        :key="dep.app_code"
                      >
                        <td class="px-3 py-2 font-medium text-highlighted">
                          <template v-if="dep.app_name?.trim().toUpperCase() === 'NA'">
                            <span class="text-muted">No IT application dependency (NA)</span>
                          </template>
                          <template v-else>
                            <div class="inline-flex flex-wrap items-center gap-1.5">
                              <span>{{ dep.app_name }}</span>
                              <UBadge
                                v-if="dep.is_other"
                                color="neutral"
                                variant="outline"
                                size="xs"
                                label="Others"
                              />
                            </div>
                          </template>
                        </td>
                        <td class="px-3 py-2 tabular-nums">
                          <div class="inline-flex items-center gap-1">
                            <span :class="dep.rto_reaches_mtd ? 'font-medium text-warning' : ''">
                              {{ dep.rto }}
                            </span>
                            <UTooltip
                              v-if="dep.rto_reaches_mtd"
                              text="RTO ≥ Expected MTD — requires Part 2a justification"
                            >
                              <UIcon
                                name="i-lucide-triangle-alert"
                                class="size-3.5 text-warning"
                              />
                            </UTooltip>
                          </div>
                        </td>
                        <td class="px-3 py-2 font-mono text-xs">
                          {{ dep.rpo }}
                        </td>
                        <td class="px-3 py-2">
                          {{ dep.workaround }}
                        </td>
                        <td class="px-3 py-2">
                          {{ dep.backlog_time }}
                        </td>
                        <td class="px-3 py-2">
                          <div class="inline-flex items-center gap-1.5">
                            <span :class="dep.daat_negative || dep.daat.startsWith('-') ? 'font-medium text-error' : ''">
                              {{ dep.daat }}
                            </span>
                            <UBadge
                              v-if="dep.daat && dep.daat !== '—' && dep.daat.toUpperCase() !== 'NA'"
                              :color="dep.daat_negative || dep.daat.startsWith('-') ? 'error' : 'success'"
                              variant="subtle"
                              size="xs"
                              :label="dep.daat_negative || dep.daat.startsWith('-') ? 'Gap' : 'OK'"
                            />
                            <UTooltip
                              v-if="dep.daat_warnings?.length"
                              :text="dep.daat_warnings.join(' ')"
                            >
                              <UIcon
                                name="i-lucide-info"
                                class="size-3.5 text-muted"
                              />
                            </UTooltip>
                          </div>
                        </td>
                        <td class="px-3 py-2">
                          {{ dep.system_usage }}
                        </td>
                        <td class="px-3 py-2 text-muted">
                          <UBadge
                            v-if="dep.workaround_gap_required && !dep.critical_gap"
                            color="error"
                            variant="subtle"
                            size="xs"
                            label="Mandatory gap note missing"
                          />
                          <template v-else>
                            {{ dep.critical_gap || '—' }}
                          </template>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                v-for="section in nonItDependencySections(fn)"
                :key="`${fn.seq_no}-${section.key}`"
              >
                <h3 class="text-sm font-semibold text-highlighted">
                  {{ section.title }}
                </h3>
                <div class="mt-2 overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead class="border-b border-default bg-muted text-xs uppercase text-muted">
                      <tr>
                        <th class="px-3 py-2">
                          Party / business unit
                        </th>
                        <th class="px-3 py-2">
                          Planned capacity
                        </th>
                        <th class="px-3 py-2">
                          Expected MTD
                        </th>
                        <th class="px-3 py-2">
                          SLA
                        </th>
                        <th class="px-3 py-2">
                          Outsourcing
                        </th>
                        <th class="px-3 py-2">
                          Material service
                        </th>
                        <th class="px-3 py-2">
                          Alignment
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-default">
                      <tr v-if="!section.rows.length">
                        <td
                          colspan="7"
                          class="px-3 py-3 text-xs text-muted"
                        >
                          {{ section.empty }}
                        </td>
                      </tr>
                      <tr
                        v-for="(ndep, idx) in section.rows"
                        :key="idx"
                      >
                        <td class="px-3 py-2 font-medium text-highlighted">
                          {{ ndep.party_name }}
                        </td>
                        <td class="px-3 py-2 tabular-nums">
                          {{ ndep.planned_capacity }}
                        </td>
                        <td class="px-3 py-2">
                          {{ ndep.expected_mtd }}
                        </td>
                        <td class="px-3 py-2">
                          {{ ndep.sla }}
                        </td>
                        <td class="px-3 py-2">
                          {{ ndep.is_outsourcing }}
                        </td>
                        <td class="px-3 py-2">
                          {{ ndep.is_material }}
                        </td>
                        <td class="px-3 py-2">
                          <UTooltip
                            v-if="ndep.alignment_warnings?.length"
                            :text="ndep.alignment_warnings.join(' ')"
                          >
                            <UBadge
                              color="warning"
                              variant="subtle"
                              size="xs"
                              label="Needs justification"
                            />
                          </UTooltip>
                          <UBadge
                            v-else
                            color="success"
                            variant="subtle"
                            size="xs"
                            label="Aligned"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </UCard>

          <UCard v-if="detail.notes?.justification_rto || detail.notes?.justification_dependency || detailSummary.missingRtoJustification || detailSummary.missingDepJustification">
            <template #header>
              <h2 class="text-base font-semibold text-highlighted">
                RTO &amp; dependency justifications (Part 2a &amp; Part 2b)
              </h2>
            </template>
            <dl class="divide-y divide-default text-sm">
              <div
                v-if="detail.notes?.justification_rto || detailSummary.missingRtoJustification"
                class="grid grid-cols-3 gap-4 py-2.5"
              >
                <dt class="text-muted">
                  IT RTO justification (Part 2a)
                </dt>
                <dd class="col-span-2 whitespace-pre-line">
                  <span v-if="detail.notes?.justification_rto">{{ detail.notes.justification_rto }}</span>
                  <UBadge
                    v-else
                    color="error"
                    variant="subtle"
                    size="xs"
                    label="Required (an IT RTO ≥ Expected MTD)"
                  />
                </dd>
              </div>
              <div
                v-if="detail.notes?.justification_dependency || detailSummary.missingDepJustification"
                class="grid grid-cols-3 gap-4 py-2.5"
              >
                <dt class="text-muted">
                  Dependency capacity / MTD justification (Part 2b)
                </dt>
                <dd class="col-span-2 whitespace-pre-line">
                  <span v-if="detail.notes?.justification_dependency">{{ detail.notes.justification_dependency }}</span>
                  <UBadge
                    v-else
                    color="error"
                    variant="subtle"
                    size="xs"
                    label="Required (misaligned capacity or MTD)"
                  />
                </dd>
              </div>
            </dl>
          </UCard>
        </div>
      </template>

      <template #recovery>
        <div class="mt-4 space-y-6">
          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <div class="flex flex-wrap items-start justify-between gap-3 border-b border-default p-4">
              <div class="min-w-0 flex-1 space-y-1.5">
                <p class="text-sm text-muted">
                  Part 3: recovery prioritization, alternate site strategy, BCP seats, vital records, and alternate-site equipment.
                </p>
                <p
                  v-if="detail.guides?.recovery"
                  class="text-xs text-muted"
                >
                  <span class="font-medium text-highlighted">Recovery guide (Config {{ detail.config_version || 'active' }}):</span> {{ detail.guides.recovery }}
                </p>
                <p
                  v-if="detail.guides?.alternate_site"
                  class="text-xs text-muted"
                >
                  <span class="font-medium text-highlighted">Alternate site guide:</span> {{ detail.guides.alternate_site }}
                </p>
              </div>
              <div
                v-if="detail.functions.length"
                class="flex shrink-0 items-center gap-1.5"
              >
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-chevrons-up-down"
                  label="Expand all"
                  @click="expandAllRecovery"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-chevrons-down-up"
                  label="Collapse all"
                  @click="collapseAllRecovery"
                />
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-default text-xs font-medium uppercase tracking-wide text-muted">
                    <th class="w-8 py-3 ps-4 pe-1" />
                    <th class="py-3 px-2 whitespace-nowrap">
                      No
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      Business function
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      Category
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      Expected MTD
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      Planned capacity
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      Recovery level
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      Staff (req / total)
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      Alternate site strategy
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      BCP seats (in place / req)
                    </th>
                    <th class="py-3 ps-3 pe-4 whitespace-nowrap">
                      Vital record
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <template
                    v-for="fn in detail.functions"
                    :key="`rec-${fn.seq_no}`"
                  >
                    <tr
                      class="cursor-pointer transition hover:bg-elevated/40"
                      @click="toggleRecoveryRow(fn.seq_no)"
                    >
                      <td class="py-3 ps-4 pe-1 align-top">
                        <button
                          type="button"
                          class="inline-flex items-center text-muted hover:text-highlighted"
                          :aria-expanded="expandedRecovery.has(fn.seq_no)"
                          :aria-label="`Toggle strategies and equipment for ${fn.name}`"
                          @click.stop="toggleRecoveryRow(fn.seq_no)"
                        >
                          <UIcon
                            :name="expandedRecovery.has(fn.seq_no) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                            class="size-4"
                          />
                        </button>
                      </td>
                      <td class="py-3 px-2 align-top tabular-nums text-muted">
                        {{ fn.seq_no }}
                      </td>
                      <td class="py-3 px-3 align-top font-medium text-highlighted whitespace-nowrap">
                        {{ fn.name }}
                      </td>
                      <td class="py-3 px-3 align-top whitespace-nowrap">
                        <StatusBadge
                          :scale="biaCategory"
                          :value="fn.category"
                          size="sm"
                        />
                      </td>
                      <td class="py-3 px-3 align-top whitespace-nowrap">
                        {{ fn.expected_mtd }}
                      </td>
                      <td class="py-3 px-3 align-top tabular-nums whitespace-nowrap">
                        {{ fn.planned_capacity }}
                      </td>
                      <td class="py-3 px-3 align-top tabular-nums whitespace-nowrap">
                        {{ fn.recovery_level }}
                      </td>
                      <td class="py-3 px-3 align-top whitespace-nowrap">
                        <div class="inline-flex items-center gap-1.5">
                          <span
                            class="tabular-nums"
                            :class="fn.total_staff > 0 && fn.required_staff > fn.total_staff ? 'font-semibold text-warning' : ''"
                          >
                            {{ fn.required_staff }} / {{ fn.total_staff }}
                          </span>
                          <UTooltip
                            v-if="fn.total_staff > 0 && fn.required_staff > fn.total_staff"
                            text="Required recovery staff exceeds total staff in the unit"
                          >
                            <UIcon
                              name="i-lucide-triangle-alert"
                              class="size-3.5 text-warning"
                            />
                          </UTooltip>
                        </div>
                      </td>
                      <td class="py-3 px-3 align-top">
                        <div class="space-y-1">
                          <span>{{ fn.alt_site_strategy }}</span>
                          <UTooltip
                            v-if="altSiteOffRecommendation(fn)"
                            :text="`Workbook recommends for ${fn.category}: ${altSiteOffRecommendation(fn)}`"
                          >
                            <UBadge
                              color="warning"
                              variant="subtle"
                              size="xs"
                              label="Outside category guidance"
                            />
                          </UTooltip>
                        </div>
                      </td>
                      <td class="py-3 px-3 align-top whitespace-nowrap">
                        <template v-if="isWfhStrategy(fn)">
                          <UTooltip text="Alternate-site resource requirements exclude Work from Home (WFH)">
                            <UBadge
                              color="neutral"
                              variant="subtle"
                              size="xs"
                              label="Excluded (WFH)"
                            />
                          </UTooltip>
                        </template>
                        <span
                          v-else
                          class="tabular-nums"
                          :class="fn.bcp_seats_current < fn.bcp_seats_required ? 'font-semibold text-error' : ''"
                        >
                          {{ fn.bcp_seats_current }} / {{ fn.bcp_seats_required }}
                          <template v-if="fn.bcp_seats_current < fn.bcp_seats_required">
                            (-{{ fn.bcp_seats_required - fn.bcp_seats_current }})
                          </template>
                        </span>
                      </td>
                      <td class="py-3 ps-3 pe-4 align-top">
                        <template v-if="fn.category === 'Business Critical' && ((!fn.vital_record || fn.vital_record === '—') || (!fn.vital_record_location || fn.vital_record_location === '—'))">
                          <UBadge
                            color="error"
                            variant="subtle"
                            size="sm"
                            :label="(!fn.vital_record || fn.vital_record === '—') ? 'Vital record required' : 'Storage location required'"
                          />
                          <p
                            v-if="fn.vital_record && fn.vital_record !== '—'"
                            class="mt-1 text-xs text-muted"
                          >
                            {{ fn.vital_record }}
                          </p>
                        </template>
                        <template v-else>
                          <p class="font-medium text-highlighted">
                            {{ fn.vital_record }}
                          </p>
                          <p class="text-xs text-muted">
                            {{ fn.vital_record_location }}
                          </p>
                        </template>
                      </td>
                    </tr>
                    <tr
                      v-if="expandedRecovery.has(fn.seq_no)"
                      class="bg-elevated/30"
                    >
                      <td
                        colspan="11"
                        class="px-6 py-3"
                      >
                        <div class="grid gap-4 text-xs md:grid-cols-3">
                          <div>
                            <p class="font-semibold uppercase tracking-wide text-muted">
                              Prioritization strategy
                            </p>
                            <p class="mt-1 whitespace-pre-line text-default">
                              {{ fn.prioritization_strategy || '—' }}
                            </p>
                          </div>
                          <div>
                            <p class="font-semibold uppercase tracking-wide text-muted">
                              Outstanding work strategy
                            </p>
                            <p class="mt-1 whitespace-pre-line text-default">
                              {{ fn.outstanding_strategy || '—' }}
                            </p>
                          </div>
                          <div>
                            <p class="font-semibold uppercase tracking-wide text-muted">
                              Alternate-site equipment
                            </p>
                            <p
                              v-if="isWfhStrategy(fn)"
                              class="mt-1 text-muted"
                            >
                              Excluded — Work from Home (WFH)
                            </p>
                            <template v-else>
                              <p class="mt-1 tabular-nums text-default">
                                PC: <span class="font-medium">{{ fn.equipment?.pc ?? 0 }}</span> ·
                                Phone: <span class="font-medium">{{ fn.equipment?.phone ?? 0 }}</span> ·
                                Fax: <span class="font-medium">{{ fn.equipment?.fax ?? 0 }}</span> ·
                                Copier: <span class="font-medium">{{ fn.equipment?.copier ?? 0 }}</span>
                              </p>
                              <p
                                v-if="fn.equipment?.others"
                                class="mt-0.5 text-muted"
                              >
                                Others: {{ fn.equipment.others }}
                              </p>
                            </template>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </UCard>
        </div>
      </template>

      <template #timings>
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="border-b border-default p-4">
            <p class="text-sm text-muted">
              Part 4: critical timing, frequency and activities that must be performed at the deadline.
            </p>
          </div>
          <UTable
            :data="detail.functions"
            :columns="timingColumns"
            :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
          >
            <template #name-cell="{ row }">
              <span class="font-medium text-highlighted">{{ row.original.name }}</span>
            </template>
            <template #category-cell="{ row }">
              <StatusBadge
                :scale="biaCategory"
                :value="row.original.category"
                size="sm"
              />
            </template>
            <template #description-cell="{ row }">
              <p class="max-w-md whitespace-normal text-muted">
                {{ row.original.description || '—' }}
              </p>
            </template>
            <template #critical_activity-cell="{ row }">
              <p class="max-w-md whitespace-normal">
                {{ row.original.critical_activity || '—' }}
              </p>
            </template>
          </UTable>
        </UCard>
      </template>

      <template #signoff>
        <div class="mt-4 space-y-4">
          <UCard v-if="detail.guides?.attestation">
            <template #header>
              <h2 class="text-base font-semibold text-highlighted">
                Management attestation (Config {{ detail.config_version || 'active' }})
              </h2>
            </template>
            <p class="whitespace-pre-line text-xs leading-relaxed text-muted">
              {{ detail.guides.attestation }}
            </p>
          </UCard>
          <div class="grid gap-4 sm:grid-cols-2">
            <UCard
              v-for="step in detail.signoffs"
              :key="step.role"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs uppercase tracking-wide text-muted">
                    {{ step.label }}
                  </p>
                  <p class="mt-0.5 text-sm font-semibold text-highlighted">
                    {{ step.title }}
                  </p>
                  <p class="mt-2 text-sm text-default">
                    {{ step.signer_name }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ step.signer_title }}
                  </p>
                  <p
                    v-if="step.signed_at"
                    class="mt-2 text-xs text-muted"
                  >
                    Signed {{ formatDateTime(step.signed_at) }}
                  </p>
                  <p
                    v-if="step.decision_note"
                    class="mt-1 text-xs text-error"
                  >
                    Note: {{ step.decision_note }}
                  </p>
                </div>
                <StatusBadge
                  :scale="signoffStatus"
                  :value="step.status"
                  size="sm"
                />
              </div>
            </UCard>
          </div>

          <UCard v-if="detail.events?.length">
            <template #header>
              <h2 class="text-base font-semibold text-highlighted">
                Approval &amp; reminder history
              </h2>
            </template>
            <ul class="divide-y divide-default text-sm">
              <li
                v-for="(ev, idx) in detail.events"
                :key="idx"
                class="flex flex-wrap items-start justify-between gap-2 py-2.5"
              >
                <div class="min-w-0 space-y-0.5">
                  <p class="font-medium text-highlighted capitalize">
                    {{ ev.action.replaceAll('_', ' ') }}<template v-if="ev.role_title">
                      · {{ ev.role_title }}
                    </template>
                  </p>
                  <p
                    v-if="ev.note || ev.actor"
                    class="text-xs text-muted"
                  >
                    <template v-if="ev.actor">
                      {{ ev.actor }}
                    </template>
                    <template v-if="ev.actor && ev.note">
                      —
                    </template>
                    <template v-if="ev.note">
                      {{ ev.note }}
                    </template>
                  </p>
                </div>
                <span
                  v-if="ev.created_at"
                  class="text-xs text-muted whitespace-nowrap"
                >
                  {{ formatDateTime(ev.created_at) }}
                </span>
              </li>
            </ul>
          </UCard>
        </div>
      </template>
    </UTabs>
  </AppPage>
</template>
