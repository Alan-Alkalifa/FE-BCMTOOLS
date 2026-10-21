<script setup lang="ts">
import { z } from 'zod'
import type { RaLocationDetail } from '~/composables/useRa'

const props = withDefaults(defineProps<{ location?: RaLocationDetail, cancelTo?: string }>(), {
  location: undefined,
  cancelTo: undefined,
})
const emit = defineEmits<{ saved: [location: RaLocationDetail] }>()

const ra = useRaModule()
const toast = useToast()
const form = useTemplateRef('form')
const dirty = useRaDirty()
const formError = ref<string | null>(null)
const snapshot = ref('')

const schema = computed(() => z.object({
  name: z.string().trim().min(1, ra.value.kind === 'branch' ? 'Enter the branch name.' : 'Enter the building name.'),
  address: z.string().optional(),
  // Section A of the branch workbook: Nama Region Cabang.
  region: ra.value.hasRegion ? z.string().trim().min(1, 'Enter the region.') : z.string().optional(),
  is_active: z.boolean(),
}))
type State = z.infer<typeof schema.value>

function fromLocation(location?: RaLocationDetail): State {
  return {
    name: location?.name ?? '',
    address: location?.address ?? '',
    region: location?.region ?? '',
    is_active: location?.is_active ?? true,
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
    toast.add({ title: props.location ? `${noun} saved` : `${noun} added`, color: 'success', icon: 'i-lucide-circle-check' })
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
        <p class="text-sm text-muted">
          {{ ra.kind === 'branch'
            ? 'Section A of the LRP scorecard: the branch that is assessed each RA cycle.'
            : 'Section A of the LRP scorecard: the building or work location that is assessed each RA cycle.' }}
        </p>
      </template>
      <div class="space-y-4">
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
        <UFormField
          v-if="location"
          name="is_active"
          :help="`Inactive ${ra.location.lowerPlural} can't get new assessments but keep their history.`"
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
        :to="cancelTo ?? `${ra.base}/locations`"
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
