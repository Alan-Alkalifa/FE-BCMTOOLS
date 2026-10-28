<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { LocationQueryRaw } from 'vue-router'
import type { RaLocation } from '~/composables/useRa'

/**
 * The Buildings register: head office buildings and branches in one table, filtered by type,
 * province and status (all in the URL), one page at a time. A row opens the building's profile.
 * A new building, and making one inactive, waits for someone else's approval: the Status
 * Building column shows it, and the status filter lists the ones waiting.
 */
const { can } = useAuth()
/** RA and RA Branch are granted separately: the register lists the sides the user holds. */
const kinds = useRaKinds()
const editKinds = useRaKinds('edit')
const canEdit = computed(() => editKinds.value.length > 0)
function canEditRow(location: RaLocation) {
  return can(RA_MODULES[location.kind].perm.edit)
}
function canDeleteRow(location: RaLocation) {
  return can(RA_MODULES[location.kind].perm.edit, RA_MODULES[location.kind].perm.manage)
}
const confirm = useConfirm()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const PER_PAGE = 25
type TypeFilter = RaKind | 'all'
type StatusFilter = 'all' | 'active' | 'inactive' | 'pending' | 'rejected'

function text(name: string) {
  const value = route.query[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
const type = computed<TypeFilter>(() => {
  const value = text('type')
  return value === 'head_office' || value === 'branch' ? value : 'all'
})
const statusFilter = computed<StatusFilter>(() => {
  const value = text('status')
  return value === 'active' || value === 'inactive' || value === 'pending' || value === 'rejected' ? value : 'all'
})
const province = computed(() => text('province'))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))

function setQuery(name: string, value: string | undefined) {
  const next = value === undefined || value === 'all' || value === '' ? undefined : value
  if (next === (route.query[name] ?? undefined)) return
  const query: LocationQueryRaw = { ...route.query, [name]: next, page: undefined }
  router.replace({ query })
}

const search = ref(text('q') ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => setQuery('q', value.trim() || undefined), 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const typeModel = computed<TypeFilter>({ get: () => type.value, set: (value) => setQuery('type', value) })
const provinceModel = computed<string>({ get: () => province.value ?? 'all', set: (value) => setQuery('province', value) })
const statusModel = computed<StatusFilter>({ get: () => statusFilter.value, set: (value) => setQuery('status', value) })

const { data, status, error, refresh } = useRaLocationRegister(() => ({
  kind: type.value,
  q: text('q'),
  province: province.value,
  active: statusFilter.value === 'active' || statusFilter.value === 'inactive' ? statusFilter.value === 'active' : undefined,
  approval: statusFilter.value === 'pending' || statusFilter.value === 'rejected' ? statusFilter.value : undefined,
  page: page.value,
  per_page: PER_PAGE,
}))
const { data: provinceData } = useRaProvinces(type)
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const actionError = ref<string | null>(null)
const hasFilters = computed(() => Boolean(text('q') || type.value !== 'all' || province.value || statusFilter.value !== 'all'))

const typeItems = [
  { label: 'All types', value: 'all' as const },
  { label: 'Head office buildings', value: 'head_office' as const },
  { label: 'Branches', value: 'branch' as const },
]
const provinceItems = computed(() => [
  { label: 'All provinces', value: 'all' },
  ...(provinceData.value?.items ?? []).map((name) => ({ label: name, value: name })),
])
const statusItems = [
  { label: 'Active and inactive', value: 'all' as const },
  { label: 'Active', value: 'active' as const },
  { label: 'Inactive', value: 'inactive' as const },
  { label: 'Waiting for approval', value: 'pending' as const },
  { label: 'Rejected', value: 'rejected' as const },
]

const columns: TableColumn<RaLocation>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'kind', header: 'Type' },
  { accessorKey: 'province', header: 'Province' },
  { accessorKey: 'address', header: 'Address' },
  { accessorKey: 'assessment_count', header: 'Assessments', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'latest', header: 'Latest residual' },
  { id: 'building_status', header: 'Status Building' },
  { id: 'assessment_status', header: 'Status Assessment' },
  { id: 'actions', header: '', meta: { class: { td: 'w-0 whitespace-nowrap' } } },
]

function noun(location: RaLocation) {
  return RA_MODULES[location.kind].location.lower
}

function openRow(_event: Event, row: { original: RaLocation }) {
  navigateTo(locationPath(row.original.id))
}

const addTo = computed(() => {
  const only = editKinds.value.length === 1 ? editKinds.value[0] : undefined
  const kind = type.value === 'all' ? only : type.value
  return { path: `${LOCATIONS_PATH}/new`, query: kind ? { type: kind } : {} }
})

/** Approve or reject (with a reason) a building waiting for someone else's approval. */
const dialogs = useRaApprovalDialogs()
async function decide(location: RaLocation, decision: 'approve' | 'reject') {
  actionError.value = null
  const action = location.approval?.action
  const note = decision === 'approve' ? await dialogs.approve(noun(location), action) : await dialogs.reject(noun(location), action)
  if (note === false) return
  try {
    if (decision === 'approve') await raApi.approveLocation(location.id, note || null)
    else await raApi.rejectLocation(location.id, note)
    toast.add({ title: `${location.name} ${decision === 'approve' ? 'approved' : 'rejected'}`, color: 'success', icon: 'i-lucide-circle-check' })
    await refresh()
  } catch (err) {
    actionError.value = apiErrorMessage(err)
  }
}

async function remove(location: RaLocation) {
  actionError.value = null
  const ok = await confirm({
    title: `Delete '${location.name}'?`,
    description: `This permanently removes the ${noun(location)}. Buildings with assessments can only be deactivated.`,
    confirmLabel: `Delete ${noun(location)}`,
    destructive: true,
  })
  if (!ok) return
  try {
    await raApi.removeLocation(location.id)
    toast.add({ title: `${RA_MODULES[location.kind].location.single} deleted`, color: 'success', icon: 'i-lucide-circle-check' })
    await refresh()
  } catch (err) {
    actionError.value = raIsConflict(err)
      ? `'${location.name}' has assessments, so it can't be deleted. Open it and clear Active instead.`
      : apiErrorMessage(err)
  }
}
</script>

<template>
  <AppPage
    title="Buildings"
    icon="i-lucide-building"
    description="Head office buildings and branches: each one's profile, map pin and RAs."
    :crumbs="[{ label: BUILDINGS_GROUP }, { label: 'Buildings' }]"
  >
    <template #actions>
      <UButton
        :to="LOCATION_MAP_PATH"
        color="neutral"
        variant="outline"
        icon="i-lucide-map"
        label="Building map"
      />
      <UButton
        v-if="canEdit"
        :to="addTo"
        icon="i-lucide-plus"
        label="Input building data"
      />
    </template>

    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="9"
      :rows="5"
      label="Loading buildings"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the buildings"
      :description="apiErrorMessage(error)"
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
      <UAlert
        v-if="actionError"
        class="m-4 mb-0"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="That didn't work"
        :description="actionError"
      />
      <div class="flex flex-wrap items-center gap-2 p-4">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search by name, ID, city, province or address"
          class="w-full sm:w-64"
          aria-label="Search by name, ID, city, province or address"
        />
        <USelectMenu
          v-if="kinds.length > 1"
          v-model="typeModel"
          value-key="value"
          :items="typeItems"
          :search-input="false"
          class="w-40"
          aria-label="Type"
        />
        <USelectMenu
          v-model="provinceModel"
          value-key="value"
          :items="provinceItems"
          class="w-44"
          aria-label="Province"
        />
        <USelectMenu
          v-model="statusModel"
          value-key="value"
          :items="statusItems"
          :search-input="false"
          class="w-44"
          aria-label="Status"
        />
      </div>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        class="cursor-pointer"
        :on-select="openRow"
        :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4' }"
      >
        <template #name-cell="{ row }">
          <NuxtLink
            :to="locationPath(row.original.id)"
            class="font-medium text-primary hover:underline"
          >
            {{ row.original.name }}
          </NuxtLink>
          <p
            v-if="row.original.code"
            class="text-xs text-muted"
          >
            {{ row.original.code }}
          </p>
        </template>
        <template #kind-cell="{ row }">
          <StatusBadge
            :scale="raLocationKind"
            :value="row.original.kind"
            size="sm"
          />
        </template>
        <template #province-cell="{ row }">
          <span v-if="row.original.province">{{ row.original.province }}</span>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #address-cell="{ row }">
          <UTooltip
            v-if="row.original.address"
            :text="row.original.address"
          >
            <span class="block max-w-48 truncate">{{ row.original.address }}</span>
          </UTooltip>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #assessment_count-cell="{ row }">
          {{ formatNumber(row.original.assessment_count, 0) }}
        </template>
        <template #latest-cell="{ row }">
          <div
            v-if="row.original.latest_assessment"
            class="flex items-center gap-2"
          >
            <NuxtLink
              :to="raRecordPath(row.original.kind, row.original.latest_assessment)"
              class="whitespace-nowrap text-primary hover:underline"
              @click.stop
            >
              {{ row.original.latest_assessment.ref_no }}
            </NuxtLink>
            <StatusBadge
              v-if="row.original.latest_assessment.highest_residual_level"
              :scale="raRiskLevel"
              :value="row.original.latest_assessment.highest_residual_level"
              size="sm"
            />
          </div>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #building_status-cell="{ row }">
          <StatusBadge
            :scale="raBuildingStatus"
            :value="raBuildingState(row.original)"
            size="sm"
          />
        </template>
        <template #assessment_status-cell="{ row }">
          <StatusBadge
            v-if="row.original.latest_assessment"
            :scale="raStatus"
            :value="raStatusKey(row.original.latest_assessment)"
            size="sm"
          />
          <span
            v-else
            class="text-muted"
          >No RA yet</span>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex items-center justify-end gap-1">
            <template v-if="row.original.approval_can?.approve">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-badge-check"
                label="Approve"
                :aria-label="`Approve ${row.original.name}`"
                @click.stop="decide(row.original, 'approve')"
              />
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-circle-x"
                label="Reject"
                :aria-label="`Reject ${row.original.name}`"
                @click.stop="decide(row.original, 'reject')"
              />
            </template>
            <UTooltip :text="canEditRow(row.original) ? `Edit ${noun(row.original)}` : `Open ${noun(row.original)}`">
              <UButton
                :to="locationPath(row.original.id)"
                color="neutral"
                variant="ghost"
                size="sm"
                :icon="canEditRow(row.original) ? 'i-lucide-pencil' : 'i-lucide-eye'"
                :aria-label="`${canEditRow(row.original) ? 'Edit' : 'Open'} ${row.original.name}`"
                @click.stop
              />
            </UTooltip>
            <UTooltip
              v-if="canDeleteRow(row.original)"
              :text="`Delete ${noun(row.original)}`"
            >
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                :aria-label="`Delete ${row.original.name}`"
                @click.stop="remove(row.original)"
              />
            </UTooltip>
          </div>
        </template>
        <template #empty>
          <p class="py-10 text-center text-sm text-muted">
            {{ hasFilters ? 'No buildings match these filters.' : 'No buildings yet. Add the first head office building or branch to assess.' }}
          </p>
        </template>
      </UTable>

      <TablePagination
        v-if="data"
        :page="data.page"
        :per-page="PER_PAGE"
        :total="data.total"
        :to="(next) => ({ query: { ...route.query, page: next > 1 ? next : undefined } })"
        label="Buildings"
      />
    </UCard>
  </AppPage>
</template>
