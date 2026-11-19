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
 *
 * New building (not opened from a building page): no building is picked. The new building is
 * entered here in full (details, map pin, emergency contacts and, for head office, occupants,
 * recovery team and call tree) and saved with the RA in one go, or nothing is.
 */
const ra = useRaModule()
const { user } = useAuth()
const route = useRoute()
const toast = useToast()
const confirm = useConfirm()
const form = useTemplateRef('form')
const formError = ref<string | null>(null)

const { data: locations } = useRaLocations(() => ({ kind: ra.value.kind, assessable: true }))
/** 1 January this year (WIB): the earliest date a New building can have. */
const yearStart = parseDate(`${raTodayIso().slice(0, 4)}-01-01`)

const required = (message: string) => z.string().trim().min(1, message)
// A mobile number: required, and a phone number (raPhoneProblem), as the API checks.
const phoneField = (message: string) => required(message).superRefine((value, context) => {
  const problem = value ? raPhoneProblem(value) : null
  if (problem) context.addIssue({ code: 'custom', message: problem })
})
const initialLocation = Number(route.query.location_id) || undefined
/** New building, not opened from a building page: the building is entered below, not picked. */
const newBuilding = computed((): boolean => state.reason === 'new_building' && !initialLocation)

const schema = computed(() => z.object({
  location_id: newBuilding.value ? z.number().optional() : z.number(`Choose the ${ra.value.location.lower}.`),
  assessment_date: z.string().min(1, 'Enter the assessment date.'),
  reason: z.enum(RA_REASONS.map((reason) => reason.value) as [RaReason, ...RaReason[]], 'Choose the reason for this assessment.'),
  due_date: z.string().nullable(),
  // The LIC is the assessor: the signed-in user, never picked or sent.
  lic_user_id: z.number().nullable(),
  lic_phone: phoneField('Enter the LIC mobile number.'),
  licom_user_id: z.number('Choose the LICOM.'),
  licom_phone: phoneField('Enter the LICOM mobile number.'),
}).superRefine((value, context) => {
  // One RA per building per period (the year of the assessment date), said before the API
  // does. A Structural change may follow in the same period once that period's RA is final.
  const year = raPeriodOf(value.assessment_date)
  const same = year && detail.value && detail.value.id === value.location_id ? detail.value.assessments.filter((row) => row.period_year === year) : []
  const open = same.find((row) => row.status !== 'approved')
  const refOf = (row: RaAssessmentSummary) => row.ref_no ?? `#${row.id}`
  if (same.length && value.reason !== RA_CUSTOM_DUE_REASON) {
    context.addIssue({ code: 'custom', path: ['assessment_date'], message: `This ${ra.value.location.lower} already has an RA for ${year} (${refOf(same[0]!)}). Pick a date in another year, or open that RA. Only a structural change can follow a final RA in the same year.` })
  } else if (open) {
    context.addIssue({ code: 'custom', path: ['assessment_date'], message: `The RA for ${year} (${refOf(open)}) isn't final yet. A structural change can start once it is final.` })
  }
  // As SCCA's New application: a New building can be back-dated, not to an earlier year.
  const backYear = raNewBuildingDateProblem(value.reason, value.assessment_date)
  if (backYear) context.addIssue({ code: 'custom', path: ['assessment_date'], message: backYear })
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
/** The members picked (and copied from the last RA): the LICOM. */
const TEAM_PICKED: Member[] = ['licom']

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
/** The picked users, for the pickers' labels and their mobile numbers. The LIC is the person
 *  making the RA, with their mobile number from their profile. */
const users = reactive<Record<Member, RaUserRef | null>>({ lic: null, licom: null })
const { data: profile } = useProfile()
watch(() => user.value, (me) => {
  users.lic = me ? { id: me.id, name: me.name, email: me.email, job_title: me.job_title } : null
  state.lic_user_id = me?.id ?? null
}, { immediate: true })
watch(() => profile.value?.mobile_phone, (mobile) => {
  if (raPhoneOrEmpty(mobile) && !state.lic_phone.trim()) state.lic_phone = raPhoneOrEmpty(mobile)
}, { immediate: true })

const assessmentDate = computed({
  get: () => state.assessment_date ? parseDate(state.assessment_date) : undefined,
  set: (value: CalendarDate | null | undefined) => {
    state.assessment_date = value ? value.toString() : ''
  },
})

/** Whether a building can be assessed for a reason (the API checks the same). New building is
 *  a building's first RA; an Annual review or a Structural change follows its final RA. */
function fits(reason: RaReason | undefined, location: RaLocation | undefined) {
  if (!reason || !location) return true
  if (reason === 'new_building') return location.assessment_count === 0
  return Boolean(location.final_assessment)
}
const chosen = computed(() => locations.value?.items.find((item) => item.id === state.location_id))
/** As SCCA's access scope: outside BCM, an Annual review or a Structural change picks only the
 *  buildings an access rule opens (RA configuration > Access scope). Null: every building. */
const scopedIds = ref<Set<number> | null>(null)
/** As SCCA's rule, from the API: why a building with a final RA can't be picked for the reason
 *  (another RA of it is open; a Structural change when its renewal is overdue). */
const problems = ref<Record<string, string>>({})
watch(() => [state.reason, ra.value.kind] as const, async ([reason, kind]) => {
  scopedIds.value = null
  problems.value = {}
  if (reason !== 'annual_review' && reason !== 'structural_change') return
  try {
    const scope = await raApi.locationScope(kind, reason)
    if (state.reason !== reason) return
    scopedIds.value = scope.all ? null : new Set(scope.ids)
    problems.value = scope.problems ?? {}
  } catch {
    scopedIds.value = null
  }
}, { immediate: true })
function inScope(location: RaLocation) {
  return !scopedIds.value || scopedIds.value.has(location.id)
}
/** As SCCA's application lookup: only the buildings the reason fits (and the one picked); one
 *  the rule refuses shows greyed out with the reason. */
const locationItems = computed(() =>
  (locations.value?.items ?? [])
    .filter((location) => location.id === state.location_id || (fits(state.reason, location) && inScope(location)))
    .map((location) => {
      const problem = problems.value[String(location.id)]
      const about = [location.code, ra.value.hasRegion ? location.region : location.address].filter(Boolean).join(' · ')
      return {
        label: location.name,
        value: location.id,
        description: problem ? [location.code, problem].filter(Boolean).join(' · ') : about || undefined,
        disabled: Boolean(problem) && location.id !== state.location_id,
      }
    }),
)
/** Why the picked building can't take the reason (the API refuses it too). */
const pickedProblem = computed(() => (state.location_id ? problems.value[String(state.location_id)] ?? null : null))
const locationHelp = computed(() => {
  const { lower, lowerPlural } = ra.value.location
  if (state.reason === 'new_building') return `Only ${lowerPlural} without an RA yet.`
  const scoped = scopedIds.value ? ` Only the ${lowerPlural} your access scope opens.` : ''
  if (state.reason === 'annual_review') return `Only ${lowerPlural} with a final RA to renew, while no other RA of it is open.${scoped}`
  if (state.reason === 'structural_change') return `The ${lower} that changed: one with a final RA, while no other RA of it is open and its renewal isn't overdue. It can follow a final RA in the same period.${scoped}`
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
  for (const member of TEAM_PICKED) {
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
  // The LIC stays the person making the RA; their own number comes along when they were the LIC.
  if (full.lic_user?.id === state.lic_user_id && full.lic_phone && !state.lic_phone.trim()) {
    state.lic_phone = full.lic_phone
  }
  for (const member of TEAM_PICKED) {
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
    : `${location.name} has no final RA yet.`
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

/** A new building waiting for approval: its RA can be made, and the building approver signs it
 *  too (when RA configuration has that step). */
const pickedWaiting = computed(() => Boolean(
  detail.value && detail.value.approval?.status === 'pending' && detail.value.approval.action !== 'deactivate',
))

/** What the picked building already has, as SCCA's note on the picked application. */
const pickedNote = computed(() => {
  if (!state.location_id || !detail.value) return null
  if (pickedProblem.value) {
    const reason = RA_REASONS.find((item) => item.value === state.reason)?.label ?? 'This reason'
    return {
      color: 'error' as const,
      title: `${reason} isn't possible for this ${ra.value.location.lower}`,
      description: `${pickedProblem.value} Pick another ${ra.value.location.lower} or reason.`,
    }
  }
  const last = previous.value
  const noun = ra.value.location.lower
  if (!last) {
    return {
      color: 'info' as const,
      title: `No RA yet for this ${noun}`,
      description: 'Pick the LICOM below. The hazards are rated from scratch.',
    }
  }
  const ref = [last.ref_no, last.assessment_date ? formatDate(last.assessment_date) : null].filter(Boolean).join(', ')
  const copied = `Copied the assessment details from its last RA${ref ? ` (${ref})` : ''}. Approvals start over.`
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
    description: state.reason === 'annual_review'
      ? `${copied} An annual review rates every hazard from scratch.`
      : `${copied} Check each rating and change anything that is different now.`,
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

// --- New building, entered here ---------------------------------------------------------------

/** An empty building of this kind: what the profile forms start from. */
const blankLocation = computed<RaLocationDetail>(() => ({
  id: 0,
  kind: ra.value.kind,
  name: '',
  region: null,
  address: null,
  latitude: null,
  longitude: null,
  is_active: true,
  assessment_count: 0,
  latest_assessment: null,
  updated_at: '',
  can_delete: false,
  assessments: [],
  contacts: [],
  occupants: [],
  occupant_summary: { units: 0, employees: 0, disabled: 0, pregnant: 0, with_bcp: 0, with_alternate_site: 0 },
  recovery_team: [],
  call_tree: [],
  created_by: null,
  updated_by: null,
}))
const occupantsDraft = ref<RaLocationDetail>(blankLocation.value)
watch(() => ra.value.kind, () => {
  occupantsDraft.value = blankLocation.value
})

const locationForm = useTemplateRef('locationForm')
const mapTab = useTemplateRef('mapTab')
const contactsForm = useTemplateRef('contactsForm')
const teamForm = useTemplateRef('teamForm')
const callTreeForm = useTemplateRef('callTreeForm')
/** The map's side card names the building as it is typed. */
const mapLocation = computed<RaLocationDetail>(() => ({
  ...blankLocation.value,
  name: locationForm.value?.state.name.trim() || `New ${ra.value.location.lower}`,
  address: locationForm.value?.state.address.trim() || null,
}))

type BuildingTab = 'details' | 'map' | 'contacts' | 'occupants' | 'team' | 'calltree'
const LCP_TABS: BuildingTab[] = ['occupants', 'team', 'calltree']
const buildingTab = ref<BuildingTab>('details')
const buildingTabs = computed(() => [
  { label: 'Details', value: 'details', icon: 'i-lucide-building-2', slot: 'details' as const },
  { label: 'Map', value: 'map', icon: 'i-lucide-map-pinned', slot: 'map' as const },
  { label: 'Emergency contacts', value: 'contacts', icon: 'i-lucide-phone', slot: 'contacts' as const },
  { label: 'Occupants', value: 'occupants', icon: 'i-lucide-users', slot: 'occupants' as const },
  { label: 'Recovery team', value: 'team', icon: 'i-lucide-life-buoy', slot: 'team' as const },
  { label: 'Call tree', value: 'calltree', icon: 'i-lucide-network', slot: 'calltree' as const },
].filter((item) => ra.value.hasLcp || !LCP_TABS.includes(item.value as BuildingTab)))

/** The building and its profile from the tabs, or null (showing the first tab that needs
 *  attention). Every tab is checked, so each shows its messages. */
async function collectBuilding() {
  const location = await locationForm.value?.collect()
  const pin = mapTab.value?.collect()
  const contacts = contactsForm.value?.collect()
  const lcp = ra.value.hasLcp
  const team = lcp ? teamForm.value?.collect() : []
  const callTree = lcp ? callTreeForm.value?.collect() : []
  const failed = ([['details', location], ['map', pin], ['contacts', contacts], ['team', team], ['calltree', callTree]] as const)
    .find(([, value]) => !value)
  if (failed || !location || !pin || !contacts || !team || !callTree) {
    if (failed) buildingTab.value = failed[0]
    return null
  }
  return {
    location: { ...location, ...pin },
    contacts,
    occupants: lcp ? occupantsDraft.value.occupants.map(({ seq: _seq, critical_rating: _rating, ...occupant }) => occupant) : [],
    recovery_team: team,
    call_tree: callTree,
  }
}

const submitting = ref(false)
async function createWithBuilding() {
  formError.value = null
  submitting.value = true
  try {
    const header = await form.value?.validate({ silent: true })
    const building = await collectBuilding()
    if (!header || !building) {
      formError.value = 'Some fields need attention. Check the messages below each field.'
      return
    }
    const created = await raApi.createWithBuilding({
      ...building,
      period_year: raPeriodOf(state.assessment_date) ?? new Date().getFullYear(),
      assessment_date: state.assessment_date,
      lic_phone: state.lic_phone.trim(),
      licom_user_id: state.licom_user_id ?? undefined,
      licom_phone: state.licom_phone.trim(),
    })
    toast.add({ title: 'Assessment created', color: 'success', icon: 'i-lucide-circle-check' })
    await navigateTo(raPath(ra.value.kind, 'manage', created.id))
  } catch (error) {
    const errors = apiFieldErrors(error)
    const own = errors.filter((item) => item.name?.startsWith('location.')).map((item) => ({ ...item, name: item.name!.slice('location.'.length) }))
    locationForm.value?.setErrors(own)
    if (own.length) buildingTab.value = 'details'
    form.value?.setErrors(raHeaderErrors(errors.filter((item) => !item.name?.includes('.'))))
    formError.value = raErrorText(error)
  } finally {
    submitting.value = false
  }
}

async function onSubmit() {
  formError.value = null
  try {
    const created = await raApi.create({
      location_id: state.location_id!,
      // The RA period is the year of the assessment date.
      period_year: raPeriodOf(state.assessment_date) ?? new Date().getFullYear(),
      assessment_date: state.assessment_date,
      reason: state.reason,
      ...(customDue.value ? { due_date: state.due_date } : {}),
      // As SCCA: always from the building's last RA, when it has one.
      copy_from_id: previous.value?.id ?? null,
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
      @submit="newBuilding ? createWithBuilding() : onSubmit()"
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
            v-if="!newBuilding"
            class="sm:col-span-2"
            :label="ra.location.single"
            name="location_id"
            required
            :help="locationHelp"
          >
            <USelectMenu
              v-model="state.location_id"
              value-key="value"
              :items="locationItems"
              :placeholder="`Choose a ${ra.location.lower}`"
              class="w-full"
            />
          </UFormField>
          <!-- As SCCA's note on a picked application: what the building's last RA is, and that
               the new one starts from it. -->
          <UAlert
            v-if="pickedNote"
            class="sm:col-span-2"
            :color="pickedNote.color"
            variant="subtle"
            :icon="pickedNote.color === 'error' ? 'i-lucide-circle-alert' : pickedNote.color === 'warning' ? 'i-lucide-triangle-alert' : 'i-lucide-history'"
            :title="pickedNote.title"
            :description="pickedNote.description"
            data-testid="building-note"
          />
          <UAlert
            v-if="pickedWaiting"
            class="sm:col-span-2"
            color="warning"
            variant="subtle"
            icon="i-lucide-hourglass"
            :title="`This ${ra.location.lower} is waiting for approval`"
            description="Its RA can be made now. Submitted while it waits, the RA is signed by the building approver first, before the other signers."
            data-testid="building-waiting-note"
          />
          <UFormField
            label="Assessment date"
            name="assessment_date"
            required
            :help="[raPeriodOf(state.assessment_date) ? `RA period ${raPeriodOf(state.assessment_date)}, the year of this date.` : null, state.reason === 'new_building' ? 'A new building can be dated earlier this year, not in an earlier year.' : null].filter(Boolean).join(' ') || undefined"
          >
            <DatePicker
              v-model="assessmentDate"
              :min="state.reason === 'new_building' ? yearStart : undefined"
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
          <!-- As SCCA's Assessor: below the assessment date, the person creating it. -->
          <UFormField
            label="Assessor"
            class="sm:col-start-1"
            name="assessor"
            help="Filled with the person who creates the assessment."
          >
            <UInput
              :model-value="user?.name ?? ''"
              disabled
              class="w-full"
            />
          </UFormField>
        </fieldset>
      </UCard>

      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              Location incident team
            </h2>
            <p class="text-sm text-muted">
              Who leads the response at this {{ ra.location.lower }}. You are the LIC, as the assessor. Pick the LICOM from the BCM Tools users.
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
                <span
                  v-if="ra[member].hint"
                  class="block text-xs font-normal text-muted"
                >{{ ra[member].hint }}</span>
              </legend>
              <RaTeamMember
                v-model:user-id="state[`${member}_user_id`]"
                v-model:user="users[member]"
                v-model:phone="state[`${member}_phone`]"
                :member="member"
                :label="ra[member].label"
                :fixed="member === 'lic'"
              />
            </fieldset>
          </fieldset>
        </UCard>

        <div
          v-if="!newBuilding"
          class="flex justify-end gap-2"
        >
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

    <!-- Outside the form above: the building tabs have forms of their own. -->
    <section
      v-if="newBuilding"
      class="max-w-6xl space-y-4"
      aria-labelledby="new-building-heading"
    >
      <h2
        id="new-building-heading"
        class="text-lg font-semibold"
      >
        New {{ ra.location.lower }}
      </h2>
      <UTabs
        v-model="buildingTab"
        :items="buildingTabs"
        variant="link"
        :unmount-on-hide="false"
        :ui="{ content: 'pt-4' }"
      >
        <template #details>
          <RaLocationForm
            ref="locationForm"
            draft
            kind-locked
          />
        </template>
        <template #map>
          <RaLocationMapTab
            ref="mapTab"
            draft
            :location="mapLocation"
          />
        </template>
        <template #contacts>
          <RaContactsForm
            ref="contactsForm"
            draft
            :location="blankLocation"
          />
        </template>
        <template #occupants>
          <RaOccupantsTab
            draft
            :location="occupantsDraft"
            @saved="(next) => (occupantsDraft = next)"
          />
        </template>
        <template #team>
          <RaGroupedRowsForm
            ref="teamForm"
            draft
            :groups="RA_RECOVERY_TEAMS"
            group-key="team"
            :lead="RA_TEAM_LEAD"
            :fields="RA_TEAM_FIELDS"
            :initial="[]"
            item-label="member"
            save-label="Save recovery team"
            saved-message="Recovery team saved"
            error-title="Check the recovery team"
          />
        </template>
        <template #calltree>
          <RaGroupedRowsForm
            ref="callTreeForm"
            draft
            :groups="RA_CALL_TREE_GROUPS"
            group-key="level"
            :lead="RA_CALL_TREE_LEAD"
            :fields="RA_CALL_TREE_FIELDS"
            :initial="[]"
            item-label="contact"
            save-label="Save call tree"
            saved-message="Call tree saved"
            error-title="Check the call tree"
          />
        </template>
      </UTabs>
      <div class="flex justify-end gap-2">
        <UButton
          :to="raPath(ra.kind, 'manage')"
          color="neutral"
          variant="outline"
          label="Cancel"
        />
        <UButton
          label="Create assessment"
          :loading="submitting"
          @click="createWithBuilding"
        />
      </div>
    </section>
  </AppPage>
</template>
