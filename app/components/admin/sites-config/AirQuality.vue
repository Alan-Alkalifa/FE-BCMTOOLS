<script setup lang="ts">
/**
 * Sites configuration > Past disasters. OpenAQ's PM2.5 at the station nearest to each building
 * is shown on one hazard (H10 by default) over its review years. Each day whose average
 * is above the threshold counts once. The backend reads a few buildings every run and needs an
 * OpenAQ API key (OPENAQ_API_KEY).
 */
import type { RaAirQualityInput } from '~/composables/useSitesConfigAdmin'

const toast = useToast()
const { can } = useAuth()
const editable = computed(() => can('sites.config.manage'))
const { data, error, refresh } = useAsyncData('sites-config-air-quality', () => sitesConfigApi.airQuality())
const { data: hazardTypes } = useRaHazardTypes()
const hazardItems = computed(() => (hazardTypes.value?.items ?? []).map((item) => ({ label: `${item.code} · ${item.short_name}`, value: item.code })))

const form = reactive<RaAirQualityInput>({ enabled: true, hazard_code: 'H10', threshold: 55.4, every_days: 7 })
watch(data, (value) => {
  if (!value) return
  Object.assign(form, { enabled: value.enabled, hazard_code: value.hazard_code, threshold: value.threshold, every_days: value.every_days })
}, { immediate: true })

const busy = ref(false)
const reading = ref(false)
const errors = ref<Record<string, string>>({})

async function save() {
  errors.value = {}
  busy.value = true
  try {
    data.value = await sitesConfigApi.saveAirQuality({ ...form })
    toast.add({ title: 'OpenAQ settings saved', color: 'success', icon: 'i-lucide-circle-check' })
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
    data.value = await sitesConfigApi.readAirQuality()
    toast.add({ title: 'Every building will be read again', description: `${data.value.per_run} buildings at each scheduler run.`, color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    reading.value = false
  }
}
</script>

<template>
  <UCard data-testid="openaq-source">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-highlighted">
          Air quality from OpenAQ
        </h2>
        <USwitch
          v-model="form.enabled"
          label="Read OpenAQ"
          :disabled="!editable || !data"
        />
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the OpenAQ settings"
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
        title="No OpenAQ API key on the server"
        description="Set OPENAQ_API_KEY in the backend's .env and restart it. Nothing is read until then."
      />
      <UAlert
        v-if="errors.form"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="errors.form"
      />
      <UFormField
        label="Counts for"
        name="hazard_code"
        :error="errors.hazard_code"
      >
        <USelectMenu
          v-model="form.hazard_code"
          value-key="value"
          :items="hazardItems"
          :disabled="!editable"
          class="w-full"
          aria-label="Hazard OpenAQ's days count for"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          label="Daily PM2.5 above"
          name="threshold"
          hint="µg/m³"
          :error="errors.threshold"
        >
          <UInputNumber
            v-model="form.threshold"
            :min="1"
            :max="500"
            :step="0.1"
            locale="en-GB"
            :format-options="{ maximumFractionDigits: 1 }"
            :disabled="!editable"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Read each building every"
          name="every_days"
          hint="days"
          :error="errors.every_days"
        >
          <UInputNumber
            v-model="form.every_days"
            :min="1"
            :max="90"
            :disabled="!editable"
            class="w-full"
          />
        </UFormField>
      </div>
      <p
        class="text-sm text-muted"
        data-testid="openaq-status"
      >
        {{ formatNumber(data.read, 0) }} of {{ formatNumber(data.locations, 0) }} buildings with coordinates read, {{ formatNumber(data.with_station, 0) }} with a station within 25 km.
        <template v-if="data.last_read_at">
          Last read {{ formatDateTime(data.last_read_at) }}.
        </template>
      </p>
      <UAlert
        v-if="data.error"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The last run had a problem"
        :description="data.error"
      />
      <div
        v-if="editable"
        class="flex flex-wrap justify-end gap-2"
      >
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          label="Read every building again"
          :loading="reading"
          @click="readAgain"
        />
        <UButton
          type="submit"
          label="Save OpenAQ settings"
          :loading="busy"
        />
      </div>
      <p class="text-xs text-muted">
        Source. OpenAQ ({{ data.source }}).
      </p>
    </form>
  </UCard>
</template>
