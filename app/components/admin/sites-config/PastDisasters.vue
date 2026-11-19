<script setup lang="ts">
/**
 * Sites configuration > Past disasters. BNPB's DIBI (Data Informasi Bencana Indonesia), read by the
 * backend on schedule, shows each hazard the disasters recorded in the building's regency over
 * its review years. BCM switches the read on or off, sets how often and how many years (also the
 * review years when none are picked), and which RA hazard each DIBI category counts for (or
 * none).
 */
import type { RaDibiInput } from '~/composables/useSitesConfigAdmin'

const toast = useToast()
const { can } = useAuth()
const editable = computed(() => can('sites.config.manage'))
const { data, status, error, refresh } = useAsyncData('sites-config-dibi', () => sitesConfigApi.dibi())
const { data: hazardTypes } = useRaHazardTypes()

const form = reactive<RaDibiInput>({ enabled: true, every_days: 7, years: 10, hazards: {} })
const busy = ref(false)
const reading = ref(false)
const errors = ref<Record<string, string>>({})

watch(data, (value) => {
  if (!value) return
  Object.assign(form, {
    enabled: value.enabled,
    every_days: value.every_days,
    years: value.years,
    hazards: Object.fromEntries(value.categories.map((item) => [item.category, item.hazard_code])),
  })
}, { immediate: true })

const NONE = '__none'
const hazardItems = computed(() => [
  { label: 'No hazard', value: NONE },
  ...(hazardTypes.value?.items ?? []).map((item) => ({ label: `${item.code} · ${item.short_name}`, value: item.code })),
])
function setHazard(category: string, value: string) {
  form.hazards[category] = value === NONE ? null : value
}

async function save() {
  errors.value = {}
  busy.value = true
  try {
    data.value = await sitesConfigApi.saveDibi({ ...form, hazards: { ...form.hazards } })
    toast.add({ title: 'Past disaster settings saved', description: 'The suggestions follow them right away.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    errors.value = details ?? { form: adminErrorText(failure) }
  } finally {
    busy.value = false
  }
}

/** For when the server can't read DIBI itself. The Tabular tab's download, Excel or CSV. */
const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  importing.value = true
  try {
    const result = await sitesConfigApi.importDibi(file)
    data.value = result.status
    const years = result.years.length ? ` from ${result.years[0]} to ${result.years[result.years.length - 1]}` : ''
    toast.add({
      title: `Kept ${formatNumber(result.kept, 0)} records${years}`,
      description: result.skipped ? `${formatNumber(result.skipped, 0)} rows had no id or date and were skipped.` : 'The suggestions use them right away.',
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    toast.add({ title: 'Couldn\'t import the file', description: details?.file ?? adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    importing.value = false
  }
}

async function readNow() {
  reading.value = true
  try {
    data.value = await sitesConfigApi.readDibi()
    toast.add({ title: 'DIBI will be read shortly', description: 'At the scheduler\'s next run, within 30 minutes.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (failure) {
    toast.add({ title: adminErrorText(failure), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    reading.value = false
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
      title="Could not load the past disaster settings"
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
      :lines="6"
    />

    <form
      v-else-if="data"
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
                Past disasters from BNPB (DIBI)
              </h2>
              <USwitch
                v-model="form.enabled"
                label="Read DIBI on schedule"
              />
            </div>
          </template>
          <div class="space-y-4">
            <p class="text-sm text-muted">
              Each hazard page shows the disasters DIBI recorded in the building's regency over the hazard's review years, or over these years when none are picked.
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                label="Read every"
                name="every_days"
                hint="days"
                :error="errors.every_days"
              >
                <UInputNumber
                  v-model="form.every_days"
                  :min="1"
                  :max="90"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Years counted"
                name="years"
                hint="the workbook counts 10"
                :error="errors.years"
              >
                <UInputNumber
                  v-model="form.years"
                  :min="1"
                  :max="30"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Which hazard each DIBI category counts for
            </h2>
            <p
              v-if="errors.hazards"
              class="mt-1 text-sm text-error"
            >
              {{ errors.hazards }}
            </p>
          </template>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs text-muted uppercase">
                <th class="px-4 py-2 font-medium">
                  DIBI category
                </th>
                <th class="px-4 py-2 text-right font-medium">
                  Records
                </th>
                <th class="px-4 py-2 font-medium">
                  RA hazard
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in data.categories"
                :key="item.category"
                class="border-b border-default last:border-b-0"
              >
                <td class="px-4 py-2">
                  {{ item.category }}
                </td>
                <td class="px-4 py-2 text-right tabular-nums">
                  {{ formatNumber(item.rows, 0) }}
                </td>
                <td class="px-4 py-2">
                  <USelectMenu
                    :model-value="form.hazards[item.category] ?? NONE"
                    value-key="value"
                    :items="hazardItems"
                    class="w-full min-w-56"
                    :aria-label="`RA hazard for ${item.category}`"
                    @update:model-value="(value: string) => setHazard(item.category, value)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </UCard>

        <div class="flex justify-end">
          <UButton
            v-if="editable"
            type="submit"
            label="Save past disaster settings"
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
            The server reads DIBI every {{ data.every_days }} days with the reminders run. Each read takes the current and the previous year, and the years not read yet.
          </p>
          <p
            class="text-muted"
            data-testid="dibi-status"
          >
            <template v-if="data.synced_at">
              Last read {{ formatDateTime(data.synced_at) }}.
            </template>
            <template v-else>
              Not read yet.
            </template>
            {{ formatNumber(data.rows, 0) }} records<template v-if="data.first && data.last">
              from {{ formatDate(data.first) }} to {{ formatDate(data.last) }}
            </template>.
          </p>
          <UAlert
            v-if="data.error"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="The last read couldn't read every year"
            :description="data.error"
          />
          <div
            v-if="editable"
            class="flex flex-wrap gap-2"
          >
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-refresh-cw"
              label="Read at the next run"
              :loading="reading"
              @click="readNow"
            />
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-file-up"
              label="Import a DIBI download"
              :loading="importing"
              @click="fileInput?.click()"
            />
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.csv"
              class="hidden"
              aria-label="DIBI download"
              @change="importFile"
            >
          </div>

          <p class="text-xs text-muted">
            Source: BNPB, Data Informasi Bencana Indonesia ({{ data.source }}).
          </p>
        </div>
      </UCard>
    </form>
  </div>
</template>
