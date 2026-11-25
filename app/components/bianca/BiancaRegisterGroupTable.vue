<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BiaMonitorGroupRow } from '~/composables/useBiaWorkflow'

const props = withDefaults(defineProps<{
  rows: BiaMonitorGroupRow[]
  pickedIds: Set<number>
  loading?: boolean
  showDirectorateColumn?: boolean
  showOrgPath?: boolean
  emptyText?: string
}>(), {
  loading: false,
  showDirectorateColumn: true,
  showOrgPath: false,
  emptyText: 'No group matches these filters.',
})

const emit = defineEmits<{
  'pick': [row: BiaMonitorGroupRow, value: boolean | 'indeterminate']
  'pick-all': [rows: BiaMonitorGroupRow[], value: boolean | 'indeterminate']
  'open-history': [row: BiaMonitorGroupRow]
}>()

const { header: sortable } = useTableSort(['functions', 'approved_at', 'renewal_date', 'assessment_count'])

const columns = computed<TableColumn<BiaMonitorGroupRow>[]>(() => [
  { id: 'select', header: '', meta: { class: { th: 'w-0', td: 'w-0' } } },
  { id: 'group', header: sortable('Group', 'group'), meta: { class: { th: 'min-w-44', td: 'min-w-44' } } },
  { id: 'group_status', header: sortable('BIA status', 'group_status'), meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  { id: 'open', header: sortable('Open BIA', 'open_status'), meta: { class: { th: 'min-w-36', td: 'min-w-36' } } },
  ...(props.showDirectorateColumn
    ? [
        { id: 'directorate', header: sortable('Directorate', 'directorate'), meta: { class: { th: 'min-w-40', td: 'min-w-40' } } },
        { id: 'sub_directorate', header: sortable('Sub directorate', 'sub_directorate'), meta: { class: { th: 'min-w-40', td: 'min-w-40' } } },
      ]
    : []),
  { id: 'category', header: sortable('Highest category', 'category'), meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  { id: 'shortest_mtd', header: sortable('Shortest MTD', 'shortest_mtd'), meta: { class: { th: 'min-w-28', td: 'min-w-28' } } },
  { id: 'functions', header: sortable('Functions', 'functions', true), meta: { class: { th: 'min-w-24 text-right', td: 'min-w-24 text-right' } } },
  { id: 'approved', header: sortable('Last final BIA', 'approved_at'), meta: { class: { th: 'min-w-36', td: 'min-w-36' } } },
  { accessorKey: 'renewal_date', header: sortable('Renewal date', 'renewal_date'), meta: { class: { th: 'min-w-32', td: 'min-w-32' } } },
  { id: 'bia_users', header: sortable('BIA users & PIC', 'assessor'), meta: { class: { th: 'min-w-40', td: 'min-w-40' } } },
  { accessorKey: 'assessment_count', header: sortable('BIA(s)', 'assessment_count', true), meta: { class: { th: 'min-w-24 text-right', td: 'min-w-24 text-right' } } },
])

const allState = computed<boolean | 'indeterminate'>(() => {
  if (!props.rows.length) return false
  const ticked = props.rows.filter((row) => props.pickedIds.has(row.group.id)).length
  if (!ticked) return false
  return ticked === props.rows.length ? true : 'indeterminate'
})

function record(id: number) {
  return biaPath('monitoring', id)
}

function registerRecord(row: BiaMonitorGroupRow) {
  return row.approved ?? row.open ?? row.history?.[0] ?? null
}

function latestBiaRef(row: BiaMonitorGroupRow) {
  return row.history?.[0] ?? row.open ?? row.approved ?? null
}

function refLabel(ref: { id: number, ref_no: string | null } | null) {
  return ref ? ref.ref_no ?? `#${ref.id}` : '—'
}

function daysLeft(row: BiaMonitorGroupRow) {
  if (row.days_left === null) return ''
  if (row.days_left < 0) return `${Math.abs(row.days_left)} ${Math.abs(row.days_left) === 1 ? 'day' : 'days'} overdue`
  if (row.days_left === 0) return 'Due today'
  return `${row.days_left} ${row.days_left === 1 ? 'day' : 'days'} left`
}
</script>

<template>
  <UTable
    :data="rows"
    :columns="columns"
    :get-row-id="(row: BiaMonitorGroupRow) => String(row.group.id)"
    :loading="loading"
    :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
  >
    <template #select-header>
      <UCheckbox
        :model-value="allState"
        aria-label="Select every group in this list"
        @update:model-value="(value: boolean | 'indeterminate') => emit('pick-all', rows, value)"
      />
    </template>
    <template #select-cell="{ row }">
      <UCheckbox
        :model-value="pickedIds.has(row.original.group.id)"
        :aria-label="`Select ${row.original.group.name}`"
        @update:model-value="(value: boolean | 'indeterminate') => emit('pick', row.original, value)"
      />
    </template>
    <template #group-cell="{ row }">
      <p
        v-if="showOrgPath"
        class="mb-0.5 text-[11px] text-muted"
      >
        {{ row.original.group.directorate || '—' }}
        <template v-if="row.original.group.sub_directorate && row.original.group.sub_directorate !== '—'">
          › {{ row.original.group.sub_directorate }}
        </template>
      </p>
      <NuxtLink
        v-if="registerRecord(row.original)"
        :to="record(registerRecord(row.original)!.id)"
        class="font-medium text-primary hover:underline"
      >
        {{ row.original.group.name }}
      </NuxtLink>
      <span
        v-else
        class="font-medium text-highlighted"
      >{{ row.original.group.name }}</span>
      <p class="text-xs text-muted">
        <span class="font-mono">{{ row.original.group.code || '—' }}</span>
        <template v-if="latestBiaRef(row.original)">
          · <span class="font-mono">{{ refLabel(latestBiaRef(row.original)) }}</span>
        </template>
      </p>
    </template>
    <template #group_status-cell="{ row }">
      <template v-if="row.original.approved">
        <NuxtLink
          :to="record(row.original.approved.id)"
          class="inline-block hover:underline"
        >
          <StatusBadge
            v-if="row.original.approved.status_group"
            :scale="biaStatusGroup"
            :value="row.original.approved.status_group"
            size="sm"
          />
          <StatusBadge
            v-else
            :scale="biaGroupStatus"
            :value="biaGroupStatusKey(row.original)"
            size="sm"
          />
        </NuxtLink>
        <p
          class="mt-1 text-xs"
          :class="row.original.bucket === 'overdue'
            ? 'font-medium text-error'
            : row.original.bucket === 'due_30'
              ? 'font-medium text-warning'
              : row.original.bucket === 'due_60' || row.original.bucket === 'due_90'
                ? 'text-info'
                : 'text-muted'"
        >
          {{ row.original.approved.status_detail_label || biaGroupStatus[biaGroupStatusKey(row.original)].label }}
          <template v-if="row.original.bucket === 'overdue' || row.original.bucket === 'due_30' || row.original.bucket === 'due_60' || row.original.bucket === 'due_90'">
            · {{ daysLeft(row.original) }}
          </template>
        </p>
      </template>
      <template v-else>
        <StatusBadge
          :scale="biaGroupStatus"
          value="no_final"
          size="sm"
        />
        <p class="mt-1 text-xs text-muted">
          {{ row.original.open ? 'Initial BIA in progress' : 'No BIA submitted yet' }}
        </p>
      </template>
    </template>
    <template #open-cell="{ row }">
      <template v-if="row.original.open">
        <div class="flex flex-wrap items-center gap-1.5">
          <NuxtLink
            :to="record(row.original.open.id)"
            class="inline-block hover:underline"
          >
            <StatusBadge
              v-if="row.original.open.status_group"
              :scale="biaStatusGroup"
              :value="row.original.open.status_group"
              size="sm"
            />
            <StatusBadge
              v-else
              :scale="biaStatus"
              :value="biaStatusKey(row.original.open)"
              size="sm"
            />
          </NuxtLink>
          <UBadge
            v-if="row.original.open.status_detail === 'escalated' || row.original.stuck_approval"
            color="error"
            variant="subtle"
            size="xs"
            icon="i-lucide-siren"
            label="Escalated"
          />
        </div>
        <p
          class="mt-1 text-xs"
          :class="row.original.open.status_detail === 'need_revision' || row.original.open.status_detail === 'escalated'
            ? 'font-medium text-error'
            : row.original.open.status_detail === 'in_revision'
              ? 'font-medium text-warning'
              : 'text-muted'"
        >
          <span>{{ row.original.open.status_detail_label || biaStatus[biaStatusKey(row.original.open)].label }}</span>
          <span class="text-muted"> · </span>
          <NuxtLink
            :to="record(row.original.open.id)"
            class="font-mono text-muted hover:underline"
          >
            {{ refLabel(row.original.open) }}
          </NuxtLink>
        </p>
      </template>
      <template v-else-if="!row.original.approved">
        <StatusBadge
          :scale="biaStatusGroup"
          value="draft"
          size="sm"
        />
        <p class="mt-1 text-xs text-muted">
          Waiting for Submission Task
        </p>
      </template>
      <span
        v-else
        class="text-xs text-muted"
      >—</span>
    </template>
    <template #bia_users-cell="{ row }">
      <div class="space-y-1">
        <p class="max-w-56 truncate text-sm font-medium text-highlighted">
          {{ row.original.assessor || row.original.group_users?.[0]?.name || '—' }}
        </p>
        <p
          v-if="row.original.alt_coordinator && row.original.alt_coordinator !== row.original.assessor"
          class="max-w-56 truncate text-xs text-muted"
        >
          Alt: {{ row.original.alt_coordinator }}
        </p>
        <BiaGroupUsersPopover
          v-if="row.original.assessor || row.original.group_users?.length || row.original.directorate_users?.length"
          :group-name="row.original.group.name"
          :users="row.original.group_users ?? []"
          :directorate-users="row.original.directorate_users ?? []"
          :coordinator="row.original.assessor"
          :alt-coordinator="row.original.alt_coordinator"
        />
        <p
          v-else-if="!row.original.assessor"
          class="text-xs text-muted"
        >
          No user assigned
        </p>
      </div>
    </template>
    <template #functions-cell="{ row }">
      <span class="tabular-nums">{{ (row.original.approved ?? row.original.open)?.function_count ?? '—' }}</span>
    </template>
    <template #category-cell="{ row }">
      <template v-if="row.original.approved?.highest_category">
        <StatusBadge
          :scale="biaCategory"
          :value="row.original.approved.highest_category"
          size="sm"
        />
      </template>
      <template v-else-if="row.original.open?.highest_category">
        <StatusBadge
          :scale="biaCategory"
          :value="row.original.open.highest_category"
          size="sm"
        />
        <p class="mt-1 text-xs text-muted">
          Preliminary
        </p>
      </template>
      <span
        v-else
        class="text-muted"
      >Not rated</span>
    </template>
    <template #shortest_mtd-cell="{ row }">
      <span :class="(row.original.approved ?? row.original.open)?.shortest_mtd ? '' : 'text-muted'">
        {{ (row.original.approved ?? row.original.open)?.shortest_mtd || '—' }}
      </span>
    </template>
    <template #approved-cell="{ row }">
      <template v-if="row.original.approved">
        <NuxtLink
          :to="record(row.original.approved.id)"
          class="font-mono text-xs text-primary hover:underline"
        >
          {{ refLabel(row.original.approved) }}
        </NuxtLink>
        <p class="text-xs text-muted">
          {{ formatDate(row.original.approved.approved_at) || '—' }}<template v-if="row.original.approved.reason">
            · {{ biaReasonLabel(row.original.approved.reason) }}
          </template>
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
    <template #directorate-cell="{ row }">
      <span class="block max-w-48 truncate">
        {{ row.original.group.directorate || '—' }}
      </span>
    </template>
    <template #sub_directorate-cell="{ row }">
      <span class="block max-w-48 truncate text-muted">
        {{ row.original.group.sub_directorate || '—' }}
      </span>
    </template>
    <template #assessment_count-cell="{ row }">
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        trailing-icon="i-lucide-history"
        :label="String(row.original.assessment_count)"
        :disabled="!row.original.assessment_count"
        :aria-label="`BIA history of ${row.original.group.name}`"
        @click="emit('open-history', row.original)"
      />
    </template>
    <template #empty>
      <p class="py-6 text-center text-sm text-muted">
        {{ emptyText }}
      </p>
    </template>
  </UTable>
</template>
