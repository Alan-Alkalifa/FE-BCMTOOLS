<script setup lang="ts">
import type { RaLocationDetail } from '~/composables/useRa'

/**
 * Editable rows grouped in cards (recovery teams, call tree levels), saved together.
 * Rows with nothing filled in are dropped; a row with details needs its required fields.
 */
interface Field {
  key: string
  label: string
  required?: boolean
  type?: 'text' | 'tel'
  placeholder?: string
  wide?: boolean
}

interface Group {
  value: string | number
  label: string
  description?: string
}

type Values = Record<string, string | number | null>

const props = defineProps<{
  groups: readonly Group[]
  groupKey: string
  fields: Field[]
  initial: Values[]
  itemLabel: string
  saveLabel: string
  savedMessage: string
  errorTitle: string
  save: (rows: Values[]) => Promise<RaLocationDetail>
}>()
const emit = defineEmits<{ saved: [location: RaLocationDetail] }>()

const toast = useToast()
const dirty = useRaDirty()
const formError = ref<string | null>(null)
const rowErrors = ref<Record<number, string>>({})
const snapshot = ref('')

interface Row {
  key: number
  group: string | number
  values: Record<string, string>
}

let nextKey = 0
function toRow(group: string | number, values: Values = {}): Row {
  nextKey += 1
  return {
    key: nextKey,
    group,
    values: Object.fromEntries(props.fields.map((field) => [field.key, String(values[field.key] ?? '')])),
  }
}

const rows = ref<Row[]>([])
const content = () => JSON.stringify(rows.value.map(({ group, values }) => ({ group, values })))

function reset(source: Values[]) {
  rows.value = source.map((row) => toRow(row[props.groupKey] as string | number, row))
  snapshot.value = content()
  rowErrors.value = {}
  if (dirty) dirty.value = false
}

watch(() => props.initial, (source) => reset(source), { immediate: true })
watch(rows, () => {
  if (dirty) dirty.value = content() !== snapshot.value
}, { deep: true })

const columns = computed(() =>
  props.fields.map((field) => (field.wide ? 'minmax(0,1.4fr)' : 'minmax(0,1fr)')).join(' ') + ' auto',
)

const grouped = computed(() =>
  props.groups.map((group) => ({ ...group, rows: rows.value.filter((row) => row.group === group.value) })),
)

function add(group: string | number) {
  rows.value.push(toRow(group))
}

function remove(row: Row) {
  rows.value = rows.value.filter((item) => item.key !== row.key)
}

function filled(row: Row) {
  return Object.values(row.values).some((value) => value.trim())
}

async function onSave() {
  formError.value = null
  const errors: Record<number, string> = {}
  for (const row of rows.value.filter(filled)) {
    const missing = props.fields.filter((field) => field.required && !row.values[field.key]?.trim())
    if (missing.length) errors[row.key] = `Enter the ${missing.map((field) => field.label.toLowerCase()).join(' and ')}, or remove this row.`
  }
  rowErrors.value = errors
  if (Object.keys(errors).length) {
    formError.value = 'Some rows are incomplete. Check the messages below.'
    return
  }
  const payload = rows.value.filter(filled).map((row) => ({
    [props.groupKey]: row.group,
    ...blankToNull(row.values),
  }))
  try {
    const saved = await props.save(payload)
    toast.add({ title: props.savedMessage, color: 'success', icon: 'i-lucide-circle-check' })
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
      :title="errorTitle"
      :description="formError"
    />

    <UCard
      v-for="group in grouped"
      :key="group.value"
    >
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              {{ group.label }}
            </h2>
            <p
              v-if="group.description"
              class="text-sm text-muted"
            >
              {{ group.description }}
            </p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-plus"
            :label="`Add ${itemLabel}`"
            :aria-label="`Add ${itemLabel} to ${group.label}`"
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
        class="space-y-2"
      >
        <div
          class="hidden gap-2 text-xs font-semibold tracking-wide text-muted uppercase md:grid"
          :style="{ gridTemplateColumns: columns }"
          aria-hidden="true"
        >
          <span
            v-for="field in fields"
            :key="field.key"
          >{{ field.label }}<span
            v-if="field.required"
            class="text-error"
          >*</span></span>
          <span class="w-8" />
        </div>
        <div
          v-for="(row, index) in group.rows"
          :key="row.key"
        >
          <div
            class="grid gap-2 max-md:!grid-cols-1"
            :style="{ gridTemplateColumns: columns }"
          >
            <UInput
              v-for="field in fields"
              :key="field.key"
              v-model="row.values[field.key]"
              :type="field.type ?? 'text'"
              :placeholder="field.placeholder ?? field.label"
              :title="row.values[field.key] || undefined"
              :aria-label="`${field.label}, ${group.label} row ${index + 1}`"
              :aria-invalid="Boolean(rowErrors[row.key]) && field.required && !row.values[field.key]?.trim()"
              class="w-full"
            />
            <UTooltip text="Remove row">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                :aria-label="`Remove ${group.label} row ${index + 1}`"
                @click="remove(row)"
              />
            </UTooltip>
          </div>
          <p
            v-if="rowErrors[row.key]"
            class="mt-1 flex items-center gap-1 text-sm text-error"
          >
            <UIcon
              name="i-lucide-circle-alert"
              class="size-4"
            />
            {{ rowErrors[row.key] }}
          </p>
        </div>
      </div>
    </UCard>

    <div class="flex justify-end">
      <UButton
        :label="saveLabel"
        loading-auto
        @click="onSave"
      />
    </div>
  </div>
</template>
