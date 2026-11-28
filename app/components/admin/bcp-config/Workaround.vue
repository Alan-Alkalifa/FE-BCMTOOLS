<script setup lang="ts">
import type { BcpConfigVersion, BcpWorkaroundCondition } from '~/composables/useBcpConfigAdmin'

/**
 * Chapter 6: the conditions every BCP plans a workaround for (one tab each on a BCP), the extra
 * fields a BCP fills in per business function (Kondisi 2: Core System and Other System), and the
 * pandemic alert levels with the split operation and WFH rules. The scenarios and their standard
 * procedures come from Master data › BCP scenario and procedure (shown read-only here). A
 * published condition or column can be made inactive, not removed.
 */
const props = defineProps<{ version: BcpConfigVersion }>()
const emit = defineEmits<{ saved: [version: BcpConfigVersion] }>()

const { draft, error, busy, dirty, submit } = useBcpConfigPart(toRef(props, 'version'), 'workaround', (saved) => emit('saved', saved), 'Conditions saved')
// Published conditions and columns can be made inactive, not removed or renamed.
const savedConditions = computed(() => new Set(props.version.locked.conditions))
function savedColumns(code: string) {
  return new Set(props.version.locked.columns[code] ?? [])
}
const SCOPES = [
  { label: 'Per critical function', value: 'per_function' },
  { label: 'Once, for all critical functions', value: 'all_critical' },
]

function addCondition() {
  const code = bcpCodeFrom('condition', draft.value.conditions.map((row) => row.code))
  draft.value.conditions.push({ code, title: '', intro: '', scope: 'per_function', active: true, show_pandemic_levels: false, columns: [] })
}
function scenariosOf(code: string) {
  return props.version.payload.scenarios.filter((row) => row.condition_code === code)
}
function addColumn(condition: BcpWorkaroundCondition) {
  if (condition.columns.length >= 8) return
  condition.columns.push({ code: bcpCodeFrom('column', condition.columns.map((row) => row.code)), label: '', example: '', active: true })
}
function renameColumn(condition: BcpWorkaroundCondition, index: number) {
  const column = condition.columns[index]!
  if (savedColumns(condition.code).has(column.code)) return
  column.code = bcpCodeFrom(column.label, condition.columns.filter((_, i) => i !== index).map((row) => row.code))
}
function addPandemicLevel() {
  const rows = draft.value.pandemic_levels
  rows.push({ code: bcpCodeFrom('level', rows.map((row) => row.code)), phase: '', level: '', description: '' })
}
</script>

<template>
  <AdminBcpConfigPartForm
    title="Workaround conditions"
    description="Chapter 6 of every BCP: one tab per active condition, with the condition's scenarios and their standard procedures, and its extra fields per business function."
    save-label="Save conditions"
    :editable="version.can.edit"
    :dirty="dirty"
    :busy="busy"
    :error="error"
    @submit="submit"
  >
    <UCard
      v-for="(condition, index) in draft.conditions"
      :key="index"
      :ui="{ root: condition.active ? '' : 'opacity-70' }"
    >
      <div class="space-y-4">
        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <UFormField
            label="Title"
            required
          >
            <UInput
              v-model="condition.title"
              class="w-full"
              maxlength="255"
              :aria-label="`Title of condition ${index + 1}`"
            />
          </UFormField>
          <UFormField label="Active">
            <USwitch
              v-model="condition.active"
              :aria-label="`${condition.title || `Condition ${index + 1}`} is active`"
            />
          </UFormField>
          <UButton
            v-if="version.can.edit && !savedConditions.has(condition.code)"
            class="self-start md:mt-6"
            color="neutral"
            variant="ghost"
            icon="i-lucide-trash-2"
            :aria-label="`Remove ${condition.title || `condition ${index + 1}`}`"
            @click="draft.conditions.splice(index, 1)"
          />
        </div>
        <UFormField label="Filled in">
          <URadioGroup
            v-model="condition.scope"
            :items="SCOPES"
            orientation="horizontal"
          />
        </UFormField>
        <UFormField
          label="Introduction"
          help="Printed above the condition's table. Start a line with '- ' for a bullet."
        >
          <UTextarea
            v-model="condition.intro"
            class="w-full"
            :rows="3"
            autoresize
            :aria-label="`Introduction of ${condition.title || `condition ${index + 1}`}`"
          />
        </UFormField>
        <div class="space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-highlighted">
              Scenarios
            </h3>
            <UButton
              :to="{ path: '/masterdata/bcp-scenarios', query: { condition: condition.code } }"
              size="sm"
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-arrow-right"
              label="Edit in Master data"
            />
          </div>
          <p
            v-if="!scenariosOf(condition.code).length"
            class="text-sm text-muted"
          >
            No scenario yet. Add one in Master data › BCP scenario and procedure.
          </p>
          <ul
            v-else
            class="divide-y divide-default rounded-md border border-default text-sm"
          >
            <li
              v-for="scenario in scenariosOf(condition.code)"
              :key="scenario.code"
              class="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              :class="scenario.active ? '' : 'text-muted'"
            >
              <span>{{ scenario.name }} <span class="font-mono text-xs text-muted">{{ scenario.code }}</span></span>
              <span class="text-xs text-muted">{{ scenario.procedures.filter((row) => row.active).length }} procedures{{ scenario.active ? '' : ' · inactive' }}</span>
            </li>
          </ul>
        </div>
        <USwitch
          v-model="condition.show_pandemic_levels"
          label="Show the pandemic alert levels on this condition"
        />
        <h3 class="text-sm font-semibold text-highlighted">
          Extra fields per business function
        </h3>
        <p
          v-if="!condition.columns.length"
          class="text-sm text-muted"
        >
          None: a BCP only fills in the scenarios of this condition.
        </p>
        <div
          v-else
          class="overflow-x-auto"
        >
          <table class="w-full min-w-[40rem] text-sm">
            <caption class="sr-only">
              Extra fields of {{ condition.title }}
            </caption>
            <thead class="bg-muted text-left text-xs uppercase text-muted">
              <tr>
                <th class="w-56 px-3 py-2">
                  Column
                </th>
                <th class="px-3 py-2">
                  Example
                </th>
                <th class="w-20 px-3 py-2">
                  Active
                </th>
                <th class="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(column, columnIndex) in condition.columns"
                :key="columnIndex"
              >
                <td class="px-3 py-2 align-top">
                  <UInput
                    v-model="column.label"
                    class="w-full"
                    maxlength="255"
                    :aria-label="`Column ${columnIndex + 1} of ${condition.title || `condition ${index + 1}`}`"
                    @blur="renameColumn(condition, columnIndex)"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <UTextarea
                    v-model="column.example"
                    class="w-full"
                    :rows="2"
                    autoresize
                    :aria-label="`Example for ${column.label || `column ${columnIndex + 1}`}`"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <USwitch
                    v-model="column.active"
                    :aria-label="`${column.label || `Column ${columnIndex + 1}`} is active`"
                  />
                </td>
                <td class="px-3 py-2 text-right align-top">
                  <UButton
                    v-if="version.can.edit && !savedColumns(condition.code).has(column.code) && true"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    :aria-label="`Remove ${column.label || `column ${columnIndex + 1}`}`"
                    @click="condition.columns.splice(columnIndex, 1)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UButton
          v-if="version.can.edit && condition.columns.length < 8"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-plus"
          label="Add field"
          @click="addColumn(condition)"
        />
      </div>
    </UCard>
    <UButton
      v-if="version.can.edit && draft.conditions.length < 10"
      color="neutral"
      variant="outline"
      icon="i-lucide-plus"
      label="Add condition"
      @click="addCondition"
    />

    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-highlighted">
        Pandemic alert levels
      </h3>
      <div
        v-for="(row, index) in draft.pandemic_levels"
        :key="index"
        class="grid gap-3 md:grid-cols-[10rem_10rem_minmax(0,1fr)_auto]"
      >
        <UInput
          v-model="row.phase"
          maxlength="255"
          placeholder="Phase, e.g. Waspada"
          :aria-label="`Phase of alert level ${index + 1}`"
        />
        <UInput
          v-model="row.level"
          maxlength="255"
          placeholder="Level, e.g. Siaga III"
          :aria-label="`Alert level ${index + 1}`"
        />
        <UTextarea
          v-model="row.description"
          :rows="2"
          autoresize
          :aria-label="`Condition of alert level ${index + 1}`"
        />
        <UButton
          v-if="version.can.edit"
          color="neutral"
          variant="ghost"
          icon="i-lucide-trash-2"
          :aria-label="`Remove alert level ${index + 1}`"
          @click="draft.pandemic_levels.splice(index, 1)"
        />
      </div>
      <UButton
        v-if="version.can.edit"
        color="neutral"
        variant="outline"
        icon="i-lucide-plus"
        label="Add alert level"
        @click="addPandemicLevel"
      />
    </section>
    <UFormField
      label="Split operations and work from home"
      help="Printed after the pandemic condition."
    >
      <UTextarea
        v-model="draft.split_wfh_text"
        class="w-full"
        :rows="5"
        autoresize
      />
    </UFormField>
  </AdminBcpConfigPartForm>
</template>
