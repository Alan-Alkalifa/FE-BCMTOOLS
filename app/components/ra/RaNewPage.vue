<script setup lang="ts">
import { parseDate, today, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { RaAssessmentSummary, RaLocation, RaLocationDetail, RaUserRef } from '~/composables/useRa'

/**
 * New assessment, with SCCA's conditions (SccaDetailsForm): the reason comes first and decides
 * which buildings can be picked — New building only those without an RA, Annual review only
 * those with a final RA to renew, Structural change any. Changing the reason to one the picked
 * building doesn't fit asks first and clears the building (or keeps the reason). Picking a
 * building says what its last RA is and copies from it, as SCCA copies an application's last
 * SCCA; a building that already has an RA for the period is flagged on the assessment date.
 */
const ra = useRaModule()
const route = useRoute()
const toast = useToast()
const confirm = useConfirm()
const form = useTemplateRef('form')
const formError = ref<string | null>(null)

const { data: locations } = useRaLocations(() => ({ kind: ra.value.kind, active: true }))

const required = (message: string) => z.string().trim().min(1, message)
const schema = computed(() => z.object({
  location_id: z.number(`Choose the ${ra.value.location.lower}.`),
  assessment_date: z.string().min(1, 'Enter the assessment date.'),
  reason: z.enum(RA_REASONS.map((reason) => reason.value) as [RaReason, ...RaReason[]], 'Choose the reason for this assessment.'),
  due_date: z.string().nullable(),
  lic_user_id: z.number('Choose the LIC.'),
  lic_phone: required('Enter the LIC mobile number.'),
  licom_user_id: z.number('Choose the LICOM.'),
  licom_phone: required('Enter the LICOM mobile number.'),
}).superRefine((value, context) => {
  // One RA per building per period (the year of the assessment date), said before the API does.
  const year = raPeriodOf(value.assessment_date)
  const taken = year ? detail.value?.assessments.find((row) => row.period_year === year) : undefined
  if (taken && detail.value?.id === value.location_id) {
    context.addIssue({ code: 'custom', path: ['assessment_date'], message: `This ${ra.value.location.lower} already has an RA for ${year} (${taken.ref_no ?? `#${taken.id}`}). Pick a date in another year, or open that RA.` })
  }
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

/** Whether a building can be assessed for a reason (the API checks the same). */
function fits(reason: RaReason | undefined, location: RaLocation | undefined) {
  if (!reason || !location) return true
  if (reason === 'new_building') return location.assessment_count === 0
  if (reason === 'annual_review') return Boolean(location.final_assessment)
  return true
}
const chosen = computed(() => locations.value?.items.find((item) => item.id === state.location_id))
/** As SCCA's application lookup: only the buildings the reason fits (and the one picked). */
const locationItems = computed(() =>
  (locations.value?.items ?? [])
    .filter((location) => location.id === state.location_id || fits(state.reason, location))
    .map((location) => ({
      label: location.name,
      value: location.id,
      description: [location.code, ra.value.hasRegion ? location.region : location.address].filter(Boolean).join(' · ') || undefined,
    })),
)
const locationHelp = computed(() => {
  const { lower, lowerPlural } = ra.value.location
  if (state.reason === 'new_building') return `Only ${lowerPlural} without an RA yet. Not listed? Use Add ${lower}.`
  if (state.reason === 'annual_review') return `Only ${lowerPlural} with a final RA to renew.`
  if (state.reason === 'structural_change') return `The ${lower} that changed. One assessment per ${lower} per period.`
  return `The ${lower} to assess. One assessment per ${lower} per period.`
})

/** The chosen building with its RAs, newest first. */
const detail = ref<RaLocationDetail | null>(null)
/** Its most recent RA: the new one starts from it (team, ratings, signers), as SCCA copies. */
const previous = computed<RaAssessmentSummary | null>(() => detail.value?.assessments[0] ?? null)
const reasonItems = RA_REASONS.map((reason) => ({ label: reason.label, value: reason.value }))
/** The picked users copied from the previous RA, cleared again if the building changes. */
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
  const full = await raApi.get(source.id)
  if (previous.value?.id !== source.id) return
  const filled: typeof prefilled.value = {}
  for (const member of MEMBERS) {
    const user = full[`${member}_user`]
    if (!user || state[`${member}_user_id`]) continue
    state[`${member}_user_id`] = user.id
    users[member] = user
    const phone = full[`${member}_phone`] ?? ''
    if (!state[`${member}_phone`].trim()) state[`${member}_phone`] = phone
    filled[member] = { user, phone }
  }
  prefilled.value = filled
}

watch(() => state.location_id, async (id) => {
  clearPrefill()
  detail.value = null
  if (!id) return
  try {
    const loaded = await raApi.getLocation(id)
    if (state.location_id !== id) return
    detail.value = loaded
    // Opened from a building page: the usual reason, renewing its final RA or its first RA.
    if (!state.reason) {
      const hasFinal = loaded.assessments.some((row) => row.status === 'approved')
      state.reason = hasFinal ? 'annual_review' : loaded.assessments.length ? undefined : 'new_building'
    }
    if (previous.value) await prefillTeam(previous.value)
  } catch {
    detail.value = null
  }
}, { immediate: true })

// As SCCA: a reason the picked building doesn't fit asks first, then clears the building; or
// the reason stays as it was.
let reverting = false
watch(() => state.reason, async (reason, before) => {
  if (reverting) {
    reverting = false
    return
  }
  const location = chosen.value
  if (!before || !location || fits(reason, location)) return
  const noun = ra.value.location.lower
  const why = reason === 'new_building'
    ? `${location.name} already has an RA${location.latest_assessment?.ref_no ? ` (${location.latest_assessment.ref_no})` : ''}, so it isn't a new ${noun}.`
    : `${location.name} has no final RA to renew yet.`
  const ok = await confirm({
    title: 'Change the reason?',
    description: `${why} The ${noun} you picked is cleared.`,
    confirmLabel: 'Change reason',
  })
  if (!ok) {
    reverting = true
    state.reason = before
    return
  }
  state.location_id = undefined as unknown as number
})

/** What the picked building already has, as SCCA's note on the picked application. */
const pickedNote = computed(() => {
  if (!state.location_id || !detail.value) return null
  const last = previous.value
  const noun = ra.value.location.lower
  if (!last) {
    return {
      color: 'info' as const,
      title: `No RA yet for this ${noun}`,
      description: 'Pick the location incident team below; the hazards are rated from scratch.',
    }
  }
  const ref = [last.ref_no, last.assessment_date ? formatDate(last.assessment_date) : null].filter(Boolean).join(', ')
  const copied = `Copied the LIC and LICOM, hazard ratings, mitigation, action plans and signers from its last RA${ref ? ` (${ref})` : ''}; approvals start over.`
  if (last.status !== 'approved') {
    return {
      color: 'warning' as const,
      title: `This ${noun} already has an RA ${raStatus[last.status].label.toLowerCase()}`,
      description: `${copied} Check with its LIC before starting another one.`,
    }
  }
  return {
    color: 'info' as const,
    title: `Existing ${noun}`,
    description: `${copied} Check each rating and change anything that is different now.`,
  }
})

const dueDate = computed(() => {
  if (!state.assessment_date) return null
  const date = parseDate(state.assessment_date).add({ years: 1 })
  return date.toString()
})
/** As SCCA: every other field waits for the reason. */
const noReason = computed(() => !state.reason)
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
      // As SCCA: always from the building's last RA, when it has one.
      copy_from_id: previous.value?.id ?? null,
      lic_user_id: state.lic_user_id ?? undefined,
      lic_phone: state.lic_phone.trim(),
      licom_user_id: state.licom_user_id ?? undefined,
      licom_phone: state.licom_phone.trim(),
    })
    toast.add({ title: 'Assessment created', color: 'success', icon: 'i-lucide-circle-check' })
    await navigateTo(raPath(ra.value.kind, 'manage', created.id))
  } catch (error) {
    form.value?.setErrors(raHeaderErrors(apiFieldErrors(error)))
    formError.value = raErrorText(error)
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
        :ui="{ description: 'whitespace-pre-line' }"
      />

      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">
            Assessment
          </h2>
        </template>
        <!-- As SCCA: the reason first (the select half width, its help the full row); the other
             fields stay disabled until a reason is chosen. -->
        <UFormField
          label="Reason for assessment"
          name="reason"
          required
          :help="raReasonHelp(state.reason)"
        >
          <USelect
            v-model="state.reason"
            :items="reasonItems"
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
            class="sm:col-span-2"
            :label="ra.location.single"
            name="location_id"
            required
            :help="locationHelp"
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
                :disabled="noReason"
                color="neutral"
                variant="outline"
                icon="i-lucide-plus"
                :label="`Add ${ra.location.lower}`"
              />
            </div>
          </UFormField>
          <!-- As SCCA's note on a picked application: what the building's last RA is, and that
               the new one starts from it. -->
          <UAlert
            v-if="pickedNote"
            class="sm:col-span-2"
            :color="pickedNote.color"
            variant="subtle"
            :icon="pickedNote.color === 'warning' ? 'i-lucide-triangle-alert' : 'i-lucide-history'"
            :title="pickedNote.title"
            :description="pickedNote.description"
            data-testid="building-note"
          />
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
        </fieldset>
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
          <fieldset
            :disabled="noReason"
            class="space-y-4"
            :class="noReason ? 'opacity-60' : ''"
          >
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
          </fieldset>
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
