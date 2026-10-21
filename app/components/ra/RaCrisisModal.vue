<script setup lang="ts">
import { parseDate, type CalendarDate } from '@internationalized/date'
import { z } from 'zod'
import type { RaCrisis, RaCrisisInput, RaMapPlace } from '~/composables/useRa'

/**
 * Declares a crisis, or edits an open one: the hazard, where it happens (a building or branch,
 * or coordinates), the affected radius and when it started (WIB). Closes with the saved crisis,
 * or false.
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
const atLocation = !props.crisis || props.crisis.location !== null
const state = reactive({
  hazard_code: props.crisis?.hazard_code ?? '',
  where: (atLocation ? 'location' : 'point') as 'location' | 'point',
  location_id: props.crisis?.location?.id ?? props.locationId ?? undefined as number | undefined,
  coordinates: props.crisis ? raFormatCoordinates({ lat: props.crisis.latitude, lng: props.crisis.longitude }) : '',
  radius_km: (props.crisis?.radius_m ?? 1000) / 1000,
  date: startedAt.date,
  time: startedAt.time,
  description: props.crisis?.description ?? '',
  note: '',
})

const schema = z.object({
  hazard_code: z.string().min(1, 'Choose the hazard.'),
  where: z.enum(['location', 'point']),
  location_id: z.number().optional(),
  coordinates: z.string(),
  radius_km: z.number({ error: 'Enter the radius in km.' }).min(0.05, 'At least 0,05 km (50 m).').max(200, 'At most 200 km.'),
  date: z.string().min(1, 'Pick the date.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Enter the time, e.g. 14:30.'),
  description: z.string(),
  note: z.string(),
}).superRefine((value, ctx) => {
  if (value.where === 'location' && !value.location_id) {
    ctx.addIssue({ code: 'custom', path: ['location_id'], message: 'Choose the building or branch.' })
  }
  if (value.where === 'point' && !raParseCoordinates(value.coordinates)) {
    ctx.addIssue({ code: 'custom', path: ['coordinates'], message: 'Enter latitude and longitude, e.g. -6.271633, 106.719358.' })
  }
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
  const point = state.where === 'point' ? raParseCoordinates(state.coordinates) : null
  const body: RaCrisisInput = {
    hazard_code: state.hazard_code,
    location_id: state.where === 'location' ? state.location_id ?? null : null,
    ...(point ? { latitude: point.lat, longitude: point.lng } : {}),
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
    :ui="{ content: 'sm:max-w-xl' }"
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
          name="where"
        >
          <URadioGroup
            v-model="state.where"
            orientation="horizontal"
            :items="[
              { label: 'At a building or branch', value: 'location' },
              { label: 'At coordinates', value: 'point' },
            ]"
          />
        </UFormField>

        <UFormField
          v-if="state.where === 'location'"
          label="Building or branch"
          name="location_id"
          required
          help="The crisis is centred on its map pin. Places without a pin aren't listed."
          :error="fieldErrors.location_id"
        >
          <USelectMenu
            v-model="state.location_id"
            :items="placeItems"
            value-key="value"
            placeholder="Search by name"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-else
          label="Coordinates"
          name="coordinates"
          required
          help="Latitude, longitude, as Google Maps copies them."
          :error="fieldErrors.location_id || fieldErrors.latitude"
        >
          <UInput
            v-model="state.coordinates"
            placeholder="-6.271633, 106.719358"
            inputmode="decimal"
            class="w-full"
          />
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
              @click="state.radius_km = preset"
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
