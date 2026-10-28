<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaDivision } from '~/composables/useRa'

/**
 * The division list: the divisions that work in buildings, each with its MTD and critical
 * rating. A building's divisions are picked from it, so a change here (name, MTD) reaches every
 * building it works in. Live: not part of a configuration version. A division in use can only
 * be made inactive.
 */
const { can } = useAuth()
const toast = useToast()
const confirm = useConfirm()
const editable = computed(() => can('ra.config.manage'))

const { data, status, error, refresh } = useAsyncData('ra-config-divisions', () => raConfigApi.divisions())
const search = ref('')
const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (data.value?.items ?? []).filter((row) => !term || row.name.toLowerCase().includes(term))
})

const mtdItems = RA_MTD_BANDS.map((value): { label: string, value: string } => ({ label: value, value }))
const ratingItems = RA_CRITICAL_RATINGS.map((value): { label: string, value: string } => ({ label: value, value }))

const columns: TableColumn<RaDivision>[] = [
  { accessorKey: 'name', header: 'Division' },
  { accessorKey: 'critical_rating', header: 'Critical rating' },
  { accessorKey: 'mtd', header: 'MTD' },
  { accessorKey: 'used_by', header: 'Buildings\' units', meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } },
  { accessorKey: 'is_active', header: 'Status' },
  { id: 'actions', header: '', meta: { class: { td: 'w-0 whitespace-nowrap text-right' } } },
]
const divisionStatus = defineStatusScale({
  active: { label: 'Active', color: 'success', icon: 'i-lucide-circle-check' },
  inactive: { label: 'Inactive', color: 'neutral', icon: 'i-lucide-circle-pause' },
})

/** The add / edit form. */
const form = reactive({ id: null as number | null, name: '', critical_rating: '', mtd: '' })
const formOpen = ref(false)
const formError = ref<string | null>(null)
const saving = ref(false)

function openForm(row?: RaDivision) {
  Object.assign(form, row
    ? { id: row.id, name: row.name, critical_rating: row.critical_rating, mtd: row.mtd }
    : { id: null, name: '', critical_rating: '', mtd: '' })
  formError.value = null
  formOpen.value = true
}

watch(() => form.critical_rating, (rating) => {
  if (rating && !form.mtd) form.mtd = RA_RATING_MTD[rating] ?? ''
})

async function save() {
  formError.value = null
  if (!form.name.trim() || !form.mtd || !form.critical_rating) {
    formError.value = 'Enter the name and choose the critical rating and MTD.'
    return
  }
  saving.value = true
  try {
    const body = { name: form.name.trim(), mtd: form.mtd, critical_rating: form.critical_rating }
    if (form.id) await raConfigApi.updateDivision(form.id, body)
    else await raConfigApi.createDivision(body)
    toast.add({ title: form.id ? 'Division saved' : 'Division added', color: 'success', icon: 'i-lucide-circle-check' })
    formOpen.value = false
    clearNuxtData('ra-divisions')
    await refresh()
  } catch (failure) {
    formError.value = configErrorText(failure)
  } finally {
    saving.value = false
  }
}

async function setActive(row: RaDivision, active: boolean) {
  try {
    await raConfigApi.updateDivision(row.id, { is_active: active })
    clearNuxtData('ra-divisions')
    await refresh()
  } catch (failure) {
    toast.add({ title: configErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

async function remove(row: RaDivision) {
  const ok = await confirm({
    title: `Delete '${row.name}'?`,
    description: 'It is removed from the division list. A division that buildings list can only be made inactive.',
    confirmLabel: 'Delete division',
    destructive: true,
  })
  if (!ok) return
  try {
    await raConfigApi.deleteDivision(row.id)
    toast.add({ title: 'Division deleted', color: 'success', icon: 'i-lucide-circle-check' })
    clearNuxtData('ra-divisions')
    await refresh()
  } catch (failure) {
    toast.add({ title: configErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold text-highlighted">
              Divisions
            </h2>
            <p class="mt-1 text-sm text-muted">
              Picked for each building's units; their MTD and critical rating follow the division.
            </p>
          </div>
          <UButton
            v-if="editable"
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            label="Add division"
            @click="openForm()"
          />
        </div>
      </template>
      <div class="border-b border-default p-4">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search divisions"
          aria-label="Search divisions"
          class="w-full sm:w-80"
        />
      </div>
      <UAlert
        v-if="error"
        class="m-4"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load the divisions"
        :description="configErrorText(error)"
      />
      <UTable
        v-else
        :data="rows"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{ th: 'first:ps-4 last:pe-4', td: 'first:ps-4 last:pe-4' }"
      >
        <template #name-cell="{ row }">
          <span class="font-medium text-highlighted">{{ row.original.name }}</span>
        </template>
        <template #is_active-cell="{ row }">
          <StatusBadge
            :scale="divisionStatus"
            :value="row.original.is_active ? 'active' : 'inactive'"
            size="sm"
          />
        </template>
        <template #actions-cell="{ row }">
          <div
            v-if="editable"
            class="flex justify-end gap-1"
          >
            <UTooltip text="Edit">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-pencil"
                :aria-label="`Edit ${row.original.name}`"
                @click="openForm(row.original)"
              />
            </UTooltip>
            <UTooltip :text="row.original.is_active ? 'Make inactive' : 'Make active'">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                :icon="row.original.is_active ? 'i-lucide-circle-pause' : 'i-lucide-circle-play'"
                :aria-label="`${row.original.is_active ? 'Make inactive' : 'Make active'}: ${row.original.name}`"
                @click="setActive(row.original, !row.original.is_active)"
              />
            </UTooltip>
            <UTooltip
              v-if="!row.original.used_by"
              text="Delete"
            >
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                :aria-label="`Delete ${row.original.name}`"
                @click="remove(row.original)"
              />
            </UTooltip>
          </div>
        </template>
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">
            {{ search ? 'No division matches this search.' : 'No divisions yet. Add them here, or while adding a division to a building.' }}
          </p>
        </template>
      </UTable>
    </UCard>

    <UCard v-if="formOpen">
      <template #header>
        <h2 class="font-semibold text-highlighted">
          {{ form.id ? 'Edit division' : 'Add division' }}
        </h2>
        <p
          v-if="form.id"
          class="mt-1 text-sm text-muted"
        >
          A new name or MTD reaches every building that lists it.
        </p>
      </template>
      <form
        class="space-y-4"
        novalidate
        @submit.prevent="save"
      >
        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :ui="{ description: 'whitespace-pre-line' }"
          :description="formError"
        />
        <UFormField
          label="Division name"
          required
        >
          <UInput
            v-model="form.name"
            aria-label="Division name"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Critical rating"
          required
        >
          <USelect
            v-model="form.critical_rating"
            :items="ratingItems"
            placeholder="Choose"
            aria-label="Critical rating"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="MTD"
          required
          help="Maximum tolerable downtime, from the division's BIA."
        >
          <USelect
            v-model="form.mtd"
            :items="mtdItems"
            placeholder="Choose"
            aria-label="MTD"
            class="w-full"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="formOpen = false"
          />
          <UButton
            type="submit"
            :label="form.id ? 'Save division' : 'Add division'"
            :loading="saving"
          />
        </div>
      </form>
    </UCard>
  </div>
</template>
