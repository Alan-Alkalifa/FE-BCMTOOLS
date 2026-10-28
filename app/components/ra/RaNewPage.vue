<script setup lang="ts">
import { parseDate, today, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { RaAssessmentSummary, RaUserRef } from '~/composables/useRa'

const ra = useRaModule()
const route = useRoute()
const toast = useToast()
const form = useTemplateRef('form')
const formError = ref<string | null>(null)

const { data: locations } = useRaLocations(() => ({ kind: ra.value.kind, active: true }))

const required = (message: string) => z.string().trim().min(1, message)
const schema = computed(() => z.object({
  location_id: z.number(`Choose the ${ra.value.location.lower}.`),
  assessment_date: z.string().min(1, 'Enter the assessment date.'),
  reason: z.enum(RA_REASONS.map((reason) => reason.value) as [RaReason, ...RaReason[]], 'Choose the reason for this assessment.'),
  due_date: z.string().nullable(),
  copy: z.boolean(),
  lic_user_id: z.number('Choose the LIC.'),
  lic_phone: required('Enter the LIC mobile number.'),
  licom_user_id: z.number('Choose the LICOM.'),
  licom_phone: required('Enter the LICOM mobile number.'),
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
}))
type State = Omit<z.infer<typeof schema.value>, 'lic_user_id' | 'licom_user_id' | 'reason'> & {
  lic_user_id: number | null
  licom_user_id: number | null
  reason: RaReason | undefined
}
type Member = 'lic' | 'licom'
const MEMBERS: Member[] = ['lic', 'licom']

const initialLocation = Number(route.query.location_id) || undefined
const state = reactive<State>({
  location_id: initialLocation as number,
  assessment_date: today('Asia/Jakarta').toString(),
  reason: undefined,
  due_date: null,
  copy: true,
  lic_user_id: null,
  lic_phone: '',
  licom_user_id: null,
  licom_phone: '',
})
/** The picked users, for the pickers' labels and their mobile numbers. */
const users = reactive<Record<Member, RaUserRef | null>>({ lic: null, licom: null })

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
    description: [location.code, ra.value.hasRegion ? location.region : location.address].filter(Boolean).join(' · ') || undefined,
  })),
)

/**
 * The most recent assessment of the chosen location, offered as the starting point. Its team
 * fills the members not picked yet; whoever was picked is kept.
 */
const previous = ref<RaAssessmentSummary | null>(null)
/** The reason follows the building until the user picks one. */
const reasonTouched = ref(false)
const reasonModel = computed<RaReason | undefined>({
  get: () => state.reason,
  set: (value) => {
    reasonTouched.value = true
    state.reason = value
  },
})
const reasonItems = RA_REASONS.map((reason) => ({ label: reason.label, value: reason.value }))
const prefilled = ref<Partial<Record<Member, { user: RaUserRef, phone: string }>>>({})

function clearPrefill() {
  for (const member of MEMBERS) {
    const filled = prefilled.value[member]
    if (filled && state[`${member}_user_id`] === filled.user.id) {
      state[`${member}_user_id`] = null
      users[member] = null
      if (state[`${member}_phone`] === filled.phone) state[`${member}_phone`] = ''
    }
  }
  prefilled.value = {}
}

async function prefillTeam(source: RaAssessmentSummary) {
  const detail = await raApi.get(source.id)
  if (previous.value?.id !== source.id || !state.copy) return
  const filled: typeof prefilled.value = {}
  for (const member of MEMBERS) {
    const user = detail[`${member}_user`]
    if (!user || state[`${member}_user_id`]) continue
    state[`${member}_user_id`] = user.id
    users[member] = user
    const phone = detail[`${member}_phone`] ?? ''
    if (!state[`${member}_phone`].trim()) state[`${member}_phone`] = phone
    filled[member] = { user, phone }
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
    // The usual reason: renew the final RA, or the building's first RA.
    const hasFinal = detail.assessments.some((row) => row.status === 'approved')
    if (!reasonTouched.value) state.reason = hasFinal ? 'annual_review' : detail.assessments.length ? undefined : 'new_building'
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
/** Structural change picks its renewal date (like SCCA's System change). */
const customDue = computed(() => state.reason === RA_CUSTOM_DUE_REASON)
const chosenDue = computed({
  get: () => state.due_date ? parseDate(state.due_date) : undefined,
  set: (value: CalendarDate | null | undefined) => {
    state.due_date = value ? value.toString() : null
  },
})

async function onSubmit() {
  formError.value = null
  try {
    const created = await raApi.create({
      location_id: state.location_id,
      // The RA period is the year of the assessment date.
      period_year: raPeriodOf(state.assessment_date) ?? new Date().getFullYear(),
      assessment_date: state.assessment_date,
      reason: state.reason,
      ...(customDue.value ? { due_date: state.due_date } : {}),
      copy_from_id: state.copy && previous.value ? previous.value.id : null,
      lic_user_id: state.lic_user_id ?? undefined,
      lic_phone: state.lic_phone.trim(),
      licom_user_id: state.licom_user_id ?? undefined,
      licom_phone: state.licom_phone.trim(),
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
        <!-- As SCCA: the reason first (half width), the building, then the dates side by side. -->
        <div class="grid items-start gap-4 sm:grid-cols-2">
          <UFormField
            label="Reason for assessment"
            name="reason"
            required
            :help="raReasonHelp(state.reason)"
          >
            <USelect
              v-model="reasonModel"
              :items="reasonItems"
              placeholder="Select a reason"
              class="w-full"
              aria-label="Reason for assessment"
            />
          </UFormField>
          <UFormField
            class="sm:col-span-2"
            :label="ra.location.single"
            name="location_id"
            required
            :help="ra.kind === 'branch'
              ? 'The branch to assess. One assessment per branch per period.'
              : 'The building or work location to assess. One assessment per building per period.'"
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
                :to="{ path: `${LOCATIONS_PATH}/new`, query: { type: ra.kind, then: 'assessment' } }"
                color="neutral"
                variant="outline"
                icon="i-lucide-plus"
                :label="`Add ${ra.location.lower}`"
              />
            </div>
          </UFormField>
          <UFormField
            label="Assessment date"
            name="assessment_date"
            required
            :help="raPeriodOf(state.assessment_date) ? `RA period ${raPeriodOf(state.assessment_date)}, the year of this date.` : undefined"
          >
            <DatePicker v-model="assessmentDate" />
          </UFormField>
          <UFormField
            v-if="customDue"
            label="Renewal due date"
            name="due_date"
            required
            help="Standard renewal is one year after the assessment. A structural change can be sooner."
          >
            <DatePicker
              v-model="chosenDue"
              :min="assessmentDate"
              :max="assessmentDate?.add({ years: 1 })"
            />
          </UFormField>
          <p
            v-else-if="dueDate"
            class="self-center text-sm text-muted sm:pt-6"
          >
            Renewal due {{ formatDate(dueDate) }}, one year after this assessment.
          </p>
          <UFormField
            v-if="previous"
            class="sm:col-span-2"
            name="copy"
          >
            <UCheckbox
              v-model="state.copy"
              :label="`Start from ${previous.ref_no} (${previous.period_year})`"
              :description="ra.hasLcp
                ? 'Copies the LIC and LICOM, hazard ratings, mitigation, action plans and the signers. Approvals start over. Contacts, divisions, the recovery team and the call tree come from the building.'
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
              Who leads the response at this {{ ra.location.lower }}, picked from the BCM Tools users. They also sign the RA.
            </p>
          </template>
          <div class="space-y-4">
            <fieldset
              v-for="member in MEMBERS"
              :key="member"
              class="space-y-3"
            >
              <legend class="text-sm font-medium text-highlighted">
                {{ ra[member].label }}
                <span class="block text-xs font-normal text-muted">{{ ra[member].hint }}</span>
              </legend>
              <RaTeamMember
                v-model:user-id="state[`${member}_user_id`]"
                v-model:user="users[member]"
                v-model:phone="state[`${member}_phone`]"
                :member="member"
                :label="ra[member].label"
              />
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
