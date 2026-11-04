<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { Application } from '~/composables/useApplications'
import type { Page } from '~/composables/useAdmin'
import ApplicationForm from '~/components/admin/ApplicationForm.vue'

definePageMeta({ permission: ['scca.application.view', 'scca.application.manage'] })

const perPage = useRowsPerPage()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const overlay = useOverlay()
const form = overlay.create(ApplicationForm)
const { can } = useAuth()
const canManage = computed(() => can('scca.application.manage'))
const { data: config } = useSccaConfig()

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const activeFilter = ref<string>(typeof route.query.active === 'string' ? route.query.active : 'all')
const categoryFilter = ref<string>(typeof route.query.category === 'string' ? route.query.category : 'all')
// Directorate: one of them, or `none` (no directorate yet: the access scope can't open it).
const directorateFilter = computed<string>({
  get: () => (typeof route.query.directorate === 'string' && route.query.directorate ? route.query.directorate : 'all'),
  set: (value) => router.replace({ query: { ...route.query, directorate: value === 'all' ? undefined : value, page: undefined } }),
})
const { data: orgValues } = useFetch<{ directorates: string[] }>('/api/admin/users/org-values', { key: 'applications-org-values' })
const directorateItems = computed(() => [
  { label: 'All directorates', value: 'all' },
  { label: 'No directorate', value: 'none' },
  ...(orgValues.value?.directorates ?? []).map((name) => ({ label: name, value: name })),
])

const query = computed(() => ({
  q: typeof route.query.q === 'string' && route.query.q ? route.query.q : undefined,
  active: route.query.active === '1' || route.query.active === '0' ? route.query.active : undefined,
  category: typeof route.query.category === 'string' ? route.query.category : undefined,
  directorate: directorateFilter.value !== 'all' && directorateFilter.value !== 'none' ? directorateFilter.value : undefined,
  no_directorate: directorateFilter.value === 'none' ? '1' : undefined,
  page: Math.max(1, Number(route.query.page) || 1),
  per_page: perPage.value,
}))

const { data, status, error, refresh } = useFetch<Page<Application>>('/api/applications', { query, key: 'admin-applications' })
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => router.replace({ query: { ...route.query, q: value.trim() || undefined, page: undefined } }), 300)
})
onBeforeUnmount(() => clearTimeout(timer))
watch(activeFilter, (value) => router.replace({ query: { ...route.query, active: value === 'all' ? undefined : value, page: undefined } }))
watch(categoryFilter, (value) => router.replace({ query: { ...route.query, category: value === 'all' ? undefined : value, page: undefined } }))

const filtered = computed(() => !!(query.value.q || query.value.active || query.value.category || directorateFilter.value !== 'all'))
function clearFilters() {
  search.value = ''
  activeFilter.value = 'all'
  categoryFilter.value = 'all'
  router.replace({ query: {} })
}

const activeItems = [
  { label: 'Active and inactive', value: 'all' },
  { label: 'Active', value: '1' },
  { label: 'Inactive', value: '0' },
]
const categoryItems = computed(() => [
  { label: 'All categories', value: 'all' },
  ...sccaListOptions(config.value, 'category'),
])

const columns: TableColumn<Application>[] = [
  { accessorKey: 'application_code', header: 'Application' },
  { accessorKey: 'directorate', header: 'Directorate' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'rto_hours', header: 'RTO (hours)', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'rpo', header: 'RPO' },
  { id: 'final', header: 'Latest final SCCA' },
  { accessorKey: 'is_active', header: 'Status' },
  { id: 'actions', header: '', meta: { class: { td: 'w-12 text-end' } } },
]

async function openForm(application?: Application) {
  if (!canManage.value) return
  const saved = await form.open({ application: application ?? null }).result
  if (saved) await refresh()
}

async function setActive(application: Application, active: boolean) {
  if (!active && !(await confirm({
    title: `Deactivate ${application.application_code}?`,
    description: 'It can no longer be picked for a new SCCA or as an upstream or downstream application. Its SCCAs stay.',
    confirmLabel: 'Deactivate',
    destructive: true,
  }))) return
  try {
    await applicationsApi.update(application.id, { is_active: active })
    toast.add({ title: active ? 'Application activated' : 'Application deactivated', color: 'success', icon: 'i-lucide-circle-check' })
    await refresh()
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

async function remove(application: Application) {
  if (!(await confirm({
    title: `Delete ${application.application_code}?`,
    description: 'Nothing refers to it yet, so it is removed for good.',
    confirmLabel: 'Delete',
    destructive: true,
  }))) return
  try {
    await applicationsApi.remove(application.id)
    toast.add({ title: 'Application deleted', color: 'success', icon: 'i-lucide-trash-2' })
    await refresh()
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

function actions(application: Application): DropdownMenuItem[][] {
  return [
    [{ label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openForm(application) }],
    [
      application.is_active
        ? { label: 'Deactivate', icon: 'i-lucide-circle-minus', color: 'error' as const, onSelect: () => setActive(application, false) }
        : { label: 'Activate', icon: 'i-lucide-circle-check', onSelect: () => setActive(application, true) },
      ...(application.in_use
        ? []
        : [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(application) }]),
    ],
  ]
}

function categoryColor(category: string | null) {
  return (sccaListItem(config.value, 'category', category)?.attrs?.color as string | undefined) ?? 'neutral'
}
</script>

<template>
  <AppPage
    title="Applications"
    icon="i-lucide-app-window"
    description="Every application BCM tracks, with or without an SCCA. A final SCCA updates its category, RTO and RPO."
    :crumbs="[{ label: 'Administration' }, { label: 'Applications' }]"
  >
    <template
      v-if="canManage"
      #actions
    >
      <UButton
        icon="i-lucide-plus"
        label="New application"
        @click="openForm()"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="8"
      label="Loading applications"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the applications"
      :description="adminErrorText(error)"
    />

    <UCard
      v-else
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <ListFilterBar
        :filtered="filtered"
        @clear="clearFilters"
      >
        <template #search>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search by code or name"
            aria-label="Search applications"
            class="w-full"
          />
        </template>
        <USelectMenu
          v-model="activeFilter"
          value-key="value"
          :items="activeItems"
          :search-input="false"
          aria-label="Filter by status"
          class="w-48"
        />
        <USelectMenu
          v-model="categoryFilter"
          value-key="value"
          :items="categoryItems"
          :search-input="false"
          aria-label="Filter by category"
          class="w-48"
        />
        <USelectMenu
          v-model="directorateFilter"
          value-key="value"
          :items="directorateItems"
          aria-label="Filter by directorate"
          class="w-56"
        />
      </ListFilterBar>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4' }"
      >
        <template #application_code-cell="{ row }">
          <div class="min-w-0">
            <component
              :is="canManage ? 'button' : 'span'"
              :type="canManage ? 'button' : undefined"
              class="block text-start font-medium text-highlighted"
              :class="canManage ? 'hover:text-primary hover:underline' : ''"
              @click="openForm(row.original)"
            >
              {{ row.original.application_code }}
            </component>
            <p class="max-w-80 truncate text-xs text-muted">
              {{ row.original.application_name }}
            </p>
          </div>
        </template>
        <template #directorate-cell="{ row }">
          <span
            class="block max-w-56 truncate text-sm"
            :class="row.original.directorate ? '' : 'text-muted'"
          >{{ row.original.directorate || '—' }}</span>
        </template>
        <template #category-cell="{ row }">
          <UBadge
            v-if="row.original.category"
            :label="sccaListLabel(config, 'category', row.original.category) ?? row.original.category"
            :color="categoryColor(row.original.category) as any"
            variant="subtle"
            size="sm"
          />
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #rto_hours-cell="{ row }">
          <span class="tabular-nums">{{ row.original.rto_hours ?? '—' }}</span>
        </template>
        <template #rpo-cell="{ row }">
          {{ row.original.rpo ?? '—' }}
        </template>
        <template #final-cell="{ row }">
          <template v-if="row.original.final_assessment">
            <NuxtLink
              :to="`/scca/monitoring/${row.original.final_assessment.id}`"
              class="font-medium text-primary hover:underline"
            >
              {{ row.original.final_assessment.ref_no }}
            </NuxtLink>
            <p class="text-xs text-muted">
              {{ formatDate(row.original.final_assessment.finalised_at) }}
            </p>
          </template>
          <span
            v-else
            class="text-sm text-muted"
          >No final SCCA</span>
        </template>
        <template #is_active-cell="{ row }">
          <UBadge
            :label="row.original.is_active ? 'Active' : 'Inactive'"
            :color="row.original.is_active ? 'success' : 'neutral'"
            :icon="row.original.is_active ? 'i-lucide-circle-check' : 'i-lucide-circle-minus'"
            variant="subtle"
            size="sm"
          />
        </template>
        <template #actions-cell="{ row }">
          <UDropdownMenu
            v-if="canManage"
            :items="actions(row.original)"
            :content="{ align: 'end' }"
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis-vertical"
              :aria-label="`Actions for ${row.original.application_code}`"
            />
          </UDropdownMenu>
        </template>
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">
            {{ filtered ? 'No applications match these filters.' : 'No applications yet.' }}
          </p>
        </template>
      </UTable>

      <TablePagination
        v-if="data"
        v-model:per-page="perPage"
        :page="data.page"
        page-sizes
        :total="data.total"
        :to="(page) => ({ query: { ...route.query, page } })"
        label="Applications"
      />
    </UCard>
  </AppPage>
</template>
