<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaLocation } from '~/composables/useRa'

const ra = useRaModule()
const { can } = useAuth()
const canEdit = computed(() => can('ra.edit'))
const canDelete = computed(() => can('ra.edit', 'ra.manage'))
const confirm = useConfirm()
const toast = useToast()

const search = ref('')
const term = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (term.value = value), 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))
const { data, status, error, refresh } = useRaLocations(() => ({ kind: ra.value.kind, q: term.value.trim() || undefined }))
const showSkeleton = useDelayedLoading(() => status.value === 'pending' && !data.value)
const actionError = ref<string | null>(null)

const columns = computed<TableColumn<RaLocation>[]>(() => [
  { accessorKey: 'name', header: ra.value.location.single },
  ...(ra.value.hasRegion ? [{ accessorKey: 'region', header: 'Region' }] : []),
  { accessorKey: 'address', header: 'Address' },
  { accessorKey: 'assessment_count', header: 'Assessments', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'latest', header: 'Latest residual' },
  { accessorKey: 'is_active', header: 'Status' },
  { id: 'actions', header: '', meta: { class: { td: 'w-0 whitespace-nowrap' } } },
])

const locationStatus = defineStatusScale({
  active: { label: 'Active', color: 'success', icon: 'i-lucide-circle-check' },
  inactive: { label: 'Inactive', color: 'neutral', icon: 'i-lucide-circle-pause' },
})

function openRow(_event: Event, row: { original: RaLocation }) {
  navigateTo(`${ra.value.base}/locations/${row.original.id}`)
}

const searchLabel = computed(() => ra.value.hasRegion ? 'Search by name, region or address' : 'Search by name or address')

async function remove(location: RaLocation) {
  actionError.value = null
  const ok = await confirm({
    title: `Delete '${location.name}'?`,
    description: `This permanently removes the ${ra.value.location.lower}. ${ra.value.location.plural} with assessments can only be deactivated.`,
    confirmLabel: `Delete ${ra.value.location.lower}`,
    destructive: true,
  })
  if (!ok) return
  try {
    await raApi.removeLocation(location.id)
    toast.add({ title: `${ra.value.location.single} deleted`, color: 'success', icon: 'i-lucide-circle-check' })
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
    :title="`${ra.title} ${ra.location.lowerPlural}`"
    :crumbs="[{ label: ra.title, to: raPath(ra.kind, 'monitoring') }, { label: ra.location.plural }]"
  >
    <SkeletonTable
      v-if="showSkeleton"
      toolbar
      :columns="6"
      :rows="5"
      :label="`Loading ${ra.location.lowerPlural}`"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="`Could not load ${ra.location.lowerPlural}`"
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

    <UCard v-else>
      <UAlert
        v-if="actionError"
        class="mb-4"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="`Couldn't delete the ${ra.location.lower}`"
        :description="actionError"
      />
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="searchLabel"
          class="w-full sm:w-72"
          :aria-label="searchLabel"
        />
        <div class="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          <UButton
            to="/ra/map"
            color="neutral"
            variant="outline"
            icon="i-lucide-map"
            label="Location map"
          />
          <UButton
            v-if="canEdit"
            :to="`${ra.base}/locations/new`"
            icon="i-lucide-plus"
            :label="`Add ${ra.location.lower}`"
          />
        </div>
      </div>

      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        class="cursor-pointer"
        :on-select="openRow"
      >
        <template #name-cell="{ row }">
          <NuxtLink
            :to="`${ra.base}/locations/${row.original.id}`"
            class="font-medium text-primary hover:underline"
          >
            {{ row.original.name }}
          </NuxtLink>
        </template>
        <template #address-cell="{ row }">
          <UTooltip
            v-if="row.original.address"
            :text="row.original.address"
          >
            <span class="block max-w-xs truncate">{{ row.original.address }}</span>
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
              :to="raRecordPath(ra.kind, row.original.latest_assessment)"
              class="whitespace-nowrap text-primary hover:underline"
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
        <template #is_active-cell="{ row }">
          <StatusBadge
            :scale="locationStatus"
            :value="row.original.is_active ? 'active' : 'inactive'"
            size="sm"
          />
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UTooltip :text="canEdit ? `Edit ${ra.location.lower}` : `Open ${ra.location.lower}`">
              <UButton
                :to="`${ra.base}/locations/${row.original.id}`"
                color="neutral"
                variant="ghost"
                size="sm"
                :icon="canEdit ? 'i-lucide-pencil' : 'i-lucide-eye'"
                :aria-label="`${canEdit ? 'Edit' : 'Open'} ${row.original.name}`"
                @click.stop
              />
            </UTooltip>
            <UTooltip
              v-if="canDelete"
              :text="`Delete ${ra.location.lower}`"
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
      </UTable>

      <div
        v-if="data && !data.items.length"
        class="py-10 text-center"
      >
        <p class="text-sm text-muted">
          {{ term
            ? `No ${ra.location.lowerPlural} match this search.`
            : ra.kind === 'branch' ? 'No branches yet. Add the first branch to assess.' : 'No locations yet. Add the first building to assess.' }}
        </p>
      </div>
    </UCard>
  </AppPage>
</template>
