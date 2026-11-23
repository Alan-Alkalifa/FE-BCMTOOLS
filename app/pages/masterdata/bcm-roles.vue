<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BcmAssignment, BcmOperationalRole } from '~/utils/bianca-bcm-roles'
import BiancaBcmAssignmentForm from '~/components/bianca/BiancaBcmAssignmentForm.vue'

definePageMeta({ permission: ['masterdata.bcm_roles.view', 'masterdata.bcm_roles.manage'] })
const route = useRoute()
const router = useRouter()
const { can } = useAuth()
const manage = computed(() => can('masterdata.bcm_roles.manage'))
const role = computed({
  get: () => bcmRoleTabs.find((item) => item.value === route.query.role)?.value ?? 'bcm_head',
  set: (value: BcmOperationalRole) => router.replace({ query: { ...route.query, role: value, page: undefined } }),
})
const dialog = useOverlay().create(BiancaBcmAssignmentForm)
const { data, error, status, refresh } = useFetch<{ items: BcmAssignment[] }>('/api/masterdata/bcm-roles', { query: { role } })
const search = ref('')
const active = ref('all')
const perPage = useRowsPerPage()
const rows = computed(() => (data.value?.items ?? []).filter((row) => row.role === role.value
  && (active.value === 'all' || row.is_active === (active.value === 'active'))
  && [row.user.username, row.user.employee_id, row.user.display_name, row.description].some((value) => value?.toLowerCase().includes(search.value.trim().toLowerCase()))))
const page = computed(() => Math.min(Math.max(1, Math.floor(Number(route.query.page)) || 1), Math.max(1, Math.ceil(rows.value.length / perPage.value))))
const columns: TableColumn<BcmAssignment>[] = [
  { id: 'username', header: 'User ID' }, { id: 'nik', header: 'NIK' }, { id: 'name', header: 'User name' },
  { accessorKey: 'description', header: 'Description' }, { id: 'status', header: 'Status' }, { id: 'actions', header: '' },
]
async function edit(assignment?: BcmAssignment) {
  if (manage.value && await dialog.open({ role: role.value, assignment }).result) await refresh()
}
</script>

<template>
  <AppPage
    title="Mapping BCM Roles"
    icon="i-lucide-users"
    description="Operational assignments for BIA signers."
    :crumbs="[{ label: 'Administration' }, { label: 'Master data', to: MASTER_DATA_PATH }, { label: 'Mapping BCM Roles' }]"
  >
    <template #actions>
      <UButton
        v-if="manage"
        icon="i-lucide-plus"
        label="Add assignment"
        @click="edit()"
      />
    </template>
    <UTabs
      v-model="role"
      :items="bcmRoleTabs"
      variant="link"
      :content="false"
    />
    <UAlert
      v-if="error"
      title="Could not load assignments"
      color="error"
      :description="adminErrorText(error)"
    >
      <template #actions>
        <UButton
          label="Try again"
          @click="refresh()"
        />
      </template>
    </UAlert>
    <UCard
      v-else
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <ListFilterBar
        :filtered="!!search || active !== 'all'"
        @clear="search = ''; active = 'all'"
      >
        <template #search>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search assignments"
            aria-label="Search assignments"
            class="w-full"
          />
        </template>
        <USelect
          v-model="active"
          :items="[{ label: 'Active and inactive', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]"
          aria-label="Filter by status"
        />
      </ListFilterBar>
      <UTable
        :columns="columns"
        :data="rows.slice((page - 1) * perPage, page * perPage)"
        :loading="status === 'pending'"
      >
        <template #username-cell="{ row }">
          {{ row.original.user.username }}
        </template>
        <template #nik-cell="{ row }">
          {{ row.original.user.employee_id || '—' }}
        </template>
        <template #name-cell="{ row }">
          {{ row.original.user.display_name || '—' }} <span
            v-if="!row.original.user.is_active"
            class="text-xs text-muted"
          >(inactive account)</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :label="row.original.is_active ? 'Active' : 'Inactive'"
            :color="row.original.is_active ? 'success' : 'neutral'"
            variant="subtle"
          />
        </template>
        <template #actions-cell="{ row }">
          <UButton
            v-if="manage"
            label="Edit"
            variant="ghost"
            color="neutral"
            icon="i-lucide-pencil"
            @click="edit(row.original)"
          />
        </template>
        <template #empty>
          No matching assignments.
        </template>
      </UTable>
      <TablePagination
        v-model:per-page="perPage"
        page-sizes
        :page="page"
        :total="rows.length"
        :to="next => ({ query: { ...route.query, page: next } })"
        label="Assignments"
      />
    </UCard>
  </AppPage>
</template>
