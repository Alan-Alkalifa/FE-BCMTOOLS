<script setup lang="ts">
/**
 * Sites configuration > Past disasters. NASA FIRMS's fire hotspots: on the building map, those of
 * the last 7 days over Indonesia (read every hour), with the buildings within the radius; on the
 * hazard page (one hazard, H09 by default), each building's hotspots per day, the past year read
 * once and then every N days. BCM switches it on or off, sets the radius, the hazard, the map's
 * satellites, the lowest confidence kept and the interval, and can read again. FIRMS needs a
 * MAP_KEY on the server: without one the card says so.
 */
import type { RaFirmsInput } from '~/composables/useSitesConfigAdmin'

const toast = useToast()
const { can } = useAuth()
const editable = computed(() => can('sites.config.manage'))
const { data, error, refresh } = useAsyncData('sites-config-firms', () => sitesConfigApi.firms())
const { data: hazardTypes } = useRaHazardTypes()
const hazardItems = computed(() => (hazardTypes.value?.items ?? []).map((item) => ({ label: `${item.code} · ${item.short_name}`, value: item.code })))
const SOURCE_LABELS: Record<string, string> = {
  VIIRS_SNPP_NRT: 'VIIRS on Suomi NPP',
  VIIRS_NOAA20_NRT: 'VIIRS on NOAA-20',
  VIIRS_NOAA21_NRT: 'VIIRS on NOAA-21',
  MODIS_NRT: 'MODIS on Terra and Aqua',
}
const sourceItems = computed(() => (data.value?.all_sources ?? []).map((code) => ({ label: SOURCE_LABELS[code] ?? code, value: code })))
const confidenceItems = [
  { label: 'Low and up (every hotspot)', value: 'low' },
  { label: 'Nominal and up', value: 'nominal' },
  { label: 'High only', value: 'high' },
]

const form = reactive<RaFirmsInput>({ enabled: true, radius_km: 5, hazard_code: 'H09', sources: [], confidence: 'nominal', every_days: 1 })
watch(data, (value) => {
  if (!value) return
  Object.assign(form, {
    enabled: value.switched_on,
    radius_km: value.radius_km,
    hazard_code: value.hazard_code,
    sources: [...value.sources],
    confidence: value.confidence,
    every_days: value.every_days,
  })
}, { immediate: true })

const busy = ref(false)
const reading = ref(false)
const errors = ref<Record<string, string>>({})

async function save() {
  errors.value = {}
  busy.value = true
  try {
    data.value = await sitesConfigApi.saveFirms({ ...form, sources: [...form.sources] })
    toast.add({ title: 'NASA FIRMS settings saved', color: 'success', icon: 'i-lucide-circle-check' })
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
    data.value = await sitesConfigApi.readFirms()
    toast.add({ title: 'NASA FIRMS will be read again', description: 'The map within 2 minutes, buildings that failed at the next history run.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    reading.value = false
  }
}
</script>

<template>
  <UCard data-testid="firms-source">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-highlighted">
          Fire hotspots from NASA FIRMS
        </h2>
        <USwitch
          v-model="form.enabled"
          label="Read NASA FIRMS"
          :disabled="!editable || !data"
        />
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the NASA FIRMS settings"
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
        title="The server has no FIRMS MAP_KEY"
        data-testid="firms-no-key"
      >
        <template #description>
          FIRMS stays off until the administrator sets FIRMS_MAP_KEY. A key is free from
          <a
            :href="data.key_url"
            target="_blank"
            rel="noopener"
            class="text-primary hover:underline"
          >NASA FIRMS</a>.
        </template>
      </UAlert>
      <UAlert
        v-if="errors.form"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="errors.form"
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          label="Radius around a building (km)"
          name="radius_km"
          :error="errors.radius_km"
        >
          <UInputNumber
            v-model="form.radius_km"
            :min="0.5"
            :max="50"
            :step="0.5"
            :disabled="!editable"
            class="w-full"
          />
        </UFormField>
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
            aria-label="Hazard NASA FIRMS's hotspots count for"
          />
        </UFormField>
        <UFormField
          label="Satellites on the map"
          name="sources"
          :error="errors.sources"
        >
          <USelectMenu
            v-model="form.sources"
            value-key="value"
            multiple
            :items="sourceItems"
            :search-input="false"
            :disabled="!editable"
            class="w-full"
            aria-label="Satellites read for the map"
          />
        </UFormField>
        <UFormField
          label="Lowest confidence kept"
          name="confidence"
          :error="errors.confidence"
        >
          <USelectMenu
            v-model="form.confidence"
            value-key="value"
            :items="confidenceItems"
            :search-input="false"
            :disabled="!editable"
            class="w-full"
            aria-label="Lowest confidence kept"
          />
        </UFormField>
        <UFormField
          label="Read each building's history again every (days)"
          name="every_days"
          :error="errors.every_days"
        >
          <UInputNumber
            v-model="form.every_days"
            :min="1"
            :max="30"
            :disabled="!editable"
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="text-xs text-muted">
        A new radius or confidence reads every building's history again from the past year. The history counts one satellite (VIIRS on Suomi NPP), so a fire seen by several counts once a pass.
      </p>

      <p
        class="text-sm text-muted"
        data-testid="firms-status"
      >
        <template v-if="data.polled_at">
          Map read {{ formatDateTime(data.polled_at) }}, {{ formatNumber(data.hotspots, 0) }} hotspots kept.
        </template>
        <template v-else>
          Map not read yet.
        </template>
        History: {{ formatNumber(data.history.read, 0) }} of {{ formatNumber(data.history.buildings, 0) }} {{ data.history.buildings === 1 ? 'building' : 'buildings' }} read, {{ formatNumber(data.history.due, 0) }} due{{ data.history.held_from ? `, counted from ${formatDate(data.history.held_from)}` : '' }}.
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
          variant="outline"
          icon="i-lucide-refresh-cw"
          label="Read again"
          :loading="reading"
          :disabled="!data.configured"
          @click="readAgain"
        />
        <UButton
          type="submit"
          label="Save NASA FIRMS settings"
          :loading="busy"
        />
      </div>
      <p class="text-xs text-muted">
        Source: {{ data.source }}.
      </p>
    </form>
  </UCard>
</template>
