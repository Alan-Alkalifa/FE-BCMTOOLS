<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { OrganizationRow, UnitLevel } from '~/utils/bianca-organization'
import BiancaOrganizationForm from '~/components/bianca/BiancaOrganizationForm.vue'
import { organizationLevels, organizationEndpoint } from '~/utils/bianca-organization'

definePageMeta({ permission: ['masterdata.access', 'masterdata.organization.manage'] })
const { can } = useAuth()
const form = useOverlay().create(BiancaOrganizationForm)
const orgRevision = useBiancaOrgRevision()
const perPage = useRowsPerPage()
const route = useRoute()
const router = useRouter()
const level = computed({
  get: () => organizationLevels.find((item) => item.value === route.query.level)?.value ?? 'directorate',
  set: (value: UnitLevel) => router.replace({ query: { ...route.query, level: value, page: undefined } }),
})
const label = computed(() => organizationLevels.find((item) => item.value === level.value)!.label)
const search = ref('')
const active = ref('all')
const statusItems = [
  { label: 'Active and inactive', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
]
const { data, error, status, refresh } = useFetch<{ items: OrganizationRow[] }>(organizationEndpoint, { query: { details: 1 } })
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const units = computed(() => data.value?.items ?? [])
const matching = computed(() => {
  const term = search.value.trim().toLowerCase()
  return units.value.filter((row) => row.level === level.value
    && (active.value === 'all' || row.available === (active.value === 'active'))
    && [row.directorate, row.sub_directorate, row.org_group, row.code, row.description, row.owner?.name, row.owner?.email]
      .some((value) => value?.toLowerCase().includes(term)))
})
const filtered = computed(() => !!search.value.trim() || active.value !== 'all')
const page = computed(() => Math.min(Math.max(1, Math.floor(Number(route.query.page)) || 1), Math.max(1, Math.ceil(matching.value.length / perPage.value))))
const rows = computed(() => matching.value.slice((page.value - 1) * perPage.value, page.value * perPage.value))
watch([search, active, perPage], () => {
  if (route.query.page) router.replace({ query: { ...route.query, page: undefined } })
})
const columns = computed<TableColumn<OrganizationRow>[]>(() => [
  ...organizationLevels.slice(0, organizationLevels.findIndex((item) => item.value === level.value)).map((item) => ({ accessorKey: item.value, header: item.label })),
  { id: 'unit', header: label.value },
  { id: 'owner', header: 'Assigned user' },
  { accessorKey: 'description', header: 'Description' },
  { id: 'source', header: 'Source' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: '', meta: { class: { td: 'w-12 text-end' } } },
])

async function openForm(unit?: OrganizationRow) {
  if (!can('masterdata.organization.manage')) return
  const saved = await form.open({ level: level.value, unit, units: units.value }).result
  if (saved) {
    orgRevision.value++
    await refresh()
  }
}
</script>

<template>
  <AppPage
    title="Organization structure"
    icon="i-lucide-network"
    description="Browse the HR hierarchy and manage unit mappings and BIA-specific units."
    :crumbs="[{ label: 'Administration' }, { label: 'Master data', to: MASTER_DATA_PATH }, { label: 'Organization structure' }]"
  >
    <template #actions>
      <UButton
        :to="`${organizationEndpoint}/export.xlsx`"
        external
        color="neutral"
        variant="outline"
        icon="i-lucide-download"
        label="Export to Excel"
      />
      <UButton
        v-if="can('masterdata.organization.manage')"
        icon="i-lucide-plus"
        :label="'New ' + label.toLowerCase()"
        :disabled="!data || !!error"
        @click="openForm()"
      />
    </template>

    <UTabs
      v-model="level"
      :items="[...organizationLevels]"
      variant="link"
      :content="false"
    />
    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="columns.length"
      label="Loading organization units"
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the organization structure"
      :description="adminErrorText(error)"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
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
        :filtered="filtered"
        @clear="search = ''; active = 'all'"
      >
        <template #search>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search units"
            aria-label="Search units"
            class="w-full"
          />
        </template>
        <USelectMenu
          v-model="active"
          :items="statusItems"
          value-key="value"
          :search-input="false"
          aria-label="Filter by status"
          class="w-48"
        />
      </ListFilterBar>
      <UTable
        :data="rows"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4' }"
      >
        <template #unit-cell="{ row }">
          <component
            :is="can('masterdata.organization.manage') ? 'button' : 'span'"
            class="block text-start font-medium text-highlighted"
            :class="can('masterdata.organization.manage') ? 'hover:text-primary hover:underline' : ''"
            @click="openForm(row.original)"
          >
            {{ row.original[level] }}
          </component>
          <span
            v-if="row.original.code"
            class="text-xs text-muted"
          >{{ row.original.code }}</span>
        </template>
        <template #owner-cell="{ row }">
          <template v-if="row.original.owner">
            <p>{{ row.original.owner.name }} <span class="text-xs text-muted">#{{ row.original.owner.id }}</span></p>
            <p class="text-xs text-muted">
              {{ row.original.owner.email }}
            </p>
          </template>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #description-cell="{ row }">
          <p class="max-w-64 whitespace-normal wrap-break-word">
            {{ row.original.description || '—' }}
          </p>
        </template>
        <template #source-cell="{ row }">
          <UBadge
            variant="subtle"
            color="neutral"
            :label="row.original.source.toUpperCase()"
          />
        </template>
        <template #status-cell="{ row }">
          <UBadge
            variant="subtle"
            :color="row.original.available ? 'success' : 'neutral'"
            :label="row.original.available ? 'Active' : 'Inactive'"
            :icon="row.original.available ? 'i-lucide-circle-check' : 'i-lucide-circle-minus'"
          />
        </template>
        <template #actions-cell="{ row }">
          <UDropdownMenu
            v-if="can('masterdata.organization.manage')"
            :items="[{ label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openForm(row.original) }]"
            :content="{ align: 'end' }"
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis-vertical"
              :aria-label="`Actions for ${row.original[level]}`"
            />
          </UDropdownMenu>
        </template>
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">
            {{ filtered ? 'No units match these filters.' : 'No units yet.' }}
          </p>
        </template>
      </UTable>
      <TablePagination
        v-model:per-page="perPage"
        :page="page"
        page-sizes
        :total="matching.length"
        :to="(next) => ({ query: { ...route.query, page: next } })"
        label="Organization units"
      />
    </UCard>
  </AppPage>
</template>
