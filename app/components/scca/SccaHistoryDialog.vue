<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { SccaHistoryItem, SccaRegisterRow } from '~/composables/useSccaWorkflow'

/** Monitoring > List > SCCA(s): every SCCA of one application, newest first, 20 a page. The
 * latest final is Current; the final SCCAs before it are Replaced. */
const props = defineProps<{ row: SccaRegisterRow }>()
const emit = defineEmits<{ close: [] }>()

const page = ref(1)
const perPage = ref(ROWS_PER_PAGE)
watch(perPage, () => (page.value = 1))
const { data, status } = useSccaApplicationHistory(computed(() => ({
  key: props.row.key,
  page: page.value,
  per_page: perPage.value,
})))

const columns: TableColumn<SccaHistoryItem>[] = [
  { accessorKey: 'ref_no', header: 'Ref no' },
  { accessorKey: 'reason', header: 'Reason' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'assessment_date', header: 'Assessment date' },
  { accessorKey: 'finalised_at', header: 'Final date' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'due_date', header: 'Renewal date' },
  { accessorKey: 'assessor', header: 'Assessor' },
  { accessorKey: 'contributor', header: 'Contributor' },
  { id: 'renews', header: 'Renews' },
]
</script>

<template>
  <UModal
    :title="`SCCAs of ${row.application_name}`"
    :description="`${row.application_code || 'No code'} · ${row.scca_count} SCCA${row.scca_count === 1 ? '' : 's'}`"
    :ui="{ content: 'sm:max-w-6xl' }"
  >
    <template #body>
      <div class="-m-4 sm:-m-6">
        <div class="flex justify-end border-b border-default px-4 py-3">
          <UButton
            :to="sccaApplicationHistoryExportUrl(row.key)"
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
              :to="sccaPath('monitoring', item.original.id)"
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
            {{ reasonLabel(item.original.reason) || '—' }}
          </template>
          <template #status-cell="{ row: item }">
            <StatusBadge
              :scale="sccaStatus"
              :value="sccaStatusKey(item.original)"
              size="sm"
            />
          </template>
          <template #assessment_date-cell="{ row: item }">
            {{ formatDate(item.original.assessment_date) || '—' }}
          </template>
          <template #finalised_at-cell="{ row: item }">
            {{ formatDate(item.original.finalised_at) || '—' }}
          </template>
          <template #category-cell="{ row: item }">
            <StatusBadge
              v-if="item.original.category"
              :scale="sccaCategory"
              :value="item.original.category"
              size="sm"
            />
            <span
              v-else
              class="text-muted"
            >—</span>
          </template>
          <template #due_date-cell="{ row: item }">
            {{ formatDate(item.original.due_date) || '—' }}
          </template>
          <template #assessor-cell="{ row: item }">
            {{ item.original.assessor || '—' }}
          </template>
          <template #contributor-cell="{ row: item }">
            {{ item.original.contributor || '—' }}
          </template>
          <template #renews-cell="{ row: item }">
            <span class="font-mono text-xs">{{ item.original.renews?.ref_no || '—' }}</span>
          </template>
          <template #empty>
            <p class="py-6 text-center text-sm text-muted">
              No SCCA of this application is in your view.
            </p>
          </template>
        </UTable>
        <TablePagination
          v-model:page="page"
          v-model:per-page="perPage"
          page-sizes
          :total="data?.total ?? 0"
          label="SCCA history"
        />
      </div>
    </template>
  </UModal>
</template>
