<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { OrganizationChange, OrganizationRow } from '~/utils/bianca-organization'
import { organizationChangeKinds, organizationChangeSources, organizationEndpoint, organizationLevels, organizationPathLabel } from '~/utils/bianca-organization'

/** Structure > Act > View history: the changes of one unit, of the units above it, and of the
 * names it had before (followed through recorded renames and moves), newest first. */
const props = defineProps<{ unit: OrganizationRow }>()

const page = ref(1)
const perPage = ref(ROWS_PER_PAGE)
watch(perPage, () => (page.value = 1))
const { data, status } = useFetch<{ items: OrganizationChange[], total: number }>(`${organizationEndpoint}/changes`, {
  query: computed(() => ({
    unit_directorate: props.unit.directorate,
    unit_sub_directorate: props.unit.sub_directorate,
    unit_org_group: props.unit.org_group,
    page: page.value,
    per_page: perPage.value,
  })),
  server: false,
})

const columns: TableColumn<OrganizationChange>[] = [
  { accessorKey: 'effective_date', header: 'Effective date' },
  { accessorKey: 'kind', header: 'Type' },
  { id: 'previous', header: 'Previous' },
  { id: 'current', header: 'Current' },
  { accessorKey: 'reference', header: 'Reference' },
  { accessorKey: 'source', header: 'Source' },
  { id: 'recorded_by', header: 'Recorded by' },
]
const levelLabel = organizationLevels.find((item) => item.value === props.unit.level)!.label
</script>

<template>
  <UModal
    :title="`History of ${unit[unit.level]}`"
    :description="`${levelLabel} · ${organizationPathLabel(unit)}`"
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #body>
      <div class="-m-4 sm:-m-6">
        <UTable
          :data="data?.items ?? []"
          :columns="columns"
          :loading="status === 'pending'"
          :ui="{ th: 'first:ps-4 last:pe-4 whitespace-nowrap', td: 'first:ps-4 last:pe-4 align-top' }"
        >
          <template #effective_date-cell="{ row }">
            {{ formatDate(row.original.effective_date) }}
          </template>
          <template #kind-cell="{ row }">
            <UBadge
              variant="subtle"
              size="sm"
              :color="organizationChangeKinds[row.original.kind].color"
              :label="organizationChangeKinds[row.original.kind].label"
            />
          </template>
          <template #previous-cell="{ row }">
            <span class="whitespace-normal">{{ organizationPathLabel(row.original.previous) }}</span>
          </template>
          <template #current-cell="{ row }">
            <span class="whitespace-normal">{{ organizationPathLabel(row.original.current) }}</span>
          </template>
          <template #reference-cell="{ row }">
            {{ row.original.reference || '—' }}
          </template>
          <template #source-cell="{ row }">
            {{ organizationChangeSources[row.original.source] }}
          </template>
          <template #recorded_by-cell="{ row }">
            {{ row.original.recorded_by?.name || '—' }}
          </template>
          <template #empty>
            <p class="py-6 text-center text-sm text-muted">
              No change of this unit is recorded yet.
            </p>
          </template>
        </UTable>
        <TablePagination
          v-model:page="page"
          v-model:per-page="perPage"
          page-sizes
          :total="data?.total ?? 0"
          label="Unit history"
        />
      </div>
    </template>
  </UModal>
</template>
