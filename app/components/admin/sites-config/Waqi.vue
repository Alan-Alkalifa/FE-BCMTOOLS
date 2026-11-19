<script setup lang="ts">
/**
 * Sites configuration > Past disasters. WAQI's air quality stations on the building map, read
 * live and never kept: the area around a station and the AQI from which a building inside it is
 * affected. Says when the server has no WAQI token.
 */
import type { RaWaqiSettingsInput } from '~/composables/useSitesConfigAdmin'

const toast = useToast()
const { can } = useAuth()
const editable = computed(() => can('sites.config.manage'))
const { data, error, refresh } = useAsyncData('sites-config-waqi', () => sitesConfigApi.waqi())

const form = reactive<RaWaqiSettingsInput>({ radius_km: 5, threshold: 101 })
watch(data, (value) => {
  if (value) Object.assign(form, { radius_km: value.radius_km, threshold: value.threshold })
}, { immediate: true })
const band = computed(() => waqiBand(form.threshold))

const busy = ref(false)
const errors = ref<Record<string, string>>({})

async function save() {
  errors.value = {}
  busy.value = true
  try {
    data.value = await sitesConfigApi.saveWaqi({ ...form })
    toast.add({ title: 'WAQI settings saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details ?? { form: adminErrorText(failure) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard data-testid="waqi-source">
    <template #header>
      <h2 class="font-semibold text-highlighted">
        Air quality stations from WAQI
      </h2>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the WAQI settings"
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
        v-if="!data.configured"
        color="warning"
        variant="subtle"
        icon="i-lucide-key-round"
        title="No WAQI token on the server"
        description="Nothing is read until WAQI_TOKEN is set in the backend's .env."
      />
      <UAlert
        v-if="errors.form"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="errors.form"
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          label="Station's area"
          name="radius_km"
          hint="km"
          :error="errors.radius_km"
        >
          <UInputNumber
            v-model="form.radius_km"
            :min="0.5"
            :max="50"
            :step="0.5"
            locale="en-GB"
            :format-options="{ maximumFractionDigits: 1 }"
            :disabled="!editable"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Affected from AQI"
          name="threshold"
          :hint="band?.label"
          :error="errors.threshold"
        >
          <UInputNumber
            v-model="form.threshold"
            :min="1"
            :max="500"
            :step="1"
            locale="en-GB"
            :disabled="!editable"
            class="w-full"
          />
        </UFormField>
      </div>
      <div
        v-if="editable"
        class="flex justify-end"
      >
        <UButton
          type="submit"
          label="Save WAQI settings"
          :loading="busy"
        />
      </div>
      <p class="text-xs text-muted">
        Source: {{ data.source }}.
      </p>
    </form>
  </UCard>
</template>
