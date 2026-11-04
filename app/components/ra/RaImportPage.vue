<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { RaImportOptions, RaImportPreview, RaUserRef } from '~/composables/useRa'

/**
 * Import from Excel: a building and its RA from the official workbook BCM fills in by hand (the
 * HO or Cabang template) or one BCM Tools exported. Step 1 reads the file and saves nothing;
 * step 2 shows what it holds, what it lacks (asked for here) and what was left out, row by row.
 * Importing creates the building (or uses the registered one of the same name), saves its
 * profile and opens the new draft RA. The API checks everything again.
 */
const toast = useToast()
const { can, user } = useAuth()
const { data: profile } = useProfile()

const MAX_BYTES = 10 * 1024 * 1024
const input = useTemplateRef<HTMLInputElement>('input')
const file = ref<File | null>(null)
const preview = ref<RaImportPreview | null>(null)
const reading = ref(false)
const fileError = ref<string | null>(null)

const ra = computed(() => RA_MODULES[preview.value?.kind ?? 'head_office'])
const canEdit = computed(() => (preview.value ? can(ra.value.perm.edit) : true))

async function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  const picked = target.files?.[0]
  target.value = ''
  if (!picked) return
  fileError.value = null
  if (!picked.name.toLowerCase().endsWith('.xlsx')) {
    fileError.value = 'Use the .xlsx workbook (an .xls file can\'t be read). Save it as .xlsx in Excel first.'
    return
  }
  if (picked.size > MAX_BYTES) {
    fileError.value = 'Use a workbook of 10 MB or less.'
    return
  }
  reading.value = true
  try {
    const result = await raApi.importPreview(picked)
    file.value = picked
    preview.value = result
    reset(result)
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    fileError.value = details?.file ?? apiErrorMessage(failure)
  } finally {
    reading.value = false
  }
}

function startOver() {
  preview.value = null
  file.value = null
  formError.value = null
}

// --- review --------------------------------------------------------------------------------

const schema = computed(() => z.object({
  target: z.enum(['existing', 'new']),
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
  licom_user_id: z.number().nullable(),
  lic_phone: z.string(),
  licom_phone: z.string(),
}).superRefine((value, context) => {
  const need = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })
  if (value.target === 'new') {
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
  if (value.create_assessment) {
    if (!value.assessment_date) need('assessment_date', 'Enter the assessment date.')
    if (!value.licom_user_id) need('licom_user_id', 'Choose the LICOM.')
    if (!value.lic_phone.trim()) need('lic_phone', 'Enter the LIC mobile number.')
    if (!value.licom_phone.trim()) need('licom_phone', 'Enter the LICOM mobile number.')
    if (periodTaken.value) need('assessment_date', `${preview.value?.existing?.name} already has an RA for ${periodOf(value.assessment_date)}. Pick a date in another year, or import only the profile.`)
  }
}))

type State = z.infer<typeof schema.value>
const state = reactive<State>({
  target: 'new',
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
  licom_user_id: null,
  lic_phone: '',
  licom_phone: '',
})
const licUser = ref<RaUserRef | null>(null)
/** The LIC is the person who imports (the assessor): shown, not picked. */
const licUserId = computed<number | null>({ get: () => licUser.value?.id ?? null, set: () => {} })
const licomUser = ref<RaUserRef | null>(null)
const formError = ref<string | null>(null)

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
const form = useTemplateRef<{ setErrors: (errors: { name: string, message: string }[]) => void }>('form')

function toRef(person: { id: number, display_name: string | null, email: string | null, mobile_phone: string | null } | null): RaUserRef | null {
  return person ? { id: person.id, name: person.display_name, email: person.email, job_title: null, mobile_phone: person.mobile_phone } : null
}

function reset(result: RaImportPreview) {
  Object.assign(state, {
    target: result.existing ? 'existing' : 'new',
    name: result.location.name ?? '',
    address: result.location.address ?? '',
    // A branch: the directory's region the workbook names (or, without a directory, its text),
    // and the workbook's own words as the region description.
    region: result.location.region_match ?? (fromDirectory.value ? '' : result.location.region ?? ''),
    area: '',
    region_description: result.kind === 'branch' ? result.location.region ?? '' : '',
    province: '',
    city: '',
    district: '',
    zip_code: result.location.zip_code ?? '',
    replace_profile: false,
    create_assessment: true,
    assessment_date: result.assessment_date ?? todayIso(),
    reason: undefined,
    licom_user_id: result.licom?.user?.id ?? null,
    lic_phone: (result.lic?.is_me ? result.lic.phone : null) ?? profile.value?.mobile_phone ?? '',
    licom_phone: result.licom?.phone ?? result.licom?.user?.mobile_phone ?? '',
  })
  licomUser.value = toRef(result.licom?.user ?? null)
  formError.value = null
  nextTick(fitReason)
}

function todayIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

function periodOf(value: string) {
  return value ? Number(value.slice(0, 4)) : null
}

watch(() => user.value, (me) => {
  licUser.value = me ? { id: me.id, name: me.name, email: me.email, job_title: me.job_title } : null
}, { immediate: true })

const assessmentDate = computed({
  get: () => state.assessment_date ? parseDate(state.assessment_date) : undefined,
  set: (value: CalendarDate | null | undefined) => {
    state.assessment_date = value ? value.toString() : ''
  },
})

const existing = computed(() => (state.target === 'existing' ? preview.value?.existing ?? null : null))
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

const targetItems = computed(() => {
  const found = preview.value?.existing
  if (!found) return []
  return [
    { value: 'existing', label: `Use the registered ${ra.value.location.lower}`, description: `${found.name} (${found.code})${found.approval_status === 'pending' ? ', waiting for approval' : ''}.` },
    { value: 'new', label: `Add a new ${ra.value.location.lower}`, description: 'Give it another name: names are unique.' },
  ]
})

const profileParts = computed(() => {
  const result = preview.value
  if (!result) return []
  const parts = [
    { key: 'contacts', label: 'Emergency contacts', count: result.contacts.length, current: result.existing?.contacts ?? 0, icon: 'i-lucide-phone' },
  ]
  if (RA_MODULES[result.kind].hasLcp && result.kind === 'head_office') {
    parts.push(
      { key: 'occupants', label: 'Occupants (Sections C and F)', count: result.occupants.length, current: result.existing?.occupants ?? 0, icon: 'i-lucide-users' },
      { key: 'recovery_team', label: 'Recovery team', count: result.recovery_team.length, current: result.existing?.recovery_team ?? 0, icon: 'i-lucide-life-buoy' },
      { key: 'call_tree', label: 'Call tree', count: result.call_tree.length, current: result.existing?.call_tree ?? 0, icon: 'i-lucide-network' },
    )
  }
  return parts
})
const signersText = computed(() => {
  const named = (preview.value?.signers ?? []).filter((signer) => signer.name)
  const names = named.map((signer) => `${signer.heading}: ${signer.name}`).join(', ')
  return `The signers are picked on the RA's Sign-off tab: the workbook has their names, not user accounts${names ? ` (${names})` : ''}.`
})

function partText(part: { key: string, count: number, current: number }) {
  let text = `${part.count} ${part.count === 1 ? 'row' : 'rows'}`
  if (part.key === 'occupants' && employees.value) text += `, ${employees.value.toLocaleString('id-ID')} employees`
  if (existing.value) text += ` · now ${part.current}, ${state.replace_profile && part.count ? 'replaced' : 'kept'}`
  return text
}
const employees = computed(() => (preview.value?.occupants ?? []).reduce((sum, unit) => sum + (unit.employee_count ?? 0), 0))
const levels: RaLevel[] = ['High', 'Medium', 'Low']

const saving = ref(false)
const PREFIXES = ['location.', 'assessment.']

async function onSubmit(event: FormSubmitEvent<State>) {
  if (!file.value || !preview.value) return
  const value = event.data
  formError.value = null
  const options: RaImportOptions = {}
  if (value.target === 'existing' && preview.value.existing) {
    options.location_id = preview.value.existing.id
    options.replace_profile = value.replace_profile
  } else {
    options.location = {
      name: value.name.trim(),
      address: value.address.trim(),
      province: value.province.trim(),
      city: value.city.trim(),
      district: value.district.trim(),
      zip_code: value.zip_code.trim(),
      ...(preview.value.kind === 'branch'
        ? {
            ...(value.region.trim() ? { region: value.region.trim() } : {}),
            ...(value.area.trim() ? { area: value.area.trim() } : {}),
            region_description: value.region_description.trim(),
          }
        : {}),
    }
  }
  if (value.create_assessment) {
    options.assessment = {
      period_year: periodOf(value.assessment_date)!,
      assessment_date: value.assessment_date,
      licom_user_id: value.licom_user_id!,
      lic_phone: value.lic_phone.trim(),
      licom_phone: value.licom_phone.trim(),
      ...(value.reason ? { reason: value.reason } : {}),
    }
  }
  saving.value = true
  try {
    const result = await raApi.importWorkbook(file.value, options)
    clearNuxtData((key) => key.startsWith('ra-'))
    toast.add({
      title: result.assessment ? `Imported: ${result.assessment.ref_no} for ${result.location.name}` : `Imported: ${result.location.name}`,
      description: result.location.created ? `The new ${ra.value.location.lower} waits for approval. Its RA can be edited meanwhile.` : undefined,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    await navigateTo(result.assessment ? raPath(result.assessment.kind, 'manage', result.assessment.id) : locationPath(result.location.id))
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
      formError.value = rest.length ? rest.join(' ') : fields.length ? 'Some fields need attention. Check the messages below.' : null
    } else {
      formError.value = apiErrorMessage(failure)
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppPage
    title="Import from Excel"
    icon="i-lucide-file-up"
    description="Add a building or branch and its RA from the official workbook: the HO Risk Assessment Location 2025 r4 or the Cabang rev4 template, filled in by hand or downloaded from BCM Tools."
    :crumbs="[{ label: BUILDINGS_GROUP }, { label: 'Buildings', to: LOCATIONS_PATH }, { label: 'Import from Excel' }]"
  >
    <template
      v-if="preview"
      #actions
    >
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-file-x"
        label="Choose another file"
        :disabled="saving"
        @click="startOver"
      />
      <UButton
        type="submit"
        form="ra-import"
        icon="i-lucide-file-input"
        label="Import"
        :loading="saving"
        :disabled="!canEdit"
      />
    </template>

    <!-- Step 1: the file. -->
    <UCard
      v-if="!preview"
      class="max-w-3xl"
    >
      <div class="space-y-4">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold">
            Choose the workbook
          </h2>
          <p class="text-sm text-muted">
            BCM Tools reads the building or branch, its emergency contacts, every hazard's ratings, existing mitigation and action plan, and for head office buildings the occupants, recovery team and call tree. Nothing is saved until you review it and press Import.
          </p>
        </div>
        <ul class="list-disc space-y-1 ps-5 text-sm text-muted">
          <li>HO Risk Assessment Location – Version 2025 – r4 (head office buildings).</li>
          <li>Risk Assessment Location – Version 2025-2026 – Cabang rev4 (branches).</li>
          <li>Any RA workbook downloaded from BCM Tools.</li>
        </ul>
        <UAlert
          v-if="fileError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Couldn't read the workbook"
          :description="fileError"
        />
        <input
          ref="input"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="sr-only"
          tabindex="-1"
          aria-label="Choose the RA workbook"
          @change="onFile"
        >
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            icon="i-lucide-upload"
            :label="reading ? 'Reading the workbook…' : 'Choose workbook'"
            :loading="reading"
            @click="input?.click()"
          />
          <span class="text-sm text-muted">.xlsx, 10 MB or less.</span>
        </div>
      </div>
    </UCard>

    <!-- Step 2: review. -->
    <UForm
      v-else
      id="ra-import"
      ref="form"
      :schema="schema"
      :state="state"
      class="@container"
      @submit="onSubmit"
    >
      <UAlert
        class="mb-6"
        color="neutral"
        variant="subtle"
        icon="i-lucide-file-spreadsheet"
        :title="`${preview.filename ?? 'Workbook'}: ${preview.template}`"
        :description="`Read as a ${preview.kind_label.toLowerCase()} workbook. Nothing is saved until you press Import.`"
      />
      <UAlert
        v-if="!canEdit"
        class="mb-6"
        color="warning"
        variant="subtle"
        icon="i-lucide-lock"
        :title="`You can't add ${ra.location.lowerPlural} or their RAs.`"
      />
      <UAlert
        v-if="formError"
        class="mb-6"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Couldn't import the workbook"
        :description="formError"
      />

      <div class="grid items-start gap-6 @4xl:grid-cols-3">
        <div class="space-y-6 @4xl:col-span-2">
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">
                {{ ra.location.single }}
              </h2>
            </template>
            <div class="space-y-4">
              <URadioGroup
                v-if="targetItems.length"
                v-model="state.target"
                :items="targetItems"
                variant="card"
                orientation="horizontal"
                :legend="`${preview.location.name} is already registered`"
              />
              <template v-if="state.target === 'existing' && preview.existing">
                <USwitch
                  v-model="state.replace_profile"
                  label="Replace its profile with the workbook's"
                  :description="`Only the parts the workbook has. Left off, its current profile stays and only the RA is imported.`"
                />
              </template>
              <template v-else>
                <UFormField
                  :label="`${ra.location.single} name`"
                  name="name"
                  required
                >
                  <UInput
                    v-model="state.name"
                    class="w-full"
                  />
                </UFormField>
                <template v-if="preview.kind === 'branch'">
                  <UFormField
                    label="Region Description"
                    name="region_description"
                    help="The workbook's Nama Region Cabang, as written. Optional."
                  >
                    <UInput
                      v-model="state.region_description"
                      class="w-full"
                    />
                  </UFormField>
                  <div
                    v-if="fromDirectory"
                    class="grid gap-4 sm:grid-cols-2"
                  >
                    <UFormField
                      label="Region"
                      name="region"
                      required
                      :help="preview.location.region_match ? 'The directory region the workbook names.' : 'From the region directory (the workbook\'s region isn\'t one of its regions).'"
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
                      :help="state.region ? (areaItems.length ? 'The Group within the region.' : 'This region has no areas.') : 'Choose the region first.'"
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
                  </div>
                  <UFormField
                    v-else
                    label="Region"
                    name="region"
                    help="The region directory is empty, so the workbook's region is kept as it is."
                  >
                    <UInput
                      v-model="state.region"
                      class="w-full"
                    />
                  </UFormField>
                </template>
                <UFormField
                  label="Address"
                  name="address"
                  required
                >
                  <UTextarea
                    v-model="state.address"
                    :rows="2"
                    autoresize
                    class="w-full"
                  />
                </UFormField>
                <p class="text-sm text-muted">
                  The workbook has one address cell. Enter its parts{{ preview.location.zip_code ? ' (the zip code is taken from the end of the address)' : '' }}:
                </p>
                <div class="grid gap-4 sm:grid-cols-2">
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
                </div>
                <p class="text-sm text-muted">
                  A new {{ ra.location.lower }} waits for someone else's approval, as when it is added by hand. Add its organization and map pin on its page.
                </p>
              </template>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="text-lg font-semibold">
                  Assessment
                </h2>
                <USwitch
                  v-model="state.create_assessment"
                  label="Create a draft RA from the workbook"
                />
              </div>
            </template>
            <div
              v-if="state.create_assessment"
              class="space-y-4"
            >
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField
                  label="Assessment date"
                  name="assessment_date"
                  required
                  :help="periodOf(state.assessment_date) ? `RA period ${periodOf(state.assessment_date)}, the year of this date.${preview.assessment_date ? '' : ' The workbook has no date.'}` : undefined"
                >
                  <DatePicker v-model="assessmentDate" />
                </UFormField>
                <UFormField
                  label="Reason for assessment"
                  name="reason"
                >
                  <USelect
                    v-model="state.reason"
                    :items="reasonItems"
                    :disabled="reasonItems.length < 2"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <fieldset class="space-y-4">
                <legend class="mb-2 text-sm font-medium">
                  {{ ra.lic.label }}
                </legend>
                <RaTeamMember
                  v-model:user-id="licUserId"
                  v-model:user="licUser"
                  v-model:phone="state.lic_phone"
                  member="lic"
                  :label="ra.lic.label"
                  :hint="preview.lic?.name && !preview.lic.is_me ? `The workbook names ${preview.lic.name}. You are the LIC as the assessor. Hand the RA over later if needed.` : 'You, as the assessor.'"
                  fixed
                />
              </fieldset>
              <fieldset class="space-y-4">
                <legend class="mb-2 text-sm font-medium">
                  {{ ra.licom.label }}
                </legend>
                <RaTeamMember
                  v-model:user-id="state.licom_user_id"
                  v-model:user="licomUser"
                  v-model:phone="state.licom_phone"
                  member="licom"
                  :label="ra.licom.label"
                  :hint="preview.licom?.name ? (preview.licom.user ? `The workbook names ${preview.licom.name}: matched to this user. Check it.` : `The workbook names ${preview.licom.name}: pick them from the user directory.`) : undefined"
                />
              </fieldset>
              <p class="text-sm text-muted">
                {{ signersText }}
              </p>
            </div>
            <p
              v-else
              class="text-sm text-muted"
            >
              Only the {{ ra.location.lower }} and its profile are imported.
            </p>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">
                In the workbook
              </h2>
            </template>
            <div class="space-y-5">
              <ul class="grid gap-3 sm:grid-cols-2">
                <li
                  v-for="part in profileParts"
                  :key="part.key"
                  class="flex items-start gap-3 rounded-md border border-default p-3"
                >
                  <UIcon
                    :name="part.icon"
                    class="mt-0.5 size-5 shrink-0 text-muted"
                  />
                  <div class="min-w-0">
                    <p class="font-medium">
                      {{ part.label }}
                    </p>
                    <p class="text-sm text-muted">
                      {{ partText(part) }}
                    </p>
                  </div>
                </li>
              </ul>
              <div>
                <p class="font-medium">
                  Hazards: {{ preview.ratings.rated }} of {{ preview.ratings.total }} fully rated
                </p>
                <p
                  v-if="preview.ratings.found < preview.ratings.total"
                  class="text-sm text-muted"
                >
                  {{ preview.ratings.total - preview.ratings.found }} have no row in the workbook and start empty.
                </p>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span class="text-muted">Residual risk:</span>
                  <template
                    v-for="level in levels"
                    :key="level"
                  >
                    <StatusBadge
                      v-if="preview.ratings.counts.residual[level]"
                      :scale="raRiskLevel"
                      :value="level"
                      size="sm"
                    />
                    <span
                      v-if="preview.ratings.counts.residual[level]"
                      class="tabular-nums"
                    >{{ preview.ratings.counts.residual[level] }}</span>
                  </template>
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <div class="space-y-6">
          <UCard>
            <template #header>
              <h2 class="font-semibold">
                Not in the workbook
              </h2>
            </template>
            <ul class="space-y-3 text-sm">
              <li
                v-for="item in preview.missing"
                :key="item.field"
              >
                <p class="font-medium">
                  {{ item.label }}
                </p>
                <p class="text-muted">
                  {{ item.why }}
                </p>
              </li>
            </ul>
          </UCard>
          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold">
                  Left out or changed
                </h2>
                <UBadge
                  :color="preview.warnings.length ? 'warning' : 'success'"
                  variant="subtle"
                  :label="String(preview.warnings.length)"
                />
              </div>
            </template>
            <p
              v-if="!preview.warnings.length"
              class="text-sm text-muted"
            >
              Every row could be imported as it is.
            </p>
            <ul
              v-else
              class="max-h-[32rem] space-y-3 overflow-y-auto pe-1 text-sm"
              aria-label="Rows left out or changed"
            >
              <li
                v-for="(warning, index) in preview.warnings"
                :key="index"
                class="flex gap-2"
              >
                <UIcon
                  name="i-lucide-triangle-alert"
                  class="mt-0.5 size-4 shrink-0 text-warning"
                />
                <div class="min-w-0">
                  <p class="text-xs text-muted">
                    {{ warning.sheet }}{{ warning.cell ? ` · ${warning.cell}` : '' }}
                  </p>
                  <p>{{ warning.message }}</p>
                </div>
              </li>
            </ul>
          </UCard>
        </div>
      </div>
    </UForm>
  </AppPage>
</template>
