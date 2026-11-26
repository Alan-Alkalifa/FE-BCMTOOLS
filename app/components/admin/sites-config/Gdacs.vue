<script setup lang="ts">
/**
 * Sites configuration > Past disasters. GDACS's disaster alerts: on the building map, the alerts
 * over Indonesia of the last 7 days (read every hour) with the buildings within the radius; on
 * the hazard page, every alert kept (the past year read once), each event type counting for one
 * RA hazard. BCM switches it on or off, sets the radius, picks the disasters shown (every type is
 * still read and kept), the hazard per event type (or none), can go back to the defaults and
 * read again.
 */
import type { RaGdacsInput } from '~/composables/useSitesConfigAdmin'

const toast = useToast()
const { can } = useAuth()
const editable = computed(() => can('sites.config.manage'))
const { data, error, refresh } = useAsyncData('sites-config-gdacs', () => sitesConfigApi.gdacs())
const { data: hazardTypes } = useRaHazardTypes()
const NONE = 'none'
const hazardItems = computed(() => [
  { label: 'None (not on the hazard page)', value: NONE },
  ...(hazardTypes.value?.items ?? []).map((item) => ({ label: `${item.code} · ${item.short_name}`, value: item.code })),
])

const form = reactive({ enabled: true, radius_km: 100 })
/** The event types shown on the map and the hazard page. */
const shown = ref<string[]>([])
function toggleType(kind: string, on: boolean | 'indeterminate') {
  const next = new Set(shown.value)
  if (on === true) next.add(kind)
  else next.delete(kind)
  shown.value = Object.keys(data.value?.event_types ?? {}).filter((code) => next.has(code))
}
/** Per GDACS event type, the hazard picked ("none" for none). */
const hazards = ref<Record<string, string>>({})
function fill(source: Record<string, string>) {
  hazards.value = Object.fromEntries(Object.keys(data.value?.event_types ?? {}).map((kind) => [kind, source[kind] ?? NONE]))
}
watch(data, (value) => {
  if (!value) return
  Object.assign(form, { enabled: value.enabled, radius_km: value.radius_km })
  shown.value = [...value.types]
  fill(value.hazards)
}, { immediate: true })

const busy = ref(false)
const reading = ref(false)
const errors = ref<Record<string, string>>({})

async function save() {
  errors.value = {}
  busy.value = true
  try {
    const body: RaGdacsInput = {
      ...form,
      types: [...shown.value],
      hazards: Object.fromEntries(Object.entries(hazards.value).map(([kind, code]) => [kind, code === NONE ? null : code])),
    }
    data.value = await sitesConfigApi.saveGdacs(body)
    toast.add({ title: 'GDACS settings saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details ?? { form: adminErrorText(failure) }
  } finally {
    busy.value = false
  }
}

async function readAgain() {
  reading.value = true
  try {
    data.value = await sitesConfigApi.readGdacs()
    toast.add({ title: 'GDACS will be read again', description: 'At the next earthquake poll, within 2 minutes.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    reading.value = false
  }
}
</script>

<template>
  <UCard data-testid="gdacs-source">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-highlighted">
          Disaster alerts from GDACS
        </h2>
        <USwitch
          v-model="form.enabled"
          label="Read GDACS"
          :disabled="!editable || !data"
        />
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the GDACS settings"
      :description="adminErrorText(error)"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="outline"
          label="Try again"
          @click="refresh()"
        />
      </template>
    </UAlert>

    <form
      v-else-if="data"
      class="space-y-4"
      novalidate
      @submit.prevent="save"
    >
      <UAlert
        v-if="errors.form"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="errors.form"
      />
      <UFormField
        label="Radius around an alert (km)"
        name="radius_km"
        :error="errors.radius_km"
      >
        <UInputNumber
          v-model="form.radius_km"
          :min="5"
          :max="500"
          :step="5"
          :disabled="!editable"
          class="w-full sm:w-48"
        />
      </UFormField>
      <fieldset class="space-y-2">
        <legend class="text-sm font-medium text-highlighted">
          Disasters shown
        </legend>
        <p class="text-xs text-muted">
          On the building map, its tab and the hazard page. Every type is still read and kept, so one picked later shows its past alerts too.
        </p>
        <div class="flex flex-wrap gap-x-5 gap-y-2">
          <UCheckbox
            v-for="(label, kind) in data.event_types"
            :key="kind"
            :model-value="shown.includes(kind)"
            :label="`${label} (${kind})`"
            :disabled="!editable"
            @update:model-value="(on: boolean | 'indeterminate') => toggleType(kind, on)"
          />
        </div>
        <p
          v-if="errors.types"
          class="text-sm text-error"
        >
          {{ errors.types }}
        </p>
      </fieldset>
      <fieldset class="space-y-2">
        <legend class="text-sm font-medium text-highlighted">
          Each alert type counts for
        </legend>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField
            v-for="(label, kind) in data.event_types"
            :key="kind"
            :label="`${label} (${kind})`"
            :name="`hazards.${kind}`"
            :error="errors[`hazards.${kind}`]"
          >
            <USelectMenu
              v-model="hazards[kind]"
              value-key="value"
              :items="hazardItems"
              :disabled="!editable"
              class="w-full"
              :aria-label="`Hazard GDACS's ${label.toLowerCase()} alerts count for`"
            />
          </UFormField>
        </div>
      </fieldset>

      <p
        class="text-sm text-muted"
        data-testid="gdacs-status"
      >
        <template v-if="data.polled_at">
          Last read {{ formatDateTime(data.polled_at) }}, {{ formatNumber(data.events, 0) }} alerts kept.
        </template>
        <template v-else>
          Not read yet.
        </template>
        <template v-if="data.history.done">
          The past year is in{{ data.history.held_from ? `, from ${formatDate(data.history.held_from)}` : '' }}.
        </template>
        <template v-else-if="data.history.held_from">
          The past year is being read, back to {{ formatDate(data.history.held_from) }} so far.
        </template>
      </p>
      <UAlert
        v-if="data.poll_error || data.history.error"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The last read had a problem"
        :description="[data.poll_error, data.history.error].filter(Boolean).join('\n')"
        :ui="{ description: 'whitespace-pre-line' }"
      />
      <div
        v-if="editable"
        class="flex flex-wrap justify-end gap-2"
      >
        <UButton
          color="neutral"
          variant="ghost"
          label="Use the defaults"
          @click="fill(data.default_hazards)"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          label="Read again"
          :loading="reading"
          @click="readAgain"
        />
        <UButton
          type="submit"
          label="Save GDACS settings"
          :loading="busy"
        />
      </div>
      <p class="text-xs text-muted">
        Source: {{ data.source }}.
      </p>
    </form>
  </UCard>
</template>
