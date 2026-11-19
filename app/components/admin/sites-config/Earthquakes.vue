<script setup lang="ts">
/**
 * Sites configuration > Earthquakes: BMKG's open earthquake data on the building map. BCM switches
 * it on or off and sets the minimum magnitude kept (felt earthquakes are kept whatever their
 * magnitude). The alert radius, how near a building or branch must be for BCM to be emailed,
 * follows each earthquake's magnitude (raAlertRadiusKm).
 * Live for everyone as soon as it is saved; the last read of BMKG shows beside it.
 */
const toast = useToast()
const { can } = useAuth()
const editable = computed(() => can('sites.config.manage'))
const { data, status, error, refresh } = useAsyncData('sites-config-bmkg', () => sitesConfigApi.bmkg())

const form = reactive({ enabled: true, min_magnitude: 5 })
const radiusExamples = [5, 6, 7].map((magnitude) => ({ magnitude, km: raAlertRadiusKm(magnitude) }))
const busy = ref(false)
const errors = ref<Record<string, string>>({})

watch(data, (value) => {
  if (!value) return
  Object.assign(form, { enabled: value.enabled, min_magnitude: value.min_magnitude })
}, { immediate: true })

async function save() {
  errors.value = {}
  busy.value = true
  try {
    data.value = await sitesConfigApi.saveBmkg({ ...form })
    toast.add({ title: 'Earthquake settings saved', description: 'They apply from the next read of BMKG.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details ?? { form: adminErrorText(failure) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Could not load the earthquake settings"
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

    <SkeletonCard
      v-else-if="status === 'pending' && !data"
      fields
      :lines="4"
    />

    <form
      v-else
      class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      novalidate
      @submit.prevent="save"
    >
      <fieldset
        :disabled="!editable"
        class="min-w-0 space-y-6"
      >
        <UAlert
          v-if="errors.form"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errors.form"
        />
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="font-semibold text-highlighted">
                Earthquakes from BMKG
              </h2>
              <USwitch
                v-model="form.enabled"
                label="Read BMKG"
              />
            </div>
          </template>
          <div class="space-y-4">
            <p class="text-sm text-muted">
              Kept and shown on the building map: earthquakes of this magnitude or more, and every earthquake felt by people, whatever its magnitude.
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                label="Minimum magnitude"
                name="min_magnitude"
                hint="3,0 to 9,0"
                :error="errors.min_magnitude"
              >
                <UInputNumber
                  v-model="form.min_magnitude"
                  :min="3"
                  :max="9"
                  :step="0.1"
                  locale="en-GB"
                  :format-options="{ minimumFractionDigits: 1, maximumFractionDigits: 1 }"
                  class="w-full"
                />
              </UFormField>
              <div
                class="space-y-1 text-sm"
                data-testid="bmkg-radius"
              >
                <p class="font-medium text-highlighted">
                  Alert radius
                </p>
                <p class="font-mono text-default">
                  e<sup>(M ÷ 1,01 − 0,13)</sup> km
                </p>
                <p class="text-muted">
                  M{{ raFormatMagnitude(form.min_magnitude) }} {{ raFormatDistance(raAlertRadiusKm(form.min_magnitude) * 1000) }}<template
                    v-for="item in radiusExamples"
                    :key="item.magnitude"
                  >
                    · M{{ raFormatMagnitude(item.magnitude) }} {{ raFormatDistance(item.km * 1000) }}
                  </template>
                </p>
              </div>
            </div>
          </div>
        </UCard>

        <div class="flex justify-end">
          <UButton
            v-if="editable"
            type="submit"
            label="Save earthquake settings"
            :loading="busy"
          />
        </div>
      </fieldset>

      <UCard>
        <div class="space-y-2 text-sm">
          <p class="font-medium text-highlighted">
            How it runs
          </p>
          <p class="text-muted">
            The server reads BMKG every 2 minutes (<code>flask ra poll-bmkg</code>): the latest earthquake, the last 15 of magnitude 5,0 or more and the last 15 felt. A new one near a building or branch is emailed once to everyone who may declare disasters; nothing is declared automatically.
          </p>
          <p
            v-if="data"
            class="text-muted"
            data-testid="bmkg-status"
          >
            <template v-if="data.polled_at">
              Last read {{ formatDateTime(data.polled_at) }}.
            </template>
            <template v-else>
              Not read yet.
            </template>
            <template v-if="data.poll_error">
              The last try couldn't read: {{ data.poll_error }}
            </template>
          </p>
          <p class="text-xs text-muted">
            Source: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika), shown with the data wherever it appears.
          </p>
        </div>
      </UCard>
    </form>
  </div>
</template>
