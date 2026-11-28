<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { BcpCondition, BcpPlan, BcpWorkaroundRow } from '~/composables/useBcp'

/**
 * One workaround condition tab, as the production BCP: the condition's text (and the pandemic
 * alert levels where the configuration asks for them), the table of scenario procedures copied
 * from Master data (the unit changes, adds and removes rows), and, when the condition has extra
 * fields (Kondisi 2: Core and Other System), those fields per business function. Saved with
 * "Save condition n" in the top bar (form `bcp-form-<code>`).
 */
const props = defineProps<{ plan: BcpPlan, condition: BcpCondition, label: string }>()
const emit = defineEmits<{ saved: [plan: BcpPlan] }>()
const dirty = inject(bcpDirtyKey, ref(false))
const saving = inject(bcpSavingKey, ref(false))
const toast = useToast()

type Fields = Record<number, Record<string, string>>
function rowsOf(condition: BcpCondition): BcpWorkaroundRow[] {
  return condition.rows.map((row) => ({
    id: row.id,
    scenario_code: row.scenario_code,
    scenario_name: row.scenario_name,
    procedure: row.procedure,
    form: row.form,
    pic: row.pic,
    functions: row.functions === 'all' ? 'all' : [...row.functions],
  }))
}
function fieldsOf(plan: BcpPlan, condition: BcpCondition): Fields {
  return Object.fromEntries(plan.functions.map((fn) => [
    fn.id,
    Object.fromEntries(condition.columns.map((col) => [col.code, fn.fields[condition.code]?.[col.code] ?? ''])),
  ]))
}
const rows = ref<BcpWorkaroundRow[]>(rowsOf(props.condition))
const fields = ref<Fields>(fieldsOf(props.plan, props.condition))
// Only a save (a new revision) resets the form.
watch(() => [props.plan.revision, props.condition.code] as const, () => {
  rows.value = rowsOf(props.condition)
  fields.value = fieldsOf(props.plan, props.condition)
})
const changed = computed(() =>
  JSON.stringify(rows.value) !== JSON.stringify(rowsOf(props.condition))
  || JSON.stringify(fields.value) !== JSON.stringify(fieldsOf(props.plan, props.condition)),
)
watch(changed, (value) => {
  dirty.value = value
}, { immediate: true })

const critical = computed(() => props.plan.functions.filter((fn) => fn.critical))
const category = (value: string | null) => (value && value in biaCategory ? value : 'na') as keyof typeof biaCategory
const functionName = (id: number) => props.plan.functions.find((fn) => fn.id === id)?.name
function coverage(row: BcpWorkaroundRow) {
  if (row.functions === 'all') return 'All business critical functions'
  const names = row.functions.map(functionName).filter(Boolean)
  return names.length ? names.join(', ') : '—'
}

const editing = ref<number | null>(null)
const dialog = ref(false)
function edit(index: number | null) {
  editing.value = index
  dialog.value = true
}
function apply(row: BcpWorkaroundRow) {
  if (editing.value === null) rows.value.push(row)
  else rows.value.splice(editing.value, 1, row)
}
function actions(index: number): DropdownMenuItem[] {
  return [
    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => edit(index) },
    { label: 'Remove', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => rows.value.splice(index, 1) },
  ]
}

const error = ref<string | null>(null)
async function submit() {
  if (!props.plan.permissions.can_edit) return
  error.value = null
  saving.value = true
  try {
    const saved = await bcpApi.saveCondition(props.plan.id, props.condition.code, {
      revision: props.plan.revision,
      rows: rows.value,
      fields: props.condition.columns.length
        ? Object.entries(fields.value).map(([id, values]) => ({ function_id: Number(id), values }))
        : [],
    })
    emit('saved', saved)
    toast.add({ title: 'Condition saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    error.value = configErrorText(failure)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form
    :id="`bcp-form-${condition.code}`"
    class="space-y-6"
    novalidate
    @submit.prevent="submit"
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the condition"
      :ui="{ description: 'whitespace-pre-line' }"
      :description="error"
    />
    <UCard>
      <template #header>
        <h2 class="font-semibold text-highlighted">
          {{ condition.title }}
        </h2>
      </template>
      <BcpText
        v-if="condition.intro"
        :text="condition.intro"
      />
      <p
        v-else
        class="text-sm text-muted"
      >
        —
      </p>
      <div
        v-if="condition.show_pandemic_levels && plan.pandemic_levels.length"
        class="mt-4 overflow-x-auto"
      >
        <h3 class="mb-2 text-sm font-semibold text-highlighted">
          Pandemic alert levels
        </h3>
        <table class="w-full min-w-[40rem] text-sm">
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="w-32 px-3 py-2">
                Phase
              </th>
              <th class="w-32 px-3 py-2">
                Level
              </th>
              <th class="px-3 py-2">
                Condition
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="level in plan.pandemic_levels"
              :key="level.code"
            >
              <td class="px-3 py-2">
                {{ level.phase }}
              </td>
              <td class="px-3 py-2">
                {{ level.level }}
              </td>
              <td class="px-3 py-2">
                {{ level.description || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <h2 class="font-semibold text-highlighted">
          Scenarios and procedures
        </h2>
        <p class="mt-1 text-sm text-muted">
          Copied from Master data › BCP scenario and procedure. Change, add or remove rows for this Group.
        </p>
      </template>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[56rem] text-sm">
          <caption class="sr-only">
            Procedures of {{ condition.title }}
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="w-56 px-4 py-2">
                Scenario
              </th>
              <th class="w-48 px-3 py-2">
                Business critical
              </th>
              <th class="px-3 py-2">
                Procedure
              </th>
              <th class="w-40 px-3 py-2">
                Form
              </th>
              <th class="w-48 px-3 py-2">
                PIC
              </th>
              <th class="w-12 px-4 py-2" />
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(row, index) in rows"
              :key="index"
            >
              <td class="px-4 py-2 align-top">
                <p>{{ row.scenario_name }}</p>
                <p
                  v-if="row.scenario_code"
                  class="font-mono text-xs text-muted"
                >
                  {{ row.scenario_code }}
                </p>
              </td>
              <td class="px-3 py-2 align-top">
                {{ coverage(row) }}
              </td>
              <td class="px-3 py-2 align-top">
                <BcpText :text="row.procedure" />
              </td>
              <td class="px-3 py-2 align-top whitespace-pre-line">
                {{ row.form || '—' }}
              </td>
              <td class="px-3 py-2 align-top whitespace-pre-line">
                {{ row.pic }}
              </td>
              <td class="px-4 py-2 text-right align-top">
                <UDropdownMenu
                  v-if="plan.permissions.can_edit"
                  :items="actions(index)"
                  :content="{ align: 'end' }"
                >
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-ellipsis-vertical"
                    :aria-label="`Actions for ${row.scenario_name}`"
                  />
                </UDropdownMenu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="!rows.length"
        class="py-6 text-center text-sm text-muted"
      >
        No procedure for this condition.
      </p>
      <div
        v-if="plan.permissions.can_edit"
        class="border-t border-default p-4"
      >
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-plus"
          label="Add procedure"
          @click="edit(null)"
        />
      </div>
    </UCard>

    <UCard
      v-if="condition.columns.length"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <template #header>
        <h2 class="font-semibold text-highlighted">
          Business functions (form BIA)
        </h2>
        <p class="mt-1 text-sm text-muted">
          Fill in {{ condition.columns.map((col) => col.label).join(' and ') }} per business function. Required for business critical functions.
        </p>
      </template>
      <fieldset
        :disabled="!plan.permissions.can_edit"
        class="overflow-x-auto"
      >
        <table class="w-full min-w-[56rem] text-sm">
          <caption class="sr-only">
            Extra fields of {{ condition.title }}
          </caption>
          <thead class="bg-muted text-left text-xs uppercase text-muted">
            <tr>
              <th class="w-12 px-4 py-2">
                No
              </th>
              <th class="w-56 px-3 py-2">
                Business function
              </th>
              <th class="w-24 px-3 py-2">
                MTD
              </th>
              <th class="w-40 px-3 py-2">
                Category
              </th>
              <th
                v-for="col in condition.columns"
                :key="col.code"
                class="px-3 py-2"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="fn in plan.functions"
              :key="fn.id"
            >
              <td class="px-4 py-2 align-top tabular-nums">
                {{ fn.seq }}
              </td>
              <td class="px-3 py-2 align-top">
                {{ fn.name }}
                <UBadge
                  v-if="fn.critical"
                  class="mt-1"
                  color="error"
                  variant="subtle"
                  size="sm"
                  label="Required for business critical"
                />
              </td>
              <td class="px-3 py-2 align-top">
                {{ fn.expected_mtd || '—' }}
              </td>
              <td class="px-3 py-2 align-top">
                <StatusBadge
                  :scale="biaCategory"
                  :value="category(fn.category)"
                  size="sm"
                />
              </td>
              <td
                v-for="col in condition.columns"
                :key="col.code"
                class="px-3 py-2 align-top"
              >
                <UTextarea
                  v-model="fields[fn.id]![col.code]"
                  class="w-full"
                  :rows="2"
                  autoresize
                  :placeholder="col.example ? `e.g. ${col.example}` : undefined"
                  :aria-label="`${col.label} of ${fn.name}`"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>
    </UCard>

    <BcpWorkaroundRowDialog
      v-model:open="dialog"
      :row="editing === null ? null : rows[editing] ?? null"
      :title="editing === null ? `Add a ${label} procedure` : `Edit ${label} procedure`"
      :functions="critical"
      @apply="apply"
    />
  </form>
</template>
