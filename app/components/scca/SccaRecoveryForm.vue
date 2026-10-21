<script setup lang="ts">
import type { SccaAssessment, SccaRecoveryStandard, SccaRecoveryValue } from '~/composables/useScca'
import { sccaLevelLabel } from '~/utils/scca'

const props = defineProps<{
  assessment: SccaAssessment
  standards: SccaRecoveryStandard[]
}>()
const emit = defineEmits<{ saved: [assessment: SccaAssessment] }>()

const toast = useToast()
const dirty = useSccaDirty()
const formError = ref<string | null>(null)
const snapshot = ref('')

const EDITED_KINDS = ['current_it', 'business', 'regulatory', 'cimbn_standard', 'final'] as const
const LEFT_KINDS = ['current_it', 'business', 'regulatory', 'cimbn_standard'] as const

type RecoveryDraft = Record<SccaRecoveryField, string>

function emptyRecovery(): RecoveryDraft {
  return {
    availability_sla: '',
    mtd: '',
    rto: '',
    rpo: '',
    ha: '',
    dr_capacity: '',
    instance_type: '',
    dr_type: '',
  }
}

function fromAssessment() {
  const recovery = {
    current_it: emptyRecovery(),
    business: emptyRecovery(),
    regulatory: emptyRecovery(),
    cimbn_standard: emptyRecovery(),
    final: emptyRecovery(),
    customer_facing: props.assessment.customer_facing === true
      ? 'yes'
      : props.assessment.customer_facing === false ? 'no' : '',
  }
  for (const row of props.assessment.recovery_values) {
    if (row.kind === 'current_it' || row.kind === 'business' || row.kind === 'regulatory' || row.kind === 'cimbn_standard' || row.kind === 'final') {
      recovery[row.kind] = {
        availability_sla: row.availability_sla ?? '',
        mtd: row.mtd ?? '',
        rto: row.rto ?? '',
        rpo: row.rpo ?? '',
        ha: row.ha ?? '',
        dr_capacity: row.dr_capacity ?? '',
        instance_type: row.instance_type ?? '',
        dr_type: row.dr_type ?? '',
      }
    }
  }
  return recovery
}

const state = reactive(fromAssessment())

function reset() {
  Object.assign(state, fromAssessment())
  snapshot.value = JSON.stringify(state)
  if (dirty) dirty.value = false
}

watch(() => props.assessment, reset)
watch(state, () => {
  if (dirty) dirty.value = JSON.stringify(state) !== snapshot.value
}, { deep: true })
onMounted(reset)

const category = computed(() =>
  props.assessment.result.final_category ?? props.assessment.result.computed_category,
)

const visibleStandards = computed(() =>
  props.standards.filter((row) => row.category !== 'Other'),
)

const currentStandard = computed(() =>
  props.standards.find((row) => row.category === category.value),
)

const config = useSccaConfigContext()

const recoveryGaps = computed(() => [
  ...recoveryGapMessages(state.current_it, state.business, state.regulatory, config.value),
  ...standardGapMessages(category.value, state.current_it, state.business, currentStandard.value),
])

const scoreSummary = computed(() => {
  const scores = props.assessment.result
  if (!scores || (scores.cia_score == null && scores.poloss_score == null)) return null
  return {
    c: scores.confidentiality_score,
    i: scores.integrity_score,
    a: scores.availability_score,
    cia: scores.cia_score,
    ciaLevel: sccaLevelLabel(scores.cia_level, 'CIA'),
    poloss: scores.poloss_score,
    polossLevel: sccaLevelLabel(scores.poloss_level, 'POLOSS'),
    category: scores.final_category ?? scores.computed_category,
  }
})

const customerFacingItems = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
]

function kindLabel(kind: SccaRecoveryKind) {
  return SCCA_RECOVERY_KINDS.find((item) => item.value === kind)?.label ?? kind
}

function fillFromStandard() {
  if (!currentStandard.value || currentStandard.value.category === 'Other') return
  state.cimbn_standard.rto = standardHourValue(currentStandard.value.rto ?? '')
  const uptime = currentStandard.value.uptime ?? ''
  state.cimbn_standard.availability_sla = standardUptimeFloor(uptime) == null ? '' : clampPercent(uptime)
}

/** Only the fields this block shows; the others are sent as null so stale hidden values are cleared. */
function recoveryPayload(kind: (typeof EDITED_KINDS)[number]) {
  const shown = new Set<string>(SCCA_RECOVERY_SECTIONS[kind].map((field) => field.key))
  const values = Object.fromEntries(
    Object.entries(state[kind]).map(([key, value]) => [key, shown.has(key) ? value : '']),
  )
  return blankToNull({ kind, ...values }) as SccaRecoveryValue
}

// The Save button sits in the page's top bar and submits this form by its id
// (`<button form="scca-form-…">`); `saving` drives its spinner.
const saving = useSccaSaving()

async function onSubmit() {
  formError.value = null
  if (saving) saving.value = true
  try {
    const saved = await sccaApi.update(props.assessment.id, {
      customer_facing: state.customer_facing === 'yes'
        ? true
        : state.customer_facing === 'no' ? false : undefined,
      recovery_values: EDITED_KINDS.map((kind) => recoveryPayload(kind)),
    })
    emit('saved', saved)
    nextTick(reset)
    toast.add({ title: 'Recovery saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    formError.value = apiErrorText(error)
  } finally {
    if (saving) saving.value = false
  }
}
</script>

<template>
  <form
    id="scca-form-recovery"
    class="space-y-6"
    @submit.prevent="onSubmit"
  >
    <UAlert
      v-if="formError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the recovery values"
      :ui="{ description: 'whitespace-pre-line' }"
      :description="formError"
    />

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="min-w-0 space-y-6">
        <div>
          <h2 class="text-lg font-semibold">
            Recovery
          </h2>
          <p class="mt-1 text-sm text-muted">
            IT committed values are checked against the business requirements, regulatory requirements, and the CIMBN recovery architecture standard for this system's category. Other is not part of the rigid check.
          </p>
        </div>

        <UCard v-if="visibleStandards.length">
          <template #header>
            <h3 class="font-semibold">
              Recovery architecture standard (CIMB Niaga)
            </h3>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th class="px-3 py-2">
                    System characteristics
                  </th>
                  <th
                    v-for="row in visibleStandards"
                    :key="row.category"
                    class="px-3 py-2"
                    :class="row.category === category ? 'text-primary' : undefined"
                  >
                    {{ sccaCategory[row.category]?.label ?? row.category }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">
                    Maximum tolerable downtime (MTD)
                  </th>
                  <td
                    v-for="row in visibleStandards"
                    :key="`${row.category}-mtd`"
                    class="px-3 py-2"
                    :class="row.category === category ? 'font-medium text-highlighted' : undefined"
                  >
                    {{ row.mtd || '—' }}
                  </td>
                </tr>
                <tr>
                  <th class="px-3 py-2 text-left font-medium">
                    Recovery time objective (RTO)
                  </th>
                  <td
                    v-for="row in visibleStandards"
                    :key="`${row.category}-rto`"
                    class="px-3 py-2"
                    :class="row.category === category ? 'font-medium text-highlighted' : undefined"
                  >
                    {{ row.rto || '—' }}
                  </td>
                </tr>
                <tr>
                  <th class="px-3 py-2 text-left font-medium">
                    Uptime ratio (per year)
                  </th>
                  <td
                    v-for="row in visibleStandards"
                    :key="`${row.category}-uptime`"
                    class="px-3 py-2"
                    :class="row.category === category ? 'font-medium text-highlighted' : undefined"
                  >
                    {{ row.uptime || '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <UCard
          v-for="kind in LEFT_KINDS"
          :key="kind"
        >
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="font-semibold">
                  {{ kindLabel(kind) }}
                </h3>
                <p
                  v-if="kind === 'regulatory'"
                  class="text-sm text-muted"
                >
                  Leave blank if none.
                </p>
              </div>
              <UButton
                v-if="kind === 'cimbn_standard'"
                color="neutral"
                variant="outline"
                icon="i-lucide-download"
                label="Fill from standard"
                @click="fillFromStandard"
              />
            </div>
          </template>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UFormField
              v-for="field in SCCA_RECOVERY_SECTIONS[kind]"
              :key="field.key"
              :label="field.label"
            >
              <SccaRecoveryField
                v-model="state[kind][field.key]"
                :control="field.control"
                :label="`${kindLabel(kind)} ${field.label}`"
              />
            </UFormField>
            <UFormField
              v-if="kind === 'business'"
              label="Customer facing (Yes / No)"
            >
              <USelect
                v-model="state.customer_facing"
                :items="customerFacingItems"
                value-key="value"
                label-key="label"
                class="w-full"
                placeholder="—"
                aria-label="Business customer facing"
              />
            </UFormField>
          </div>
        </UCard>
      </div>

      <div class="space-y-6 lg:sticky lg:top-6">
        <SccaScoreSummary :summary="scoreSummary" />

        <UCard>
          <template #header>
            <h3 class="font-semibold">
              {{ kindLabel('final') }}
            </h3>
          </template>
          <div class="space-y-4">
            <UFormField
              v-for="field in SCCA_RECOVERY_SECTIONS.final"
              :key="field.key"
              :label="field.label"
            >
              <SccaRecoveryField
                v-model="state.final[field.key]"
                :control="field.control"
                :label="`${kindLabel('final')} ${field.label}`"
              />
            </UFormField>
            <UAlert
              v-if="recoveryGaps.length"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              title="Recovery gap"
              :description="recoveryGaps.join(' ')"
            />
          </div>
        </UCard>
      </div>
    </div>
  </form>
</template>
