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
  { id: 'staff', header: 'Staff (req / total)' },
  { accessorKey: 'alt_site_strategy', header: 'Alternate site strategy' },
  { id: 'seats', header: 'BCP seats (in place / req)' },
  { accessorKey: 'vital_record', header: 'Vital record' },
]

const timingColumns: TableColumn<BiaFunctionItem>[] = [
  { accessorKey: 'seq_no', header: 'No' },
  { accessorKey: 'name', header: 'Business function' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'frequency', header: 'Frequency' },
  { accessorKey: 'critical_timing', header: 'Critical timing' },
  { accessorKey: 'critical_activity', header: 'Activity performed' },
]

const signoffStatus = defineStatusScale<'approved' | 'pending' | 'rejected'>({
  approved: { label: 'Approved', color: 'success', icon: 'i-lucide-circle-check' },
  pending: { label: 'Waiting', color: 'warning', icon: 'i-lucide-hourglass' },
  rejected: { label: 'Returned', color: 'error', icon: 'i-lucide-undo-2' },
})
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
                  BCM coordinators
                </h2>
              </template>
              <dl class="divide-y divide-default text-sm">
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
                          Committed RTO
                        </th>
                        <th class="px-3 py-2">
                          Committed RPO
                        </th>
                        <th class="px-3 py-2">
                          Workaround
                        </th>
                        <th class="px-3 py-2">
                          Backlog clear
                        </th>
                        <th class="px-3 py-2">
                          DAAT
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
                      <tr
                        v-for="dep in fn.it_dependencies"
                        :key="dep.app_code"
                      >
                        <td class="px-3 py-2 font-medium text-highlighted">
                          {{ dep.app_name }}
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
                        <td
                          class="px-3 py-2"
                          :class="dep.daat_negative || dep.daat.startsWith('-') ? 'font-medium text-error' : ''"
                        >
                          {{ dep.daat }}
                        </td>
                        <td class="px-3 py-2">
                          {{ dep.system_usage }}
                        </td>
                        <td class="px-3 py-2 text-muted">
                          {{ dep.critical_gap || '—' }}
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
        <UCard
          class="mt-4"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <div class="border-b border-default p-4">
            <p class="text-sm text-muted">
              Part 3: recovery prioritization, alternate site strategy, BCP seats at the alternate site, and vital records.
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
                :class="row.original.bcp_seats_current < row.original.bcp_seats_required ? 'font-medium text-warning' : ''"
              >
                {{ row.original.bcp_seats_current }} / {{ row.original.bcp_seats_required }}
              </span>
            </template>
            <template #vital_record-cell="{ row }">
              <p class="font-medium text-highlighted">
                {{ row.original.vital_record }}
              </p>
              <p class="text-xs text-muted">
                {{ row.original.vital_record_location }}
              </p>
            </template>
          </UTable>
        </UCard>
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
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
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
      </template>
    </UTabs>
  </AppPage>
</template>
