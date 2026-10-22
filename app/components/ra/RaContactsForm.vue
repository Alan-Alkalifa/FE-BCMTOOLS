<script setup lang="ts">
import type { RaContact, RaLocationDetail } from '~/composables/useRa'

const props = defineProps<{ location: RaLocationDetail }>()
const emit = defineEmits<{ saved: [location: RaLocationDetail] }>()

const toast = useToast()
const dirty = useRaDirty()
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const snapshot = ref('')

interface Row {
  key: number
  kind: RaContactKind
  name: string
  phone: string
  group_name: string
  floor: string
  address: string
}

let nextKey = 0
function toRow(contact: Partial<RaContact> & { kind: RaContactKind }): Row {
  nextKey += 1
  return {
    key: nextKey,
    kind: contact.kind,
    name: contact.name ?? '',
    phone: contact.phone ?? '',
    group_name: contact.group_name ?? '',
    floor: contact.floor ?? '',
    address: contact.address ?? '',
  }
}

const rows = ref<Row[]>([])

function content() {
  return JSON.stringify(rows.value.map(({ key: _key, ...row }) => row))
}

function reset(location: RaLocationDetail) {
  rows.value = location.contacts.map(toRow)
  snapshot.value = content()
  fieldErrors.value = {}
  if (dirty) dirty.value = false
}

watch(() => props.location, (location) => reset(location), { immediate: true })
watch(rows, () => {
  if (dirty) dirty.value = content() !== snapshot.value
}, { deep: true })

const groups = computed(() =>
  RA_CONTACT_KINDS.map((kind) => ({ ...kind, rows: rows.value.filter((row) => row.kind === kind.value) })),
)

function add(kind: RaContactKind) {
  rows.value.push(toRow({ kind }))
}

function remove(row: Row) {
  rows.value = rows.value.filter((item) => item.key !== row.key)
}

/** Rows with nothing filled in are dropped; a row with details but no name needs one. */
function validate() {
  const errors: Record<string, string> = {}
  for (const row of rows.value) {
    const { key, kind: _kind, name, ...rest } = row
    if (!name.trim() && Object.values(rest).some((value) => value.trim())) {
      errors[`${key}`] = 'Enter a name, or remove this row.'
    }
  }
  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function save() {
  formError.value = null
  if (!validate()) {
    formError.value = 'Some contacts need a name. Check the messages below.'
    return
  }
  const contacts = rows.value
    .filter((row) => row.name.trim())
    .map(({ key: _key, ...row }) => blankToNull(row) as RaContact)
  try {
    const saved = await raApi.setContacts(props.location.id, contacts)
    reset(saved)
    toast.add({ title: 'Contacts saved', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', saved)
  } catch (error) {
    formError.value = apiErrorMessage(error)
  }
}
</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="formError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the contacts"
      :description="formError"
    />

    <UCard
      v-for="group in groups"
      :key="group.value"
    >
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">
            {{ group.label }}
          </h2>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-plus"
            :label="`Add ${group.single.toLowerCase()}`"
            @click="add(group.value)"
          />
        </div>
      </template>

      <p
        v-if="!group.rows.length"
        class="text-sm text-muted"
      >
        None yet.
      </p>

      <div
        v-else
        class="divide-y divide-default"
      >
        <div
          v-for="(row, index) in group.rows"
          :key="row.key"
          class="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <UFormField
            :label="`${group.single} ${index + 1}`"
            :error="fieldErrors[row.key]"
          >
            <UInput
              v-model="row.name"
              placeholder="Name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Phone">
            <UInput
              v-model="row.phone"
              type="tel"
              class="w-full"
            />
          </UFormField>
          <div class="flex items-end">
            <UTooltip text="Remove">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                :aria-label="`Remove ${group.single.toLowerCase()} ${index + 1}`"
                @click="remove(row)"
              />
            </UTooltip>
          </div>
          <template v-if="group.value === 'floor_warden'">
            <UFormField label="Group">
              <UInput
                v-model="row.group_name"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Floor">
              <UInput
                v-model="row.floor"
                class="w-full"
              />
            </UFormField>
          </template>
          <UFormField
            v-else
            label="Address"
            class="sm:col-span-2"
          >
            <UInput
              v-model="row.address"
              class="w-full"
            />
          </UFormField>
        </div>
      </div>
    </UCard>

    <div class="flex justify-end">
      <UButton
        label="Save contacts"
        loading-auto
        @click="save"
      />
    </div>
  </div>
</template>
