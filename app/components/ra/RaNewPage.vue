<script setup lang="ts">
import { parseDate, today, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { RaAssessmentSummary } from '~/composables/useRa'

const ra = useRaModule()
const route = useRoute()
const toast = useToast()
const form = useTemplateRef('form')
const formError = ref<string | null>(null)

const { data: locations } = useRaLocations(() => ({ kind: ra.value.kind, active: true }))

const required = (message: string) => z.string().trim().min(1, message)
const schema = computed(() => z.object({
  location_id: z.number(`Choose the ${ra.value.location.lower}.`),
  period_year: z.number('Enter the RA period.').int().min(2000).max(2100),
  assessment_date: z.string().min(1, 'Enter the assessment date.'),
  copy: z.boolean(),
  lic_name: required('Enter the LIC name.'),
  lic_phone: required('Enter the LIC mobile number.'),
  licom_name: required('Enter the LICOM name.'),
  licom_phone: required('Enter the LICOM mobile number.'),
}))
type State = z.infer<typeof schema.value>
type TeamField = 'lic_name' | 'lic_phone' | 'licom_name' | 'licom_phone'
const TEAM_FIELDS: TeamField[] = ['lic_name', 'lic_phone', 'licom_name', 'licom_phone']

const initialLocation = Number(route.query.location_id) || undefined
const state = reactive<State>({
  location_id: initialLocation as number,
  period_year: new Date().getFullYear(),
  assessment_date: today('Asia/Jakarta').toString(),
  copy: true,
  lic_name: '',
  lic_phone: '',
  licom_name: '',
  licom_phone: '',
})

const assessmentDate = computed({
  get: () => state.assessment_date ? parseDate(state.assessment_date) : undefined,
  set: (value: CalendarDate | null | undefined) => {
    state.assessment_date = value ? value.toString() : ''
  },
})

const locationItems = computed(() =>
  (locations.value?.items ?? []).map((location) => ({
    label: location.name,
    value: location.id,
    description: (ra.value.hasRegion ? location.region : location.address) ?? undefined,
  })),
)

/**
 * The most recent assessment of the chosen location, offered as the starting point. Its team
 * fills the empty team fields; whatever is typed in is kept.
 */
const previous = ref<RaAssessmentSummary | null>(null)
const prefilled = ref<Partial<Record<TeamField, string>>>({})

function clearPrefill() {
  for (const field of TEAM_FIELDS) {
    if (prefilled.value[field] !== undefined && state[field] === prefilled.value[field]) state[field] = ''
  }
  prefilled.value = {}
}

async function prefillTeam(source: RaAssessmentSummary) {
  const detail = await raApi.get(source.id)
  if (previous.value?.id !== source.id || !state.copy) return
  const filled: Partial<Record<TeamField, string>> = {}
  for (const field of TEAM_FIELDS) {
    const value = detail[field]
    if (value && !state[field].trim()) {
      state[field] = value
      filled[field] = value
    }
  }
  prefilled.value = filled
}

watch(() => state.location_id, async (id) => {
  clearPrefill()
  previous.value = null
  if (!id) return
  try {
    const detail = await raApi.getLocation(id)
    if (state.location_id !== id) return
    previous.value = detail.assessments[0] ?? null
    if (previous.value && state.copy) await prefillTeam(previous.value)
  } catch {
    previous.value = null
  }
}, { immediate: true })

watch(() => state.copy, (copy) => {
  if (!copy) clearPrefill()
  else if (previous.value) prefillTeam(previous.value).catch(() => {})
})

const dueDate = computed(() => {
  if (!state.assessment_date) return null
  const date = parseDate(state.assessment_date).add({ years: 1 })
  return date.toString()
})

async function onSubmit() {
  formError.value = null
  try {
    const created = await raApi.create({
      location_id: state.location_id,
      period_year: state.period_year,
      assessment_date: state.assessment_date,
      copy_from_id: state.copy && previous.value ? previous.value.id : null,
      ...Object.fromEntries(TEAM_FIELDS.map((field) => [field, state[field].trim()])),
    })
    toast.add({ title: 'Assessment created', color: 'success', icon: 'i-lucide-circle-check' })
    await navigateTo(raPath(ra.value.kind, 'manage', created.id))
  } catch (error) {
    form.value?.setErrors(apiFieldErrors(error))
    formError.value = apiErrorMessage(error)
  }
}
</script>

<template>
  <AppPage
    :title="`New ${ra.title} assessment`"
    :crumbs="[{ label: ra.title, to: raPath(ra.kind, 'monitoring') }, { label: 'Manage', to: raPath(ra.kind, 'manage') }, { label: 'New assessment' }]"
  >
    <UForm
      ref="form"
      :schema="schema"
      :state="state"
      class="grid max-w-6xl items-start gap-6 lg:grid-cols-2"
      @submit="onSubmit"
    >
      <UAlert
        v-if="formError"
        class="lg:col-span-2"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Couldn't create the assessment"
        :description="formError"
      />

      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">
            Assessment
          </h2>
        </template>
        <div class="space-y-4">
          <UFormField
            :label="ra.location.single"
            name="location_id"
            required
            :help="ra.kind === 'branch'
              ? 'The branch to assess. One assessment per branch per period.'
              : 'The building or work location to assess. One assessment per location per period.'"
          >
            <div class="flex gap-2">
              <USelectMenu
                v-model="state.location_id"
                value-key="value"
                :items="locationItems"
                :placeholder="`Choose a ${ra.location.lower}`"
                class="min-w-0 flex-1"
              />
              <UButton
                :to="`${ra.base}/locations/new?then=assessment`"
                color="neutral"
                variant="outline"
                icon="i-lucide-plus"
                :label="`Add ${ra.location.lower}`"
              />
            </div>
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="RA period"
              name="period_year"
              required
            >
              <UInputNumber
                v-model="state.period_year"
                :min="2000"
                :max="2100"
                :format-options="{ useGrouping: false }"
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
          </div>
          <p
            v-if="dueDate"
            class="text-sm text-muted"
          >
            Renewal due {{ formatDate(dueDate) }}, one year after this assessment. You can change it later.
          </p>
          <UFormField
            v-if="previous"
            name="copy"
          >
            <UCheckbox
              v-model="state.copy"
              :label="`Start from ${previous.ref_no} (${previous.period_year})`"
              :description="ra.hasLcp
                ? 'Copies the LIC and LICOM, hazard ratings, mitigation, action plans and the signers. Approvals start over. Contacts, occupants, the recovery team and the call tree come from the location.'
                : 'Copies the LIC and LICOM, hazard ratings, mitigation, action plans and the signers. Approvals start over. Contacts come from the branch.'"
            />
          </UFormField>
        </div>
      </UCard>

      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              Location incident team
            </h2>
            <p class="text-sm text-muted">
              Who leads the response at this {{ ra.location.lower }}. Both are required.
            </p>
          </template>
          <div class="space-y-4">
            <fieldset class="space-y-3">
              <legend class="text-sm font-medium text-highlighted">
                {{ ra.lic.label }}
                <span class="block text-xs font-normal text-muted">{{ ra.lic.hint }}</span>
              </legend>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField
                  label="Name"
                  name="lic_name"
                  required
                  eager-validation
                >
                  <UInput
                    v-model="state.lic_name"
                    autocomplete="off"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Mobile number"
                  name="lic_phone"
                  required
                  eager-validation
                >
                  <UInput
                    v-model="state.lic_phone"
                    type="tel"
                    autocomplete="off"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </fieldset>
            <fieldset class="space-y-3">
              <legend class="text-sm font-medium text-highlighted">
                {{ ra.licom.label }}
                <span class="block text-xs font-normal text-muted">{{ ra.licom.hint }}</span>
              </legend>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField
                  label="Name"
                  name="licom_name"
                  required
                  eager-validation
                >
                  <UInput
                    v-model="state.licom_name"
                    autocomplete="off"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Mobile number"
                  name="licom_phone"
                  required
                  eager-validation
                >
                  <UInput
                    v-model="state.licom_phone"
                    type="tel"
                    autocomplete="off"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </fieldset>
          </div>
        </UCard>

        <div class="flex justify-end gap-2">
          <UButton
            :to="raPath(ra.kind, 'manage')"
            color="neutral"
            variant="outline"
            label="Cancel"
          />
          <UButton
            type="submit"
            label="Create assessment"
            loading-auto
          />
        </div>
      </div>
    </UForm>
  </AppPage>
</template>
