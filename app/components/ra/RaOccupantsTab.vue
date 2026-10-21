<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaLocationDetail, RaOccupant } from '~/composables/useRa'
import RaOccupantModal from '~/components/ra/RaOccupantModal.vue'

const props = defineProps<{ location: RaLocationDetail }>()
const emit = defineEmits<{ saved: [location: RaLocationDetail] }>()
const ra = useRaModule()

const toast = useToast()
const confirm = useConfirm()
const modal = useOverlay().create(RaOccupantModal)
const saving = ref(false)
const saveError = ref<string | null>(null)

const VIEWS = [
  { label: 'Occupants', value: 'profile', icon: 'i-lucide-users' },
  { label: 'Continuity strategy', value: 'strategy', icon: 'i-lucide-route' },
]
const view = ref<'profile' | 'strategy'>('profile')
const search = ref('')

type Row = RaOccupant & { index: number }

const rows = computed<Row[]>(() => {
  const term = search.value.trim().toLowerCase()
  return props.location.occupants
    .map((occupant, index) => ({ ...occupant, index }))
    .filter((row) => !term || [row.unit_name, row.directorate, row.floor]
      .some((value) => value?.toLowerCase().includes(term)))
})

const summary = computed(() => props.location.occupant_summary)
const tiles = computed(() => [
  { label: 'Units', value: summary.value.units, icon: 'i-lucide-building-2' },
  { label: 'Employees', value: summary.value.employees, icon: 'i-lucide-users' },
  { label: 'Units with a BCP', value: summary.value.with_bcp, icon: 'i-lucide-file-check' },
  { label: 'Units with an alternate site', value: summary.value.with_alternate_site, icon: 'i-lucide-map-pin' },
])

const right = { class: { th: 'text-right', td: 'text-right' } }
// Unit names can be long lists ("A | B | C"), so they wrap instead of widening the table.
const wrap = { class: { td: 'whitespace-normal min-w-56' } }
const profileColumns: TableColumn<Row>[] = [
  { accessorKey: 'floor', header: 'Floor' },
  { accessorKey: 'unit_name', header: 'Unit', meta: wrap },
  { accessorKey: 'directorate', header: 'Directorate', meta: wrap },
  { accessorKey: 'employee_count', header: 'Employees', meta: right },
  { accessorKey: 'disabled_count', header: 'Disability', meta: right },
  { accessorKey: 'pregnant_count', header: 'Pregnant', meta: right },
  { accessorKey: 'shift_work', header: 'Shifts' },
  { id: 'actions', header: '', meta: { class: { td: 'w-0 whitespace-nowrap' } } },
]
const strategyColumns: TableColumn<Row>[] = [
  { accessorKey: 'floor', header: 'Floor' },
  { accessorKey: 'unit_name', header: 'Unit', meta: wrap },
  { accessorKey: 'employee_count', header: 'Employees', meta: right },
  { accessorKey: 'mtd', header: 'MTD' },
  { accessorKey: 'has_bcp', header: 'BCP' },
  { accessorKey: 'alternate_site', header: 'Alternate site' },
  { accessorKey: 'remarks', header: 'Remarks' },
  { id: 'actions', header: '', meta: { class: { td: 'w-0 whitespace-nowrap' } } },
]

async function save(occupants: RaOccupant[], message: string) {
  saveError.value = null
  saving.value = true
  try {
    const saved = await raApi.setOccupants(
      props.location.id,
      occupants.map(({ seq: _seq, ...occupant }) => occupant),
    )
    toast.add({ title: message, color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', saved)
  } catch (error) {
    const fields = apiFieldErrors(error)
    saveError.value = fields.length ? fields.map((item) => item.message).join(' ') : apiErrorMessage(error)
  } finally {
    saving.value = false
  }
}

async function edit(row?: Row) {
  const occupant = await modal.open({
    occupant: row ? props.location.occupants[row.index] : undefined,
    directorates: props.location.occupants.map((item) => item.directorate ?? ''),
  }).result
  if (!occupant) return
  const next = [...props.location.occupants]
  if (row) next[row.index] = occupant
  else next.push(occupant)
  await save(next, row ? 'Unit saved' : 'Unit added')
}

async function remove(row: Row) {
  const ok = await confirm({
    title: `Remove '${row.unit_name}'?`,
    description: 'The unit and its continuity strategy are removed from this location.',
    confirmLabel: 'Remove unit',
    destructive: true,
  })
  if (!ok) return
  await save(props.location.occupants.filter((_, index) => index !== row.index), 'Unit removed')
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <UCard
        v-for="tile in tiles"
        :key="tile.label"
      >
        <p class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon
            :name="tile.icon"
            class="size-4"
          />
          {{ tile.label }}
        </p>
        <p class="mt-1 text-3xl font-semibold text-highlighted tabular-nums">
          {{ formatNumber(tile.value, 0) }}
        </p>
      </UCard>
    </div>

    <UAlert
      v-if="saveError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the units"
      :description="saveError"
    />

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              Units in this {{ ra.location.lower === 'branch' ? 'branch' : 'building' }}
            </h2>
            <p class="text-sm text-muted">
              LCP Section C (occupants) and Section F (business continuity strategy).
            </p>
          </div>
          <UButton
            icon="i-lucide-plus"
            label="Add unit"
            @click="edit()"
          />
        </div>
      </template>

      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search by unit, directorate or floor"
          class="w-full sm:w-80"
          aria-label="Search by unit, directorate or floor"
        />
        <UTabs
          v-model="view"
          :items="VIEWS"
          :content="false"
          size="sm"
          class="w-auto"
        />
      </div>

      <UTable
        :data="rows"
        :columns="view === 'profile' ? profileColumns : strategyColumns"
        :loading="saving"
      >
        <template #floor-cell="{ row }">
          {{ row.original.floor || '—' }}
        </template>
        <template #unit_name-cell="{ row }">
          <span class="font-medium text-highlighted">{{ row.original.unit_name }}</span>
        </template>
        <template #directorate-cell="{ row }">
          {{ row.original.directorate || '—' }}
        </template>
        <template #employee_count-cell="{ row }">
          {{ formatNumber(row.original.employee_count, 0) ?? '—' }}
        </template>
        <template #disabled_count-cell="{ row }">
          {{ formatNumber(row.original.disabled_count, 0) ?? '—' }}
        </template>
        <template #pregnant_count-cell="{ row }">
          {{ formatNumber(row.original.pregnant_count, 0) ?? '—' }}
        </template>
        <template #shift_work-cell="{ row }">
          <span v-if="row.original.shift_work === true">{{ row.original.shift_times || 'Yes' }}</span>
          <span v-else-if="row.original.shift_work === false">No</span>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #mtd-cell="{ row }">
          {{ row.original.mtd || '—' }}
        </template>
        <template #has_bcp-cell="{ row }">
          <StatusBadge
            v-if="raYesNoKey(row.original.has_bcp)"
            :scale="raYesNo"
            :value="raYesNoKey(row.original.has_bcp)"
            size="sm"
          />
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #alternate_site-cell="{ row }">
          <StatusBadge
            v-if="raYesNoKey(row.original.alternate_site)"
            :scale="raYesNo"
            :value="raYesNoKey(row.original.alternate_site)"
            size="sm"
          />
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #remarks-cell="{ row }">
          <UTooltip
            v-if="row.original.remarks"
            :text="row.original.remarks"
          >
            <span class="block max-w-48 truncate">{{ row.original.remarks }}</span>
          </UTooltip>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UTooltip text="Edit unit">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-pencil"
                :aria-label="`Edit ${row.original.unit_name}`"
                @click="edit(row.original)"
              />
            </UTooltip>
            <UTooltip text="Remove unit">
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                :aria-label="`Remove ${row.original.unit_name}`"
                @click="remove(row.original)"
              />
            </UTooltip>
          </div>
        </template>
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">
            {{ search ? 'No units match this search.' : `No units yet. Add the units that work in this ${ra.location.lower === 'branch' ? 'branch' : 'building'}.` }}
          </p>
        </template>
      </UTable>

      <p
        v-if="rows.length"
        class="mt-4 text-sm text-muted"
      >
        Showing {{ formatNumber(rows.length, 0) }} of {{ formatNumber(location.occupants.length, 0) }} units
      </p>
    </UCard>
  </div>
</template>
