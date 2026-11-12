<script setup lang="ts">
import type { Application } from '~/composables/useApplications'
import type { SccaAssessment, SccaInterdependency } from '~/composables/useScca'

/**
 * A3 Interdependency: the upstream and downstream applications, ticked in a table of the
 * application master (several at once). Category, RTO, RPO and DR capacity come from each
 * application's current final SCCA and are read-only (the server stores them on the row with
 * that SCCA); an application without a final SCCA takes what the assessor enters. Every field
 * is required except the workaround and the gap notes; the automatic gap checks show next to
 * the assessor's own notes.
 */
const props = defineProps<{ assessment: SccaAssessment }>()
const emit = defineEmits<{ saved: [assessment: SccaAssessment] }>()

const toast = useToast()
const dirty = useSccaDirty()
const formError = ref<string | null>(null)
const snapshot = ref('')
const tried = ref(false)

type Filled = 'criticality_category' | 'rto' | 'rpo' | 'dr_capacity'
const FILLED: Filled[] = ['criticality_category', 'rto', 'rpo', 'dr_capacity']
const REQUIRED = [
  ['criticality_category', 'category'],
  ['rto', 'RTO (hours)'],
  ['rpo', 'RPO'],
  ['dr_capacity', 'DR capacity (%)'],
  ['processing_mode', 'processing mode'],
  ['dependency', 'dependency'],
] as const

type FormRow = {
  direction: SccaDirection
  application_id: number | null
  application_code: string | null
  system_name: string
  criticality_category: SccaCategory | undefined
  rto: string
  rpo: string
  dr_capacity: string
  processing_mode: string
  dependency: SccaDependency | undefined
  workaround: string
  gaps_note: string
  /** The final SCCA the values come from (read-only), or null: entered by the assessor. */
  source: { ref_no: string | null, finalised_at: string | null } | null
  /** The values the source gave (read-only); a field it left empty stays editable. */
  filled: Filled[]
}

function emptyRow(direction: SccaDirection): FormRow {
  return {
    direction,
    application_id: null,
    application_code: null,
    system_name: '',
    criticality_category: undefined,
    rto: '',
    rpo: '',
    dr_capacity: '',
    processing_mode: '',
    dependency: undefined,
    workaround: '',
    gaps_note: '',
    source: null,
    filled: [],
  }
}

function toFormRow(row: SccaInterdependency): FormRow {
  const source = row.source ? { ref_no: row.source.ref_no, finalised_at: row.source.finalised_at } : null
  return {
    direction: row.direction,
    application_id: row.application_id ?? null,
    application_code: row.application_code ?? null,
    system_name: row.system_name,
    criticality_category: row.criticality_category ?? undefined,
    rto: row.rto ?? '',
    rpo: row.rpo ?? '',
    dr_capacity: row.dr_capacity ?? '',
    processing_mode: row.processing_mode ?? '',
    dependency: row.dependency ?? undefined,
    workaround: row.workaround ?? '',
    gaps_note: row.gaps_note ?? '',
    source,
    filled: source ? FILLED.filter((field) => !!row[field]) : [],
  }
}

function fromAssessment() {
  return {
    upstream: props.assessment.interdependencies.filter((row) => row.direction === 'upstream').map(toFormRow),
    downstream: props.assessment.interdependencies.filter((row) => row.direction === 'downstream').map(toFormRow),
  }
}

const committedRto = computed(() =>
  props.assessment.recovery_values.find((row) => row.kind === 'current_it')?.rto ?? '',
)

const state = reactive(fromAssessment())

/** What counts as a change (not the autofill bookkeeping). */
function comparable() {
  const strip = (rows: FormRow[]) => rows.map(({ source: _source, filled: _filled, application_code: _code, ...row }) => row)
  return JSON.stringify({ upstream: strip(state.upstream), downstream: strip(state.downstream) })
}

function reset() {
  const next = fromAssessment()
  state.upstream = next.upstream
  state.downstream = next.downstream
  tried.value = false
  snapshot.value = comparable()
  if (dirty) dirty.value = false
}

watch(() => props.assessment, reset)
watch(state, () => {
  if (dirty) dirty.value = comparable() !== snapshot.value
}, { deep: true })
onMounted(reset)

const picker = reactive<{ open: boolean, direction: SccaDirection }>({ open: false, direction: 'upstream' })

function openPicker(direction: SccaDirection) {
  picker.direction = direction
  picker.open = true
}

/** One row per ticked application, filled from its current final SCCA. */
function addApplications(applications: Application[]) {
  const rows = state[picker.direction]
  for (const application of applications) {
    if (rows.some((row) => row.application_id === application.id)) continue
    const row = emptyRow(picker.direction)
    row.application_id = application.id
    row.application_code = application.application_code
    row.system_name = application.application_name
    const values = application.characteristics
    if (values) {
      row.criticality_category = (values.criticality_category ?? undefined) as SccaCategory | undefined
      row.rto = values.rto ?? ''
      row.rpo = values.rpo ?? ''
      row.dr_capacity = values.dr_capacity ?? ''
      row.source = values.final ? { ref_no: values.final.ref_no, finalised_at: values.final.finalised_at } : null
      row.filled = values.final ? FILLED.filter((field) => !!row[field]) : []
    }
    rows.push(row)
  }
}

function remove(direction: SccaDirection, index: number) {
  state[direction].splice(index, 1)
}

function taken(direction: SccaDirection) {
  return state[direction].map((row) => row.application_id).filter((id): id is number => !!id)
}

/** Read-only: the value came from the application's current final SCCA. */
function fixed(row: FormRow, field: Filled) {
  return !!row.source && row.filled.includes(field)
}

/** Under the application's name: which SCCA its values come from. */
function sourceNote(row: FormRow) {
  if (!row.application_id) return null
  if (!row.source) return 'No final SCCA (listed before one was required): enter the values.'
  const when = row.source.finalised_at ? `, final ${formatDate(row.source.finalised_at)}` : ''
  return `Current SCCA ${row.source.ref_no ?? ''}${when}`.trim()
}

/** Keep DR capacity within 0–100. The typed value is set first, so a value clamped back to
 * what was there before (150 over 100) still redraws the field. */
function setCapacity(row: FormRow, value: string | number | null | undefined) {
  row.dr_capacity = String(value ?? '')
  nextTick(() => {
    row.dr_capacity = clampPercent(row.dr_capacity)
  })
}

function missing(row: FormRow) {
  const empty: string[] = row.application_id ? [] : ['application']
  for (const [field, label] of REQUIRED) {
    const value = row[field]
    if (value === undefined || value === null || String(value).trim() === '') empty.push(label)
  }
  return empty
}

function invalid(row: FormRow, field: (typeof REQUIRED)[number][0] | 'application_id') {
  if (!tried.value) return false
  if (field === 'application_id') return !row.application_id
  const value = row[field]
  return value === undefined || value === null || String(value).trim() === ''
}

function payload(rows: FormRow[]) {
  return rows.map((row) => blankToNull({
    direction: row.direction,
    application_id: row.application_id,
    system_name: row.system_name.trim() || null,
    criticality_category: row.criticality_category,
    rto: row.rto,
    rpo: row.rpo,
    dr_capacity: row.dr_capacity,
    processing_mode: row.processing_mode,
    dependency: row.dependency,
    workaround: row.workaround,
    gaps_note: row.gaps_note,
  }) as unknown as SccaInterdependency)
}

function rowGaps(row: FormRow) {
  const text = interdependencyGap(row, committedRto.value, config.value)
  return text ? text.split(/(?<=\.)\s+/).filter(Boolean) : []
}

// The Save button sits in the page's top bar and submits this form by its id
// (`<button form="scca-form-…">`); `saving` drives its spinner.
const saving = useSccaSaving()

async function onSubmit() {
  formError.value = null
  tried.value = true
  const problems = (['upstream', 'downstream'] as const).flatMap((direction) =>
    state[direction].flatMap((row, index) => {
      const empty = missing(row)
      return empty.length ? [`• ${direction === 'upstream' ? 'Upstream' : 'Downstream'} ${index + 1}${row.system_name ? ` (${row.system_name})` : ''}: ${empty.join(', ')}`] : []
    }),
  )
  if (problems.length) {
    formError.value = ['Every field is required except the workaround and the gap notes.', ...problems].join('\n')
    return
  }
  if (saving) saving.value = true
  try {
    const saved = await sccaApi.setInterdependencies(props.assessment.id, [
      ...payload(state.upstream),
      ...payload(state.downstream),
    ])
    emit('saved', saved)
    nextTick(reset)
    toast.add({ title: 'Interdependencies saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    formError.value = apiErrorText(error)
  } finally {
    if (saving) saving.value = false
  }
}

// Choices come from the SCCA's configuration version; the V4.2 lists are the fallback.
const config = useSccaConfigContext()
const categoryItems = computed(() => config.value
  ? sccaListOptions(config.value, 'category')
  : SCCA_CATEGORIES.map((category) => ({ label: sccaCategory[category].label, value: category })))
function choices(name: SccaListName, current: string | null | undefined, fallback: readonly string[]) {
  if (config.value) return sccaListOptions(config.value, name, current)
  return optionsWith(current ?? '', fallback).map((option) => ({ label: option, value: option }))
}
function hourChoices(current: string) {
  return config.value ? sccaListOptions(config.value, 'hours', current) : hourOptions(current)
}
</script>

<template>
  <form
    id="scca-form-interdependencies"
    class="space-y-6"
    novalidate
    @submit.prevent="onSubmit"
  >
    <UAlert
      v-if="formError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the interdependencies"
      :ui="{ description: 'whitespace-pre-line' }"
      :description="formError"
    />

    <div>
      <h2 class="text-lg font-semibold">
        A3 Interdependency
      </h2>
      <div class="mt-2 space-y-2 text-sm text-muted">
        <p>
          Applications that feed this application or depend on its output. Use <span class="font-medium">Add applications</span> to tick several at once.
          Their category, RTO, RPO and DR capacity come from each application's current final SCCA and can't be changed here; an application without a final SCCA needs them entered.
        </p>
        <p>
          Full: no workaround when the other application is down. Partial: a manual workaround exists (describe it). No: the application continues with the last data received.
        </p>
        <p>
          Every field is required except the workaround and the gaps.
        </p>
      </div>
    </div>

    <UCard
      v-for="group in SCCA_DIRECTIONS"
      :key="group.value"
    >
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              {{ group.label }}
            </h2>
            <p class="text-sm text-muted">
              {{ group.description }}
            </p>
          </div>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-list-plus"
            label="Add applications"
            @click="openPicker(group.value)"
          />
        </div>
      </template>

      <p
        v-if="!state[group.value].length"
        class="text-sm text-muted"
      >
        No {{ group.value }} applications yet.
      </p>

      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="w-full min-w-7xl text-sm">
          <thead>
            <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th class="w-12 px-3 py-2">
                No.
              </th>
              <th class="px-3 py-2">
                Application name <span class="text-error">*</span>
              </th>
              <th class="px-3 py-2">
                Category <span class="text-error">*</span>
              </th>
              <th class="px-3 py-2">
                RTO (hours) <span class="text-error">*</span>
              </th>
              <th class="px-3 py-2">
                RPO <span class="text-error">*</span>
              </th>
              <th class="px-3 py-2">
                DR capacity (%) <span class="text-error">*</span>
              </th>
              <th class="px-3 py-2">
                Processing mode <span class="text-error">*</span>
              </th>
              <th class="px-3 py-2">
                Dependency <span class="text-error">*</span>
              </th>
              <th class="px-3 py-2">
                Workaround
              </th>
              <th class="px-3 py-2">
                Gaps
              </th>
              <th class="px-3 py-2">
                <span class="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(row, index) in state[group.value]"
              :key="`${group.value}-${index}`"
            >
              <td class="px-3 py-2 align-top tabular-nums text-muted">
                {{ index + 1 }}
              </td>
              <td class="min-w-64 px-3 py-2 align-top">
                <p class="font-medium">
                  {{ row.system_name }}
                </p>
                <p
                  v-if="row.application_code"
                  class="text-xs text-muted"
                >
                  {{ row.application_code }}
                </p>
                <p
                  v-if="sourceNote(row)"
                  class="mt-1 flex items-center gap-1 text-xs"
                  :class="row.source ? 'text-info' : 'text-warning'"
                >
                  <UIcon
                    :name="row.source ? 'i-lucide-link' : 'i-lucide-pencil-line'"
                    class="size-3.5 shrink-0"
                  />
                  {{ sourceNote(row) }}
                </p>
              </td>
              <td class="px-3 py-2 align-top">
                <StatusBadge
                  v-if="fixed(row, 'criticality_category')"
                  :scale="sccaCategory"
                  :value="row.criticality_category"
                  size="sm"
                />
                <USelect
                  v-else
                  v-model="row.criticality_category"
                  :items="categoryItems"
                  value-key="value"
                  label-key="label"
                  class="min-w-40"
                  placeholder="—"
                  :color="invalid(row, 'criticality_category') ? 'error' : undefined"
                  :highlight="invalid(row, 'criticality_category')"
                  :aria-label="`Category ${index + 1}`"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <span
                  v-if="fixed(row, 'rto')"
                  class="tabular-nums"
                >{{ sccaListLabel(config, 'hours', row.rto) || row.rto }}</span>
                <USelect
                  v-else
                  v-model="row.rto"
                  :items="hourChoices(row.rto)"
                  value-key="value"
                  label-key="label"
                  class="min-w-28"
                  placeholder="—"
                  :color="invalid(row, 'rto') ? 'error' : undefined"
                  :highlight="invalid(row, 'rto')"
                  :aria-label="`RTO (hours) ${index + 1}`"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <span v-if="fixed(row, 'rpo')">{{ sccaListLabel(config, 'rpo', row.rpo) || row.rpo }}</span>
                <USelect
                  v-else
                  v-model="row.rpo"
                  :items="choices('rpo', row.rpo, SCCA_RPO_OPTIONS)"
                  value-key="value"
                  label-key="label"
                  class="min-w-24"
                  placeholder="—"
                  :color="invalid(row, 'rpo') ? 'error' : undefined"
                  :highlight="invalid(row, 'rpo')"
                  :aria-label="`RPO ${index + 1}`"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <span
                  v-if="fixed(row, 'dr_capacity')"
                  class="tabular-nums"
                >{{ row.dr_capacity }}%</span>
                <UInput
                  v-else
                  :model-value="row.dr_capacity"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  class="min-w-24"
                  :color="invalid(row, 'dr_capacity') ? 'error' : undefined"
                  :highlight="invalid(row, 'dr_capacity')"
                  :aria-label="`DR capacity (%) ${index + 1}`"
                  @update:model-value="setCapacity(row, $event)"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <USelect
                  v-model="row.processing_mode"
                  :items="choices('processing_mode', row.processing_mode, ['Online', 'Batch'])"
                  value-key="value"
                  label-key="label"
                  class="min-w-28"
                  placeholder="—"
                  :color="invalid(row, 'processing_mode') ? 'error' : undefined"
                  :highlight="invalid(row, 'processing_mode')"
                  :aria-label="`Processing mode ${index + 1}`"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <USelect
                  v-model="row.dependency"
                  :items="choices('dependency', row.dependency, SCCA_DEPENDENCIES)"
                  value-key="value"
                  label-key="label"
                  class="min-w-28"
                  placeholder="—"
                  :color="invalid(row, 'dependency') ? 'error' : undefined"
                  :highlight="invalid(row, 'dependency')"
                  :aria-label="`Dependency ${index + 1}`"
                />
              </td>
              <td class="min-w-64 px-3 py-2 align-top">
                <UTextarea
                  v-model="row.workaround"
                  :maxlength="TEXT_LIMITS.long"
                  :rows="2"
                  autoresize
                  class="w-full min-w-64"
                  :aria-label="`Workaround ${index + 1}`"
                />
                <FieldCount
                  class="mt-1 block text-right text-xs"
                  :value="row.workaround"
                  :max="TEXT_LIMITS.long"
                />
              </td>
              <td class="min-w-72 px-3 py-2 align-top">
                <ul
                  v-if="rowGaps(row).length"
                  class="mb-2 space-y-1"
                  :aria-label="`Automatic gaps ${index + 1}`"
                >
                  <li
                    v-for="gap in rowGaps(row)"
                    :key="gap"
                    class="flex items-start gap-1.5 text-xs text-warning"
                  >
                    <UIcon
                      name="i-lucide-triangle-alert"
                      class="mt-0.5 size-3.5 shrink-0"
                    />
                    {{ gap }}
                  </li>
                </ul>
                <p
                  v-else
                  class="mb-2 text-xs text-muted"
                >
                  No automatic gap.
                </p>
                <UTextarea
                  v-model="row.gaps_note"
                  :maxlength="TEXT_LIMITS.long"
                  :rows="2"
                  autoresize
                  placeholder="Other gaps (optional)"
                  class="w-full min-w-72"
                  :aria-label="`Gap notes ${index + 1}`"
                />
                <FieldCount
                  class="mt-1 block text-right text-xs"
                  :value="row.gaps_note"
                  :max="TEXT_LIMITS.long"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :aria-label="`Remove ${row.system_name || 'application'}`"
                  @click="remove(group.value, index)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <SccaInterdependencyPicker
      v-model:open="picker.open"
      :direction-label="SCCA_DIRECTIONS.find((item) => item.value === picker.direction)?.label ?? ''"
      :exclude="assessment.application_id ?? null"
      :taken="taken(picker.direction)"
      @add="addApplications"
    />
  </form>
</template>
