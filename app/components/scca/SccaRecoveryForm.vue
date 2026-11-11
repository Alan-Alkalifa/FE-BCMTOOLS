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
/** Edited by the assessor; the CIMBN block (on the side) follows the configured standard. */
const LEFT_KINDS = ['current_it', 'business', 'regulatory', 'final'] as const

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

function comparableState() {
  return JSON.stringify(state)
}

function reset() {
  Object.assign(state, fromAssessment())
  applyStandard()
  snapshot.value = comparableState()
  if (dirty) dirty.value = false
}

watch(() => props.assessment, reset)
watch(state, () => {
  if (dirty) dirty.value = comparableState() !== snapshot.value
}, { deep: true })
onMounted(reset)

const category = computed(() =>
  props.assessment.result.final_category ?? props.assessment.result.computed_category,
)

/** Every category of the version's standard, Other included. */
const visibleStandards = computed(() => props.standards)

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

function numberText(value: number | null | undefined) {
  return value == null ? null : String(value)
}

/** The CIMBN block is the standard of the final category (as the API sets it), read-only; a
 *  value the configuration leaves empty is null. No category yet: every value is null. */
const standardValues = computed<Partial<Record<SccaRecoveryField, string | null>>>(() => {
  const standard = currentStandard.value
  return {
    availability_sla: numberText(standard?.uptime_min_pct),
    rto: numberText(standard?.rto_to_h),
    rpo: standard?.rpo ?? null,
    ha: standard?.ha ?? null,
    dr_capacity: numberText(standard?.dr_capacity),
    dr_type: standard?.dr_type ?? null,
  }
})

/** Set by the configured standard (the CIMBN block is read-only either way). */
function fromStandard(field: SccaRecoveryField) {
  return standardValues.value[field] != null
}

/** A draft follows the standard (as the API does when it saves); a submitted or final SCCA
 *  shows what it stored. */
function applyStandard() {
  if (props.assessment.status !== 'draft' || !props.standards.length) return
  for (const [field, value] of Object.entries(standardValues.value)) {
    state.cimbn_standard[field as SccaRecoveryField] = value ?? ''
  }
}
// The standard arriving (or the category changing) is not an edit of the assessor's: an
// unchanged form stays unchanged.
watch(standardValues, () => {
  const clean = comparableState() === snapshot.value
  applyStandard()
  if (clean) {
    snapshot.value = comparableState()
    if (dirty) dirty.value = false
  }
}, { immediate: true })

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
            IT committed values are checked against the business requirements, regulatory requirements, and the CIMBN recovery architecture standard for this application's category. Other is not part of the rigid check. The CIMBN block is filled from the standard (SCCA configuration > Formula). Every field is required except Regulatory requirements.
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
                    Maximum tolerable downtime (MTD, hours)
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
                    Recovery time objective (RTO, hours)
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
                    Availability/SLA (per year)
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
                <tr>
                  <th class="px-3 py-2 text-left font-medium">
                    RPO
                  </th>
                  <td
                    v-for="row in visibleStandards"
                    :key="`${row.category}-rpo`"
                    class="px-3 py-2"
                    :class="row.category === category ? 'font-medium text-highlighted' : undefined"
                  >
                    {{ sccaListLabel(config, 'rpo', row.rpo) || '—' }}
                  </td>
                </tr>
                <tr>
                  <th class="px-3 py-2 text-left font-medium">
                    HA (Prod / DR)
                  </th>
                  <td
                    v-for="row in visibleStandards"
                    :key="`${row.category}-ha`"
                    class="px-3 py-2"
                    :class="row.category === category ? 'font-medium text-highlighted' : undefined"
                  >
                    {{ sccaListLabel(config, 'ha', row.ha) || '—' }}
                  </td>
                </tr>
                <tr>
                  <th class="px-3 py-2 text-left font-medium">
                    DR capacity (%)
                  </th>
                  <td
                    v-for="row in visibleStandards"
                    :key="`${row.category}-dr-capacity`"
                    class="px-3 py-2 tabular-nums"
                    :class="row.category === category ? 'font-medium text-highlighted' : undefined"
                  >
                    {{ row.dr_capacity == null ? '—' : `${row.dr_capacity}%` }}
                  </td>
                </tr>
                <tr>
                  <th class="px-3 py-2 text-left font-medium">
                    DR type
                  </th>
                  <td
                    v-for="row in visibleStandards"
                    :key="`${row.category}-dr-type`"
                    class="px-3 py-2"
                    :class="row.category === category ? 'font-medium text-highlighted' : undefined"
                  >
                    {{ sccaListLabel(config, 'dr_type', row.dr_type) || '—' }}
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
            </div>
          </template>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UFormField
              v-for="field in SCCA_RECOVERY_SECTIONS[kind]"
              :key="field.key"
              :label="field.label"
              :required="kind !== 'regulatory'"
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
              required
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
              {{ kindLabel('cimbn_standard') }}
            </h3>
            <p class="mt-1 text-sm text-muted">
              <template v-if="category">
                From the recovery architecture standard (CIMB Niaga) for {{ sccaCategory[category]?.label ?? category }}. Read-only.
              </template>
              <template v-else>
                Filled from the recovery architecture standard (CIMB Niaga) once the category is known. Read-only.
              </template>
            </p>
          </template>
          <div class="space-y-4">
            <UFormField
              v-for="field in SCCA_RECOVERY_SECTIONS.cimbn_standard"
              :key="field.key"
              :label="field.label"
              :help="fromStandard(field.key) || !category ? undefined : 'Not set in SCCA configuration > Formula'"
            >
              <SccaRecoveryField
                v-model="state.cimbn_standard[field.key]"
                :control="field.control"
                :label="`${kindLabel('cimbn_standard')} ${field.label}`"
                disabled
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
