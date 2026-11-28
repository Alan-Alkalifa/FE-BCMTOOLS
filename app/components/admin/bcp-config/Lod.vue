<script setup lang="ts">
import type { BcpConfigVersion, BcpLodColor } from '~/composables/useBcpConfigAdmin'

/**
 * Chapter 2.8: the levels of disruption, what each criterion means at each level, and which plans
 * each level activates, who activates them, who approves and who is told. Every row has a text
 * for every level: adding a level adds a column to both matrices.
 */
const props = defineProps<{ version: BcpConfigVersion }>()
const emit = defineEmits<{ saved: [version: BcpConfigVersion] }>()

const { draft, error, busy, dirty, submit } = useBcpConfigPart(toRef(props, 'version'), 'lod', (saved) => emit('saved', saved), 'Levels saved')
const savedLevels = computed(() => new Set(props.version.locked.levels))
const COLORS: { label: string, value: BcpLodColor }[] = [
  { label: 'Black', value: 'black' }, { label: 'Red', value: 'red' }, { label: 'Amber', value: 'amber' },
  { label: 'Yellow', value: 'yellow' }, { label: 'Green', value: 'green' }, { label: 'Neutral', value: 'neutral' },
]

function addLevel() {
  const code = bcpCodeFrom('level', draft.value.levels.map((row) => row.code))
  draft.value.levels.push({ code, label: '', color: 'neutral' })
  for (const row of draft.value.criteria) row.descriptions[code] = ''
  for (const row of draft.value.activation) row.by_level[code] = ''
}
/** The texts of a row with the level `from` moved to `to` (or dropped when `to` is null). */
function rekey(texts: Record<string, string>, from: string, to: string | null) {
  return Object.fromEntries(
    Object.entries(texts).flatMap(([key, text]) => (key !== from ? [[key, text]] : to ? [[to, text]] : [])),
  )
}
function renameLevel(index: number) {
  const level = draft.value.levels[index]!
  if (savedLevels.value.has(level.code)) return
  const code = bcpCodeFrom(level.label, draft.value.levels.filter((_, i) => i !== index).map((row) => row.code))
  if (code === level.code) return
  for (const row of draft.value.criteria) row.descriptions = rekey(row.descriptions, level.code, code)
  for (const row of draft.value.activation) row.by_level = rekey(row.by_level, level.code, code)
  level.code = code
}
function removeLevel(index: number) {
  const [level] = draft.value.levels.splice(index, 1)
  if (!level) return
  for (const row of draft.value.criteria) row.descriptions = rekey(row.descriptions, level.code, null)
  for (const row of draft.value.activation) row.by_level = rekey(row.by_level, level.code, null)
}
function addRow(kind: 'criteria' | 'activation') {
  const blank = Object.fromEntries(draft.value.levels.map((level) => [level.code, '']))
  const code = bcpCodeFrom(kind === 'criteria' ? 'criterion' : 'row', draft.value[kind].map((row) => row.code))
  if (kind === 'criteria') draft.value.criteria.push({ code, label: '', descriptions: blank })
  else draft.value.activation.push({ code, label: '', by_level: blank })
}
const MATRICES = [
  { kind: 'criteria', title: 'Criteria (2.8 a)', field: 'descriptions', add: 'Add criterion' },
  { kind: 'activation', title: 'Activation, authority and notification (2.8 b)', field: 'by_level', add: 'Add row' },
] as const
function cells(row: { descriptions?: Record<string, string>, by_level?: Record<string, string> }) {
  return (row.descriptions ?? row.by_level)!
}
</script>

<template>
  <AdminBcpConfigPartForm
    title="Level of disruption"
    description="Chapter 2.8 of every BCP. A published level can't be removed, since BCPs and incident logs use it."
    save-label="Save levels"
    :editable="version.can.edit"
    :dirty="dirty"
    :busy="busy"
    :error="error"
    @submit="submit"
  >
    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-highlighted">
        Levels
      </h3>
      <div
        v-for="(level, index) in draft.levels"
        :key="index"
        class="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto]"
      >
        <UInput
          v-model="level.label"
          class="w-full"
          maxlength="255"
          :aria-label="`Name of level ${index + 1}`"
          @blur="renameLevel(index)"
        />
        <USelect
          v-model="level.color"
          :items="COLORS"
          class="w-full"
          :aria-label="`Colour of ${level.label || `level ${index + 1}`}`"
        />
        <UButton
          v-if="version.can.edit && !savedLevels.has(level.code)"
          color="neutral"
          variant="ghost"
          icon="i-lucide-trash-2"
          :aria-label="`Remove ${level.label || `level ${index + 1}`}`"
          @click="removeLevel(index)"
        />
      </div>
      <UButton
        v-if="version.can.edit && draft.levels.length < 7"
        color="neutral"
        variant="outline"
        icon="i-lucide-plus"
        label="Add level"
        @click="addLevel"
      />
    </section>

    <section
      v-for="matrix in MATRICES"
      :key="matrix.kind"
      class="space-y-3"
    >
      <h3 class="text-sm font-semibold text-highlighted">
        {{ matrix.title }}
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[56rem] text-sm">
          <caption class="sr-only">
            {{ matrix.title }}
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th
                scope="col"
                class="w-56 px-3 py-2"
              >
                {{ matrix.kind === 'criteria' ? 'Criterion' : 'Row' }}
              </th>
              <th
                v-for="level in draft.levels"
                :key="level.code"
                scope="col"
                class="px-3 py-2"
              >
                {{ level.label || level.code }}
              </th>
              <th class="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(row, index) in draft[matrix.kind]"
              :key="index"
            >
              <td class="px-3 py-2 align-top">
                <UTextarea
                  v-model="row.label"
                  class="w-full"
                  :rows="2"
                  autoresize
                  :aria-label="`${matrix.kind === 'criteria' ? 'Criterion' : 'Row'} ${index + 1}`"
                />
              </td>
              <td
                v-for="level in draft.levels"
                :key="level.code"
                class="px-3 py-2 align-top"
              >
                <UTextarea
                  v-model="cells(row)[level.code]"
                  class="w-full min-w-40"
                  :rows="3"
                  autoresize
                  :aria-label="`${row.label || `Row ${index + 1}`} at ${level.label || level.code}`"
                />
              </td>
              <td class="px-3 py-2 text-right align-top">
                <UButton
                  v-if="version.can.edit"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :aria-label="`Remove ${row.label || `row ${index + 1}`}`"
                  @click="draft[matrix.kind].splice(index, 1)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UButton
        v-if="version.can.edit"
        color="neutral"
        variant="outline"
        icon="i-lucide-plus"
        :label="matrix.add"
        @click="addRow(matrix.kind)"
      />
    </section>

    <UFormField
      label="Notes under the tables"
      name="lod.notes"
    >
      <UTextarea
        v-model="draft.notes"
        class="w-full"
        :rows="3"
        autoresize
      />
    </UFormField>
  </AdminBcpConfigPartForm>
</template>
