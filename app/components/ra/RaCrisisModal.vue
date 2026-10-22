<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { RaCrisis, RaCrisisInput, RaMapMarker, RaMapPlace, RaPin } from '~/composables/useRa'

/**
 * Declares a crisis, or edits an open one: the hazard, where it happens, the affected radius and
 * when it started (WIB). Closes with the saved crisis, or false.
 *
 * Where is always a pin on the map: drop it by clicking the map, drag it, or pick a building or
 * branch (from the list or its marker) to put the pin on it. The ring shows the affected area.
 */
const props = withDefaults(defineProps<{
  places: RaMapPlace[]
  crisis?: RaCrisis | null
  /** Preselects the place when declaring from a place on the map. */
  locationId?: number | null
}>(), { crisis: null, locationId: null })
const emit = defineEmits<{ close: [crisis: RaCrisis | false] }>()

const { data: formula } = useRaFormula('head_office')
const editing = computed(() => !!props.crisis)

const hazardItems = computed(() => (formula.value?.categories ?? []).map((category) => [
  { type: 'label' as const, label: category.label, value: category.code, description: undefined },
  ...category.hazards.map((hazard) => ({ label: `${hazard.short_name}`, value: hazard.code, description: hazard.code })),
]))

const placeItems = computed(() => props.places.map((place) => ({
  label: place.name,
  value: place.id,
  description: [RA_PLACE_KIND_LABEL[place.kind], place.region].filter(Boolean).join(' · '),
  icon: place.kind === 'branch' ? 'i-lucide-landmark' : 'i-lucide-building-2',
})))

const startedAt = raWibParts(props.crisis?.started_at ?? new Date())
const initialPlace = props.places.find((place) => place.id === (props.crisis?.location?.id ?? props.locationId)) ?? null
const state = reactive({
  hazard_code: props.crisis?.hazard_code ?? '',
  location_id: initialPlace?.id as number | undefined,
  pin: (props.crisis
    ? { lat: props.crisis.latitude, lng: props.crisis.longitude }
    : initialPlace ? { lat: initialPlace.latitude, lng: initialPlace.longitude } : null) as RaPin | null,
  radius_km: (props.crisis?.radius_m ?? 1000) / 1000,
  date: startedAt.date,
  time: startedAt.time,
  description: props.crisis?.description ?? '',
  note: '',
})

const schema = z.object({
  hazard_code: z.string().min(1, 'Choose the hazard.'),
  location_id: z.number().optional(),
  pin: z.custom<RaPin | null>((value) => !!value, 'Click the map to drop the pin, or choose a building or branch.'),
  radius_km: z.number({ error: 'Enter the radius in km.' }).min(0.05, 'At least 0,05 km (50 m).').max(200, 'At most 200 km.'),
  date: z.string().min(1, 'Pick the date.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Enter the time, e.g. 14:30.'),
  description: z.string(),
  note: z.string(),
})

const mapRef = useTemplateRef<{ fit: (pins: RaPin[]) => void }>('map')

function placePin(place: RaMapPlace): RaPin {
  return { lat: place.latitude, lng: place.longitude }
}

/** Show the whole affected area around the pin. */
function showArea() {
  const pin = state.pin
  if (!pin) return
  const radius = Math.max(state.radius_km, 0.2) * 1000
  const dLat = radius / 111_320
  const dLng = radius / (111_320 * Math.cos((pin.lat * Math.PI) / 180))
  mapRef.value?.fit([
    { lat: pin.lat + dLat, lng: pin.lng + dLng },
    { lat: pin.lat - dLat, lng: pin.lng - dLng },
  ])
}

/** Picking a building or branch puts the pin on it. */
function choosePlace(id: number | undefined) {
  state.location_id = id
  const place = props.places.find((item) => item.id === id)
  if (place) {
    state.pin = placePin(place)
    nextTick(showArea)
  }
}

// A pin moved off the chosen place is a point of its own, not that building or branch.
watch(() => state.pin, (pin) => {
  const place = props.places.find((item) => item.id === state.location_id)
  if (place && (!pin || pin.lat !== place.latitude || pin.lng !== place.longitude)) state.location_id = undefined
})

const markers = computed<RaMapMarker[]>(() => props.places.map((place) => ({
  id: place.id,
  lat: place.latitude,
  lng: place.longitude,
  label: `${place.name} (${RA_PLACE_KIND_LABEL[place.kind]}). Select to put the crisis here.`,
  level: (place.latest ? place.latest.highest_residual_level ?? 'na' : 'none') as RaMapMarker['level'],
  variant: place.kind === 'branch' ? 'branch' as const : 'location' as const,
})))
const circles = computed(() => (state.pin && state.radius_km > 0
  ? [{ id: 0, ...state.pin, radiusM: state.radius_km * 1000, crisis: true }]
  : []))

/** The places inside the ring, nearest first: what the crisis will affect. */
const affected = computed(() => {
  const pin = state.pin
  if (!pin) return []
  return props.places
    .map((place) => ({ place, distanceM: raDistanceKm(pin, placePin(place)) * 1000 }))
    .filter((row) => row.distanceM <= state.radius_km * 1000)
    .sort((a, b) => a.distanceM - b.distanceM)
})

/** DatePicker speaks CalendarDate; the form keeps the ISO date. */
const date = computed<CalendarDate | undefined>({
  get: () => (state.date ? parseDate(state.date) : undefined),
  set: (value) => (state.date = value ? value.toString() : ''),
})

const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)

const RADIUS_PRESETS = [0.5, 1, 5, 10, 25]

async function onSubmit() {
  formError.value = null
  fieldErrors.value = {}
  const body: RaCrisisInput = {
    hazard_code: state.hazard_code,
    location_id: state.location_id ?? null,
    latitude: state.pin!.lat,
    longitude: state.pin!.lng,
    radius_m: Math.round(state.radius_km * 1000),
    started_at: raWibToIso(state.date, state.time),
    description: state.description.trim() || null,
    ...(editing.value && state.note.trim() ? { note: state.note.trim() } : {}),
  }
  saving.value = true
  try {
    const saved = editing.value
      ? await raCrisisApi.update(props.crisis!.id, body)
      : await raCrisisApi.declare(body)
    emit('close', saved)
  } catch (error) {
    fieldErrors.value = Object.fromEntries(apiFieldErrors(error).map((item) => [item.name, item.message ?? '']))
    formError.value = fieldErrors.value.status ?? (Object.keys(fieldErrors.value).length ? null : apiErrorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :title="editing ? `Update ${crisis!.ref_no}` : 'Declare a crisis'"
    :description="editing
      ? 'What changes is added to the crisis history.'
      : 'Everyone sees it on the location map until it is closed. Each affected place gets its instructions.'"
    :ui="{ content: 'sm:max-w-3xl' }"
    @update:open="(open) => !open && emit('close', false)"
  >
    <template #body>
      <UForm
        id="ra-crisis-form"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="editing ? 'Couldn\'t update the crisis' : 'Couldn\'t declare the crisis'"
          :description="formError"
        />

        <UFormField
          label="Hazard"
          name="hazard_code"
          required
          :error="fieldErrors.hazard_code"
        >
          <USelectMenu
            v-model="state.hazard_code"
            :items="hazardItems"
            value-key="value"
            placeholder="Choose one of the 33 RA hazards"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Where"
          name="pin"
          required
          help="Click the map to drop the pin, or drag it. Choosing a building or branch puts the pin on it."
          :error="fieldErrors.location_id || fieldErrors.latitude"
        >
          <div class="space-y-2">
            <USelectMenu
              :model-value="state.location_id"
              :items="placeItems"
              value-key="value"
              icon="i-lucide-search"
              placeholder="Put the pin on a building or branch"
              aria-label="Put the pin on a building or branch"
              class="w-full"
              @update:model-value="(id: number) => choosePlace(id)"
            />
            <RaMap
              ref="map"
              v-model:pin="state.pin"
              editable
              pin-variant="crisis"
              :auto-fit="false"
              :recentre="false"
              :markers="markers"
              :circles="circles"
              :selected="state.location_id ?? null"
              label="Map for the crisis point. Click to drop the pin, or select a building or branch."
              height-class="h-72"
              @select="(id: number) => choosePlace(id)"
              @ready="showArea"
            />
            <p class="text-sm text-muted">
              <template v-if="state.pin">
                {{ raFormatCoordinates(state.pin) }} ·
                <template v-if="affected.length">
                  {{ affected.length }} {{ affected.length === 1 ? 'place' : 'places' }} in the area:
                  {{ affected.slice(0, 4).map((row) => row.place.name).join(', ') }}<template v-if="affected.length > 4">
                    and {{ affected.length - 4 }} more
                  </template>
                </template>
                <template v-else>
                  no building or branch in the area yet
                </template>
              </template>
              <template v-else>
                No pin yet.
              </template>
            </p>
          </div>
        </UFormField>

        <UFormField
          label="Affected radius"
          name="radius_km"
          required
          help="Every building and branch within this distance of the point is affected."
          :error="fieldErrors.radius_m"
        >
          <div class="flex flex-wrap items-center gap-2">
            <UInputNumber
              v-model="state.radius_km"
              :min="0.05"
              :max="200"
              :step="0.5"
              locale="id-ID"
              :format-options="{ maximumFractionDigits: 2 }"
              class="w-36"
            />
            <span class="text-sm text-muted">km</span>
            <UButton
              v-for="preset in RADIUS_PRESETS"
              :key="preset"
              color="neutral"
              :variant="state.radius_km === preset ? 'subtle' : 'ghost'"
              size="sm"
              :label="`${formatNumber(preset, 1)} km`"
              :aria-pressed="state.radius_km === preset"
              @click="state.radius_km = preset; nextTick(showArea)"
            />
          </div>
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Started on"
            name="date"
            required
            :error="fieldErrors.started_at"
          >
            <DatePicker
              v-model="date"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Time (WIB)"
            name="time"
            required
          >
            <UInput
              v-model="state.time"
              type="time"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          label="What is happening"
          name="description"
          help="Optional. Shown with the crisis, e.g. the water level or the affected floors."
        >
          <UTextarea
            v-model="state.description"
            :rows="3"
            autoresize
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="editing"
          label="Why it changed"
          name="note"
          help="Optional. Kept in the history with what changed."
        >
          <UTextarea
            v-model="state.note"
            :rows="2"
            autoresize
            class="w-full"
          />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="emit('close', false)"
        />
        <UButton
          type="submit"
          form="ra-crisis-form"
          :color="editing ? 'primary' : 'error'"
          :icon="editing ? undefined : 'i-lucide-siren'"
          :label="editing ? 'Save changes' : 'Declare crisis'"
          :loading="saving"
        />
      </div>
    </template>
  </UModal>
</template>
