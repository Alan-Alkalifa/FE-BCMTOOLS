<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BiaFunctionItem } from '~/composables/useBiaWorkflow'

definePageMeta({ permission: 'bianca.access' })

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id) || 1)
const { data: detail, status, error, refresh } = useBiaAssessmentDetail(id)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !detail.value)

const hasPart1Notes = computed(() => Boolean(
  detail.value?.notes?.loss_formula
  || detail.value?.notes?.justification_regulatory
  || detail.value?.notes?.justification_customer,
))

const hasDependencyNotes = computed(() => Boolean(
  detail.value?.notes?.justification_rto
  || detail.value?.notes?.justification_dependency,
))

const TABS = ['details', 'impact', 'dependencies', 'recovery', 'timings', 'signoff'] as const
type DetailTab = (typeof TABS)[number]
const tab = computed<DetailTab>({
  get: () => (TABS.includes(route.query.tab as DetailTab) ? route.query.tab as DetailTab : 'details'),
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'details' ? undefined : value } }),
})

const tabs = [
  { label: 'Details & personnel', value: 'details', icon: 'i-lucide-building-2', slot: 'details' as const },
  { label: 'Impact assessment', value: 'impact', icon: 'i-lucide-chart-column', slot: 'impact' as const },
  { label: 'IT & non-IT dependencies', value: 'dependencies', icon: 'i-lucide-network', slot: 'dependencies' as const },
  { label: 'Recovery strategies', value: 'recovery', icon: 'i-lucide-life-buoy', slot: 'recovery' as const },
  { label: 'Critical timings', value: 'timings', icon: 'i-lucide-calendar', slot: 'timings' as const },
  { label: 'Sign-off', value: 'signoff', icon: 'i-lucide-badge-check', slot: 'signoff' as const },
]

const impactColumns: TableColumn<BiaFunctionItem>[] = [
  { accessorKey: 'seq_no', header: 'No' },
  { accessorKey: 'name', header: 'Business function' },
  { accessorKey: 'suggested_mtd', header: 'Suggested MTD' },
  { accessorKey: 'expected_mtd', header: 'Expected MTD' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'fin_loss_4h', header: 'Loss (4 hrs)', meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } },
  { accessorKey: 'fin_loss_d1', header: 'Loss (Day 1)', meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } },
  { accessorKey: 'fin_loss_w1', header: 'Loss (Week 1)', meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } },
  { accessorKey: 'fin_loss_w4', header: 'Loss (Week 4)', meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } },
  { id: 'scores', header: 'Max Reg / Cust score' },
]

const recoveryColumns: TableColumn<BiaFunctionItem>[] = [
  { accessorKey: 'seq_no', header: 'No' },
  { accessorKey: 'name', header: 'Business function' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'expected_mtd', header: 'Expected MTD' },
  { accessorKey: 'planned_capacity', header: 'Planned capacity' },
  { accessorKey: 'recovery_level', header: 'Recovery level' },
  { id: 'staff', header: 'Staff (req / total)' },
  { accessorKey: 'alt_site_strategy', header: 'Alternate site strategy' },
  { id: 'seats', header: 'BCP seats (in place / req)' },
  { accessorKey: 'vital_record', header: 'Vital record' },
]

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

const DEFAULT_IMPACT_PERIODS = ['4 Hours', 'Day 1', 'Day 2', 'Day 3', 'Week 1', 'Week 2', 'Week 3', 'Week 4']
const impactPeriods = computed(() =>
  detail.value?.periods?.length ? detail.value.periods : DEFAULT_IMPACT_PERIODS,
)

function scoreTone(score: number | null | undefined) {
  const alertScore = detail.value?.impact_reference?.score_alert ?? 3
  if ((score ?? 0) >= alertScore) return 'font-semibold text-error'
  if (score === 2) return 'font-medium text-warning'
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
  let missingCriticalGapNote = 0
  let unalignedNonItCount = 0
  let seatGap = 0
  let missingVitalCritical = 0
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
      if (dep.workaround_gap_required && !dep.critical_gap) missingCriticalGapNote += 1
    }
    for (const ndep of fn.non_it_dependencies) {
      if (ndep.alignment_warnings?.length) unalignedNonItCount += 1
    }
    if (fn.bcp_seats_current < fn.bcp_seats_required) {
      seatGap += fn.bcp_seats_required - fn.bcp_seats_current
    }
    if (fn.category === 'Business Critical' && (!fn.vital_record || fn.vital_record === '—')) {
      missingVitalCritical += 1
    }
  }

  return {
    fnCount: fns.length,
    critical,
    important,
    others,
    itGapCount,
    missingCriticalGapNote,
    unalignedNonItCount,
    seatGap,
    missingVitalCritical,
    mtdExceedCount,
    suggestedMismatchCount,
  }
})

const attentionItems = computed(() => {
  const s = detailSummary.value
  const items: { text: string, targetTab: DetailTab }[] = []
  if (s.mtdExceedCount > 0) {
    items.push({ text: `${s.mtdExceedCount} business function(s) have Expected MTD longer than Suggested MTD`, targetTab: 'impact' })
  }
  if (s.itGapCount > 0) {
    items.push({ text: `${s.itGapCount} IT application(s) have a negative DAAT (RTO + backlog exceeds Expected MTD)`, targetTab: 'dependencies' })
  }
  if (s.missingCriticalGapNote > 0) {
    items.push({ text: `${s.missingCriticalGapNote} IT application(s) require a mandatory Workaround Critical Gap note`, targetTab: 'dependencies' })
  }
  if (s.unalignedNonItCount > 0) {
    items.push({ text: `${s.unalignedNonItCount} upstream/downstream dependency row(s) are misaligned with function capacity or MTD`, targetTab: 'dependencies' })
  }
  if (s.seatGap > 0) {
    items.push({ text: `BCP seat shortage of ${s.seatGap} seat(s) across business functions`, targetTab: 'recovery' })
  }
  if (s.missingVitalCritical > 0) {
    items.push({ text: `${s.missingVitalCritical} Business Critical function(s) missing vital record details`, targetTab: 'recovery' })
  }
  return items
})

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
        <div class="rounded-lg border border-default bg-default p-3.5">
          <p class="text-xs text-muted">
            Business functions
          </p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-highlighted">
            {{ detailSummary.fnCount }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ detailSummary.critical }} Critical · {{ detailSummary.important }} Important · {{ detailSummary.others }} Others
          </p>
        </div>
        <div class="rounded-lg border border-default bg-default p-3.5">
          <p class="text-xs text-muted">
            Shortest Expected MTD
          </p>
          <p class="mt-1 text-2xl font-semibold text-highlighted">
            {{ detail.shortest_mtd || '—' }}
          </p>
          <p class="mt-1 text-xs text-muted">
            Highest priority recovery target
          </p>
        </div>
        <div class="rounded-lg border border-default bg-default p-3.5">
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
        </div>
        <div class="rounded-lg border border-default bg-default p-3.5">
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
        </div>
      </div>

      <UAlert
        v-if="attentionItems.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Needs attention"
      >
        <template #description>
          <ul class="mt-1 space-y-1 text-xs">
            <li
              v-for="item in attentionItems"
              :key="item.text"
              class="flex flex-wrap items-center justify-between gap-2"
            >
              <span>• {{ item.text }}</span>
              <UButton
                size="xs"
                color="warning"
                variant="link"
                class="p-0"
                label="Review"
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
                    <p class="font-medium text-highlighted">
                      {{ detail.coordinator.name }} ({{ detail.coordinator.nik }})
                    </p>
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
                    <p class="font-medium text-highlighted">
                      {{ detail.alt_coordinator.name }} ({{ detail.alt_coordinator.nik }})
                    </p>
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
                    <p
                      v-if="detail.ra_questionnaire.others_note"
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
                    {{ detail.ra_questionnaire.location_ra_completed }}
                  </dd>
                </div>
                <div
                  v-if="detail.notes?.ra_justification"
                  class="grid grid-cols-3 gap-4 py-2.5"
                >
                  <dt class="text-muted">
                    RA justification
                  </dt>
                  <dd class="col-span-2">
                    {{ detail.notes.ra_justification }}
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
                Part 1 & Part 2a: cumulative potential financial loss (IDR), maximum regulatory and customer service impact scores (1–3), and resulting Business Function Category.
              </p>
              <p
                v-if="detail.loss_totals"
                class="text-xs text-muted tabular-nums"
              >
                Total loss (4h / D1 / W1 / W4):
                <span class="font-medium text-highlighted">{{ formatCurrency(detail.loss_totals.fin_loss_4h) }}</span> /
                <span class="font-medium text-highlighted">{{ formatCurrency(detail.loss_totals.fin_loss_d1) }}</span> /
                <span class="font-medium text-highlighted">{{ formatCurrency(detail.loss_totals.fin_loss_w1) }}</span> /
                <span class="font-medium text-highlighted">{{ formatCurrency(detail.loss_totals.fin_loss_w4) }}</span>
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
                  <span>{{ row.original.computed_suggested_mtd || row.original.suggested_mtd }}</span>
                  <UTooltip
                    v-if="triggerSummary(row.original)"
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
              <template #fin_loss_4h-cell="{ row }">
                {{ formatCurrency(row.original.fin_loss_4h) }}
              </template>
              <template #fin_loss_d1-cell="{ row }">
                {{ formatCurrency(row.original.fin_loss_d1) }}
              </template>
              <template #fin_loss_w1-cell="{ row }">
                {{ formatCurrency(row.original.fin_loss_w1) }}
              </template>
              <template #fin_loss_w4-cell="{ row }">
                {{ formatCurrency(row.original.fin_loss_w4) }}
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
                  Potential regulatory (A) &amp; customer service (B) impact (Score 1–3) — {{ impactPeriods[0] }} to {{ impactPeriods[impactPeriods.length - 1] }}
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
                          {{ fn.computed_suggested_mtd || fn.suggested_mtd }}
                        </p>
                        <p
                          v-if="triggerSummary(fn)"
                          class="mt-1 max-w-56 text-[11px] leading-snug text-muted"
                        >
                          {{ triggerSummary(fn) }}
                        </p>
                        <p
                          v-if="fn.suggested_mtd_matches === false && fn.stored_suggested_mtd"
                          class="mt-1 text-[11px] text-dimmed"
                        >
                          Form input: {{ fn.stored_suggested_mtd }}
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

          <UCard v-if="hasPart1Notes">
            <template #header>
              <h2 class="text-base font-semibold text-highlighted">
                Financial loss formula & rating justifications (Part 1)
              </h2>
            </template>
            <dl class="divide-y divide-default text-sm">
              <div
                v-if="detail.notes?.loss_formula"
                class="grid grid-cols-3 gap-4 py-2.5"
              >
                <dt class="text-muted">
                  Financial loss formula
                </dt>
                <dd class="col-span-2 whitespace-pre-line">
                  {{ detail.notes.loss_formula }}
                </dd>
              </div>
              <div
                v-if="detail.notes?.justification_regulatory"
                class="grid grid-cols-3 gap-4 py-2.5"
              >
                <dt class="text-muted">
                  Regulatory impact (A)
                </dt>
                <dd class="col-span-2 whitespace-pre-line">
                  {{ detail.notes.justification_regulatory }}
                </dd>
              </div>
              <div
                v-if="detail.notes?.justification_customer"
                class="grid grid-cols-3 gap-4 py-2.5"
              >
                <dt class="text-muted">
                  Customer service impact (B)
                </dt>
                <dd class="col-span-2 whitespace-pre-line">
                  {{ detail.notes.justification_customer }}
                </dd>
              </div>
            </dl>
          </UCard>
        </div>
      </template>

      <template #dependencies>
        <div class="mt-4 space-y-6">
          <UCard
            v-for="fn in detail.functions"
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
                          {{ dep.rto }}
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

              <div v-if="fn.non_it_dependencies.length">
                <h3 class="text-sm font-semibold text-highlighted">
                  Upstream & downstream dependencies (Part 2b)
                </h3>
                <div class="mt-2 overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead class="border-b border-default bg-muted text-xs uppercase text-muted">
                      <tr>
                        <th class="px-3 py-2">
                          Direction
                        </th>
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
                      <tr
                        v-for="(ndep, idx) in fn.non_it_dependencies"
                        :key="idx"
                      >
                        <td class="px-3 py-2 font-medium">
                          {{ ndep.direction }}
                        </td>
                        <td class="px-3 py-2 text-highlighted">
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

          <UCard v-if="hasDependencyNotes">
            <template #header>
              <h2 class="text-base font-semibold text-highlighted">
                RTO & dependency justifications (Part 2a & Part 2b)
              </h2>
            </template>
            <dl class="divide-y divide-default text-sm">
              <div
                v-if="detail.notes?.justification_rto"
                class="grid grid-cols-3 gap-4 py-2.5"
              >
                <dt class="text-muted">
                  IT RTO justification (B132)
                </dt>
                <dd class="col-span-2 whitespace-pre-line">
                  {{ detail.notes.justification_rto }}
                </dd>
              </div>
              <div
                v-if="detail.notes?.justification_dependency"
                class="grid grid-cols-3 gap-4 py-2.5"
              >
                <dt class="text-muted">
                  Dependency capacity / MTD justification (B131)
                </dt>
                <dd class="col-span-2 whitespace-pre-line">
                  {{ detail.notes.justification_dependency }}
                </dd>
              </div>
            </dl>
          </UCard>
        </div>
      </template>

      <template #recovery>
        <div class="mt-4 space-y-6">
          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <div class="space-y-1.5 border-b border-default p-4">
              <p class="text-sm text-muted">
                Part 3: recovery prioritization, alternate site strategy, BCP seats at the alternate site, and vital records.
              </p>
              <p
                v-if="detail.guides?.recovery"
                class="text-xs text-muted"
              >
                <span class="font-medium text-highlighted">Guide (Config {{ detail.config_version || 'active' }}):</span> {{ detail.guides.recovery }}
              </p>
            </div>
            <UTable
              :data="detail.functions"
              :columns="recoveryColumns"
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
              <template #staff-cell="{ row }">
                <span class="tabular-nums">{{ row.original.required_staff }} / {{ row.original.total_staff }}</span>
              </template>
              <template #seats-cell="{ row }">
                <span
                  class="tabular-nums"
                  :class="row.original.bcp_seats_current < row.original.bcp_seats_required ? 'font-semibold text-error' : ''"
                >
                  {{ row.original.bcp_seats_current }} / {{ row.original.bcp_seats_required }}
                  <template v-if="row.original.bcp_seats_current < row.original.bcp_seats_required">
                    (-{{ row.original.bcp_seats_required - row.original.bcp_seats_current }})
                  </template>
                </span>
              </template>
              <template #vital_record-cell="{ row }">
                <template v-if="row.original.category === 'Business Critical' && (!row.original.vital_record || row.original.vital_record === '—')">
                  <UBadge
                    color="error"
                    variant="subtle"
                    size="sm"
                    label="Required for Business Critical"
                  />
                </template>
                <template v-else>
                  <p class="font-medium text-highlighted">
                    {{ row.original.vital_record }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ row.original.vital_record_location }}
                  </p>
                </template>
              </template>
            </UTable>
          </UCard>

          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <h2 class="text-base font-semibold text-highlighted">
                Recovery strategies &amp; alternate-site equipment (Part 3)
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
                    <th class="py-3 px-3">
                      Prioritization strategy
                    </th>
                    <th class="py-3 px-3">
                      Outstanding work strategy
                    </th>
                    <th class="py-3 px-3 whitespace-nowrap">
                      Equipment (PC / Phone / Fax / Copier)
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr
                    v-for="fn in detail.functions"
                    :key="`rec-extra-${fn.seq_no}`"
                  >
                    <td class="py-3 ps-4 pe-3 align-top tabular-nums text-muted">
                      {{ fn.seq_no }}
                    </td>
                    <td class="py-3 px-3 align-top font-medium text-highlighted whitespace-nowrap">
                      {{ fn.name }}
                    </td>
                    <td class="py-3 px-3 align-top text-muted whitespace-pre-line">
                      {{ fn.prioritization_strategy || '—' }}
                    </td>
                    <td class="py-3 px-3 align-top text-muted whitespace-pre-line">
                      {{ fn.outstanding_strategy || '—' }}
                    </td>
                    <td class="py-3 px-3 align-top tabular-nums whitespace-nowrap">
                      <span>
                        {{ fn.equipment?.pc ?? 0 }} / {{ fn.equipment?.phone ?? 0 }} / {{ fn.equipment?.fax ?? 0 }} / {{ fn.equipment?.copier ?? 0 }}
                      </span>
                      <p
                        v-if="fn.equipment?.others"
                        class="mt-1 text-xs text-muted whitespace-normal"
                      >
                        Others: {{ fn.equipment.others }}
                      </p>
                    </td>
                  </tr>
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
        </div>
      </template>
    </UTabs>
  </AppPage>
</template>
