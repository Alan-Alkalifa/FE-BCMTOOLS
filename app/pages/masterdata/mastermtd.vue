<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { MasterMtd } from '~/composables/useMasterMtd'
import MtdForm from '~/components/masterdata/MtdForm.vue'

/** Master data › Master MTD: the MTD choices of BIANCA, in the order the forms offer them. */
definePageMeta({ permission: ['masterdata.access', 'master.mtd.manage'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const overlay = useOverlay()
const form = overlay.create(MtdForm)
const { can } = useAuth()
const canManage = computed(() => can('master.mtd.manage'))

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const activeFilter = ref<string>(route.query.active === '1' || route.query.active === '0' ? route.query.active : 'all')
const query = computed(() => ({
  q: typeof route.query.q === 'string' && route.query.q ? route.query.q : undefined,
  active: route.query.active === '1' || route.query.active === '0' ? route.query.active : undefined,
}))
const { data, status, error, refresh } = useMasterMtds(query)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const rows = computed(() => data.value?.items ?? [])

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => router.replace({ query: { ...route.query, q: value.trim() || undefined } }), 300)
})
onBeforeUnmount(() => clearTimeout(timer))
watch(activeFilter, (value) => router.replace({ query: { ...route.query, active: value === 'all' ? undefined : value } }))
const filtered = computed(() => !!(query.value.q || query.value.active))
function clearFilters() {
  search.value = ''
  activeFilter.value = 'all'
  router.replace({ query: {} })
}
const activeItems = [
  { label: 'Active and inactive', value: 'all' },
  { label: 'Active', value: '1' },
  { label: 'Inactive', value: '0' },
]

const columns: TableColumn<MasterMtd>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'category', header: 'Business function category' },
  { accessorKey: 'hours', header: 'Hours', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'offered', header: 'Offered for' },
  { accessorKey: 'description', header: 'Description' },
  { accessorKey: 'sort_order', header: 'Sort', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'is_active', header: 'Status' },
  { id: 'actions', header: '', meta: { class: { td: 'w-12 text-end' } } },
]

async function openForm(mtd?: MasterMtd) {
  if (!canManage.value) return
  const nextSort = Math.max(0, ...rows.value.map((row) => row.sort_order)) + 1
  const saved = await form.open({ mtd: mtd ?? null, nextSort }).result
  if (saved) await refresh()
}

async function setActive(mtd: MasterMtd, active: boolean) {
  if (!active && !(await confirm({
    title: `Deactivate ${mtd.name}?`,
    description: 'It is no longer offered in the BIA form or the Excel template. BIAs that have it keep it.',
    confirmLabel: 'Deactivate',
    destructive: true,
  }))) return
  try {
    await masterMtdApi.update(mtd.id, { ...masterMtdInput(mtd), is_active: active })
    toast.add({ title: active ? 'MTD activated' : 'MTD deactivated', color: 'success', icon: 'i-lucide-circle-check' })
    await refresh()
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

function actions(mtd: MasterMtd): DropdownMenuItem[][] {
  return [
    [{ label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openForm(mtd) }],
    [mtd.is_active
      ? { label: 'Deactivate', icon: 'i-lucide-circle-minus', color: 'error' as const, onSelect: () => setActive(mtd, false) }
      : { label: 'Activate', icon: 'i-lucide-circle-check', onSelect: () => setActive(mtd, true) }],
  ]
}
</script>

<template>
  <AppPage
    title="Master MTD"
    icon="i-lucide-timer"
    description="The MTD choices of the BIA. MTD IT is offered as a function's Expected MTD (Part 2a) and sets its category; MTD non-IT as an upstream or downstream MTD (Part 2b)."
    :crumbs="[{ label: 'Administration' }, { label: 'Master data', to: MASTER_DATA_PATH }, { label: 'Master MTD' }]"
  >
    <template
      v-if="canManage"
      #actions
    >
      <UButton
        icon="i-lucide-plus"
        label="New MTD"
        @click="openForm()"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="7"
      label="Loading the MTD master"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the MTD master"
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
            placeholder="Search by name, code or category"
            aria-label="Search MTDs"
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
      </ListFilterBar>

      <UTable
        :data="rows"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4' }"
      >
        <template #name-cell="{ row }">
          <component
            :is="canManage ? 'button' : 'span'"
            :type="canManage ? 'button' : undefined"
            class="block text-start font-medium text-highlighted"
            :class="canManage ? 'hover:text-primary hover:underline' : ''"
            @click="openForm(row.original)"
          >
            {{ row.original.name }}
          </component>
          <p class="font-mono text-xs text-muted">
            {{ row.original.code }}
          </p>
        </template>
        <template #category-cell="{ row }">
          <StatusBadge
            v-if="row.original.category"
            :scale="BIANCA_CATEGORY"
            :value="row.original.category"
            size="sm"
          />
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #hours-cell="{ row }">
          <span class="tabular-nums">{{ row.original.hours ?? '—' }}</span>
        </template>
        <template #offered-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-if="row.original.for_it"
              label="IT"
              color="neutral"
              variant="outline"
              size="sm"
            />
            <UBadge
              v-if="row.original.for_non_it"
              label="Non-IT"
              color="neutral"
              variant="outline"
              size="sm"
            />
          </div>
        </template>
        <template #description-cell="{ row }">
          <span
            class="block max-w-72 truncate text-sm"
            :class="row.original.description ? '' : 'text-muted'"
            :title="row.original.description ?? undefined"
          >{{ row.original.description || '—' }}</span>
        </template>
        <template #sort_order-cell="{ row }">
          <span class="tabular-nums">{{ row.original.sort_order }}</span>
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
              :aria-label="`Actions for ${row.original.name}`"
            />
          </UDropdownMenu>
        </template>
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">
            {{ filtered ? 'No MTD matches these filters.' : 'No MTD yet.' }}
          </p>
        </template>
      </UTable>
    </UCard>
  </AppPage>
</template>
