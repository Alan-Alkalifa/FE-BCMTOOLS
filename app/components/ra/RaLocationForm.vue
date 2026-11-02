<script setup lang="ts">
import { z } from 'zod'
import type { RaLocationDetail, RaNetworkHead, RaOrgValues } from '~/composables/useRa'

/**
 * Building Data Entry: a head office building or a branch. The type is picked in the form
 * (`v-model:kind`, fixed when the link gives it, read-only once saved), with the description
 * RA configuration gives each type. Every field is required.
 *
 * A branch also gets its place in the Network organisation: its Region (the Sub Directorate)
 * and Area (the Group) from the region directory (the DataRegion sheet; LDAP in production),
 * with their heads shown. While the directory is empty the region is free text.
 *
 * Its organization, as SCCA's application owner: Directorate, Sub Directorate, Division and
 * Department, picked from the user master's values (a new one can be typed). A new head office
 * building starts with the signed-in user's own; a branch's Directorate and Sub Directorate
 * follow its region. Monitoring filters by them and the access scope opens a location to the
 * users of its directorate.
 */
const props = withDefaults(defineProps<{
  location?: RaLocationDetail
  cancelTo?: string
  /** The type can't be changed (given by the link, or a saved building). */
  kindLocked?: boolean
}>(), {
  location: undefined,
  cancelTo: undefined,
  kindLocked: false,
})
const emit = defineEmits<{ saved: [location: RaLocationDetail] }>()
const kind = defineModel<RaKind | undefined>('kind')

const ra = useRaModule()
const toast = useToast()
const form = useTemplateRef('form')
const dirty = useRaDirty()
const formError = ref<string | null>(null)
const snapshot = ref('')

const { data: buildingTypes } = useRaBuildingTypes()
const typeItems = computed(() => (buildingTypes.value?.items ?? [
  { kind: 'head_office' as const, label: 'Head office building', description: null },
  { kind: 'branch' as const, label: 'Branch', description: null },
]).map((item) => ({ label: item.label, value: item.kind })))
const typeHint = computed(() =>
  buildingTypes.value?.items.find((item) => item.kind === ra.value.kind)?.description
  ?? (ra.value.kind === 'branch'
    ? 'The branch that is assessed each RA cycle.'
    : 'The building or work location that is assessed each RA cycle.'))
const typeModel = computed<RaKind>({
  get: () => kind.value ?? ra.value.kind,
  set: (value) => {
    kind.value = value
  },
})

const { data: directory } = useRaRegionDirectory()
const isBranch = computed(() => ra.value.kind === 'branch')
const regionList = computed(() => directory.value?.items ?? [])
/** Pick from the directory once it has regions; type the region while it has none. */
const fromDirectory = computed(() => regionList.value.length > 0)

const schema = computed(() => z.object({
  name: z.string().trim().min(1, ra.value.kind === 'branch' ? 'Enter the branch name.' : 'Enter the building name.'),
  address: z.string().trim().min(1, 'Enter the address.'),
  province: z.string().trim().min(1, 'Enter the province.'),
  city: z.string().trim().min(1, 'Enter the city.'),
  district: z.string().trim().min(1, 'Enter the district.'),
  zip_code: z.string().trim().min(1, 'Enter the zip code.').max(10, 'At most 10 characters.').regex(/^[0-9A-Za-z -]*$/, 'Use digits and letters only.'),
  is_active: z.boolean(),
  region: z.string(),
  area: z.string(),
  directorate: z.string(),
  sub_directorate: z.string(),
  division: z.string(),
  department: z.string(),
}).superRefine((value, context) => {
  if (!isBranch.value || !fromDirectory.value) return
  const region = regionList.value.find((item) => item.region === value.region)
  if (!region) {
    context.addIssue({ code: 'custom', path: ['region'], message: 'Choose the region.' })
  } else if (region.areas.length && !region.areas.some((item) => item.area === value.area)) {
    context.addIssue({ code: 'custom', path: ['area'], message: 'Choose the area.' })
  }
}))
type State = z.infer<typeof schema.value>

function fromLocation(location?: RaLocationDetail): State {
  return {
    name: location?.name ?? '',
    address: location?.address ?? '',
    province: location?.province ?? '',
    city: location?.city ?? '',
    district: location?.district ?? '',
    zip_code: location?.zip_code ?? '',
    region: location?.region ?? '',
    area: location?.area ?? '',
    directorate: location?.directorate ?? '',
    sub_directorate: location?.sub_directorate ?? '',
    division: location?.division ?? '',
    department: location?.department ?? '',
    // Cleared while its deactivation waits for approval; ticking it again withdraws that.
    is_active: (location?.is_active ?? true) && location?.approval?.action !== 'deactivate',
  }
}

const state = reactive<State>(fromLocation(props.location))

// --- Organization ------------------------------------------------------------------------------

type OrgField = 'directorate' | 'sub_directorate' | 'division' | 'department'
const ORG_FIELDS: { key: OrgField, label: string, list: keyof RaOrgValues }[] = [
  { key: 'directorate', label: 'Directorate', list: 'directorates' },
  { key: 'sub_directorate', label: 'Sub Directorate', list: 'sub_directorates' },
  { key: 'division', label: 'Division', list: 'divisions' },
  { key: 'department', label: 'Department', list: 'departments' },
]
const { data: orgValues } = useRaOrgValues()
const { data: profile } = useProfile()
/** The values to pick from, with the one saved even if it is no longer in the user master. */
function orgItems(field: (typeof ORG_FIELDS)[number]) {
  const items = [...(orgValues.value?.[field.list] ?? [])]
  const current = state[field.key]
  if (current && !items.includes(current)) items.unshift(current)
  return items
}
/** A branch's Directorate (from the region directory) and Sub Directorate (its region) follow
 *  the region; while the directory is empty its Directorate is typed. */
function orgLocked(key: OrgField) {
  if (!isBranch.value) return false
  return key === 'sub_directorate' || (key === 'directorate' && fromDirectory.value)
}
function orgValue(key: OrgField) {
  if (isBranch.value && key === 'sub_directorate') return state.region
  if (isBranch.value && key === 'directorate' && fromDirectory.value) return pickedRegion.value?.directorate ?? state.directorate
  return state[key]
}
/** A new head office building starts with the signed-in user's organization. */
watch(() => profile.value, (me) => {
  if (props.location || isBranch.value || !me) return
  for (const key of ['directorate', 'sub_directorate', 'division', 'department'] as const) {
    if (!state[key]) state[key] = me[key] ?? ''
  }
}, { immediate: true })

const regionItems = computed(() => {
  const items = regionList.value.map((item) => ({
    label: item.region,
    value: item.region,
    description: [item.head, item.city && titleCase(item.city)].filter(Boolean).join(' · ') || undefined,
  }))
  // A branch saved before the directory keeps its region until it is changed.
  if (state.region && !items.some((item) => item.value === state.region)) {
    items.unshift({ label: state.region, value: state.region, description: 'Not in the region list' })
  }
  return items
})
const pickedRegion = computed(() => regionList.value.find((item) => item.region === state.region) ?? null)
const areaItems = computed(() => (pickedRegion.value?.areas ?? []).map((item) => ({
  label: item.area,
  value: item.area,
  description: [item.head, item.city && titleCase(item.city)].filter(Boolean).join(' · ') || undefined,
})))
const pickedArea = computed(() => pickedRegion.value?.areas.find((item) => item.area === state.area) ?? null)
/** A new region keeps the area only if it is one of its own. */
watch(() => state.region, () => {
  if (fromDirectory.value && !areaItems.value.some((item) => item.value === state.area)) state.area = ''
})

/** "KC - Bandung - Asia Afrika - BAA, Bandung": where a head works. */
function headLine(unit: RaNetworkHead | null) {
  if (!unit) return null
  const where = [unit.office, unit.city && titleCase(unit.city)].filter(Boolean).join(', ')
  return [unit.head ?? 'No head listed', where && `(${where})`].filter(Boolean).join(' ')
}
function titleCase(text: string) {
  return text.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
}

function reset(location?: RaLocationDetail) {
  Object.assign(state, fromLocation(location))
  snapshot.value = JSON.stringify(state)
  if (dirty) dirty.value = false
}

watch(() => props.location, (location) => reset(location), { immediate: true })
watch(state, () => {
  if (dirty) dirty.value = JSON.stringify(state) !== snapshot.value
}, { deep: true })

async function onSubmit() {
  formError.value = null
  try {
    const { region, area, directorate, sub_directorate: subDirectorate, ...fields } = state
    const body = blankToNull({
      ...fields,
      name: state.name.trim(),
      // Only a branch has a region and area; its Sub Directorate is the region and, with the
      // region directory, its Directorate comes from there (the backend sets both).
      ...(isBranch.value ? { region: region.trim(), area: area.trim() } : { sub_directorate: subDirectorate }),
      ...(orgLocked('directorate') ? {} : { directorate }),
    })
    const saved = props.location
      ? await raApi.updateLocation(props.location.id, body)
      : await raApi.createLocation({ ...body, kind: ra.value.kind })
    reset(saved)
    const noun = ra.value.location.single
    // A new building, and making one inactive, wait for someone else's approval.
    const asked = saved.approval?.status === 'pending' && saved.approval.action === 'deactivate' && props.location?.approval?.action !== 'deactivate'
    toast.add({
      title: props.location ? (asked ? `${noun} saved. Making it inactive waits for approval` : `${noun} saved`) : `${noun} added. It waits for approval`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
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
      :title="`Couldn't save the ${ra.location.lower}`"
      :description="formError"
    />

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          {{ ra.location.single }}
        </h2>
      </template>
      <div class="space-y-4">
        <UFormField
          label="Type of building"
          required
        >
          <USelect
            v-model="typeModel"
            :items="typeItems"
            :disabled="kindLocked || Boolean(location)"
            aria-label="Type of building"
            class="w-full sm:w-72"
          />
          <template #help>
            <span
              class="whitespace-pre-line"
              data-testid="building-type-hint"
            >{{ typeHint }}</span>
          </template>
        </UFormField>
        <UFormField
          :label="ra.kind === 'branch' ? 'Branch name' : 'Building name'"
          name="name"
          required
          eager-validation
        >
          <UInput
            v-model="state.name"
            :placeholder="ra.kind === 'branch' ? 'e.g. KCP Bogor Pajajaran' : 'e.g. Griya CIMB Niaga 2'"
            class="w-full"
          />
        </UFormField>
        <!-- A branch's place in the Network organisation (the region directory; LDAP in
             production): Region = Sub Directorate, Area = Group. -->
        <template v-if="isBranch">
          <div
            v-if="fromDirectory"
            class="space-y-4"
          >
            <UFormField
              label="Region"
              name="region"
              required
              help="The Sub Directorate of Network & Digital Banking."
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
            <dl
              v-if="pickedRegion"
              class="grid gap-x-4 gap-y-1 rounded-md bg-elevated/50 p-3 text-sm sm:grid-cols-[auto_1fr]"
              data-testid="branch-organisation"
            >
              <dt class="text-muted">
                Directorate
              </dt>
              <dd>{{ pickedRegion.directorate }}</dd>
              <dt class="text-muted">
                Region head
              </dt>
              <dd>{{ headLine(pickedRegion) ?? '—' }}</dd>
              <template v-if="pickedArea">
                <dt class="text-muted">
                  Area head
                </dt>
                <dd>{{ headLine(pickedArea) }}</dd>
              </template>
            </dl>
          </div>
          <UFormField
            v-else
            label="Region"
            name="region"
            help="The region list comes from LDAP."
          >
            <UInput
              v-model="state.region"
              placeholder="e.g. Network - Jabar & Jateng Region"
              class="w-full"
            />
          </UFormField>
        </template>
        <UFormField
          label="Address"
          name="address"
          required
          eager-validation
        >
          <UTextarea
            v-model="state.address"
            :rows="3"
            autoresize
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Province"
            name="province"
            required
            eager-validation
          >
            <UInput
              v-model="state.province"
              placeholder="e.g. DKI Jakarta"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="City"
            name="city"
            required
            eager-validation
          >
            <UInput
              v-model="state.city"
              placeholder="e.g. Jakarta Selatan"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="District"
            name="district"
            required
            eager-validation
          >
            <UInput
              v-model="state.district"
              placeholder="e.g. Setiabudi"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Zip code"
            name="zip_code"
            required
            eager-validation
          >
            <UInput
              v-model="state.zip_code"
              inputmode="numeric"
              placeholder="e.g. 12920"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          v-if="location"
          name="is_active"
          :help="`Inactive ${ra.location.lowerPlural} can't get new assessments but keep their history. Making it inactive waits for someone else's approval.`"
        >
          <UCheckbox
            v-model="state.is_active"
            label="Active"
          />
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          Organization
        </h2>
        <p class="text-sm text-muted">
          Who the {{ ra.location.lower }} belongs to, as the user master names it. Monitoring filters by it, and the access scope opens the {{ ra.location.lower }} to the users of its directorate.
        </p>
      </template>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          v-for="field in ORG_FIELDS"
          :key="field.key"
          :label="field.label"
          :name="field.key"
          :help="orgLocked(field.key) ? (field.key === 'sub_directorate' ? 'The branch\'s region.' : 'From the region directory.') : undefined"
        >
          <UInput
            v-if="orgLocked(field.key)"
            :model-value="orgValue(field.key)"
            disabled
            class="w-full"
            :aria-label="field.label"
          />
          <USelectMenu
            v-else
            v-model="state[field.key]"
            :items="orgItems(field)"
            create-item
            :placeholder="`Choose the ${field.label.toLowerCase()}`"
            class="w-full"
            :aria-label="field.label"
            @create="(item: string) => (state[field.key] = item)"
          />
        </UFormField>
      </div>
    </UCard>

    <div class="flex justify-end gap-2">
      <UButton
        v-if="!location"
        :to="cancelTo ?? LOCATIONS_PATH"
        color="neutral"
        variant="outline"
        label="Cancel"
      />
      <UButton
        type="submit"
        :label="location ? `Save ${ra.location.lower}` : `Add ${ra.location.lower}`"
        loading-auto
      />
    </div>
  </UForm>
</template>
