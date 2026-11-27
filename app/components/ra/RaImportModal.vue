<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { RaImportOptions, RaImportPreview, RaImportResult, RaLocation, RaNetworkRegion, RaUserRef } from '~/composables/useRa'

/**
 * Import from Excel: one building's RA from one filled-in workbook, in the module it is opened
 * from (RA HO › New assessment takes the HO workbook, RA Branch › New assessment the Cabang
 * one), as SCCA's Upload Excel.
 * 1. What is assessed. The reason, then
 *    - New building: the building's details, filled in from the workbook where it has them,
 *    - Annual review or Structural change: the registered building it renews (only those the
 *      reason and the access scope fit), and whether its profile is updated from the file,
 *    and the assessment date, the renewal due date (Structural change), the LIC (the importer) and
 *    the LICOM.
 * 2. The empty template to fill in.
 * 3. The filled workbook. The preview shows what it holds, what to fix and what to check,
 *    saving nothing. A workbook with errors (a required input missing or unreadable, as SCCA's)
 *    can't be imported until it is fixed and chosen again.
 * Import creates the draft RA (and a new building, which waits for approval). The API checks
 * everything again. Several workbooks at once go through Administration › RA migration.
 */
const props = defineProps<{ kind: RaKind }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ imported: [result: RaImportResult] }>()

const toast = useToast()
const { user, can } = useAuth()
/** The importer's mobile (the LIC's number), read when the dialog opens. */
const profileMobile = ref<string | null>(null)
watch(open, async (isOpen) => {
  if (!isOpen || profileMobile.value !== null) return
  try {
    profileMobile.value = (await $fetch<{ mobile_phone: string | null }>('/api/me/profile')).mobile_phone ?? ''
  } catch {
    profileMobile.value = ''
  }
}, { immediate: true })

const MAX_BYTES = 10 * 1024 * 1024
const chosenKind = computed<RaKind>(() => props.kind)
const ra = computed(() => RA_MODULES[chosenKind.value])
const { data: formula } = useRaFormula(() => chosenKind.value)
const renewalMonths = computed(() => formula.value?.renewal_months ?? 12)
const renewalPeriod = computed(() => raRenewalPeriod(renewalMonths.value))

// --- the form ---------------------------------------------------------------------------------

const newBuilding = computed(() => state.reason === 'new_building')
const renews = computed(() => state.reason === 'annual_review' || state.reason === 'structural_change')
const standardRenewal = computed(() => state.reason === 'new_building' || state.reason === 'annual_review')

const schema = computed(() => z.object({
  reason: z.enum(['annual_review', 'new_building', 'structural_change'], 'Choose the reason for assessment.'),
  location_id: z.number().optional(),
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
  assessment_date: z.string(),
  due_date: z.string().nullable(),
  licom_user_id: z.number().nullable(),
  lic_phone: z.string(),
  licom_phone: z.string(),
}).superRefine((value, context) => {
  const need = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })
  if (value.reason === 'new_building' && !registered.value) {
    if (!value.name.trim()) need('name', `Enter the ${ra.value.location.lower} name.`)
    if (!value.address.trim()) need('address', 'Enter the address.')
    if (!value.province.trim()) need('province', 'Enter the province.')
    if (!value.city.trim()) need('city', 'Enter the city.')
    if (!value.district.trim()) need('district', 'Enter the district.')
    if (!/^[0-9A-Za-z -]{1,10}$/.test(value.zip_code.trim())) need('zip_code', 'Enter the zip code: digits and letters, at most 10.')
    if (value.region_description.trim().length > 255) need('region_description', 'At most 255 characters.')
    if (chosenKind.value === 'branch' && fromDirectory.value) {
      const region = regionList.value.find((item) => item.region === value.region)
      if (!region) need('region', 'Choose the region.')
      else if (region.areas.length && !region.areas.some((item) => raNetworkAreaName(item) === value.area)) need('area', 'Choose the area.')
    }
  }
  if (value.reason !== 'new_building' && !value.location_id) need('location_id', `Choose the ${ra.value.location.lower}.`)
  if (!value.assessment_date) need('assessment_date', 'Enter the assessment date.')
  if (!value.licom_user_id) need('licom_user_id', `Choose the ${ra.value.licom.short}.`)
  for (const [field, label] of [['lic_phone', ra.value.lic.short], ['licom_phone', ra.value.licom.short]] as const) {
    const problem = value[field].trim() ? raPhoneProblem(value[field]) : `Enter the ${label} mobile number.`
    if (problem) need(field, problem)
  }
  const backYear = raNewBuildingDateProblem(value.reason, value.assessment_date)
  if (backYear) need('assessment_date', backYear)
  // A Structural change picks its renewal date, at most one renewal period on.
  if (value.reason === RA_CUSTOM_DUE_REASON && value.assessment_date) {
    if (!value.due_date) need('due_date', `Enter the renewal due date. It can be sooner than ${renewalPeriod.value}.`)
    else if (value.due_date < value.assessment_date) need('due_date', 'Cannot be before the assessment date.')
    else if (value.due_date > parseDate(value.assessment_date).add({ months: renewalMonths.value }).toString()) need('due_date', `Cannot be later than ${renewalPeriod.value} after the assessment date.`)
  }
}))

type State = z.infer<typeof schema.value>
const blank = (): State => ({
  reason: undefined as unknown as State['reason'],
  location_id: undefined,
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
  assessment_date: raTodayIso(),
  due_date: null,
  licom_user_id: null,
  lic_phone: '',
  licom_phone: '',
})
const state = reactive<State>(blank())
const reasonItems = RA_REASONS.map((item) => ({ label: item.label, value: item.value, description: item.description }))

const licUser = ref<RaUserRef | null>(null)
/** The LIC is the person who imports (the assessor): shown, not picked. */
const licUserId = computed<number | null>({ get: () => licUser.value?.id ?? null, set: () => {} })
const licomUser = ref<RaUserRef | null>(null)
watch(() => user.value, (me) => {
  licUser.value = me ? { id: me.id, name: me.name, email: me.email, job_title: me.job_title } : null
}, { immediate: true })
watch(profileMobile, (mobile) => {
  if (!state.lic_phone.trim() && raPhoneOrEmpty(mobile)) state.lic_phone = raPhoneOrEmpty(mobile)
}, { immediate: true })

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
const dueMax = computed(() => state.assessment_date ? parseDate(state.assessment_date).add({ months: renewalMonths.value }) : undefined)
const standardDueDate = computed(() => state.assessment_date
  ? parseDate(state.assessment_date).add({ months: renewalMonths.value })
  : undefined)
const yearStart = computed(() => parseDate(`${raTodayIso().slice(0, 4)}-01-01`))
const period = computed(() => (state.assessment_date ? Number(state.assessment_date.slice(0, 4)) : null))

/** A new branch takes its region and area from the region directory once it has regions. Read
 *  when the dialog needs it, not with the page. */
const regionList = ref<RaNetworkRegion[]>([])
watch(() => open.value && chosenKind.value === 'branch' && state.reason === 'new_building', async (needed) => {
  if (!needed || regionList.value.length) return
  try {
    regionList.value = (await $fetch<{ items: RaNetworkRegion[] }>('/api/ra/regions')).items
  } catch {
    regionList.value = []
  }
}, { immediate: true })
const fromDirectory = computed(() => regionList.value.length > 0)
const regionItems = computed(() => regionList.value.map((item) => ({ label: item.region, value: item.region })))
const areaItems = computed(() => (regionList.value.find((item) => item.region === state.region)?.areas ?? [])
  .flatMap((item) => {
    const name = raNetworkAreaName(item)
    return name ? [{ label: name, value: name, description: raNetworkAreaDescription(item) }] : []
  }))
watch(() => state.region, () => {
  if (!areaItems.value.some((item) => item.value === state.area)) state.area = ''
})

// --- the registered building an Annual review or a Structural change renews --------------------

const locations = ref<RaLocation[]>([])
/** Outside BCM, only the buildings an access rule opens (RA configuration > Access scope).
 *  Null: every building. */
const scopedIds = ref<Set<number> | null>(null)
/** Why a building with a final RA can't take the reason (another RA of it is open, a
 *  Structural change while its renewal is overdue). */
const problems = ref<Record<string, string>>({})
watch(() => [open.value, state.reason, chosenKind.value] as const, async ([isOpen, reason, kind]) => {
  scopedIds.value = null
  problems.value = {}
  if (!isOpen || (reason !== 'annual_review' && reason !== 'structural_change')) return
  try {
    const [list, scope] = await Promise.all([
      $fetch<{ items: RaLocation[] }>('/api/ra/locations', { query: { kind, assessable: true } }),
      raApi.locationScope(kind, reason).catch(() => ({ all: true, ids: [], problems: {} })),
    ])
    if (state.reason !== reason || chosenKind.value !== kind) return
    locations.value = list.items
    scopedIds.value = scope.all ? null : new Set(scope.ids)
    problems.value = scope.problems ?? {}
  } catch {
    locations.value = []
  }
}, { immediate: true })
const candidates = computed<RaLocation[]>(() => locations.value
  .filter((location) => Boolean(location.final_assessment) && (!scopedIds.value || scopedIds.value.has(location.id))))
const locationItems = computed(() => candidates.value.map((location) => {
  const problem = problems.value[String(location.id)]
  const about = [location.code, ra.value.hasRegion ? location.region : location.address].filter(Boolean).join(' · ')
  return {
    label: location.name,
    value: location.id,
    description: problem ? [location.code, problem].filter(Boolean).join(' · ') : about || undefined,
    disabled: Boolean(problem) && location.id !== state.location_id,
  }
}))
const picked = computed(() => candidates.value.find((location) => location.id === state.location_id) ?? null)
const pickedProblem = computed(() => (state.location_id ? problems.value[String(state.location_id)] ?? null : null))
const locationHelp = computed(() => {
  const { lower, lowerPlural } = ra.value.location
  const scoped = scopedIds.value ? ` Only the ${lowerPlural} your access scope opens.` : ''
  if (state.reason === 'structural_change') return `The ${lower} that changed: one with a final RA, while no other RA of it is open and its renewal isn't overdue.${scoped}`
  return `Only ${lowerPlural} with a final RA to renew, while no other RA of it is open.${scoped}`
})

// --- the workbook ------------------------------------------------------------------------------

const file = ref<File | null>(null)
const preview = ref<RaImportPreview | null>(null)
const readError = ref<string | null>(null)
const reading = ref(false)
const importing = ref(false)
const result = ref<RaImportResult | null>(null)
const formError = ref<string | null>(null)
const wrongType = computed(() => Boolean(preview.value && preview.value.kind !== chosenKind.value))
const otherType = computed(() => RA_MODULES[preview.value?.kind === 'branch' ? 'branch' : 'head_office'].title)

/** New building: the workbook's building is already registered under that name. Without any RA
 *  it is used (its RA is its first); with a final RA or an open one it can't be a new building. */
const sameName = computed(() => {
  const found = preview.value?.existing
  return found && found.name.trim().toLowerCase() === state.name.trim().toLowerCase() ? found : null
})
const registered = computed(() => (newBuilding.value && sameName.value && !sameName.value.has_final && !sameName.value.open_assessment ? sameName.value : null))
const blocked = computed(() => {
  const found = sameName.value
  if (!newBuilding.value || !found) return null
  if (found.open_assessment) return `${found.name} (${found.code}) already has an RA in progress (${found.open_assessment.ref_no ?? found.open_assessment.period_year}). It must be final before a new RA can be made.`
  if (found.has_final) return `${found.name} (${found.code}) is already registered with a final RA. Choose Annual review or Structural change.`
  return null
})
/** Annual review or Structural change: the workbook names another building than the one picked. */
const otherName = computed(() => {
  const named = preview.value?.location.name
  if (!renews.value || !picked.value || !named) return null
  return named.trim().toLowerCase() === picked.value.name.trim().toLowerCase() ? null : named
})

const input = useTemplateRef<HTMLInputElement>('input')
const dragDepth = ref(0)
const dragging = computed(() => dragDepth.value > 0)

function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  const chosen = target.files?.[0]
  target.value = ''
  if (chosen) read(chosen)
}
function onDrop(event: DragEvent) {
  dragDepth.value = 0
  const chosen = event.dataTransfer?.files?.[0]
  if (chosen && !importing.value) read(chosen)
}

async function read(chosen: File) {
  readError.value = null
  formError.value = null
  if (!chosen.name.toLowerCase().endsWith('.xlsx')) {
    readError.value = `${chosen.name}: use an .xlsx file. Save it as .xlsx in Excel first.`
    return
  }
  if (chosen.size > MAX_BYTES) {
    readError.value = `${chosen.name}: the file is larger than 10 MB.`
    return
  }
  file.value = chosen
  preview.value = null
  reading.value = true
  try {
    const found = await raApi.importPreview(chosen)
    if (file.value !== chosen) return
    preview.value = found
    fillFromFile(true)
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    readError.value = details?.file ?? apiErrorMessage(failure)
    file.value = null
  } finally {
    reading.value = false
  }
}

function toRef(person: { id: number, display_name: string | null, email: string | null, mobile_phone: string | null } | null): RaUserRef | null {
  return person ? { id: person.id, name: person.display_name, email: person.email, job_title: null, mobile_phone: person.mobile_phone } : null
}

/** Fill what is still empty from the workbook: the new building's details, the date, the LICOM
 *  and the phones; for a renewal, the building the workbook names when it can be picked. */
function fillFromFile(fresh = false) {
  const found = preview.value
  if (!found || wrongType.value) return
  if (newBuilding.value) {
    const fill = (key: 'name' | 'address' | 'zip_code' | 'region_description', value: string | null | undefined) => {
      if (!state[key].trim() && value) state[key] = value
    }
    fill('name', found.location.name)
    fill('address', found.location.address)
    fill('zip_code', found.location.zip_code)
    if (found.kind === 'branch') {
      fill('region_description', found.location.region)
      if (!state.region) state.region = found.location.region_match ?? (fromDirectory.value ? '' : found.location.region ?? '')
    }
  }
  if (renews.value && !state.location_id && found.existing) {
    const match = locationItems.value.find((item) => item.value === found.existing!.id && !item.disabled)
    if (match) state.location_id = match.value
  }
  if (fresh && found.assessment_date) state.assessment_date = found.assessment_date
  if (!state.licom_user_id && found.licom?.user) {
    state.licom_user_id = found.licom.user.id
    licomUser.value = toRef(found.licom.user)
  }
  if (!state.licom_phone.trim()) state.licom_phone = raPhoneOrEmpty(found.licom?.phone) || raPhoneOrEmpty(found.licom?.user?.mobile_phone)
  if (!state.lic_phone.trim()) state.lic_phone = raPhoneOrEmpty(found.lic?.is_me ? found.lic.phone : null) || raPhoneOrEmpty(profileMobile.value)
}

watch(() => state.reason, (reason, before) => {
  if (reason !== RA_CUSTOM_DUE_REASON) state.due_date = null
  if ((before === 'new_building') !== (reason === 'new_building')) state.location_id = undefined
  fillFromFile()
})
watch(locationItems, () => fillFromFile())
watch(chosenKind, () => {
  state.location_id = undefined
  state.region = ''
  state.area = ''
})

function reset() {
  Object.assign(state, blank())
  state.lic_phone = raPhoneOrEmpty(profileMobile.value)
  licomUser.value = null
  file.value = null
  preview.value = null
  readError.value = null
  formError.value = null
  result.value = null
}
watch(open, (isOpen) => {
  if (isOpen) reset()
}, { immediate: true })

/** What still has to be chosen before the import can run. */
const missing = computed(() => {
  if (!state.reason) return 'Choose the reason for assessment.'
  if (renews.value && !state.location_id) return `Choose the ${ra.value.location.lower}.`
  if (pickedProblem.value) return pickedProblem.value
  if (blocked.value) return blocked.value
  if (!file.value) return 'Choose the filled workbook.'
  if (preview.value && !preview.value.can_import) return 'Fix the workbook and choose it again.'
  return null
})

// --- import ------------------------------------------------------------------------------------

const form = useTemplateRef<{ validate: (options?: { silent?: boolean }) => Promise<unknown>, setErrors: (errors: { name: string, message: string }[]) => void }>('form')
const PREFIXES = ['location.', 'assessment.']

function options(): RaImportOptions {
  const chosen: RaImportOptions = {}
  if (renews.value || registered.value) {
    chosen.location_id = renews.value ? state.location_id! : registered.value!.id
    chosen.replace_profile = state.replace_profile
  } else {
    chosen.location = {
      name: state.name.trim(),
      address: state.address.trim(),
      province: state.province.trim(),
      city: state.city.trim(),
      district: state.district.trim(),
      zip_code: state.zip_code.trim(),
      ...(chosenKind.value === 'branch'
        ? {
            ...(state.region.trim() ? { region: state.region.trim() } : {}),
            ...(state.area.trim() ? { area: state.area.trim() } : {}),
            region_description: state.region_description.trim(),
          }
        : {}),
    }
  }
  chosen.assessment = {
    period_year: period.value!,
    assessment_date: state.assessment_date,
    reason: state.reason,
    licom_user_id: state.licom_user_id!,
    lic_phone: state.lic_phone.trim(),
    licom_phone: state.licom_phone.trim(),
    ...(state.reason === RA_CUSTOM_DUE_REASON && state.due_date ? { due_date: state.due_date } : {}),
  }
  return chosen
}

async function runImport() {
  if (!file.value || !preview.value || wrongType.value || missing.value) return
  formError.value = null
  try {
    await form.value?.validate()
  } catch {
    formError.value = 'Some fields need attention.'
    return
  }
  importing.value = true
  try {
    result.value = await raApi.importWorkbook(file.value, options())
    clearNuxtData((key) => key.startsWith('ra-'))
    emit('imported', result.value)
    toast.add({ title: result.value.assessment ? `${result.value.assessment.ref_no} created` : 'Imported', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    if (details) {
      const fields: { name: string, message: string }[] = []
      const rest: string[] = []
      for (const [key, message] of Object.entries(details)) {
        const prefix = PREFIXES.find((item) => key.startsWith(item))
        const name = prefix ? key.slice(prefix.length) : key
        const field = name === 'period_year' ? 'assessment_date' : name
        if (field in state) fields.push({ name: field, message })
        else rest.push(message)
      }
      form.value?.setErrors(fields)
      formError.value = rest.length ? rest.join(' ') : 'Some fields need attention.'
    } else {
      formError.value = apiErrorMessage(failure)
    }
  } finally {
    importing.value = false
  }
}

const downloading = ref(false)
async function downloadTemplate() {
  downloading.value = true
  try {
    await downloadRaImportTemplate(chosenKind.value)
  } catch (failure) {
    toast.add({ color: 'error', title: 'Couldn\'t download the template', description: apiErrorMessage(failure) })
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Import from Excel"
    :description="`Create an RA from the ${chosenKind === 'branch' ? 'Cabang' : 'HO'} workbook filled in Excel, one building per file.`"
    :dismissible="!importing"
    :ui="{ content: 'sm:max-w-4xl', body: 'space-y-6' }"
  >
    <template #body>
      <UAlert
        v-if="result"
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
            v-if="can('sites.master')"
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
        class="space-y-6"
      >
        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="formError"
        />

        <section class="space-y-4">
          <h3 class="text-sm font-semibold">
            1. What is assessed
          </h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Reason for assessment"
              name="reason"
              required
            >
              <USelect
                v-model="state.reason"
                :items="reasonItems"
                placeholder="Select a reason"
                class="w-full"
                aria-label="Reason for assessment"
              />
            </UFormField>
            <UFormField
              v-if="renews"
              :label="ra.location.single"
              name="location_id"
              required
              :help="locationHelp"
              class="sm:col-span-2"
            >
              <USelectMenu
                v-model="state.location_id"
                value-key="value"
                :items="locationItems"
                :placeholder="`Choose a ${ra.location.lower}`"
                class="w-full"
                :aria-label="ra.location.single"
              />
            </UFormField>
          </div>
          <UAlert
            v-if="pickedProblem"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="pickedProblem"
          />
          <UAlert
            v-if="otherName"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="`The workbook names ${otherName}`"
            :description="`Its values are imported into ${picked?.name}. Check this is the right file.`"
          />
          <UFormField
            v-if="renews && state.location_id"
            name="replace_profile"
          >
            <USwitch
              v-model="state.replace_profile"
              label="Update its profile from this file"
              description="Its emergency contacts, occupants, recovery team and call tree."
            />
          </UFormField>

          <!-- New building: its details, filled in from the workbook where it has them. -->
          <fieldset
            v-if="newBuilding"
            class="space-y-3"
          >
            <legend class="mb-2 font-medium">
              {{ ra.location.single }} details
            </legend>
            <UAlert
              v-if="blocked"
              color="error"
              variant="subtle"
              icon="i-lucide-circle-alert"
              :title="blocked"
            />
            <UAlert
              v-else-if="registered"
              color="info"
              variant="subtle"
              icon="i-lucide-building-2"
              :title="`${registered.name} is already registered (${registered.code})`"
              description="It has no RA yet, so this is its first. Its registered details are used."
            />
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                :label="`${ra.location.single} name`"
                name="name"
                required
                class="sm:col-span-2"
              >
                <UInput
                  v-model="state.name"
                  class="w-full"
                  :maxlength="TEXT_LIMITS.name"
                />
              </UFormField>
              <template v-if="!registered">
                <UFormField
                  label="Address"
                  name="address"
                  required
                  class="sm:col-span-2"
                >
                  <UTextarea
                    v-model="state.address"
                    :rows="2"
                    autoresize
                    class="w-full"
                  />
                </UFormField>
                <template v-if="chosenKind === 'branch'">
                  <UFormField
                    label="Region Description"
                    name="region_description"
                    class="sm:col-span-2"
                  >
                    <UInput
                      v-model="state.region_description"
                      class="w-full"
                    />
                  </UFormField>
                  <template v-if="fromDirectory">
                    <UFormField
                      label="Region (Sub-directorate)"
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
                      label="Area (Group)"
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
                  <UFormField
                    v-else
                    label="Region"
                    name="region"
                  >
                    <UInput
                      v-model="state.region"
                      class="w-full"
                    />
                  </UFormField>
                </template>
                <UFormField
                  label="Province"
                  name="province"
                  required
                >
                  <UInput
                    v-model="state.province"
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
                    inputmode="numeric"
                    placeholder="e.g. 15224"
                    class="w-full"
                  />
                </UFormField>
              </template>
              <UFormField
                v-else
                name="replace_profile"
                class="sm:col-span-2"
              >
                <USwitch
                  v-model="state.replace_profile"
                  label="Update its profile from this file"
                  description="Its emergency contacts, occupants, recovery team and call tree."
                />
              </UFormField>
            </div>
          </fieldset>

          <!-- The RA to create. -->
          <fieldset
            v-if="state.reason"
            class="space-y-3"
          >
            <legend class="mb-2 font-medium">
              Assessment
            </legend>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                label="Assessment date"
                name="assessment_date"
                required
                :help="period ? `RA period ${period}.` : undefined"
              >
                <DatePicker
                  v-model="assessmentDate"
                  :min="newBuilding ? yearStart : undefined"
                />
              </UFormField>
              <UFormField
                v-if="state.reason === RA_CUSTOM_DUE_REASON"
                label="Renewal due date"
                name="due_date"
                required
                :help="`At most ${renewalPeriod} after the assessment date.`"
              >
                <DatePicker
                  v-model="dueDate"
                  :min="dueMin"
                  :max="dueMax"
                />
              </UFormField>
              <UFormField
                v-else-if="standardRenewal && standardDueDate"
                label="Renewal due date"
                name="due_date"
                :help="`Renewal is due ${renewalPeriod} after the assessment date.`"
              >
                <template #label>
                  <span class="invisible">Renewal due date</span>
                </template>
                <div
                  class="h-9"
                  aria-hidden="true"
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
                  :short-label="ra.lic.short"
                  :phone-label="`${ra.lic.short} mobile number`"
                  :hint="preview?.lic?.name && !preview.lic.is_me ? `The file names ${preview.lic.name}. You are the ${ra.lic.short}.` : 'You, as the assessor.'"
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
                  :short-label="ra.licom.short"
                  :phone-label="`${ra.licom.short} mobile number`"
                  :hint="preview?.licom?.name ? (preview.licom.user ? `The file names ${preview.licom.name}. Check this user.` : `The file names ${preview.licom.name}. Pick the user.`) : undefined"
                />
              </fieldset>
            </div>
          </fieldset>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold">
            2. Fill in the template
          </h3>
          <p class="text-sm text-muted">
            Use the {{ chosenKind === 'branch' ? 'Cabang' : 'HO' }} workbook. Keep its sheets, rows and columns as they are.
          </p>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-download"
            label="Download template"
            :loading="downloading"
            @click="downloadTemplate"
          />
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold">
            3. Choose the filled workbook
          </h3>
          <input
            ref="input"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            class="sr-only"
            tabindex="-1"
            aria-label="Choose the RA workbook"
            @change="onFile"
          >
          <div
            data-testid="import-drop-zone"
            class="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-4 text-center transition-colors sm:flex-row sm:gap-3 sm:text-start"
            :class="[dragging ? 'border-primary bg-primary/5' : 'border-default', importing ? 'opacity-60' : '']"
            @dragenter.prevent="dragDepth++"
            @dragover.prevent
            @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
            @drop.prevent="onDrop"
          >
            <UIcon
              name="i-lucide-file-spreadsheet"
              class="size-8 shrink-0"
              :class="preview && !wrongType ? 'text-success' : 'text-muted'"
            />
            <div class="min-w-0 flex-1 text-sm">
              <p
                v-if="file"
                class="truncate font-medium text-highlighted"
                data-testid="import-file"
              >
                {{ file.name }}
              </p>
              <p
                v-else
                class="font-medium text-highlighted"
              >
                {{ dragging ? 'Drop to add the file' : 'Drop the Excel file here, or choose it' }}
              </p>
              <p class="text-muted">
                {{ reading ? 'Reading the file…' : preview ? preview.template : '.xlsx, up to 10 MB. Nothing is saved until you import.' }}
              </p>
            </div>
            <UButton
              icon="i-lucide-upload"
              :label="file ? 'Choose another file' : 'Choose file'"
              :variant="file ? 'outline' : 'solid'"
              :color="file ? 'neutral' : 'primary'"
              :loading="reading"
              :disabled="importing"
              @click="input?.click()"
            />
          </div>
          <UAlert
            v-if="readError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="This file can't be imported"
            :description="readError"
          />
          <UAlert
            v-else-if="wrongType"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="`This is an ${otherType} workbook`"
            :description="`Import it from ${otherType} › New assessment, or choose another file.`"
          />
          <RaImportReview
            v-else-if="preview"
            :preview="preview"
          />
        </section>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-end gap-3">
        <p
          v-if="!result && missing"
          class="me-auto text-sm text-warning"
        >
          {{ missing }}
        </p>
        <UButton
          color="neutral"
          variant="outline"
          :label="result ? 'Close' : 'Cancel'"
          :disabled="importing"
          @click="open = false"
        />
        <UButton
          v-if="!result"
          icon="i-lucide-file-input"
          label="Import"
          :loading="importing"
          :disabled="!preview || wrongType || reading || Boolean(missing)"
          @click="runImport"
        />
      </div>
    </template>
  </UModal>
</template>
