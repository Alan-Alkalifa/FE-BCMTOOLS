<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BiaGroupHistoryRow, BiaMonitorGroupRow } from '~/composables/useBiaWorkflow'

/**
 * Monitoring > List > BIA(s), as SCCA's SCCA(s) and RA's RA(s): every BIA of one group,
 * newest first. The latest final BIA is Current; the final BIAs before it are Replaced.
 */
const props = defineProps<{ row: BiaMonitorGroupRow }>()
const emit = defineEmits<{ close: [] }>()

const page = ref(1)
const perPage = ref(ROWS_PER_PAGE)
watch(perPage, () => (page.value = 1))
const { data, status } = useBiaGroupHistory(computed(() => ({
  group_id: props.row.group.id,
  page: page.value,
  per_page: perPage.value,
})))

const columns: TableColumn<BiaGroupHistoryRow>[] = [
  { accessorKey: 'ref_no', header: 'Ref no' },
  { accessorKey: 'reason', header: 'Reason' },
  { accessorKey: 'status', header: 'Status', meta: BIA_STATUS_COLUMN },
  { accessorKey: 'assessment_date', header: 'Assessment date' },
  { accessorKey: 'approved_at', header: 'Final date' },
  { accessorKey: 'highest_category', header: 'Highest category' },
  { accessorKey: 'shortest_mtd', header: 'Shortest MTD' },
  { accessorKey: 'assessor', header: 'BCM Coordinator' },
  { accessorKey: 'alt_coordinator', header: 'Alternate' },
]
</script>

<template>
  <UModal
    :title="`BIAs of ${row.group.name}`"
    :description="`${row.group.code || 'No ID'} · ${row.assessment_count} BIA${row.assessment_count === 1 ? '' : 's'}`"
    :ui="{ content: 'sm:max-w-6xl' }"
  >
    <template #body>
      <div class="-m-4 sm:-m-6">
        <UTable
          :data="data?.items ?? []"
          :columns="columns"
          :loading="status === 'pending'"
          :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
        >
          <template #ref_no-cell="{ row: item }">
            <NuxtLink
              :to="biaPath('monitoring', item.original.id)"
              class="font-mono text-xs text-primary hover:underline"
              @click="emit('close')"
            >
              {{ item.original.ref_no || `#${item.original.id}` }}
            </NuxtLink>
            <UBadge
              v-if="item.original.mark"
              :color="item.original.mark === 'current' ? 'success' : 'neutral'"
              variant="subtle"
              size="sm"
              class="ms-1"
              :label="item.original.mark === 'current' ? 'Current' : 'Replaced'"
            />
          </template>
          <template #reason-cell="{ row: item }">
            {{ biaReasonLabel(item.original.reason) || '—' }}
          </template>
          <template #status-cell="{ row: item }">
            <div class="inline-flex flex-col items-center gap-0.5">
              <StatusBadge
                v-if="item.original.status_group"
                :scale="biaStatusGroup"
                :value="item.original.status_group"
                size="sm"
              />
              <StatusBadge
                v-else
                :scale="biaStatus"
                :value="biaStatusKey(item.original)"
                size="sm"
              />
              <span
                v-if="item.original.status_detail_label"
                class="text-xs text-muted"
              >
                {{ item.original.status_detail_label }}
              </span>
            </div>
          </template>
          <template #assessment_date-cell="{ row: item }">
            {{ formatDate(item.original.assessment_date) || '—' }}
          </template>
          <template #approved_at-cell="{ row: item }">
            {{ formatDate(item.original.approved_at) || '—' }}
          </template>
          <template #highest_category-cell="{ row: item }">
            <StatusBadge
              v-if="item.original.highest_category"
              :scale="biaCategory"
              :value="item.original.highest_category"
              size="sm"
            />
            <span
              v-else
              class="text-muted"
            >—</span>
          </template>
          <template #shortest_mtd-cell="{ row: item }">
            {{ item.original.shortest_mtd || '—' }}
          </template>
          <template #assessor-cell="{ row: item }">
            {{ item.original.assessor || '—' }}
          </template>
          <template #alt_coordinator-cell="{ row: item }">
            {{ item.original.alt_coordinator || '—' }}
          </template>
          <template #empty>
            <p class="py-6 text-center text-sm text-muted">
              No BIA of this group is in your view.
            </p>
          </template>
        </UTable>
        <TablePagination
          v-model:page="page"
          v-model:per-page="perPage"
          page-sizes
          :total="data?.total ?? 0"
          label="BIA history"
        />
      </div>
    </template>
  </UModal>
</template>
