<script setup lang="ts">
import type { RaLocationDetail } from '~/composables/useRa'

/**
 * Editable rows grouped in cards (recovery teams, call tree levels), saved together. Inside a
 * card, people are grouped under a lead (the call tree's caller, a team's role), written once
 * as in the workbook's merged cell: "Add caller" adds a lead, "Add contact" adds a person under
 * it. Every field takes free text, so a note such as "Sesuai Tab LRP (front)" or "(Jika ada)"
 * goes where a person would. The API gets one row per person with the lead repeated, in order.
 * Rows with nothing filled in are dropped; a filled row needs its required fields and a lead.
 */
interface Field {
  key: string
  label: string
  required?: boolean
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
  /** The field written once for its people (caller, role); always required. */
  lead: { key: string, label: string, placeholder?: string }
  fields: Field[]
  initial: Values[]
  /** One person under a lead: "contact", "member". */
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
const errors = ref<Record<number, string>>({})
const snapshot = ref('')

interface Row {
  key: number
  values: Record<string, string>
}

interface Block {
  key: number
  group: string | number
  lead: string
  rows: Row[]
}

let nextKey = 0
function toRow(values: Values = {}): Row {
  nextKey += 1
  return {
    key: nextKey,
    values: Object.fromEntries(props.fields.map((field) => [field.key, String(values[field.key] ?? '')])),
  }
}

function toBlock(group: string | number, lead = '', rows: Row[] = [toRow()]): Block {
  nextKey += 1
  return { key: nextKey, group, lead, rows }
}

const blocks = ref<Block[]>([])
const content = () => JSON.stringify(blocks.value.map(({ group, lead, rows }) => ({ group, lead, rows: rows.map((row) => row.values) })))

/** Consecutive rows of a group with the same lead are one block, as the workbook's merged cell. */
function reset(source: Values[]) {
  const result: Block[] = []
  for (const item of source) {
    const group = item[props.groupKey] as string | number
    const lead = String(item[props.lead.key] ?? '')
    const last = result.at(-1)
    if (last && last.group === group && last.lead.trim() === lead.trim()) last.rows.push(toRow(item))
    else result.push(toBlock(group, lead, [toRow(item)]))
  }
  blocks.value = result
  snapshot.value = content()
  errors.value = {}
  if (dirty) dirty.value = false
}

watch(() => props.initial, (source) => reset(source), { immediate: true })
watch(blocks, () => {
  if (dirty) dirty.value = content() !== snapshot.value
}, { deep: true })

const columns = computed(() =>
  props.fields.map((field) => (field.wide ? 'minmax(0,1.4fr)' : 'minmax(0,1fr)')).join(' ') + ' auto',
)

const grouped = computed(() =>
  props.groups.map((group) => ({ ...group, blocks: blocks.value.filter((block) => block.group === group.value) })),
)

const leadWord = computed(() => props.lead.label.toLowerCase())

function addBlock(group: string | number) {
  blocks.value.push(toBlock(group))
}

function addRow(block: Block) {
  block.rows.push(toRow())
}

function removeBlock(block: Block) {
  blocks.value = blocks.value.filter((item) => item.key !== block.key)
}

function removeRow(block: Block, row: Row) {
  block.rows = block.rows.filter((item) => item.key !== row.key)
}

function filled(row: Row) {
  return Object.values(row.values).some((value) => value.trim())
}

function missingIn(row: Row) {
  return props.fields.filter((field) => field.required && !row.values[field.key]?.trim())
}

function invalid(row: Row, field: Field) {
  return Boolean(errors.value[row.key]) && Boolean(field.required) && !row.values[field.key]?.trim()
}

function check() {
  const found: Record<number, string> = {}
  for (const block of blocks.value) {
    const rows = block.rows.filter(filled)
    if (!block.lead.trim() && rows.length) {
      found[block.key] = `Enter the ${leadWord.value}, or remove it.`
    } else if (block.lead.trim() && !rows.length) {
      found[block.key] = `Add a ${props.itemLabel} for this ${leadWord.value}, or remove it.`
    }
    for (const row of rows) {
      const missing = missingIn(row)
      if (missing.length) found[row.key] = `Enter the ${missing.map((field) => field.label.toLowerCase()).join(' and ')}, or remove this row.`
    }
  }
  return found
}

async function onSave() {
  formError.value = null
  errors.value = check()
  if (Object.keys(errors.value).length) {
    formError.value = 'Some rows are incomplete. Check the messages below.'
    return
  }
  const payload = blocks.value.flatMap((block) =>
    block.rows.filter(filled).map((row) => ({
      [props.groupKey]: block.group,
      [props.lead.key]: block.lead.trim(),
      ...blankToNull(row.values),
    })),
  )
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
            :label="`Add ${leadWord}`"
            :aria-label="`Add ${leadWord} to ${group.label}`"
            @click="addBlock(group.value)"
          />
        </div>
      </template>

      <p
        v-if="!group.blocks.length"
        class="text-sm text-muted"
      >
        None yet.
      </p>

      <div
        v-else
        class="space-y-3"
      >
        <section
          v-for="(block, b) in group.blocks"
          :key="block.key"
          class="space-y-2 rounded-md border border-default p-3"
          :aria-label="`${lead.label} ${b + 1}, ${group.label}`"
          :data-lead="block.lead"
        >
          <div class="flex flex-wrap items-center gap-2">
            <UFormField
              :label="lead.label"
              required
              class="min-w-0 flex-1 sm:max-w-xl"
              :ui="{ label: 'text-xs font-semibold tracking-wide text-muted uppercase' }"
            >
              <UInput
                v-model="block.lead"
                :placeholder="lead.placeholder ?? lead.label"
                :title="block.lead || undefined"
                :aria-label="`${lead.label} ${b + 1}, ${group.label}`"
                :aria-invalid="Boolean(errors[block.key]) && !block.lead.trim()"
                class="w-full"
              />
            </UFormField>
            <div class="ml-auto flex items-center gap-1 self-end">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-plus"
                :label="`Add ${itemLabel}`"
                :aria-label="`Add ${itemLabel} for ${leadWord} ${b + 1}, ${group.label}`"
                @click="addRow(block)"
              />
              <UTooltip :text="`Remove this ${leadWord} and its ${itemLabel}s`">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-trash-2"
                  :aria-label="`Remove ${leadWord} ${b + 1}, ${group.label}`"
                  @click="removeBlock(block)"
                />
              </UTooltip>
            </div>
          </div>

          <p
            v-if="!block.rows.length"
            class="text-sm text-muted"
          >
            No {{ itemLabel }} yet.
          </p>
          <div
            v-else
            class="space-y-2 border-l-2 border-default pl-3"
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
              v-for="(row, r) in block.rows"
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
                  :placeholder="field.placeholder ?? field.label"
                  :title="row.values[field.key] || undefined"
                  :aria-label="`${field.label}, ${group.label} ${leadWord} ${b + 1} row ${r + 1}`"
                  :aria-invalid="invalid(row, field)"
                  class="w-full"
                />
                <UTooltip text="Remove row">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-x"
                    :aria-label="`Remove ${group.label} ${leadWord} ${b + 1} row ${r + 1}`"
                    @click="removeRow(block, row)"
                  />
                </UTooltip>
              </div>
              <p
                v-if="errors[row.key]"
                class="mt-1 flex items-center gap-1 text-sm text-error"
              >
                <UIcon
                  name="i-lucide-circle-alert"
                  class="size-4"
                />
                {{ errors[row.key] }}
              </p>
            </div>
          </div>
          <p
            v-if="errors[block.key]"
            class="flex items-center gap-1 text-sm text-error"
          >
            <UIcon
              name="i-lucide-circle-alert"
              class="size-4"
            />
            {{ errors[block.key] }}
          </p>
        </section>
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
