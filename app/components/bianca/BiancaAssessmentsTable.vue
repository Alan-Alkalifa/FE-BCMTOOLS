<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BiaMonitorAssessmentRow } from '~/composables/useBiaWorkflow'

const props = withDefaults(defineProps<{
  rows: BiaMonitorAssessmentRow[]
  pickedIds: Set<number>
  loading?: boolean
  emptyText?: string
}>(), {
  loading: false,
  emptyText: 'No BIA matches these filters.',
})

const emit = defineEmits<{
  'pick': [row: BiaMonitorAssessmentRow, value: boolean | 'indeterminate']
  'pick-all': [rows: BiaMonitorAssessmentRow[], value: boolean | 'indeterminate']
}>()

const { header: sortable } = useTableSort([
  'ref_no',
  'group',
  'status',
  'directorate',
  'sub_directorate',
  'category',
  'shortest_mtd',
  'functions',
  'approved_at',
  'renewal_date',
  'assessor',
])

const columns: TableColumn<BiaMonitorAssessmentRow>[] = [
  { id: 'select', header: '', meta: { class: { th: 'w-0', td: 'w-0' } } },
  { id: 'ref_no', header: sortable('BIA ref. no.', 'ref_no'), meta: { class: { th: 'min-w-36', td: 'min-w-36' } } },
  { id: 'group', header: sortable('Group', 'group'), meta: { class: { th: 'min-w-44', td: 'min-w-44' } } },
  { id: 'status', header: sortable('BIA status', 'status'), meta: { class: { th: 'min-w-44', td: 'min-w-44' } } },
  { id: 'directorate', header: sortable('Directorate', 'directorate'), meta: { class: { th: 'min-w-40', td: 'min-w-40' } } },
  { id: 'sub_directorate', header: sortable('Sub directorate', 'sub_directorate'), meta: { class: { th: 'min-w-40', td: 'min-w-40' } } },
  { id: 'category', header: sortable('Highest category', 'category'), meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  { id: 'shortest_mtd', header: sortable('Shortest MTD', 'shortest_mtd'), meta: { class: { th: 'min-w-28', td: 'min-w-28' } } },
  { id: 'functions', header: sortable('Functions', 'functions', true), meta: { class: { th: 'min-w-24 text-right', td: 'min-w-24 text-right' } } },
  { id: 'approved_at', header: sortable('Approved date', 'approved_at'), meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  { accessorKey: 'renewal_date', header: sortable('Renewal date', 'renewal_date'), meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  { id: 'assessor', header: sortable('BCM coordinator', 'assessor'), meta: { class: { th: 'min-w-40', td: 'min-w-40' } } },
]

const allState = computed<boolean | 'indeterminate'>(() => {
  if (!props.rows.length) return false
  const ticked = props.rows.filter((row) => props.pickedIds.has(row.id)).length
  if (!ticked) return false
  return ticked === props.rows.length ? true : 'indeterminate'
})

function daysHint(row: BiaMonitorAssessmentRow): string | null {
  if (row.days_left == null) return null
  if (row.days_left < 0) return `${Math.abs(row.days_left)} ${Math.abs(row.days_left) === 1 ? 'day' : 'days'} overdue`
  if (row.days_left === 0) return 'Due today'
  return `${row.days_left} ${row.days_left === 1 ? 'day' : 'days'} left`
}
</script>

<template>
  <UTable
    :data="rows"
    :columns="columns"
    :loading="loading"
    :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
  >
    <template #select-header>
      <UCheckbox
        :model-value="allState"
        aria-label="Select all BIAs on this page"
        @update:model-value="emit('pick-all', rows, $event)"
      />
    </template>

    <template #select-cell="{ row }">
      <UCheckbox
        :model-value="pickedIds.has(row.original.id)"
        :aria-label="`Select ${row.original.ref_no ?? `#${row.original.id}`}`"
        @update:model-value="emit('pick', row.original, $event)"
      />
    </template>

    <template #ref_no-cell="{ row }">
      <NuxtLink
        :to="{ path: `/bianca/monitoring/${row.original.id}`, query: { from: 'assessments' } }"
        class="font-mono text-xs font-medium text-primary hover:underline"
      >
        {{ row.original.ref_no ?? `#${row.original.id}` }}
      </NuxtLink>
      <p class="mt-0.5 text-xs text-muted">
        {{ row.original.reason === 'new_group' ? 'Initial assessment' : 'Annual review' }}
      </p>
    </template>

    <template #group-cell="{ row }">
      <p class="font-medium text-highlighted">
        {{ row.original.group.name }}
      </p>
      <p
        v-if="row.original.group.code"
        class="font-mono text-xs text-muted"
      >
        {{ row.original.group.code }}
      </p>
    </template>

    <template #status-cell="{ row }">
      <StatusBadge
        v-if="row.original.status_group"
        :scale="biaStatusGroup"
        :value="row.original.status_group"
        size="sm"
      />
      <p class="mt-1 text-xs text-muted">
        {{ row.original.status_detail_label }}
      </p>
      <p
        v-if="row.original.current_step_title"
        class="text-xs text-muted"
      >
        Step: {{ row.original.current_step_title }}
      </p>
      <p
        v-else-if="daysHint(row.original)"
        class="text-xs"
        :class="row.original.days_left != null && row.original.days_left < 0 ? 'text-error' : row.original.days_left != null && row.original.days_left <= 30 ? 'text-warning' : 'text-muted'"
      >
        {{ daysHint(row.original) }}
      </p>
    </template>

    <template #directorate-cell="{ row }">
      <span class="text-sm text-highlighted">{{ row.original.group.directorate || '—' }}</span>
    </template>

    <template #sub_directorate-cell="{ row }">
      <span class="text-sm text-muted">{{ row.original.group.sub_directorate || '—' }}</span>
    </template>

    <template #category-cell="{ row }">
      <StatusBadge
        v-if="row.original.highest_category"
        :scale="biaCategory"
        :value="row.original.highest_category"
        size="sm"
      />
      <span
        v-else
        class="text-muted"
      >Not rated</span>
    </template>

    <template #shortest_mtd-cell="{ row }">
      {{ row.original.shortest_mtd || '—' }}
    </template>

    <template #functions-cell="{ row }">
      <span class="tabular-nums">{{ row.original.function_count }}</span>
    </template>

    <template #approved_at-cell="{ row }">
      {{ formatDate(row.original.approved_at) || '—' }}
    </template>

    <template #renewal_date-cell="{ row }">
      {{ formatDate(row.original.renewal_date) || '—' }}
    </template>

    <template #assessor-cell="{ row }">
      <p class="max-w-52 truncate text-sm text-highlighted">
        {{ row.original.assessor || '—' }}
      </p>
      <p
        v-if="row.original.alt_coordinator"
        class="max-w-52 truncate text-xs text-muted"
      >
        Alt: {{ row.original.alt_coordinator }}
      </p>
    </template>

    <template #empty>
      <p class="py-8 text-center text-sm text-muted">
        {{ emptyText }}
      </p>
    </template>
  </UTable>
</template>
