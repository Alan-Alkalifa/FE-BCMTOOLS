<script setup lang="ts">
import { z } from 'zod'
import type { PickedUser } from '~/components/UserPicker.vue'
import type { SccaAssessment, SccaFormula, SccaRecoveryStandard } from '~/composables/useScca'
import type { SccaConfigStep } from '~/utils/scca-config'

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

interface SignoffState {
  role: SccaSignoffRole
  user_id: number | null
  /** The picked user, for the label, designation and sub-directorate shown under the picker. */
  person: PickedUser | null
}

// The steps, their order, whether each is required and who picks the signer come from the
// SCCA's configuration version (V4.2: 9 required steps, all chosen by the assessor).
const config = useSccaConfigContext()
const steps = computed<SccaConfigStep[]>(() => config.value?.steps ?? SCCA_SIGNOFF_ROLES.map((role) => ({
  code: role.value,
  title: role.label,
  short: role.short,
  mandatory: true,
  signer_mode: 'chosen' as const,
  signer_roles: [],
  excel_box: null,
  comments_all_tabs: role.value === 'bcm_reviewer',
})))
function stepOf(role: string) {
  return steps.value.find((step) => step.code === role)
}

function signoffsFrom(assessment: SccaAssessment): SignoffState[] {
  return steps.value.map((step) => {
    const role = { value: step.code }
    const saved = assessment.signoffs.find((row) => row.role === role.value)
    const person = saved?.user_id
      ? {
          id: saved.user_id,
          display_name: saved.name,
          email: saved.email,
          job_title: saved.designation,
          department: saved.sub_dir,
        }
      : null
    return { role: role.value, user_id: saved?.user_id ?? null, person }
  })
}

function roleName(code: string) {
  return code.replaceAll('_', ' ').replace(/^bcm/, 'BCM')
}

function savedSignoff(role: SccaSignoffRole) {
  return props.assessment.signoffs.find((row) => row.role === role)
}

function pick(row: SignoffState, user: PickedUser | null) {
  row.person = user
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

/** Gaps from the earlier tabs: when there are any, the justification field shows. */
const previousGaps = computed(() => previousTabGapMessages({
  missingAnswers: props.assessment.missing_answers,
  recoveryValues: props.assessment.recovery_values,
  category: props.assessment.result.final_category ?? props.assessment.result.computed_category,
  standards: props.standards ?? [],
  config: config.value,
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

// The Save button sits in the page's top bar and submits this form by its id
// (`<button form="scca-form-…">`); `saving` drives its spinner.
const saving = useSccaSaving()

async function onSubmit() {
  formError.value = null
  if (saving) saving.value = true
  try {
    const saved = await sccaApi.update(props.assessment.id, {
      override_type: state.override_type === 'none' ? null : state.override_type,
      override_category: state.override_type === 'none' ? null : state.override_category ?? null,
      justification: state.justification.trim() || null,
      cim_ref_no: state.cim_ref_no.trim() || null,
      // Fixed steps are set by BCM; they are not sent.
      signoffs: state.signoffs
        .filter((row) => stepOf(row.role)?.signer_mode !== 'fixed')
        .map((row) => ({ role: row.role, user_id: row.user_id })),
    })
    emit('saved', saved)
    nextTick(reset)
    toast.add({ title: 'Result saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    form.value?.setErrors(apiFieldErrors(error))
    formError.value = apiErrorText(error)
  } finally {
    if (saving) saving.value = false
  }
}
</script>

<template>
  <UForm
    id="scca-form-result"
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
      :ui="{ description: 'whitespace-pre-line' }"
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

        <!-- The gaps from the earlier tabs are listed in the gap check above (SccaGapSummary). -->

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
              <template #hint>
                <FieldCount
                  :value="state.cim_ref_no"
                  :max="TEXT_LIMITS.medium"
                />
              </template>
              <UInput
                v-model="state.cim_ref_no"
                :maxlength="TEXT_LIMITS.medium"
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
              <template #hint>
                <FieldCount
                  :value="state.justification"
                  :max="TEXT_LIMITS.long"
                />
              </template>
              <UTextarea
                v-model="state.justification"
                :maxlength="TEXT_LIMITS.long"
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
          <p class="mt-1 text-sm text-muted">
            Pick a user for each step. They approve in this order; designation and sub-directorate come from their profile.
            <template v-if="steps.some((step) => !step.mandatory)">
              An optional step without a user is skipped.
            </template>
          </p>
        </template>
        <ol class="space-y-4">
          <li
            v-for="(row, index) in state.signoffs"
            :key="row.role"
            class="space-y-1.5"
          >
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-sm font-medium">
                {{ index + 1 }}. {{ stepOf(row.role)?.title ?? signoffRoleLabel(row.role) }}
                <UBadge
                  v-if="stepOf(row.role) && !stepOf(row.role)!.mandatory"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  label="Optional"
                  class="ms-1 align-middle"
                />
              </h3>
              <StatusBadge
                v-if="savedSignoff(row.role)?.status"
                :scale="sccaSignoffStatus"
                :value="savedSignoff(row.role)!.status"
                size="sm"
              />
              <UBadge
                v-else-if="savedSignoff(row.role)?.skipped"
                color="neutral"
                variant="outline"
                size="sm"
                label="Not required"
              />
            </div>
            <template v-if="stepOf(row.role)?.signer_mode === 'fixed'">
              <p class="flex items-center gap-1.5 text-sm">
                <UIcon
                  name="i-lucide-lock"
                  class="size-4 text-muted"
                />
                <span class="font-medium">{{ row.person?.display_name ?? stepOf(row.role)?.signer?.display_name ?? 'Not set yet' }}</span>
              </p>
              <p class="text-xs text-muted">
                Fixed signer, set by BCM in the SCCA configuration. It is applied at Submit.
              </p>
            </template>
            <UFormField
              v-else
              :name="`signoffs.${index}.user_id`"
              :help="stepOf(row.role)?.signer_mode === 'default' ? 'Filled in from the SCCA configuration; you can change it.' : undefined"
            >
              <UserPicker
                v-model="row.user_id"
                :selected="row.person"
                :disabled="!assessment.permissions.can_edit"
                :aria-label="`${stepOf(row.role)?.title ?? signoffRoleLabel(row.role)} user`"
                :placeholder="stepOf(row.role)?.mandatory === false ? 'Optional: leave empty to skip' : undefined"
                permission="scca.access"
                @pick="(user) => pick(row, user)"
              />
            </UFormField>
            <p
              v-if="stepOf(row.role)?.signer_roles.length && stepOf(row.role)?.signer_mode !== 'fixed'"
              class="text-xs text-muted"
            >
              Only a user with the role {{ stepOf(row.role)!.signer_roles.map(roleName).join(' or ') }}.
            </p>
            <p
              v-if="row.person"
              class="text-xs text-muted"
            >
              {{ row.person.job_title || 'No designation' }} · {{ row.person.department || 'No sub-directorate' }}
            </p>
            <p
              v-if="savedSignoff(row.role)?.decided_at"
              class="text-xs text-muted"
            >
              {{ savedSignoff(row.role)!.status === 'rejected' ? 'Rejected' : 'Approved' }}
              {{ formatDateTime(savedSignoff(row.role)!.decided_at) }}<span v-if="savedSignoff(row.role)!.on_behalf_by"> on behalf, by {{ savedSignoff(row.role)!.on_behalf_by }}</span><span v-if="savedSignoff(row.role)!.decision_note">: “{{ savedSignoff(row.role)!.decision_note }}”</span>
            </p>
            <a
              v-if="savedSignoff(row.role)?.attachment"
              :href="savedSignoff(row.role)!.attachment!.url"
              class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              download
            >
              <UIcon
                name="i-lucide-paperclip"
                class="size-3.5"
              />
              Evidence: {{ savedSignoff(row.role)!.attachment!.filename }}
            </a>
          </li>
        </ol>
      </UCard>
    </div>
  </UForm>
</template>
