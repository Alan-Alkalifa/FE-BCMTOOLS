<script setup lang="ts">
import type { SccaAssessment, SccaRecoveryStandard, SccaRecoveryValue } from '~/composables/useScca'
import { sccaLevelLabel } from '~/utils/scca'
import type { DrAnswers } from './SccaDrDecision.vue'

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

function triText(value: boolean | null | undefined): 'yes' | 'no' | '' {
  return value === true ? 'yes' : value === false ? 'no' : ''
}

function drFromAssessment(): DrAnswers {
  const row = props.assessment
  return {
    alt: triText(row.dr_alt_process),
    altNote: row.dr_alt_process_note ?? '',
    accepts: triText(row.dr_business_accepts),
    acceptNote: row.dr_accept_note ?? '',
    acceptedBy: row.dr_accepted_by ?? '',
  }
}

const state = reactive(fromAssessment())
const drAnswers = ref<DrAnswers>(drFromAssessment())

function comparableState() {
  return JSON.stringify({ state, dr: drAnswers.value })
}

function reset() {
  Object.assign(state, fromAssessment())
  drAnswers.value = drFromAssessment()
  applyStandard()
  snapshot.value = comparableState()
  if (dirty) dirty.value = false
}

watch(() => props.assessment, reset)
watch([state, drAnswers], () => {
  if (dirty) dirty.value = comparableState() !== snapshot.value
}, { deep: true })
onMounted(reset)

const category = computed(() =>
  props.assessment.result.final_category ?? props.assessment.result.computed_category,
)

/** The CIMB Niaga standard table shows the SCCA's current category only. */
const visibleStandards = computed(() => props.standards.filter((row) => row.category === category.value))

const standardRows = computed(() => {
  const row = visibleStandards.value[0]
  if (!row) return []
  return [
    { label: 'Maximum tolerable downtime (MTD, hours)', value: row.mtd || '—' },
    { label: 'Recovery time objective (RTO, hours)', value: row.rto || '—' },
    { label: 'Availability/SLA (per year)', value: row.uptime || '—' },
    { label: 'RPO', value: sccaListLabel(config.value, 'rpo', row.rpo) || '—' },
    { label: 'HA (Prod / DR)', value: sccaListLabel(config.value, 'ha', row.ha) || '—' },
    { label: 'DR capacity (%)', value: row.dr_capacity == null ? '—' : `${row.dr_capacity}%` },
    { label: 'DR type', value: sccaListLabel(config.value, 'dr_type', row.dr_type) || '—' },
  ]
})

const currentStandard = computed(() =>
  props.standards.find((row) => row.category === category.value),
)

const config = useSccaConfigContext()

const drDecision = computed(() => {
  const dr = config.value?.dr
  if (!dr || props.assessment.status !== 'draft') return props.assessment.dr_decision
  const flag = (value: 'yes' | 'no' | '') => (value === 'yes' ? true : value === 'no' ? false : null)
  return decideDr(dr, props.standards, category.value, flag(drAnswers.value.alt), flag(drAnswers.value.accepts))
})

const recoveryGaps = computed(() => [
  ...recoveryGapMessages(state.current_it, state.business, state.regulatory, config.value),
  ...standardGapMessages(category.value, state.current_it, state.business, currentStandard.value),
  ...(config.value?.dr ? drGapMessages(config.value.dr, drDecision.value, state.final.rto, state.final.dr_type) : []),
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
      ...(config.value?.dr && props.assessment.status === 'draft'
        ? {
            dr_alt_process: drAnswers.value.alt === '' ? null : drAnswers.value.alt === 'yes',
            dr_alt_process_note: drAnswers.value.altNote.trim() || null,
            dr_business_accepts: drAnswers.value.accepts === '' ? null : drAnswers.value.accepts === 'yes',
            dr_accept_note: drAnswers.value.acceptNote.trim() || null,
            dr_accepted_by: drAnswers.value.acceptedBy.trim() || null,
          }
        : {}),
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

        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-semibold">
                Recovery architecture standard (CIMB Niaga)
              </h3>
              <StatusBadge
                v-if="category"
                :scale="sccaCategory"
                :value="(category as SccaCategory)"
                size="sm"
              />
            </div>
          </template>
          <p
            v-if="!category"
            class="text-sm text-muted"
          >
            Complete the Rating tab to see the standard for this application's category.
          </p>
          <p
            v-else-if="!visibleStandards.length"
            class="text-sm text-muted"
          >
            Not set in SCCA configuration > Formula.
          </p>
          <div
            v-else
            class="overflow-x-auto"
          >
            <table class="w-full text-sm">
              <tbody class="divide-y divide-default">
                <tr
                  v-for="item in standardRows"
                  :key="item.label"
                >
                  <th class="w-1/2 px-3 py-2 text-left font-medium">
                    {{ item.label }}
                  </th>
                  <td class="px-3 py-2 font-medium tabular-nums text-highlighted">
                    {{ item.value }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <SccaDrDecision
          v-model="drAnswers"
          :assessment="assessment"
          :standards="standards"
          :category="category"
          :editable="true"
        />

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
