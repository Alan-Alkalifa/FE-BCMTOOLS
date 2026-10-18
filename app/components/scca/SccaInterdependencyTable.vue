<script setup lang="ts">
import type { SccaAssessment, SccaInterdependency } from '~/composables/useScca'

const props = defineProps<{ assessment: SccaAssessment }>()
const emit = defineEmits<{ saved: [assessment: SccaAssessment] }>()

const toast = useToast()
const dirty = useSccaDirty()
const formError = ref<string | null>(null)
const snapshot = ref('')

type FormRow = {
  direction: SccaDirection
  system_name: string
  criticality_category: SccaCategory | undefined
  rto: string
  rpo: string
  dr_capacity: string
  processing_mode: string
  dependency: SccaDependency | undefined
  workaround: string
}

function emptyRow(direction: SccaDirection): FormRow {
  return {
    direction,
    system_name: '',
    criticality_category: undefined,
    rto: '',
    rpo: '',
    dr_capacity: '',
    processing_mode: '',
    dependency: undefined,
    workaround: '',
  }
}

function toFormRow(row: SccaInterdependency): FormRow {
  return {
    direction: row.direction,
    system_name: row.system_name,
    criticality_category: row.criticality_category ?? undefined,
    rto: row.rto ?? '',
    rpo: row.rpo ?? '',
    dr_capacity: row.dr_capacity ?? '',
    processing_mode: row.processing_mode ?? '',
    dependency: row.dependency ?? undefined,
    workaround: row.workaround ?? '',
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

function reset() {
  const next = fromAssessment()
  state.upstream = next.upstream
  state.downstream = next.downstream
  snapshot.value = JSON.stringify(state)
  if (dirty) dirty.value = false
}

watch(() => props.assessment, reset)
watch(state, () => {
  if (dirty) dirty.value = JSON.stringify(state) !== snapshot.value
}, { deep: true })
onMounted(reset)

function add(direction: SccaDirection) {
  state[direction].push(emptyRow(direction))
}

function remove(direction: SccaDirection, index: number) {
  state[direction].splice(index, 1)
}

function payload(rows: FormRow[]) {
  return rows
    .filter((row) => row.system_name.trim())
    .map((row) => blankToNull({
      direction: row.direction,
      system_name: row.system_name.trim(),
      criticality_category: row.criticality_category,
      rto: row.rto,
      rpo: row.rpo,
      dr_capacity: row.dr_capacity,
      processing_mode: row.processing_mode,
      dependency: row.dependency,
      workaround: row.workaround,
      gaps: rowGap(row),
    }) as SccaInterdependency)
}

function rowGap(row: FormRow) {
  return interdependencyGap(row, committedRto.value)
}

async function onSubmit() {
  formError.value = null
  try {
    const saved = await sccaApi.setInterdependencies(props.assessment.id, [
      ...payload(state.upstream),
      ...payload(state.downstream),
    ])
    emit('saved', saved)
    nextTick(reset)
    toast.add({ title: 'Interdependencies saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    formError.value = apiErrorMessage(error)
  }
}

const categoryItems = SCCA_CATEGORIES.map((category) => ({
  label: sccaCategory[category].label,
  value: category,
}))
const processingItems = ['Online', 'Batch']
const dependencyItems = [...SCCA_DEPENDENCIES]
const rpoItems = [...SCCA_RPO_OPTIONS]

</script>

<template>
  <form
    class="space-y-6"
    @submit.prevent="onSubmit"
  >
    <UAlert
      v-if="formError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the interdependencies"
      :description="formError"
    />

    <div>
      <h2 class="text-lg font-semibold">
        A3 Interdependency
      </h2>
      <div class="mt-2 space-y-2 text-sm text-muted">
        <p>
          Applications or services that feed this application or depend on its output.
        </p>
        <p>
          Full: no workaround when the other system is down. Partial: a manual workaround exists (describe it). No: the application continues with the last data received.
        </p>
        <p>
          Take category, RTO, RPO and DR from the current EA architecture document and Application Portfolio.
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
            icon="i-lucide-plus"
            label="Add system"
            @click="add(group.value)"
          />
        </div>
      </template>

      <p
        v-if="!state[group.value].length"
        class="text-sm text-muted"
      >
        No {{ group.value }} systems yet.
      </p>

      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="w-full min-w-6xl text-sm">
          <thead>
            <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th class="w-12 px-3 py-2">
                No.
              </th>
              <th class="px-3 py-2">
                System name
              </th>
              <th class="px-3 py-2">
                SCC
              </th>
              <th class="px-3 py-2">
                RTO
              </th>
              <th class="px-3 py-2">
                RPO
              </th>
              <th class="px-3 py-2">
                DR capacity
              </th>
              <th class="px-3 py-2">
                Mode
              </th>
              <th class="px-3 py-2">
                Dependency
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
              <td class="px-3 py-2 align-top">
                <UInput
                  v-model="row.system_name"
                  class="min-w-40"
                  :aria-label="`System name ${index + 1}`"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <USelect
                  v-model="row.criticality_category"
                  :items="categoryItems"
                  class="min-w-40"
                  placeholder="—"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <USelect
                  v-model="row.rto"
                  :items="hourOptions(row.rto)"
                  value-key="value"
                  label-key="label"
                  class="min-w-32"
                  placeholder="—"
                  :aria-label="`RTO ${index + 1}`"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <USelect
                  v-model="row.rpo"
                  :items="optionsWith(row.rpo, rpoItems)"
                  class="min-w-24"
                  placeholder="—"
                  :aria-label="`RPO ${index + 1}`"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <UInput
                  :model-value="row.dr_capacity"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  class="min-w-24"
                  :aria-label="`DR capacity ${index + 1}`"
                  @update:model-value="row.dr_capacity = clampPercent($event)"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <USelect
                  v-model="row.processing_mode"
                  :items="processingItems"
                  class="min-w-28"
                  placeholder="—"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <USelect
                  v-model="row.dependency"
                  :items="dependencyItems"
                  class="min-w-28"
                  placeholder="—"
                />
              </td>
              <td class="min-w-72 px-3 py-2 align-top">
                <UInput
                  v-model="row.workaround"
                  class="w-full min-w-72"
                  :aria-label="`Workaround ${index + 1}`"
                />
              </td>
              <td class="min-w-72 px-3 py-2 align-top">
                <p
                  class="min-w-72 text-sm"
                  :class="rowGap(row) ? 'text-warning' : 'text-muted'"
                  :aria-label="`Gaps ${index + 1}`"
                >
                  {{ rowGap(row) || 'No gap' }}
                </p>
              </td>
              <td class="px-3 py-2 align-top">
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :aria-label="`Remove ${row.system_name || 'system'}`"
                  @click="remove(group.value, index)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <div class="flex justify-end">
      <UButton
        type="submit"
        label="Save interdependencies"
        loading-auto
      />
    </div>
  </form>
</template>
