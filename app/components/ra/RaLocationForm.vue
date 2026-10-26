<script setup lang="ts">
import { z } from 'zod'
import type { RaLocationDetail } from '~/composables/useRa'

/**
 * Building Data Entry: a head office building or a branch. The type is picked in the form
 * (`v-model:kind`, fixed when the link gives it, read-only once saved), with the description
 * RA configuration gives each type; a branch also needs its region.
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

const schema = computed(() => z.object({
  name: z.string().trim().min(1, ra.value.kind === 'branch' ? 'Enter the branch name.' : 'Enter the building name.'),
  address: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  zip_code: z.string().trim().max(10, 'At most 10 characters.').regex(/^[0-9A-Za-z -]*$/, 'Use digits and letters only.').optional(),
  // Section A of the branch workbook: Nama Region Cabang.
  region: ra.value.hasRegion ? z.string().trim().min(1, 'Enter the region.') : z.string().optional(),
  is_active: z.boolean(),
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
    // Cleared while its deactivation waits for approval; ticking it again withdraws that.
    is_active: (location?.is_active ?? true) && location?.approval?.action !== 'deactivate',
  }
}

const state = reactive<State>(fromLocation(props.location))

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
    const { region, ...rest } = blankToNull({ ...state, name: state.name.trim() })
    const body = ra.value.hasRegion ? { ...rest, region } : rest
    const saved = props.location
      ? await raApi.updateLocation(props.location.id, body)
      : await raApi.createLocation({ ...body, kind: ra.value.kind })
    reset(saved)
    const noun = ra.value.location.single
    // A new building, and making one inactive, wait for someone else's approval.
    const asked = saved.approval?.status === 'pending' && saved.approval.action === 'deactivate' && props.location?.approval?.action !== 'deactivate'
    toast.add({
      title: props.location ? (asked ? `${noun} saved; making it inactive waits for approval` : `${noun} saved`) : `${noun} added; it waits for approval`,
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
        <UFormField
          v-if="ra.hasRegion"
          label="Region"
          name="region"
          required
          eager-validation
        >
          <UInput
            v-model="state.region"
            placeholder="e.g. Region Jabar"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Address"
          name="address"
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
