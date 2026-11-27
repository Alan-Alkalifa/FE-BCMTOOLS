<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaLocationHistoryRow, RaMonitorLocation } from '~/composables/useRa'

/** Monitoring > List > RA(s), as SCCA's SCCA(s): every RA of one location, newest first. The
 * latest final RA is Current; the final RAs before it are Replaced. */
const props = defineProps<{ row: RaMonitorLocation, kind: RaKind }>()
const emit = defineEmits<{ close: [] }>()
const ra = RA_MODULES[props.kind]

const page = ref(1)
const perPage = ref(ROWS_PER_PAGE)
watch(perPage, () => (page.value = 1))
const { data, status } = useRaLocationHistory(computed(() => ({
  kind: props.kind,
  location_id: props.row.location.id,
  page: page.value,
  per_page: perPage.value,
})))

const columns: TableColumn<RaLocationHistoryRow>[] = [
  { accessorKey: 'ref_no', header: 'Ref no' },
  { accessorKey: 'reason', header: 'Reason' },
  { accessorKey: 'status', header: 'Status', meta: RA_STATUS_COLUMN },
  { accessorKey: 'assessment_date', header: 'Assessment date' },
  { accessorKey: 'approved_at', header: 'Final date' },
  { accessorKey: 'highest_residual_level', header: 'Highest residual', meta: RA_STATUS_COLUMN },
  { accessorKey: 'assessor', header: 'Assessor' },
  { accessorKey: 'licom', header: ra.licom.short },
]
</script>

<template>
  <UModal
    :title="`RAs of ${row.location.name}`"
    :description="`${row.location.code || 'No ID'} · ${row.assessment_count} RA${row.assessment_count === 1 ? '' : 's'}`"
    :ui="{ content: 'sm:max-w-6xl' }"
  >
    <template #body>
      <div class="-m-4 sm:-m-6">
        <div class="flex justify-end border-b border-default px-4 py-3">
          <UButton
            :to="raExportUrl('location-ras', { kind, location_id: row.location.id })"
            external
            download
            color="neutral"
            variant="outline"
            icon="i-lucide-file-spreadsheet"
            label="Export to Excel"
          />
        </div>
        <UTable
          :data="data?.items ?? []"
          :columns="columns"
          :loading="status === 'pending'"
          :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
        >
          <template #ref_no-cell="{ row: item }">
            <NuxtLink
              :to="raPath(kind, 'monitoring', item.original.id)"
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
            {{ raReasonLabel(item.original.reason) || '—' }}
          </template>
          <template #status-cell="{ row: item }">
            <StatusBadge
              :scale="raStatus"
              :value="raStatusKey(item.original)"
              size="sm"
            />
          </template>
          <template #assessment_date-cell="{ row: item }">
            {{ formatDate(item.original.assessment_date) || '—' }}
          </template>
          <template #approved_at-cell="{ row: item }">
            {{ formatDate(item.original.approved_at) || '—' }}
          </template>
          <template #highest_residual_level-cell="{ row: item }">
            <StatusBadge
              v-if="item.original.highest_residual_level"
              :scale="raRiskLevel"
              :value="item.original.highest_residual_level"
              size="sm"
            />
            <span
              v-else
              class="text-muted"
            >—</span>
          </template>
          <template #assessor-cell="{ row: item }">
            {{ item.original.assessor || '—' }}
          </template>
          <template #licom-cell="{ row: item }">
            {{ item.original.licom || '—' }}
          </template>
          <template #empty>
            <p class="py-6 text-center text-sm text-muted">
              No RA of this {{ kind === 'branch' ? 'branch' : 'building' }} is in your view.
            </p>
          </template>
        </UTable>
        <TablePagination
          v-model:page="page"
          v-model:per-page="perPage"
          page-sizes
          :total="data?.total ?? 0"
          label="RA history"
        />
      </div>
    </template>
  </UModal>
</template>
