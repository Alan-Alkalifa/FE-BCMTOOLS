<script setup lang="ts">
import { z } from 'zod'
import type { SccaAssessment, SccaFormula, SccaRecoveryStandard, SccaSignoff } from '~/composables/useScca'

const props = defineProps<{
  assessment: SccaAssessment
  formula: SccaFormula
  standards?: SccaRecoveryStandard[]
}>()
const emit = defineEmits<{ saved: [assessment: SccaAssessment] }>()

const toast = useToast()
const form = useTemplateRef('form')
const dirty = useSccaDirty()
const formError = ref<string | null>(null)
const snapshot = ref('')

const schema = z.object({
  override_type: z.enum(['none', 'upgrade', 'downgrade']),
  override_category: z.string().nullable().optional(),
  justification: z.string().optional(),
  cim_ref_no: z.string().optional(),
}).superRefine((value, context) => {
  if (value.override_type === 'none') return
  if (!value.override_category) {
    context.addIssue({
      code: 'custom',
      path: ['override_category'],
      message: `Required for a ${value.override_type}.`,
    })
  }
  if (!value.justification?.trim()) {
    context.addIssue({
      code: 'custom',
      path: ['justification'],
      message: `Required for a ${value.override_type}.`,
    })
  }
  if (!value.cim_ref_no?.trim()) {
    context.addIssue({
      code: 'custom',
      path: ['cim_ref_no'],
      message: 'Required for an upgrade or downgrade.',
    })
  }
})

function signoffsFrom(assessment: SccaAssessment) {
  return SCCA_SIGNOFF_ROLES.map((role) => {
    const saved = assessment.signoffs.find((row) => row.role === role.value)
    return {
      role: role.value,
      name: saved?.name ?? '',
      designation: saved?.designation ?? '',
      sub_dir: saved?.sub_dir ?? '',
    }
  })
}

function fromAssessment() {
  return {
    override_type: (props.assessment.override_type ?? 'none') as 'none' | SccaOverrideType,
    override_category: props.assessment.override_category ?? undefined,
    justification: props.assessment.justification ?? '',
    cim_ref_no: props.assessment.cim_ref_no ?? '',
    signoffs: signoffsFrom(props.assessment),
  }
}

const state = reactive(fromAssessment())

const computedCategory = computed(() => props.assessment.result.computed_category)

const previousGaps = computed(() => previousTabGapMessages({
  missingAnswers: props.assessment.missing_answers,
  recoveryValues: props.assessment.recovery_values,
  category: props.assessment.result.final_category ?? props.assessment.result.computed_category,
  standards: props.standards ?? [],
  interdependencies: props.assessment.interdependencies,
}))

const overrideCategories = computed(() => {
  const computed = computedCategory.value
  if (state.override_type === 'none' || !computed) return [...SCCA_CATEGORIES]
  const rank = categoryRank(computed)
  return SCCA_CATEGORIES.filter((category) => {
    const change = categoryRank(category) - rank
    return state.override_type === 'upgrade' ? change > 0 : change < 0
  })
})

const showRemarks = computed(() =>
  state.override_type !== 'none' || previousGaps.value.length > 0 || Boolean(state.justification.trim()),
)

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

watch(() => state.override_type, (type) => {
  if (type === 'none') state.override_category = undefined
  else if (state.override_category && !overrideCategories.value.includes(state.override_category)) {
    state.override_category = undefined
  }
})

function percent(value: number | null | undefined) {
  return formatPercent(value, 0) ?? '—'
}

async function onSubmit() {
  formError.value = null
  try {
    const saved = await sccaApi.update(props.assessment.id, {
      override_type: state.override_type === 'none' ? null : state.override_type,
      override_category: state.override_type === 'none' ? null : state.override_category ?? null,
      justification: state.justification.trim() || null,
      cim_ref_no: state.cim_ref_no.trim() || null,
      signoffs: state.signoffs.map((row) => blankToNull({
        role: row.role,
        name: row.name,
        designation: row.designation,
        sub_dir: row.sub_dir,
      }) as SccaSignoff),
    })
    emit('saved', saved)
    nextTick(reset)
    toast.add({ title: 'Result saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    form.value?.setErrors(apiFieldErrors(error))
    formError.value = apiErrorMessage(error)
  }
}
</script>

<template>
  <UForm
    ref="form"
    :schema="schema"
    :state="state"
    class="space-y-6"
    @submit="onSubmit"
  >
    <UAlert
      v-if="formError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the result"
      :description="formError"
    />

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div class="min-w-0 space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              Scores
            </h2>
          </template>
          <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div>
              <dt class="text-muted">
                Confidentiality
              </dt>
              <dd class="mt-1 text-lg font-semibold tabular-nums">
                {{ percent(assessment.result.confidentiality_score) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                Integrity
              </dt>
              <dd class="mt-1 text-lg font-semibold tabular-nums">
                {{ percent(assessment.result.integrity_score) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                Availability
              </dt>
              <dd class="mt-1 text-lg font-semibold tabular-nums">
                {{ percent(assessment.result.availability_score) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                CIA
              </dt>
              <dd class="mt-1 text-lg font-semibold tabular-nums">
                {{ percent(assessment.result.cia_score) }}
                <span
                  v-if="assessment.result.cia_level"
                  class="text-sm font-normal text-muted"
                > · {{ sccaLevelLabel(assessment.result.cia_level, 'CIA') }}</span>
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                Potential loss
              </dt>
              <dd class="mt-1 text-lg font-semibold tabular-nums">
                {{ percent(assessment.result.poloss_score) }}
                <span
                  v-if="assessment.result.poloss_level"
                  class="text-sm font-normal text-muted"
                > · {{ sccaLevelLabel(assessment.result.poloss_level, 'POLOSS') }}</span>
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                Computed category
              </dt>
              <dd class="mt-1">
                <StatusBadge
                  :scale="sccaCategory"
                  :value="assessment.result.computed_category"
                />
              </dd>
            </div>
          </dl>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              Criticality matrix
            </h2>
          </template>
          <SccaMatrix
            :cells="formula.matrix"
            :cia-level="assessment.result.cia_level"
            :poloss-level="assessment.result.poloss_level"
          />
        </UCard>

        <UAlert
          v-if="previousGaps.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Gaps from earlier tabs"
        >
          <template #description>
            <ul class="mt-1 list-disc space-y-1 pl-4">
              <li
                v-for="(gap, index) in previousGaps"
                :key="index"
              >
                {{ gap }}
              </li>
            </ul>
          </template>
        </UAlert>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              Override
            </h2>
          </template>
          <div class="space-y-4">
            <UFormField
              label="Change the computed category"
              name="override_type"
            >
              <URadioGroup
                v-model="state.override_type"
                :items="[
                  { label: 'None', value: 'none' },
                  { label: 'Upgrade', value: 'upgrade' },
                  { label: 'Downgrade', value: 'downgrade' },
                ]"
                orientation="horizontal"
              />
            </UFormField>
            <UAlert
              v-if="state.override_type !== 'none' && computedCategory && !overrideCategories.length"
              color="info"
              variant="subtle"
              icon="i-lucide-info"
              :title="state.override_type === 'upgrade' ? 'Already the highest category' : 'Already the lowest category'"
              :description="`Computed as ${computedCategory}.`"
            />
            <UFormField
              v-if="state.override_type !== 'none'"
              label="New category"
              name="override_category"
              required
            >
              <USelect
                v-model="state.override_category"
                :items="overrideCategories.map((category) => ({ label: sccaCategory[category].label, value: category }))"
                class="w-full"
                placeholder="Select a category"
              />
            </UFormField>
            <UFormField
              v-if="state.override_type !== 'none'"
              label="CIM / MKK / RA ref. no."
              name="cim_ref_no"
              required
              help="Required for an upgrade or downgrade."
            >
              <UInput
                v-model="state.cim_ref_no"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="showRemarks"
              label="Justification / Process Workaround / Remarks"
              name="justification"
              :required="state.override_type !== 'none'"
              :help="state.override_type !== 'none'
                ? 'Use this for the process workaround or other remarks. Required when you change the category.'
                : 'Explain the gaps above and any process workaround.'"
            >
              <UTextarea
                v-model="state.justification"
                name="justification"
                class="w-full"
                :rows="4"
              />
            </UFormField>
            <UAlert
              v-if="state.override_type !== 'none' && state.override_category && computedCategory && state.override_category !== computedCategory"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              title="Final category will differ from the computed one"
              :description="`Computed as ${computedCategory}; recorded as ${state.override_category}.`"
            />
          </div>
        </UCard>
      </div>

      <UCard class="lg:sticky lg:top-6">
        <template #header>
          <h2 class="text-lg font-semibold">
            Sign-off
          </h2>
        </template>
        <div class="space-y-5">
          <div
            v-for="(row, index) in state.signoffs"
            :key="row.role"
            class="space-y-3"
          >
            <h3 class="text-sm font-medium">
              {{ SCCA_SIGNOFF_ROLES[index]!.label }}
            </h3>
            <UFormField label="Name">
              <UInput
                v-model="row.name"
                class="w-full"
                :aria-label="`${SCCA_SIGNOFF_ROLES[index]!.label} name`"
              />
            </UFormField>
            <UFormField label="Designation">
              <UInput
                v-model="row.designation"
                class="w-full"
                :aria-label="`${SCCA_SIGNOFF_ROLES[index]!.label} designation`"
              />
            </UFormField>
            <UFormField label="Sub-directorate">
              <UInput
                v-model="row.sub_dir"
                class="w-full"
                :aria-label="`${SCCA_SIGNOFF_ROLES[index]!.label} sub-directorate`"
              />
            </UFormField>
          </div>
        </div>
      </UCard>
    </div>

    <div class="flex flex-wrap justify-end gap-2">
      <UTooltip text="Approval will be added in a later release.">
        <span class="inline-flex">
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            icon="i-lucide-send"
            label="Submit for approval"
            disabled
          />
        </span>
      </UTooltip>
      <UButton
        type="submit"
        label="Save result"
        loading-auto
      />
    </div>
  </UForm>
</template>
