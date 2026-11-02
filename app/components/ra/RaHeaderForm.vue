<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { RaAssessment, RaAssessmentSummary, RaUserRef } from '~/composables/useRa'

const props = defineProps<{ assessment: RaAssessment }>()
const emit = defineEmits<{ saved: [assessment: RaAssessment] }>()

const ra = useRaModule()
/** In sign-off or approved: shown, not edited. */
const locked = computed(() => !props.assessment.can_edit)
/** The location's pin, shown for reference; it is edited on the location's Map tab. */
const locationPin = computed(() => raPin(props.assessment.location))
const toast = useToast()
const form = useTemplateRef('form')
const dirty = useRaDirty()
const formError = ref<string | null>(null)
const snapshot = ref('')

const schema = z.object({
  period_year: z.number('Enter the RA period.').int().min(2000).max(2100),
  assessment_date: z.string().min(1, 'Enter the assessment date.'),
  due_date: z.string().nullable(),
  reason: z.string('Choose the reason for this assessment.').nullable(),
  // The LIC is the assessor (who made the RA): shown, never picked or sent.
  lic_user_id: z.number().nullable(),
  lic_phone: z.string().trim().min(1, 'Enter the LIC mobile number.'),
  licom_user_id: z.number('Choose the LICOM.'),
  licom_phone: z.string().trim().min(1, 'Enter the LICOM mobile number.'),
}).superRefine((value, context) => {
  // Like SCCA's System change: a structural change picks its renewal date, at most a year on.
  if (value.reason !== RA_CUSTOM_DUE_REASON || !value.assessment_date) return
  if (!value.due_date) {
    context.addIssue({ code: 'custom', path: ['due_date'], message: 'Enter the renewal due date. It can be sooner than one year.' })
  } else if (value.due_date < value.assessment_date) {
    context.addIssue({ code: 'custom', path: ['due_date'], message: 'Cannot be before the assessment date.' })
  } else if (value.due_date > parseDate(value.assessment_date).add({ years: 1 }).toString()) {
    context.addIssue({ code: 'custom', path: ['due_date'], message: 'Cannot be later than one year after the assessment date.' })
  }
})
type State = Omit<z.infer<typeof schema>, 'lic_user_id' | 'licom_user_id'> & {
  lic_user_id: number | null
  licom_user_id: number | null
}
type Member = 'lic' | 'licom'
const MEMBERS: Member[] = ['lic', 'licom']
/** The building's other RAs: as on New assessment (SCCA's conditions), New building fits only
 *  its first RA and Annual review only a building with another final RA. The building can't
 *  change here, so a reason it doesn't fit is offered disabled, saying why. */
const others = ref<RaAssessmentSummary[] | null>(null)
watch(() => props.assessment.location.id, async (id) => {
  try {
    const location = await raApi.getLocation(id)
    others.value = location.assessments.filter((row) => row.id !== props.assessment.id)
  } catch {
    others.value = null
  }
}, { immediate: true })
const reasonItems = computed(() => RA_REASONS.map((reason) => {
  const list = others.value
  let why: string | undefined
  if (list && reason.value === 'new_building' && list.length) why = 'This building already has another RA.'
  if (list && reason.value === 'annual_review' && !list.some((row) => row.status === 'approved')) why = 'There is no final RA to renew.'
  return { label: reason.label, value: reason.value, disabled: Boolean(why) && state.reason !== reason.value, description: why }
}))
const reasonModel = computed<RaReason | undefined>({
  get: () => (state.reason as RaReason | null) ?? undefined,
  set: (value) => {
    state.reason = value ?? null
  },
})

function fromAssessment(assessment: RaAssessment): State {
  return {
    period_year: assessment.period_year,
    assessment_date: assessment.assessment_date ?? '',
    due_date: assessment.due_date,
    reason: assessment.reason ?? null,
    lic_user_id: assessment.lic_user?.id ?? null,
    lic_phone: assessment.lic_phone ?? '',
    licom_user_id: assessment.licom_user?.id ?? null,
    licom_phone: assessment.licom_phone ?? '',
  }
}

const state = reactive<State>(fromAssessment(props.assessment))
/** The picked users, for the pickers' labels and their mobile numbers. */
const users = reactive<Record<Member, RaUserRef | null>>({
  lic: props.assessment.lic_user,
  licom: props.assessment.licom_user,
})

const assessmentDate = computed({
  get: () => state.assessment_date ? parseDate(state.assessment_date) : undefined,
  set: (value: CalendarDate | null | undefined) => {
    state.assessment_date = value ? value.toString() : ''
  },
})

/** The period shown under the date: the saved one until the date is changed. */
const periodShown = computed(() => state.assessment_date !== (props.assessment.assessment_date ?? '')
  ? raPeriodOf(state.assessment_date) ?? state.period_year
  : state.period_year)

/** As SCCA: every other field waits for the reason. */
const noReason = computed(() => !state.reason)

/** Structural change picks its renewal date; every other reason renews a year after the assessment. */
const customDue = computed(() => state.reason === RA_CUSTOM_DUE_REASON)
const standardDue = computed(() => state.assessment_date ? parseDate(state.assessment_date).add({ years: 1 }).toString() : null)
const dueDate = computed({
  get: () => state.due_date ? parseDate(state.due_date) : undefined,
  set: (value: CalendarDate | null | undefined) => {
    state.due_date = value ? value.toString() : null
  },
})

function reset(assessment: RaAssessment) {
  Object.assign(state, fromAssessment(assessment))
  Object.assign(users, { lic: assessment.lic_user, licom: assessment.licom_user })
  snapshot.value = JSON.stringify(state)
  if (dirty) dirty.value = false
}

watch(() => props.assessment, (assessment) => reset(assessment), { immediate: true })
watch(state, () => {
  if (dirty) dirty.value = JSON.stringify(state) !== snapshot.value
}, { deep: true })

async function onSubmit() {
  formError.value = null
  try {
    const { lic_user_id: _lic, licom_user_id, reason, due_date, period_year, ...fields } = state
    // The RA period is the year of the assessment date: it follows a changed date. An RA whose
    // date was not changed keeps its period.
    const dateChanged = state.assessment_date !== (props.assessment.assessment_date ?? '')
    // An assessment from before users were picked keeps its typed names until someone is picked.
    const saved = await raApi.update(props.assessment.id, {
      ...blankToNull({ ...fields }),
      period_year: dateChanged ? raPeriodOf(state.assessment_date) ?? period_year : period_year,
      ...(reason ? { reason: reason as RaReason } : {}),
      ...(reason === RA_CUSTOM_DUE_REASON ? { due_date } : {}),
      ...(licom_user_id ? { licom_user_id } : {}),
    })
    reset(saved)
    toast.add({ title: 'Assessment saved', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', saved)
  } catch (error) {
    form.value?.setErrors(raHeaderErrors(apiFieldErrors(error)))
    formError.value = raErrorText(error)
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
      title="Couldn't save the assessment"
      :description="formError"
      :ui="{ description: 'whitespace-pre-line' }"
    />

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              Assessment
            </h2>
          </template>
          <!-- As SCCA: the reason first (the select half width, its help the full row); the
               other fields stay disabled until a reason is chosen. -->
          <UFormField
            label="Reason for assessment"
            name="reason"
            required
            :help="raReasonHelp(state.reason)"
          >
            <USelect
              v-model="reasonModel"
              :items="reasonItems"
              :disabled="locked"
              placeholder="Select a reason"
              class="w-full sm:w-[calc(50%-0.5rem)]"
              aria-label="Reason for assessment"
            />
          </UFormField>
          <fieldset
            :disabled="noReason"
            class="mt-4 grid min-w-0 items-start gap-4 sm:grid-cols-2"
            :class="noReason ? 'opacity-60' : ''"
          >
            <UFormField
              label="Assessment date"
              name="assessment_date"
              required
              :help="`RA period ${periodShown}, the year of this date.`"
            >
              <DatePicker
                v-model="assessmentDate"
                :disabled="locked"
              />
            </UFormField>
            <UFormField
              v-if="customDue"
              label="Renewal due date"
              name="due_date"
              required
              help="Standard renewal is one year after the assessment. A structural change can be sooner."
            >
              <DatePicker
                v-model="dueDate"
                :min="assessmentDate"
                :max="assessmentDate?.add({ years: 1 })"
                :disabled="locked"
              />
            </UFormField>
            <p
              v-else-if="standardDue"
              class="self-center text-sm text-muted sm:pt-6"
            >
              Renewal due {{ formatDate(standardDue) }}, one year after this assessment.
            </p>
            <!-- As SCCA's Assessor: below the assessment date, read-only. -->
            <UFormField
              label="Assessor"
              class="sm:col-start-1"
              name="assessor"
              help="Filled with the person who creates the assessment."
            >
              <UInput
                :model-value="assessment.created_by ?? ''"
                disabled
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="RA ref. no."
              name="ref_no"
            >
              <UInput
                :model-value="assessment.ref_no ?? ''"
                disabled
                class="w-full"
              />
            </UFormField>
          </fieldset>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              Location incident team
            </h2>
            <p class="text-sm text-muted">
              Both are required.
            </p>
          </template>
          <div class="space-y-4">
            <RaTeamMember
              v-for="member in MEMBERS"
              :key="member"
              v-model:user-id="state[`${member}_user_id`]"
              v-model:user="users[member]"
              v-model:phone="state[`${member}_phone`]"
              :member="member"
              :label="ra[member].label"
              :hint="ra[member].hint"
              :legacy-name="assessment[`${member}_name`]"
              :name-label="ra[member].label"
              :phone-label="`${member.toUpperCase()} mobile number`"
              :fixed="member === 'lic'"
              :disabled="locked"
            />
          </div>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">
            {{ ra.location.single }}
          </h2>
        </template>
        <div class="mb-4">
          <RaMap
            v-if="locationPin"
            :markers="[{ id: assessment.location.id, label: assessment.location.name, level: assessment.summary.highest_residual_level ?? 'none', ...locationPin }]"
            :label="`Map of ${assessment.location.name}`"
            height-class="h-48"
          />
          <p
            v-else
            class="flex items-start gap-2 rounded-md bg-elevated p-3 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-map-pin-off"
              class="mt-0.5 size-4 shrink-0"
            />
            <span>
              No map pin yet.
              <NuxtLink
                :to="locationPath(assessment.location.id, 'map')"
                class="text-primary hover:underline"
              >Add it on the {{ ra.location.lower }}'s Map tab</NuxtLink>.
            </span>
          </p>
        </div>
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-muted">
              {{ ra.kind === 'branch' ? 'Branch' : 'Building' }}
            </dt>
            <dd class="font-medium text-highlighted">
              {{ assessment.location.name }}
            </dd>
          </div>
          <div v-if="ra.hasRegion">
            <dt class="text-muted">
              Region
            </dt>
            <dd>{{ assessment.location.region || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Address
            </dt>
            <dd>{{ assessment.location.address || '—' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Formula version
            </dt>
            <dd>{{ assessment.formula_version }}</dd>
          </div>
        </dl>
        <p class="mt-4 text-sm text-muted">
          {{ ra.hasLcp
            ? 'Emergency contacts, divisions, the recovery team and the call tree are kept on the building and shared by every RA cycle.'
            : 'Emergency contacts are kept on the branch and shared by every RA cycle.' }}
        </p>
        <template #footer>
          <UButton
            :to="locationPath(assessment.location.id)"
            variant="link"
            trailing-icon="i-lucide-arrow-right"
            :label="`Open ${ra.location.lower} profile`"
            class="px-0"
          />
        </template>
      </UCard>
    </div>

    <div
      v-if="!locked"
      class="flex justify-end"
    >
      <UButton
        type="submit"
        label="Save assessment"
        loading-auto
      />
    </div>
  </UForm>
</template>
