<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { SccaAssessment } from '~/composables/useScca'

const props = defineProps<{ assessment?: SccaAssessment }>()
const emit = defineEmits<{ saved: [assessment: SccaAssessment] }>()

const toast = useToast()
const { user } = useAuth()
const form = useTemplateRef('form')
const dirty = useSccaDirty()
const formError = ref<string | null>(null)
const snapshot = ref('')

const assessorName = computed(() => props.assessment?.assessor || user.value?.name || '')

const schema = z.object({
  application_code: z.string().trim().min(1, 'Enter an application code.'),
  application_name: z.string().trim().min(1, 'Enter an application name.'),
  application_description: z.string().optional(),
  assessment_reason: z.enum(['new_application', 'annual_review', 'system_change'], 'Select a reason.'),
  assessment_date: z.string().min(1, 'Enter the assessment date.'),
  due_date: z.string().nullable().optional(),
  application_owner: z.string().min(1, 'Select the application owner.'),
  it_support: z.string().min(1, 'Select IT support.'),
  business_stakeholders: z.string().min(1, 'Select the business stakeholder.'),
  country: z.string().optional(),
  vendor_name: z.string().optional(),
  deployment_model: z.enum(['On-premise', 'SaaS', 'PaaS', 'laaS'], 'Select a deployment model.'),
  customer_facing: z.enum(['yes', 'no'], 'Select whether the application is customer facing.'),
  business_days: z.enum(['Mon-Fri', 'Mon-Sat', 'Mon-Sun'], 'Select the business days.'),
  business_hours: z.enum(['08-18', '08-21', '00-24'], 'Select the business hours.'),
}).superRefine((value, context) => {
  if (value.assessment_reason !== 'system_change' || !value.assessment_date) return
  if (!value.due_date) {
    context.addIssue({ code: 'custom', path: ['due_date'], message: 'Enter the renewal due date. It can be sooner than 2 years.' })
    return
  }
  const latest = addYears(value.assessment_date, 2)
  if (value.due_date < value.assessment_date) {
    context.addIssue({ code: 'custom', path: ['due_date'], message: 'Cannot be before the assessment date.' })
  } else if (latest && value.due_date > latest) {
    context.addIssue({ code: 'custom', path: ['due_date'], message: 'Cannot be later than 2 years after the assessment date.' })
  }
})

type State = z.infer<typeof schema>

function addYears(iso: string, years: number) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(Date.UTC(year + years, month - 1, day))
  if (date.getUTCMonth() !== month - 1) date.setUTCDate(0)
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

const standardDue = computed(() => state.assessment_date ? addYears(state.assessment_date, 2) : null)

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
    due_date: state.assessment_reason === 'system_change' ? state.due_date : standardDue.value,
    application_owner: state.application_owner,
    it_support: state.it_support,
    business_stakeholders: state.business_stakeholders,
    assessor: assessorName.value,
    country: state.country,
    vendor_name: state.vendor_name,
    deployment_model: state.deployment_model,
    customer_facing: state.customer_facing === 'yes',
    business_days: state.business_days,
    business_hours: state.business_hours,
  })
}

async function onSubmit() {
  formError.value = null
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
      title="Couldn't save the assessment"
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
          >
            <UInput
              v-model="state.application_name"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Reason for assessment"
            name="assessment_reason"
            required
          >
            <USelect
              v-model="state.assessment_reason"
              :items="[...SCCA_REASONS]"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Assessment date"
            name="assessment_date"
            required
          >
            <UInputDate
              v-model="assessmentDate"
              locale="id-ID"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="state.assessment_reason === 'system_change'"
            label="Renewal due date"
            name="due_date"
            required
            help="Standard renewal is 2 years after the assessment. A system change can be sooner."
          >
            <UInputDate
              v-model="dueDate"
              locale="id-ID"
              class="w-full"
            />
          </UFormField>
          <p
            v-else-if="standardDue"
            class="text-sm text-muted sm:col-span-2"
          >
            Renewal due {{ formatDate(standardDue) }}, 2 years after this assessment.
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
              :items="[...SCCA_DEPLOYMENT_MODELS]"
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
              :items="[...SCCA_BUSINESS_DAYS]"
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
              :items="[...SCCA_BUSINESS_HOURS]"
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
          <p>The application owner and IT support review the SCCA every 2 years.</p>
        </div>
      </UCard>
    </div>

    <div class="flex justify-end">
      <UButton
        type="submit"
        :label="assessment ? 'Save application' : 'Create assessment'"
        loading-auto
      />
    </div>
  </UForm>
</template>
