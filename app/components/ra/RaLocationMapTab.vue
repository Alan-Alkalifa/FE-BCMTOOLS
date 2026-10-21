<script setup lang="ts">
import type { RaLocationDetail, RaPin } from '~/composables/useRa'

/**
 * The location's map pin: placed by clicking the map, dragging the pin, or pasting the
 * coordinates Google Maps copies ("-6.271633, 106.719358"). It belongs to the location, so
 * every RA cycle of the building or branch shows the same pin.
 */
const props = defineProps<{ location: RaLocationDetail }>()
const emit = defineEmits<{ saved: [location: RaLocationDetail] }>()

const ra = useRaModule()
const { can } = useAuth()
const toast = useToast()
const dirty = useRaDirty()
const formError = ref<string | null>(null)

const pin = ref<RaPin | null>(raPin(props.location))
const coordinates = ref(raFormatCoordinates(pin.value))
const coordinatesError = ref<string | null>(null)

function reset(location: RaLocationDetail) {
  pin.value = raPin(location)
  coordinates.value = raFormatCoordinates(pin.value)
  coordinatesError.value = null
}

watch(() => props.location, (location) => reset(location))

const saved = computed(() => raPin(props.location))
const changed = computed(() => raFormatCoordinates(pin.value) !== raFormatCoordinates(saved.value))
watch(changed, (value) => {
  if (dirty) dirty.value = value
}, { immediate: true })

// A click or drag on the map updates the text; typing a valid pair moves the pin.
watch(pin, (value) => {
  if (raParseCoordinates(coordinates.value)?.lat !== value?.lat || raParseCoordinates(coordinates.value)?.lng !== value?.lng) {
    coordinates.value = raFormatCoordinates(value)
  }
  coordinatesError.value = null
})

function applyCoordinates() {
  const text = coordinates.value.trim()
  if (!text) {
    coordinatesError.value = null
    return
  }
  const parsed = raParseCoordinates(text)
  if (!parsed) {
    coordinatesError.value = 'Enter latitude and longitude, e.g. -6.271633, 106.719358.'
    return
  }
  coordinatesError.value = null
  pin.value = parsed
}

async function save(next: RaPin | null) {
  formError.value = null
  try {
    const updated = await raApi.updateLocation(props.location.id, {
      latitude: next?.lat ?? null,
      longitude: next?.lng ?? null,
    })
    reset(updated)
    if (dirty) dirty.value = false
    toast.add({ title: next ? 'Map pin saved' : 'Map pin removed', color: 'success', icon: 'i-lucide-circle-check' })
    emit('saved', updated)
  } catch (error) {
    formError.value = apiErrorMessage(error)
  }
}

function removePin() {
  pin.value = null
  coordinates.value = ''
}

const searchQuery = computed(() => [props.location.name, props.location.address].filter(Boolean).join(', '))
</script>

<template>
  <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          Map pin
        </h2>
        <p class="text-sm text-muted">
          Click the map to place the pin, or drag it. Every RA cycle of this {{ ra.location.lower }} uses it.
        </p>
      </template>

      <div class="space-y-4">
        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Couldn't save the map pin"
          :description="formError"
        />

        <RaMap
          v-model:pin="pin"
          :editable="can('ra.edit')"
          :label="`Map of ${location.name}. Click to place the pin.`"
          height-class="h-[28rem]"
        />

        <UFormField
          label="Coordinates"
          help="Latitude, longitude. Paste them from Google Maps (right-click the spot, then click the numbers to copy them)."
          :error="coordinatesError ?? undefined"
        >
          <div class="flex gap-2">
            <UInput
              v-model="coordinates"
              placeholder="-6.271633, 106.719358"
              inputmode="decimal"
              class="min-w-0 flex-1"
              @blur="applyCoordinates"
              @keydown.enter.prevent="applyCoordinates"
            />
            <UButton
              color="neutral"
              variant="outline"
              label="Show on map"
              @click="applyCoordinates"
            />
          </div>
        </UFormField>
      </div>

      <template #footer>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <p
            v-if="!saved && !pin"
            class="mr-auto text-sm text-muted"
          >
            No pin yet.
          </p>
          <p
            v-else-if="changed"
            class="mr-auto text-sm text-muted"
          >
            Unsaved changes
          </p>
          <UButton
            v-if="pin"
            color="neutral"
            variant="outline"
            icon="i-lucide-map-pin-off"
            label="Remove pin"
            @click="removePin"
          />
          <UButton
            label="Save pin"
            :disabled="!changed"
            loading-auto
            @click="save(pin)"
          />
        </div>
      </template>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          {{ location.name }}
        </h2>
      </template>
      <dl class="space-y-3 text-sm">
        <div v-if="ra.hasRegion">
          <dt class="text-muted">
            Region
          </dt>
          <dd>{{ location.region || '—' }}</dd>
        </div>
        <div>
          <dt class="text-muted">
            Address
          </dt>
          <dd>{{ location.address || '—' }}</dd>
        </div>
        <div>
          <dt class="text-muted">
            Saved pin
          </dt>
          <dd class="tabular-nums">
            {{ saved ? raFormatCoordinates(saved) : 'Not set' }}
          </dd>
        </div>
      </dl>
      <template #footer>
        <div class="flex flex-col items-start gap-1">
          <UButton
            v-if="saved"
            :to="raGoogleMapsUrl(saved)"
            target="_blank"
            rel="noopener"
            variant="link"
            trailing-icon="i-lucide-external-link"
            label="Open the pin in Google Maps"
            class="px-0"
          />
          <UButton
            :to="raGoogleMapsUrl(searchQuery)"
            target="_blank"
            rel="noopener"
            variant="link"
            trailing-icon="i-lucide-external-link"
            label="Find the address in Google Maps"
            class="px-0"
          />
        </div>
      </template>
    </UCard>
  </div>
</template>
