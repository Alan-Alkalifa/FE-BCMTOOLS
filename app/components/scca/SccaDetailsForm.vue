<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { SccaApplication, SccaAssessment } from '~/composables/useScca'

const props = defineProps<{ assessment?: SccaAssessment }>()
const emit = defineEmits<{ saved: [assessment: SccaAssessment] }>()

const toast = useToast()
const { user } = useAuth()
const form = useTemplateRef('form')
const dirty = useSccaDirty()
const formError = ref<string | null>(null)
const snapshot = ref('')

// The lists and the renewal period come from the SCCA's configuration version (the record
// page provides it); a new assessment uses the active version.
const provided = inject(sccaConfigKey, null)
const own = provided ? null : useSccaConfig()
const config = computed(() => provided?.value ?? own?.data.value ?? null)
const renewalMonths = computed(() => config.value?.renewal_months ?? 24)
const period = computed(() => sccaRenewalPeriod(renewalMonths.value))
const reasonItems = computed(() => sccaListOptions(config.value, 'assessment_reason', props.assessment?.assessment_reason))
const deploymentItems = computed(() => sccaListOptions(config.value, 'deployment_model', props.assessment?.deployment_model))
const dayItems = computed(() => sccaListOptions(config.value, 'business_days', props.assessment?.business_days))
const hourItems = computed(() => sccaListOptions(config.value, 'business_hours', props.assessment?.business_hours))
/** The reason that lets the assessor pick a sooner renewal date (V4.2: System change). */
function customDue(reason: string | null | undefined) {
  if (!config.value) return reason === 'system_change'
  return !!sccaListItem(config.value, 'assessment_reason', reason)?.attrs?.custom_due_date
}
const renewalReason = computed(() =>
  config.value?.lists.assessment_reason.find((item) => item.active && item.attrs?.renewal)?.code ?? 'annual_review',
)

const assessorName = computed(() => props.assessment?.assessor || user.value?.name || '')
/** Only the assessor (or a BCM admin) picks the contributor; a new assessment's creator is the assessor. */
const canSetContributor = computed(() => !props.assessment || props.assessment.permissions.can_set_contributor)

const schema = z.object({
  application_code: z.string().trim().min(1, 'Enter an application code.'),
  application_name: z.string().trim().min(1, 'Enter an application name.'),
  application_description: z.string().optional(),
  assessment_reason: z.string('Select a reason.').min(1, 'Select a reason.'),
  assessment_date: z.string().min(1, 'Enter the assessment date.'),
  due_date: z.string().nullable().optional(),
  contributor_id: z.number().nullable().optional(),
  application_owner: z.string().min(1, 'Select the application owner.'),
  it_support: z.string().min(1, 'Select IT support.'),
  business_stakeholders: z.string().min(1, 'Select the business stakeholder.'),
  country: z.string().optional(),
  vendor_name: z.string().optional(),
  deployment_model: z.string('Select a deployment model.').min(1, 'Select a deployment model.'),
  customer_facing: z.enum(['yes', 'no'], 'Select whether the application is customer facing.'),
  business_days: z.string('Select the business days.').min(1, 'Select the business days.'),
  business_hours: z.string('Select the business hours.').min(1, 'Select the business hours.'),
}).superRefine((value, context) => {
  if (!customDue(value.assessment_reason) || !value.assessment_date) return
  if (!value.due_date) {
    context.addIssue({ code: 'custom', path: ['due_date'], message: `Enter the renewal due date. It can be sooner than ${period.value}.` })
    return
  }
  const latest = addMonths(value.assessment_date, renewalMonths.value)
  if (value.due_date < value.assessment_date) {
    context.addIssue({ code: 'custom', path: ['due_date'], message: 'Cannot be before the assessment date.' })
  } else if (latest && value.due_date > latest) {
    context.addIssue({ code: 'custom', path: ['due_date'], message: `Cannot be later than ${period.value} after the assessment date.` })
  }
})

type State = z.infer<typeof schema>

function addMonths(iso: string, months: number) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  const target = month - 1 + months
  const date = new Date(Date.UTC(year, target, day))
  // 31 Jan + 1 month: the last day of February, as the API does.
  if (date.getUTCMonth() !== ((target % 12) + 12) % 12) date.setUTCDate(0)
  return date.toISOString().slice(0, 10)
}

function fromAssessment(assessment?: SccaAssessment): State {
  return {
    application_code: assessment?.application_code ?? '',
    application_name: assessment?.application_name ?? '',
    application_description: assessment?.application_description ?? '',
    assessment_reason: (assessment?.assessment_reason ?? 'new_application') as State['assessment_reason'],
    assessment_date: assessment?.assessment_date ?? '',
    due_date: assessment?.due_date ?? null,
    contributor_id: assessment?.contributor_id ?? null,
    application_owner: assessment?.application_owner ?? '',
    it_support: assessment?.it_support ?? '',
    business_stakeholders: assessment?.business_stakeholders ?? '',
    country: assessment?.country ?? '',
    vendor_name: assessment?.vendor_name ?? '',
    deployment_model: (assessment?.deployment_model ?? undefined) as State['deployment_model'],
    customer_facing: assessment?.customer_facing == null ? undefined as unknown as State['customer_facing'] : assessment.customer_facing ? 'yes' : 'no',
    business_days: (assessment?.business_days ?? undefined) as State['business_days'],
    business_hours: (assessment?.business_hours ?? undefined) as State['business_hours'],
  }
}

const state = reactive<State>(fromAssessment(props.assessment))

/** On a new assessment, the existing application picked in the Application name search. */
const pickedApplication = ref<SccaApplication | null>(null)

function onPickApplication(application: SccaApplication | null) {
  pickedApplication.value = application
  if (!application) return
  Object.assign(state, {
    application_code: application.application_code ?? '',
    application_name: application.application_name,
    application_description: application.application_description ?? '',
    application_owner: application.application_owner ?? '',
    it_support: application.it_support ?? '',
    business_stakeholders: application.business_stakeholders ?? '',
    country: application.country ?? '',
    vendor_name: application.vendor_name ?? '',
    deployment_model: (application.deployment_model ?? undefined) as State['deployment_model'],
    customer_facing: application.customer_facing == null
      ? undefined as unknown as State['customer_facing']
      : application.customer_facing ? 'yes' : 'no',
    business_days: (application.business_days ?? undefined) as State['business_days'],
    business_hours: (application.business_hours ?? undefined) as State['business_hours'],
  })
  // An application that was assessed before is no longer a new application.
  const current = sccaListItem(config.value, 'assessment_reason', state.assessment_reason)
  if (config.value ? !current?.attrs?.renewal && !current?.attrs?.custom_due_date : state.assessment_reason === 'new_application') {
    state.assessment_reason = renewalReason.value
  }
  form.value?.clear()
}

const pickedNote = computed(() => {
  const application = pickedApplication.value
  if (!application) return null
  const last = application.last_assessment
  const ref = [last.ref_no, last.assessment_date ? formatDate(last.assessment_date) : null].filter(Boolean).join(', ')
  const source = `Copied the application details from its last SCCA${ref ? ` (${ref})` : ''}.`
  if (last.status !== 'final') {
    return {
      color: 'warning' as const,
      title: `This application already has an SCCA ${sccaStatus[last.status].label.toLowerCase()}`,
      description: `${source} Check with its assessor before starting another one.`,
    }
  }
  return {
    color: 'info' as const,
    title: 'Existing application',
    description: `${source} Check each field and change anything that is different now.`,
  }
})

const standardDue = computed(() => state.assessment_date ? addMonths(state.assessment_date, renewalMonths.value) : null)

const assessmentDate = computed({
  get: () => state.assessment_date ? parseDate(state.assessment_date) : undefined,
  set: (value: CalendarDate | null | undefined) => {
    state.assessment_date = value ? value.toString() : ''
  },
})

const dueDate = computed({
  get: () => state.due_date ? parseDate(state.due_date) : undefined,
  set: (value: CalendarDate | null | undefined) => {
    state.due_date = value ? value.toString() : null
  },
})

function reset(assessment?: SccaAssessment) {
  Object.assign(state, fromAssessment(assessment))
  snapshot.value = JSON.stringify(state)
  if (dirty) dirty.value = false
}

watch(() => props.assessment, (assessment) => reset(assessment), { immediate: true })
watch(state, () => {
  if (dirty) dirty.value = JSON.stringify(state) !== snapshot.value
}, { deep: true })

function payload() {
  return blankToNull({
    application_code: state.application_code,
    application_name: state.application_name,
    application_description: state.application_description,
    assessment_reason: state.assessment_reason,
    assessment_date: state.assessment_date || null,
    due_date: customDue(state.assessment_reason) ? state.due_date : standardDue.value,
    application_owner: state.application_owner,
    it_support: state.it_support,
    business_stakeholders: state.business_stakeholders,
    assessor: assessorName.value,
    contributor_id: state.contributor_id ?? null,
    country: state.country,
    vendor_name: state.vendor_name,
    deployment_model: state.deployment_model,
    customer_facing: state.customer_facing === 'yes',
    business_days: state.business_days,
    business_hours: state.business_hours,
  })
}

// The Save button sits in the page's top bar and submits this form by its id
// (`<button form="scca-form-…">`); `saving` drives its spinner.
const saving = useSccaSaving()

async function onSubmit() {
  formError.value = null
  if (saving) saving.value = true
  try {
    const body = payload()
    const saved = props.assessment
      ? await sccaApi.update(props.assessment.id, body)
      : await sccaApi.create({ ...body, application_name: state.application_name.trim() })
    reset(saved)
    toast.add({ title: props.assessment ? 'Assessment saved' : 'Assessment created', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', saved)
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
    id="scca-form-details"
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
      :ui="{ description: 'whitespace-pre-line' }"
      :description="formError"
    />

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">
            Application details
          </h2>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            v-if="assessment?.ref_no"
            label="SCCA ref. no."
            name="ref_no"
          >
            <UInput
              :model-value="assessment.ref_no"
              disabled
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Application code"
            name="application_code"
            required
          >
            <UInput
              v-model="state.application_code"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Application name"
            name="application_name"
            required
            :help="assessment ? undefined : 'Search applications assessed before, or type a new name.'"
          >
            <UInput
              v-if="assessment"
              v-model="state.application_name"
              class="w-full"
            />
            <SccaApplicationSearch
              v-else
              v-model="state.application_name"
              aria-label="Application name"
              @pick="onPickApplication"
            />
          </UFormField>
          <UAlert
            v-if="!assessment && pickedNote"
            class="sm:col-span-2"
            :color="pickedNote.color"
            variant="subtle"
            :icon="pickedNote.color === 'warning' ? 'i-lucide-triangle-alert' : 'i-lucide-history'"
            :title="pickedNote.title"
            :description="pickedNote.description"
          />
          <UFormField
            label="Reason for assessment"
            name="assessment_reason"
            required
          >
            <USelect
              v-model="state.assessment_reason"
              :items="reasonItems"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Assessment date"
            name="assessment_date"
            required
          >
            <DatePicker
              v-model="assessmentDate"
            />
          </UFormField>
          <UFormField
            v-if="customDue(state.assessment_reason)"
            label="Renewal due date"
            name="due_date"
            required
            :help="`Standard renewal is ${period} after the assessment. A ${sccaListLabel(config, 'assessment_reason', state.assessment_reason)?.toLowerCase()} can be sooner.`"
          >
            <DatePicker
              v-model="dueDate"
              :min="assessmentDate"
              :max="assessmentDate?.add({ months: renewalMonths })"
            />
          </UFormField>
          <p
            v-else-if="standardDue"
            class="text-sm text-muted sm:col-span-2"
          >
            Renewal due {{ formatDate(standardDue) }}, {{ period }} after this assessment.
          </p>
          <UFormField
            class="sm:col-span-2"
            label="Description"
            name="application_description"
          >
            <UTextarea
              v-model="state.application_description"
              class="w-full"
              :rows="3"
            />
          </UFormField>
          <UFormField
            label="Assessor"
            name="assessor"
            help="Filled with the person who creates the assessment."
          >
            <UInput
              :model-value="assessorName"
              disabled
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Contributor"
            name="contributor_id"
            :help="canSetContributor
              ? 'One colleague who can open and edit this SCCA with you.'
              : 'Set by the assessor.'"
          >
            <UserPicker
              v-model="state.contributor_id"
              :selected="assessment?.contributor ?? null"
              :disabled="!canSetContributor"
              aria-label="Contributor"
              permission="scca.access"
            />
          </UFormField>
          <UFormField
            label="Application owner"
            name="application_owner"
            required
          >
            <SccaUserSelect v-model="state.application_owner" />
          </UFormField>
          <UFormField
            label="IT support"
            name="it_support"
            required
          >
            <SccaUserSelect v-model="state.it_support" />
          </UFormField>
          <UFormField
            label="Business stakeholder"
            name="business_stakeholders"
            required
          >
            <SccaUserSelect v-model="state.business_stakeholders" />
          </UFormField>
          <UFormField
            label="Country"
            name="country"
          >
            <UInput
              v-model="state.country"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Vendor"
            name="vendor_name"
          >
            <UInput
              v-model="state.vendor_name"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Deployment model"
            name="deployment_model"
            required
          >
            <USelect
              v-model="state.deployment_model"
              :items="deploymentItems"
              class="w-full"
              placeholder="Select a model"
            />
          </UFormField>
          <UFormField
            label="Customer facing"
            name="customer_facing"
            required
          >
            <USelect
              v-model="state.customer_facing"
              :items="[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
              ]"
              class="w-full"
              placeholder="Select"
            />
          </UFormField>
          <UFormField
            label="Business days"
            name="business_days"
            required
          >
            <USelect
              v-model="state.business_days"
              :items="dayItems"
              class="w-full"
              placeholder="Select"
            />
          </UFormField>
          <UFormField
            label="Business hours"
            name="business_hours"
            required
          >
            <USelect
              v-model="state.business_hours"
              :items="hourItems"
              class="w-full"
              placeholder="Select"
            />
          </UFormField>
        </div>
      </UCard>

      <UCard class="lg:sticky lg:top-6">
        <template #header>
          <h2 class="text-lg font-semibold">
            How SCCA works
          </h2>
        </template>
        <div class="space-y-4 text-sm">
          <p>This form follows the SCCA Tools</p>
          <ol class="list-decimal space-y-3 pl-5">
            <li>Application: the SCC_Rating header. Description, owner, IT support and stakeholders are saved on the application.</li>
            <li>Rating: rate the 18 questions C1–P4 with the levels the form offers, and write a justification for each.</li>
            <li>Interdependency: the A3 table of upstream and downstream systems. It suggests A3 and I4.</li>
            <li>Recovery: IT committed, business and regulatory values, the agreed final values and the CIMBN Recovery Architecture standard.</li>
            <li>Result &amp; sign-off: category, upgrade or downgrade with a CIM / MKK / RA reference, signers and submit.</li>
          </ol>
          <p>The application owner and IT support review the SCCA every {{ period }}.</p>
        </div>
      </UCard>
    </div>

    <!-- New assessment only: on a saved SCCA, Save is in the page's top bar. -->
    <div
      v-if="!assessment"
      class="flex justify-end"
    >
      <UButton
        type="submit"
        label="Create assessment"
        loading-auto
      />
    </div>
  </UForm>
</template>
