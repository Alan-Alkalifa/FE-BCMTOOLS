<script setup lang="ts">
/**
 * Sites configuration > Past disasters. BMKG's weather early warnings, read by the backend every
 * 10 minutes with the earthquakes, show on the building map and, as history, on one hazard
 * (H06 by default). BCM switches them on or off, picks the hazard and can read them at the next
 * poll.
 */
import type { RaWeatherInput } from '~/composables/useSitesConfigAdmin'

const toast = useToast()
const { can } = useAuth()
const editable = computed(() => can('sites.config.manage'))
const { data, error, refresh } = useAsyncData('sites-config-weather', () => sitesConfigApi.weather())
const { data: hazardTypes } = useRaHazardTypes()
const hazardItems = computed(() => (hazardTypes.value?.items ?? []).map((item) => ({ label: `${item.code} · ${item.short_name}`, value: item.code })))

const form = reactive<RaWeatherInput>({ enabled: true, hazard_code: 'H06' })
watch(data, (value) => {
  if (value) Object.assign(form, { enabled: value.enabled, hazard_code: value.hazard_code })
}, { immediate: true })

const busy = ref(false)
const reading = ref(false)
const errors = ref<Record<string, string>>({})

async function save() {
  errors.value = {}
  busy.value = true
  try {
    data.value = await sitesConfigApi.saveWeather({ ...form })
    toast.add({ title: 'BMKG weather warning settings saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details ?? { form: adminErrorText(failure) }
  } finally {
    busy.value = false
  }
}

async function readNext() {
  reading.value = true
  try {
    data.value = await sitesConfigApi.readWeather()
    toast.add({ title: 'BMKG will be read shortly', description: 'At the next earthquake poll, within 2 minutes.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    reading.value = false
  }
}
</script>

<template>
  <UCard data-testid="weather-source">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-highlighted">
          Weather early warnings from BMKG
        </h2>
        <USwitch
          v-model="form.enabled"
          label="Read BMKG every 10 minutes"
          :disabled="!editable || !data"
        />
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the weather warning settings"
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
        label="History counts for"
        name="hazard_code"
        :error="errors.hazard_code"
      >
        <USelectMenu
          v-model="form.hazard_code"
          value-key="value"
          :items="hazardItems"
          :disabled="!editable"
          class="w-full"
          aria-label="Hazard BMKG's weather warnings count for"
        />
      </UFormField>
      <p
        class="text-sm text-muted"
        data-testid="weather-status"
      >
        <template v-if="data.polled_at">
          Last read {{ formatDateTime(data.polled_at) }}.
        </template>
        <template v-else>
          Not read yet.
        </template>
        {{ formatNumber(data.active, 0) }} active, {{ formatNumber(data.rows, 0) }} kept, {{ formatNumber(data.over_places, 0) }} over a building or branch.
      </p>
      <UAlert
        v-if="data.poll_error"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The last read had a problem"
        :description="data.poll_error"
      />
      <div
        v-if="editable"
        class="flex flex-wrap justify-end gap-2"
      >
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          label="Read at the next poll"
          :loading="reading"
          @click="readNext"
        />
        <UButton
          type="submit"
          label="Save weather settings"
          :loading="busy"
        />
      </div>
      <p class="text-xs text-muted">
        Source. {{ data.source }}, peringatan dini cuaca.
      </p>
    </form>
  </UCard>
</template>
