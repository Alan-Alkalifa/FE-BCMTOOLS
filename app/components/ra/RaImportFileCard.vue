<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { RaImportOptions, RaImportPreview, RaImportResult, RaUserRef } from '~/composables/useRa'

/**
 * One workbook in Import from Excel (`RaImportModal`): it reads the file (the preview saves
 * nothing), shows the file name and template, the building (editable when new, read-only when
 * registered), the RA to create, what the file holds and what to check later. The modal's Import
 * button calls `check()` then `run()` on every card that is ready. The API checks everything
 * again.
 */
const props = defineProps<{
  file: File
  /** The type picked in the modal: a workbook of the other type can't be imported here. */
  kind: RaKind
  /** Another file in the list is for the same building and period. */
  duplicate?: string | null
}>()
const emit = defineEmits<{
  remove: []
  summary: [summary: { status: RaImportCardStatus, building: string | null, period: number | null }]
}>()

const { user, can } = useAuth()
const { data: profile } = useProfile()

const preview = ref<RaImportPreview | null>(null)
const readError = ref<string | null>(null)
const result = ref<RaImportResult | null>(null)
const formError = ref<string | null>(null)
const importing = ref(false)

const ra = computed(() => RA_MODULES[preview.value?.kind ?? props.kind])
const status = computed<RaImportCardStatus>(() => {
  if (result.value) return 'imported'
  if (importing.value) return 'importing'
  if (readError.value) return 'unreadable'
  if (!preview.value) return 'reading'
  if (preview.value.kind !== props.kind) return 'wrong_type'
  return formError.value ? 'failed' : 'ready'
})

onMounted(async () => {
  try {
    const found = await raApi.importPreview(props.file)
    preview.value = found
    reset(found)
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    readError.value = details?.file ?? apiErrorMessage(failure)
  }
})

// --- the form -------------------------------------------------------------------------------

const existing = computed(() => preview.value?.existing ?? null)
/** A registered building's details are shown, not changed. */
const locked = computed(() => Boolean(existing.value))
/** The registered building's RA still in progress: no new RA until it is final (the API says
 *  the same), so only its profile can be updated. */
const openRa = computed(() => existing.value?.open_assessment ?? null)

const schema = computed(() => z.object({
  name: z.string(),
  address: z.string(),
  region: z.string(),
  area: z.string(),
  region_description: z.string(),
  province: z.string(),
  city: z.string(),
  district: z.string(),
  zip_code: z.string(),
  replace_profile: z.boolean(),
  create_assessment: z.boolean(),
  assessment_date: z.string(),
  reason: z.enum(['annual_review', 'new_building', 'structural_change']).optional(),
  due_date: z.string().nullable(),
  licom_user_id: z.number().nullable(),
  lic_phone: z.string(),
  licom_phone: z.string(),
}).superRefine((value, context) => {
  const need = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })
  if (!existing.value) {
    if (!value.name.trim()) need('name', `Enter the ${ra.value.location.lower} name.`)
    if (!value.address.trim()) need('address', 'Enter the address.')
    if (!value.province.trim()) need('province', 'Enter the province.')
    if (!value.city.trim()) need('city', 'Enter the city.')
    if (!value.district.trim()) need('district', 'Enter the district.')
    if (!/^[0-9A-Za-z -]{1,10}$/.test(value.zip_code.trim())) need('zip_code', 'Enter the zip code: digits and letters, at most 10.')
    if (value.region_description.trim().length > 255) need('region_description', 'At most 255 characters.')
    if (preview.value?.kind === 'branch' && fromDirectory.value) {
      const region = regionList.value.find((item) => item.region === value.region)
      if (!region) need('region', 'Choose the region.')
      else if (region.areas.length && !region.areas.some((item) => item.area === value.area)) need('area', 'Choose the area.')
    }
  }
  if (existing.value && !value.create_assessment && !value.replace_profile) {
    need('replace_profile', openRa.value ? 'Nothing to import yet. Turn on Update the profile.' : 'Nothing to import yet. Turn on Update the profile or Create a draft RA.')
  }
  if (!value.create_assessment) return
  if (!value.assessment_date) need('assessment_date', 'Enter the assessment date.')
  if (!value.licom_user_id) need('licom_user_id', 'Choose the LICOM.')
  for (const [field, label] of [['lic_phone', 'LIC'], ['licom_phone', 'LICOM']] as const) {
    const problem = value[field].trim() ? raPhoneProblem(value[field]) : `Enter the ${label} mobile number.`
    if (problem) need(field, problem)
  }
  const backYear = raNewBuildingDateProblem(value.reason, value.assessment_date)
  if (backYear) need('assessment_date', backYear)
  if (periodTaken.value) need('assessment_date', `${existing.value?.name} already has an RA for ${periodOf(value.assessment_date)}. Pick a date in another year, or turn off Create a draft RA.`)
  // A Structural change picks its renewal date, at most a year on (as New assessment).
  if (value.reason === RA_CUSTOM_DUE_REASON && value.assessment_date) {
    if (!value.due_date) need('due_date', 'Enter the renewal date. It can be sooner than one year.')
    else if (value.due_date < value.assessment_date) need('due_date', 'Cannot be before the assessment date.')
    else if (value.due_date > parseDate(value.assessment_date).add({ years: 1 }).toString()) need('due_date', 'Cannot be later than one year after the assessment date.')
  }
}))

type State = z.infer<typeof schema.value>
const state = reactive<State>({
  name: '',
  address: '',
  region: '',
  area: '',
  region_description: '',
  province: '',
  city: '',
  district: '',
  zip_code: '',
  replace_profile: false,
  create_assessment: true,
  assessment_date: '',
  reason: undefined,
  due_date: null,
  licom_user_id: null,
  lic_phone: '',
  licom_phone: '',
})
const licUser = ref<RaUserRef | null>(null)
/** The LIC is the person who imports (the assessor): shown, not picked. */
const licUserId = computed<number | null>({ get: () => licUser.value?.id ?? null, set: () => {} })
const licomUser = ref<RaUserRef | null>(null)
watch(() => user.value, (me) => {
  licUser.value = me ? { id: me.id, name: me.name, email: me.email, job_title: me.job_title } : null
}, { immediate: true })
// The profile may load after the file is read: its mobile then fills an empty LIC number.
watch(() => profile.value?.mobile_phone, (mobile) => {
  if (preview.value && !state.lic_phone.trim() && raPhoneOrEmpty(mobile)) state.lic_phone = raPhoneOrEmpty(mobile)
})

/** A new branch takes its region and area from the region directory once it has regions. */
const { data: directory } = useRaRegionDirectory()
const regionList = computed(() => directory.value?.items ?? [])
const fromDirectory = computed(() => regionList.value.length > 0)
const regionItems = computed(() => regionList.value.map((item) => ({ label: item.region, value: item.region, description: item.head ?? undefined })))
const areaItems = computed(() => (regionList.value.find((item) => item.region === state.region)?.areas ?? [])
  .map((item) => ({ label: item.area, value: item.area, description: item.head ?? undefined })))
watch(() => state.region, () => {
  if (!areaItems.value.some((item) => item.value === state.area)) state.area = ''
})

function toRef(person: { id: number, display_name: string | null, email: string | null, mobile_phone: string | null } | null): RaUserRef | null {
  return person ? { id: person.id, name: person.display_name, email: person.email, job_title: null, mobile_phone: person.mobile_phone } : null
}

function reset(found: RaImportPreview) {
  const registered = found.existing
  Object.assign(state, {
    // A registered building shows its own details; a new one the workbook's.
    name: registered?.name ?? found.location.name ?? '',
    address: registered ? registered.address ?? '' : found.location.address ?? '',
    region: registered ? registered.region ?? '' : found.location.region_match ?? (fromDirectory.value ? '' : found.location.region ?? ''),
    area: registered?.area ?? '',
    region_description: registered ? registered.region_description ?? '' : found.kind === 'branch' ? found.location.region ?? '' : '',
    province: registered?.province ?? '',
    city: registered?.city ?? '',
    district: registered?.district ?? '',
    zip_code: registered ? registered.zip_code ?? '' : found.location.zip_code ?? '',
    replace_profile: false,
    create_assessment: !registered?.open_assessment,
    assessment_date: found.assessment_date ?? raTodayIso(),
    reason: undefined,
    due_date: null,
    licom_user_id: found.licom?.user?.id ?? null,
    // Only phone numbers are prefilled: a profile's "-" leaves the field to fill in.
    lic_phone: raPhoneOrEmpty(found.lic?.is_me ? found.lic.phone : null) || raPhoneOrEmpty(profile.value?.mobile_phone),
    licom_phone: raPhoneOrEmpty(found.licom?.phone) || raPhoneOrEmpty(found.licom?.user?.mobile_phone),
  })
  licomUser.value = toRef(found.licom?.user ?? null)
  nextTick(fitReason)
}

function periodOf(value: string) {
  return value ? Number(value.slice(0, 4)) : null
}

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
const dueMin = computed(() => state.assessment_date ? parseDate(state.assessment_date) : undefined)
const dueMax = computed(() => state.assessment_date ? parseDate(state.assessment_date).add({ years: 1 }) : undefined)
const yearStart = computed(() => parseDate(`${raTodayIso().slice(0, 4)}-01-01`))

/** One RA per building per period; a Structural change may follow once that RA is final. */
const periodTaken = computed(() => Boolean(existing.value?.has_period && periodOf(state.assessment_date) === preview.value?.period_year && state.reason !== RA_CUSTOM_DUE_REASON))

/** The reasons that fit (the API checks the same): a first RA is New building. */
const reasonItems = computed(() => {
  const target = existing.value
  const values: RaReason[] = !target ? ['new_building'] : target.has_final ? ['annual_review', 'structural_change'] : ['new_building']
  return RA_REASONS.filter((item) => values.includes(item.value)).map((item) => ({ label: item.label, value: item.value, description: item.description }))
})
function fitReason() {
  const items = reasonItems.value
  if (!items.some((item) => item.value === state.reason)) state.reason = items[0]?.value
}
watch(reasonItems, fitReason, { immediate: true })
watch(() => state.reason, (reason) => {
  if (reason !== RA_CUSTOM_DUE_REASON) state.due_date = null
})

watch([status, () => state.name, () => state.assessment_date, () => state.create_assessment], () => {
  emit('summary', {
    status: status.value,
    building: existing.value ? `id:${existing.value.id}` : state.name.trim().toLowerCase() || null,
    period: state.create_assessment ? periodOf(state.assessment_date) : null,
  })
}, { immediate: true })

// --- what the file holds --------------------------------------------------------------------

const employees = computed(() => (preview.value?.occupants ?? []).reduce((sum, unit) => sum + (unit.employee_count ?? 0), 0))
const values = computed(() => {
  const found = preview.value
  if (!found) return []
  const count = (n: number, one: string, many: string) => `${formatNumber(n, 0)} ${n === 1 ? one : many}`
  const items = [{ key: 'contacts', icon: 'i-lucide-phone', text: count(found.contacts.length, 'emergency contact', 'emergency contacts') }]
  if (found.kind === 'head_office') {
    items.push(
      { key: 'employees', icon: 'i-lucide-users', text: count(employees.value, 'employee', 'employees') },
      { key: 'recovery_team', icon: 'i-lucide-life-buoy', text: count(found.recovery_team.length, 'recovery team member', 'recovery team members') },
      { key: 'call_tree', icon: 'i-lucide-network', text: count(found.call_tree.length, 'call tree contact', 'call tree contacts') },
    )
  }
  items.push({ key: 'hazards', icon: 'i-lucide-list-checks', text: `${found.ratings.rated} of ${found.ratings.total} hazards rated` })
  return items
})
const levels: RaLevel[] = ['High', 'Medium', 'Low']
const showAllNotes = ref(false)
const notes = computed(() => {
  const all = preview.value?.warnings ?? []
  return showAllNotes.value ? all : all.slice(0, 4)
})

// --- import ---------------------------------------------------------------------------------

const form = useTemplateRef<{ validate: (options?: { silent?: boolean }) => Promise<unknown>, setErrors: (errors: { name: string, message: string }[]) => void }>('form')
const PREFIXES = ['location.', 'assessment.']

/** Validate the form (showing its messages). False when the card can't be imported now. */
async function check(): Promise<boolean> {
  if (status.value !== 'ready' && status.value !== 'failed') return false
  if (props.duplicate) return false
  formError.value = null
  try {
    await form.value?.validate()
    return true
  } catch {
    formError.value = 'Some fields need attention.'
    return false
  }
}

function options(): RaImportOptions {
  const found = preview.value!
  const chosen: RaImportOptions = {}
  if (found.existing) {
    chosen.location_id = found.existing.id
    chosen.replace_profile = state.replace_profile
  } else {
    chosen.location = {
      name: state.name.trim(),
      address: state.address.trim(),
      province: state.province.trim(),
      city: state.city.trim(),
      district: state.district.trim(),
      zip_code: state.zip_code.trim(),
      ...(found.kind === 'branch'
        ? {
            ...(state.region.trim() ? { region: state.region.trim() } : {}),
            ...(state.area.trim() ? { area: state.area.trim() } : {}),
            region_description: state.region_description.trim(),
          }
        : {}),
    }
  }
  if (state.create_assessment) {
    chosen.assessment = {
      period_year: periodOf(state.assessment_date)!,
      assessment_date: state.assessment_date,
      licom_user_id: state.licom_user_id!,
      lic_phone: state.lic_phone.trim(),
      licom_phone: state.licom_phone.trim(),
      ...(state.reason ? { reason: state.reason } : {}),
      ...(state.reason === RA_CUSTOM_DUE_REASON && state.due_date ? { due_date: state.due_date } : {}),
    }
  }
  return chosen
}

/** Import this file (after `check()`). The result, or null with the API's messages shown. */
async function run(): Promise<RaImportResult | null> {
  importing.value = true
  formError.value = null
  try {
    result.value = await raApi.importWorkbook(props.file, options())
    return result.value
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    if (details) {
      const fields: { name: string, message: string }[] = []
      const rest: string[] = []
      for (const [key, message] of Object.entries(details)) {
        const prefix = PREFIXES.find((item) => key.startsWith(item))
        const name = prefix ? key.slice(prefix.length) : key
        if (prefix && name in state) fields.push({ name: name === 'period_year' ? 'assessment_date' : name, message })
        else rest.push(message)
      }
      form.value?.setErrors(fields)
      formError.value = rest.length ? rest.join(' ') : 'Some fields need attention.'
    } else {
      formError.value = apiErrorMessage(failure)
    }
    return null
  } finally {
    importing.value = false
  }
}

defineExpose({ check, run, status })

const badge = computed(() => ({
  reading: { label: 'Reading', color: 'neutral', icon: 'i-lucide-loader-circle' },
  unreadable: { label: 'Can\'t import', color: 'error', icon: 'i-lucide-circle-x' },
  wrong_type: { label: 'Wrong type', color: 'error', icon: 'i-lucide-circle-x' },
  ready: { label: props.duplicate ? 'Duplicate' : 'Ready', color: props.duplicate ? 'error' : 'success', icon: props.duplicate ? 'i-lucide-copy' : 'i-lucide-circle-check' },
  importing: { label: 'Importing', color: 'info', icon: 'i-lucide-loader-circle' },
  imported: { label: 'Imported', color: 'success', icon: 'i-lucide-badge-check' },
  failed: { label: 'Check details', color: 'warning', icon: 'i-lucide-triangle-alert' },
} as const)[status.value])
const otherType = computed(() => RA_MODULES[preview.value?.kind === 'branch' ? 'branch' : 'head_office'].title)
</script>

<template>
  <UCard
    :ui="{ body: 'space-y-5' }"
    :data-file="file.name"
  >
    <template #header>
      <div class="flex flex-wrap items-start gap-3">
        <UIcon
          name="i-lucide-file-spreadsheet"
          class="mt-0.5 size-6 shrink-0 text-success"
        />
        <dl class="min-w-0 flex-1 text-sm">
          <dt class="sr-only">
            File
          </dt>
          <dd class="truncate font-semibold text-highlighted">
            {{ file.name }}
          </dd>
          <dt class="sr-only">
            Template
          </dt>
          <dd class="text-muted">
            {{ preview ? preview.template : 'Reading the file…' }}
          </dd>
        </dl>
        <UBadge
          :color="badge.color"
          variant="subtle"
          :icon="badge.icon"
          :label="badge.label"
          :ui="{ leadingIcon: status === 'reading' || status === 'importing' ? 'animate-spin' : '' }"
        />
        <UTooltip
          v-if="status !== 'imported' && status !== 'importing'"
          text="Remove this file"
        >
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            :aria-label="`Remove ${file.name}`"
            @click="emit('remove')"
          />
        </UTooltip>
      </div>
    </template>

    <UAlert
      v-if="readError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="This file can't be imported"
      :description="readError"
    />
    <UAlert
      v-else-if="status === 'wrong_type'"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="`This is an ${otherType} workbook`"
      :description="`Choose ${otherType} above, or remove this file.`"
    />
    <div
      v-else-if="!preview"
      class="space-y-2"
    >
      <USkeleton class="h-4 w-1/2" />
      <USkeleton class="h-4 w-1/3" />
    </div>

    <UAlert
      v-else-if="result"
      color="success"
      variant="subtle"
      icon="i-lucide-badge-check"
      :title="result.assessment ? `${result.assessment.ref_no} created for ${result.location.name}` : `${result.location.name} imported`"
      :description="result.location.created ? `New ${ra.location.lower} ${result.location.code}. It waits for approval.` : `Added to ${result.location.code}.`"
    >
      <template #actions>
        <UButton
          v-if="result.assessment"
          size="sm"
          color="neutral"
          variant="outline"
          label="Open RA"
          :to="raPath(result.assessment.kind, 'manage', result.assessment.id)"
        />
        <UButton
          v-if="can('location.master')"
          size="sm"
          color="neutral"
          variant="ghost"
          :label="`Open ${ra.location.lower}`"
          :to="masterBuildingPath(result.location.id)"
        />
      </template>
    </UAlert>

    <UForm
      v-else
      ref="form"
      :schema="schema"
      :state="state"
      :validate-on="['change']"
      class="space-y-5"
    >
      <UAlert
        v-if="duplicate"
        color="error"
        variant="subtle"
        icon="i-lucide-copy"
        :title="duplicate"
      />
      <UAlert
        v-if="formError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="formError"
      />

      <!-- Building: the workbook's when new, the registered one's (read-only) when known. -->
      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="font-semibold">
            {{ ra.location.single }}
          </h3>
          <UBadge
            :color="existing ? 'info' : 'neutral'"
            variant="subtle"
            :label="existing ? `Registered · ${existing.code}` : 'New'"
          />
        </div>
        <p class="text-sm text-muted">
          {{ existing
            ? `Already registered. Its details can't be changed here.`
            : `Not registered yet. Check the details from the file. It will wait for approval.` }}
        </p>
        <fieldset
          :disabled="Boolean(existing)"
          class="grid gap-4 sm:grid-cols-2"
        >
          <legend class="sr-only">
            {{ ra.location.single }} details
          </legend>
          <UFormField
            :label="`${ra.location.single} name`"
            name="name"
            required
            class="sm:col-span-2"
          >
            <UInput
              v-model="state.name"
              :disabled="locked"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Address"
            name="address"
            required
            class="sm:col-span-2"
          >
            <UTextarea
              v-model="state.address"
              :disabled="locked"
              :rows="2"
              autoresize
              class="w-full"
            />
          </UFormField>
          <template v-if="preview.kind === 'branch'">
            <UFormField
              label="Region Description"
              name="region_description"
              class="sm:col-span-2"
            >
              <UInput
                v-model="state.region_description"
                :disabled="locked"
                class="w-full"
              />
            </UFormField>
            <template v-if="fromDirectory && !existing">
              <UFormField
                label="Region"
                name="region"
                required
              >
                <USelectMenu
                  v-model="state.region"
                  value-key="value"
                  :items="regionItems"
                  placeholder="Choose the region"
                  class="w-full"
                  aria-label="Region"
                />
              </UFormField>
              <UFormField
                label="Area"
                name="area"
                :required="areaItems.length > 0"
              >
                <USelectMenu
                  v-model="state.area"
                  value-key="value"
                  :items="areaItems"
                  :disabled="!areaItems.length"
                  placeholder="Choose the area"
                  class="w-full"
                  aria-label="Area"
                />
              </UFormField>
            </template>
            <template v-else>
              <UFormField
                label="Region"
                name="region"
              >
                <UInput
                  v-model="state.region"
                  :disabled="locked"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                v-if="existing"
                label="Area"
                name="area"
              >
                <UInput
                  v-model="state.area"
                  :disabled="locked"
                  class="w-full"
                />
              </UFormField>
            </template>
          </template>
          <UFormField
            label="Province"
            name="province"
            required
          >
            <UInput
              v-model="state.province"
              :disabled="locked"
              placeholder="e.g. Banten"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="City"
            name="city"
            required
          >
            <UInput
              v-model="state.city"
              :disabled="locked"
              placeholder="e.g. Tangerang Selatan"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="District"
            name="district"
            required
          >
            <UInput
              v-model="state.district"
              :disabled="locked"
              placeholder="e.g. Pondok Aren"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Zip code"
            name="zip_code"
            required
          >
            <UInput
              v-model="state.zip_code"
              :disabled="locked"
              inputmode="numeric"
              placeholder="e.g. 15224"
              class="w-full"
            />
          </UFormField>
        </fieldset>
        <UFormField
          v-if="existing"
          name="replace_profile"
        >
          <USwitch
            v-model="state.replace_profile"
            label="Update the profile"
            description="Update its contacts, occupants, recovery team and call tree."
          />
        </UFormField>
      </section>

      <USeparator />

      <!-- The RA to create. -->
      <section class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="font-semibold">
            Assessment
          </h3>
          <USwitch
            v-model="state.create_assessment"
            label="Create a draft RA"
            :disabled="Boolean(openRa)"
          />
        </div>
        <UAlert
          v-if="openRa"
          color="neutral"
          variant="subtle"
          icon="i-lucide-file-clock"
          title="An RA is already in progress"
          :description="`${openRa.ref_no ?? 'Its RA'} (${raStatus[raStatusKey(openRa)]?.label ?? openRa.status}, ${openRa.period_year}) must be final before a new RA can be made. Only the profile can be updated.`"
          :actions="[{ label: 'Open RA', to: raRecordPath(openRa.kind, openRa), target: '_blank', color: 'neutral', variant: 'outline', size: 'sm', trailingIcon: 'i-lucide-external-link' }]"
        />
        <template v-if="state.create_assessment">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Reason for assessment"
              name="reason"
            >
              <USelect
                v-model="state.reason"
                :items="reasonItems"
                :disabled="reasonItems.length < 2"
                class="w-full"
                aria-label="Reason for assessment"
              />
            </UFormField>
            <UFormField
              label="Assessment date"
              name="assessment_date"
              required
              :help="periodOf(state.assessment_date) ? `RA period ${periodOf(state.assessment_date)}.` : undefined"
            >
              <DatePicker
                v-model="assessmentDate"
                :min="state.reason === 'new_building' ? yearStart : undefined"
              />
            </UFormField>
            <UFormField
              v-if="state.reason === RA_CUSTOM_DUE_REASON"
              label="Renewal date"
              name="due_date"
              required
              help="At most one year after the assessment date."
            >
              <DatePicker
                v-model="dueDate"
                :min="dueMin"
                :max="dueMax"
              />
            </UFormField>
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            <fieldset class="space-y-2">
              <legend class="mb-2 text-sm font-medium">
                {{ ra.lic.label }}
              </legend>
              <RaTeamMember
                v-model:user-id="licUserId"
                v-model:user="licUser"
                v-model:phone="state.lic_phone"
                member="lic"
                :label="ra.lic.label"
                :hint="preview.lic?.name && !preview.lic.is_me ? `The file names ${preview.lic.name}. You are the LIC.` : 'You, as the assessor.'"
                fixed
              />
            </fieldset>
            <fieldset class="space-y-2">
              <legend class="mb-2 text-sm font-medium">
                {{ ra.licom.label }}
              </legend>
              <RaTeamMember
                v-model:user-id="state.licom_user_id"
                v-model:user="licomUser"
                v-model:phone="state.licom_phone"
                member="licom"
                :label="ra.licom.label"
                :hint="preview.licom?.name ? (preview.licom.user ? `The file names ${preview.licom.name}. Check this user.` : `The file names ${preview.licom.name}. Pick the user.`) : undefined"
              />
            </fieldset>
          </div>
        </template>
        <p
          v-else-if="!openRa"
          class="text-sm text-muted"
        >
          Only the {{ ra.location.lower }} {{ existing ? 'profile' : 'and its profile' }} will be imported.
        </p>
      </section>

      <USeparator />

      <!-- What the file holds. -->
      <section class="space-y-3">
        <h3 class="font-semibold">
          Values
        </h3>
        <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="item in values"
            :key="item.key"
            class="flex items-center gap-2 rounded-md border border-default px-3 py-2 text-sm"
          >
            <UIcon
              :name="item.icon"
              class="size-4 shrink-0 text-muted"
            />
            <span>{{ item.text }}</span>
          </li>
        </ul>
        <div
          v-if="levels.some((level) => preview!.ratings.counts.residual[level])"
          class="flex flex-wrap items-center gap-2 text-sm"
        >
          <span class="text-muted">Residual risk:</span>
          <template
            v-for="level in levels"
            :key="level"
          >
            <span
              v-if="preview.ratings.counts.residual[level]"
              class="inline-flex items-center gap-1"
            >
              <StatusBadge
                :scale="raRiskLevel"
                :value="level"
                size="sm"
              />
              <span class="tabular-nums">{{ preview.ratings.counts.residual[level] }}</span>
            </span>
          </template>
        </div>
      </section>

      <!-- What to check after import. -->
      <section
        v-if="preview.warnings.length"
        class="space-y-2"
      >
        <div class="flex items-center gap-2">
          <h3 class="font-semibold">
            Check after import
          </h3>
          <UBadge
            color="warning"
            variant="subtle"
            :label="String(preview.warnings.length)"
          />
        </div>
        <p class="text-sm text-muted">
          These are imported as shown. You can fix them later on the {{ ra.location.lower }} page.
        </p>
        <ul
          class="space-y-2 text-sm"
          aria-label="Check after import"
        >
          <li
            v-for="(note, index) in notes"
            :key="index"
            class="flex gap-2"
          >
            <UIcon
              name="i-lucide-triangle-alert"
              class="mt-0.5 size-4 shrink-0 text-warning"
            />
            <div class="min-w-0">
              <p class="text-xs text-muted">
                {{ note.sheet }}{{ note.cell ? ` · ${note.cell}` : '' }}
              </p>
              <p>{{ note.message }}</p>
            </div>
          </li>
        </ul>
        <UButton
          v-if="preview.warnings.length > 4"
          color="neutral"
          variant="link"
          size="sm"
          :label="showAllNotes ? 'Show fewer' : `Show all ${preview.warnings.length}`"
          @click="showAllNotes = !showAllNotes"
        />
      </section>
    </UForm>
  </UCard>
</template>
