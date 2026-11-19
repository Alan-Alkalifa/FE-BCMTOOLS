<script setup lang="ts">
/**
 * Sites configuration > Past disasters. WHO's Disease Outbreak News about the country, read daily
 * by the backend, is shown on one hazard (H11 by default) over its review years. BCM
 * switches it on or off, picks the hazard and can read it now.
 */
import type { RaOutbreakInput } from '~/composables/useSitesConfigAdmin'

const toast = useToast()
const { can } = useAuth()
const editable = computed(() => can('sites.config.manage'))
const { data, error, refresh } = useAsyncData('sites-config-outbreaks', () => sitesConfigApi.outbreaks())
const { data: hazardTypes } = useRaHazardTypes()
const hazardItems = computed(() => (hazardTypes.value?.items ?? []).map((item) => ({ label: `${item.code} · ${item.short_name}`, value: item.code })))

const form = reactive<RaOutbreakInput>({ enabled: true, hazard_code: 'H11' })
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
    data.value = await sitesConfigApi.saveOutbreaks({ ...form })
    toast.add({ title: 'WHO outbreak news settings saved', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details ?? { form: adminErrorText(failure) }
  } finally {
    busy.value = false
  }
}

async function readNow() {
  reading.value = true
  try {
    data.value = await sitesConfigApi.readOutbreaks()
    if (data.value.error) toast.add({ title: 'WHO couldn\'t be read', description: data.value.error, color: 'error', icon: 'i-lucide-circle-alert' })
    else toast.add({ title: `Kept ${formatNumber(data.value.rows, 0)} WHO news items`, color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    reading.value = false
  }
}
</script>

<template>
  <UCard data-testid="who-source">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-highlighted">
          Disease outbreaks from WHO
        </h2>
        <USwitch
          v-model="form.enabled"
          label="Read WHO daily"
          :disabled="!editable || !data"
        />
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the WHO settings"
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
          aria-label="Hazard WHO's news counts for"
        />
      </UFormField>
      <p
        class="text-sm text-muted"
        data-testid="who-status"
      >
        <template v-if="data.synced_at">
          Last read {{ formatDateTime(data.synced_at) }}.
        </template>
        <template v-else>
          Not read yet.
        </template>
        {{ formatNumber(data.rows, 0) }} news items<template v-if="data.first && data.last">
          from {{ formatDate(data.first) }} to {{ formatDate(data.last) }}
        </template>.
      </p>
      <UAlert
        v-if="data.error"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The last read failed"
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
          label="Read WHO now"
          :loading="reading"
          @click="readNow"
        />
        <UButton
          type="submit"
          label="Save WHO settings"
          :loading="busy"
        />
      </div>
      <p class="text-xs text-muted">
        Source: WHO, Disease Outbreak News ({{ data.source }}).
      </p>
    </form>
  </UCard>
</template>
