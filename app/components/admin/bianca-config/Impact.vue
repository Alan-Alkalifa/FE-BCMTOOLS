<script setup lang="ts">
import type { BiancaConfigPayload, BiancaListItems, BiancaMtdOption } from '~/composables/useBiancaConfigAdmin'

const model = defineModel<BiancaConfigPayload>({ required: true })
const props = defineProps<{ disabled: boolean, listItems: BiancaListItems }>()
const route = useRoute()
const router = useRouter()
const items = [
  { value: 'thresholds', label: 'Impact thresholds', description: 'Financial loss and score alerts used by the assessment.' },
  { value: 'financial-bands', label: 'Financial loss matrix', description: 'Five risk bands of potential cumulative financial loss (Part 1), with their bounds in IDR.' },
  { value: 'customer-matrix', label: 'Customer impact matrix', description: 'Workbook guidance for customer service impact scores 1–3.' },
  { value: 'regulator-matrix', label: 'Regulatory impact matrix', description: 'Workbook guidance for regulatory impact scores 1–3.' },
  { value: 'mtd-guide', label: 'Suggested MTD rule', description: 'First qualifying impact period, with the workbook fallback.' },
  { value: 'expected-mtd', label: 'Expected MTD', description: 'Expected MTD must be equal to or shorter than Suggested MTD. The choices and their categories come from Master data › Master MTD.' },
  { value: 'conversion', label: 'Time conversion', description: 'Convert days and weeks to hours for duration comparisons.' },
  { value: 'limits', label: 'Workbook limits', description: 'Rows of the Excel template: business functions and dependency rows. The web form takes any number of functions.' },
  { value: 'review', label: 'Review period', description: 'How long a final BIA stays valid before it is due for review (renewal). Manage and Monitoring show the renewal date from it.' },
]
const selected = computed({
  get: () => route.query.impact === 'impact-matrix' ? 'customer-matrix' : items.find((item) => item.value === route.query.impact)?.value ?? 'thresholds',
  set: (value: string) => router.replace({ query: { ...route.query, impact: value } }),
})
const current = computed(() => items.find((item) => item.value === selected.value)!)
const numeric = [
  { group: 'thresholds', key: 'loss_alert_idr', label: 'Financial loss alert (IDR)', min: 0, max: 1e15 },
  { group: 'thresholds', key: 'score_alert', label: 'Highlighted impact score', min: 1, max: 3 },
  { group: 'conversion', key: 'hours_per_day', label: 'Hours per day', min: 0.1, max: 24, step: 0.1 },
  { group: 'conversion', key: 'days_per_week', label: 'Days per week', min: 0.1, max: 7, step: 0.1 },
  { group: 'limits', key: 'max_functions', label: 'Function rows in the Excel template', min: 1, max: 30 },
  { group: 'limits', key: 'it_slots', label: 'IT rows per function', min: 1, max: 4 },
  { group: 'limits', key: 'dependency_slots', label: 'Non-IT rows per function', min: 1, max: 4 },
  { group: 'review', key: 'review_period_months', label: 'Review period of a final BIA (months)', min: 1, max: 60 },
] as const
const fields = computed(() => numeric.filter((field) => field.group === selected.value))
const activePeriods = computed(() => props.listItems.periods.filter((row) => row.active && row.code).map((row) => row.code.trim()))
const suggested = computed(() => props.listItems.suggested_mtd.filter((row) => row.active && row.code).map((row) => row.code.trim()))
const mtdRows = computed(() => model.value.mtd_options ?? [...new Set([
  ...model.value.expected_mtd.map((row) => row.value), ...props.listItems.dependency_mtd.map((row) => row.code),
])].map((value): BiancaMtdOption => {
  const expected = model.value.expected_mtd.find((row) => row.value === value)
  const dependency = props.listItems.dependency_mtd.find((row) => row.code === value)
  return {
    value, code: value.replaceAll(' ', ''), label: dependency?.label ?? value,
    category: expected?.category ?? null, description: dependency?.text ?? null,
    use_it: !!expected, use_non_it: !!dependency, active: !!expected || !!dependency?.active,
  }
}))
// Very High starts where the financial loss alert is: its minimum sets the alert (and the
// server refuses the two apart), so the alert is only typed directly when the band has no bound.
const veryHigh = computed(() => model.value.financial_bands.find((band) => band.code === 'very_high'))
watch(() => veryHigh.value?.min_idr, (value) => {
  if (value != null && !props.disabled) model.value.loss_alert_idr = value
})
function setBound(band: BiancaConfigPayload['financial_bands'][number], key: 'min_idr' | 'max_idr', value: number | null | undefined) {
  band[key] = value ?? null
}
// The completed workbook's bands (BIA_TERISI, Part 1), offered while no band has bounds yet.
const WORKBOOK_BOUNDS: Record<string, [number | null, number | null]> = {
  very_high: [4e9, null], high: [2e9, 4e9], medium: [3e8, 2e9], low: [2e8, 3e8], very_low: [0, 2e8],
}
const noBounds = computed(() => model.value.financial_bands.every((band) => band.min_idr == null && band.max_idr == null))
function useWorkbookBounds() {
  for (const band of model.value.financial_bands) {
    const [min, max] = WORKBOOK_BOUNDS[band.code] ?? [null, null]
    band.min_idr = min
    band.max_idr = max
  }
}
function boundsText(band: BiancaConfigPayload['financial_bands'][number]) {
  const idr = (value: number) => `IDR ${formatNumber(value)}`
  if (band.min_idr != null && band.max_idr != null) return `${idr(band.min_idr)} – ${idr(band.max_idr)}`
  if (band.min_idr != null) return `Above ${idr(band.min_idr)}`
  if (band.max_idr != null) return `Up to ${idr(band.max_idr)}`
  return 'No bounds set'
}
// The MTD choices are read-only here: they come from Master data › Master MTD (the server
// copies it into the draft on every save).
const { can } = useAuth()
function durationHours(value: string) {
  const duration = /^(\d+(?:\.\d+)?) (hour|day|week)s?$/.exec(value)
  if (!duration) return '—'
  const unit = duration[2] === 'week' ? model.value.hours_per_day * model.value.days_per_week : duration[2] === 'day' ? model.value.hours_per_day : 1
  return formatNumber(Number(duration[1]) * unit)
}
function setPeriod(period: string, value: string) {
  const mapping = Object.fromEntries(Object.entries(model.value.suggested_mtd_by_period ?? {}).filter(([key]) => key !== period))
  if (value) mapping[period] = value
  model.value.suggested_mtd_by_period = mapping
}
const mappedPeriods = computed(() => [...new Set([...activePeriods.value, ...Object.keys(model.value.suggested_mtd_by_period ?? {})])])
const workbookDefault = '__workbook_default__'
function mappingChoices(current?: string | null) {
  const durations = [...new Set([...suggested.value, ...(current ? [current] : [])])]
  return [{ label: 'Workbook default', value: workbookDefault }, ...durations.map((value) => ({ value, label: value }))]
}
</script>

<template>
  <AdminBiancaConfigSectionLayout
    v-model="selected"
    label="Impact and MTD"
    :items="items"
  >
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1 basis-60">
          <h2 class="font-semibold text-highlighted">
            {{ current.label }}
          </h2><p class="mt-1 text-sm text-muted">
            {{ current.description }}
          </p>
        </div>
        <UButton
          v-if="selected === 'expected-mtd' && can('masterdata.mtd.view', 'masterdata.mtd.manage')"
          :to="{ path: MASTER_MTD_PATH, query: { part: 'options' } }"
          color="neutral"
          variant="outline"
          icon="i-lucide-timer"
          :label="can('masterdata.mtd.manage') ? 'Edit in Master MTD' : 'Open Master MTD'"
        />
      </div>
    </template>
    <fieldset
      :disabled="disabled"
      class="min-w-0 space-y-5"
    >
      <template v-if="selected === 'financial-bands'">
        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          title="Bounds as in BIANCA's risk matrix"
          description="Very High's minimum is the financial loss alert: it highlights Part 1 losses and drives the Suggested MTD rule. The workbook doesn't say which band a loss of exactly a bound belongs to; confirm with BCM before relying on it."
        >
          <template
            v-if="noBounds && !disabled"
            #actions
          >
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              icon="i-lucide-wand-sparkles"
              label="Use workbook bounds"
              @click="useWorkbookBounds"
            />
          </template>
        </UAlert>
        <div class="overflow-x-auto rounded-lg border border-default">
          <table class="w-full min-w-[48rem] text-sm">
            <caption class="sr-only">
              Financial loss bands
            </caption>
            <thead class="bg-muted text-left text-xs uppercase text-muted">
              <tr>
                <th class="w-40 px-3 py-2 ps-4">
                  Risk impact
                </th>
                <th class="w-48 px-3 py-2">
                  From (IDR)
                </th>
                <th class="w-48 px-3 py-2">
                  To (IDR)
                </th>
                <th class="px-3 py-2 pe-4">
                  Description shown to assessors
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="band in model.financial_bands"
                :key="band.code"
              >
                <td class="px-3 py-2 ps-4 align-top">
                  <UInput
                    v-model="band.label"
                    :maxlength="255"
                    class="w-full"
                    :aria-label="band.code + ' label'"
                  />
                </td>
                <td class="px-3 py-2 align-top">
                  <UInputNumber
                    :model-value="band.min_idr ?? undefined"
                    :min="0"
                    :max="1e15"
                    placeholder="No minimum"
                    :increment="false"
                    :decrement="false"
                    class="w-full"
                    :aria-label="band.label + ' from (IDR)'"
                    @update:model-value="setBound(band, 'min_idr', $event)"
                  />
                  <p
                    v-if="band.code === 'very_high'"
                    class="mt-1 text-xs text-muted"
                  >
                    Also the financial loss alert.
                  </p>
                </td>
                <td class="px-3 py-2 align-top">
                  <span
                    v-if="band.code === 'very_high'"
                    class="inline-block py-1.5 text-muted"
                  >No limit</span>
                  <UInputNumber
                    v-else
                    :model-value="band.max_idr ?? undefined"
                    :min="0"
                    :max="1e15"
                    placeholder="No maximum"
                    :increment="false"
                    :decrement="false"
                    class="w-full"
                    :aria-label="band.label + ' to (IDR)'"
                    @update:model-value="setBound(band, 'max_idr', $event)"
                  />
                </td>
                <td class="px-3 py-2 pe-4 align-top">
                  <UInput
                    v-model="band.description"
                    :maxlength="2000"
                    class="w-full"
                    :aria-label="band.code + ' description'"
                  />
                  <p class="mt-1 text-xs text-muted">
                    {{ boundsText(band) }}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template v-else-if="selected === 'customer-matrix' || selected === 'regulator-matrix'">
        <UAlert
          v-if="selected === 'customer-matrix'"
          color="neutral"
          variant="subtle"
          title="Customer threshold in workbook"
          description="Score 3 uses >20%, score 2 uses <20%, and score 1 means no customers affected. Exactly 20% is not defined in the reference and requires BCM clarification."
        />
        <div
          v-for="row in model.impact_matrix"
          :key="row.score"
          class="space-y-3 rounded-lg border border-default p-4"
        >
          <h3 class="font-semibold">
            Score {{ row.score }}
          </h3>
          <div>
            <UFormField
              v-if="selected === 'regulator-matrix'"
              label="Regulatory impact (A)"
            >
              <UTextarea
                v-model="row.regulatory"
                :rows="4"
                autoresize
                :maxlength="2000"
                class="w-full"
                :aria-label="'Regulatory score ' + row.score"
              />
            </UFormField>
            <UFormField
              v-else
              label="Customer service impact (B)"
            >
              <UTextarea
                v-model="row.customer"
                :rows="4"
                autoresize
                :maxlength="2000"
                class="w-full"
                :aria-label="'Customer score ' + row.score"
              />
            </UFormField>
          </div>
        </div>
      </template>
      <template v-else-if="selected === 'mtd-guide'">
        <div class="rounded-lg bg-elevated/50 p-5 text-sm leading-7">
          <h3 class="font-semibold">
            Use the first period when any trigger is reached
          </h3>
          <ol class="mt-3 list-decimal space-y-2 ps-5">
            <li>Potential cumulative financial loss is greater than {{ formatNumber(model.loss_alert_idr) }} IDR.</li><li>Regulatory impact reaches score {{ model.score_alert }}.</li><li>Customer service impact reaches score {{ model.score_alert }}.</li>
          </ol>
          <p class="mt-4">
            Fallback: {{ model.suggested_mtd_fallback || (suggested.includes('4 weeks') ? '4 weeks' : 'Not available') }} if no trigger is met. Suggested MTD remains selected by the assessor.
          </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <UFormField
            v-for="period in mappedPeriods"
            :key="period"
            :label="period"
            :help="activePeriods.includes(period) ? undefined : 'Inactive period: clear its override before saving.'"
          >
            <USelect
              :model-value="model.suggested_mtd_by_period?.[period] ?? workbookDefault"
              :items="mappingChoices(model.suggested_mtd_by_period?.[period])"
              :disabled="disabled"
              class="w-full"
              @update:model-value="setPeriod(period, $event === workbookDefault ? '' : $event)"
            />
          </UFormField>
          <UFormField label="Fallback when no threshold is reached">
            <USelect
              :model-value="model.suggested_mtd_fallback ?? workbookDefault"
              :items="mappingChoices(model.suggested_mtd_fallback)"
              :disabled="disabled"
              class="w-full"
              @update:model-value="model.suggested_mtd_fallback = $event === workbookDefault ? null : $event"
            />
          </UFormField>
        </div>
        <p class="text-sm text-muted">
          Workbook default matches the horizon duration, regardless of list order. Map a custom horizon explicitly to enable a suggestion for it.
        </p>
        <UFormField label="Suggested MTD guidance">
          <UTextarea
            v-model="model.guides.suggested_mtd"
            :rows="4"
            autoresize
            :maxlength="20000"
            class="w-full"
          />
        </UFormField>
        <p class="text-sm text-muted">
          Review written guidance whenever alert parameters change. Impact periods are managed under Lists; Suggested MTD choices in Master data › Master MTD.
        </p>
      </template>
      <template v-else-if="selected === 'expected-mtd'">
        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-lock"
          title="Managed in Master data › Master MTD"
          description="This version keeps a copy of Master MTD, refreshed whenever the draft is saved, submitted and published. Change the choices in Master MTD; the IT and non-IT choices below are read-only. Converted hours follow Time conversion."
        />
        <div class="overflow-x-auto rounded-lg border border-default">
          <table class="w-full min-w-[48rem] text-sm">
            <caption class="sr-only">
              Expected MTD choices of this version
            </caption>
            <thead class="bg-muted text-left text-xs uppercase text-muted">
              <tr>
                <th class="w-12 px-3 py-2 ps-4">
                  #
                </th>
                <th class="px-3 py-2">
                  Name
                </th>
                <th class="px-3 py-2">
                  Business function category
                </th>
                <th class="px-3 py-2 text-right">
                  Hours
                </th>
                <th class="px-3 py-2">
                  Used in
                </th>
                <th class="px-3 py-2 pe-4">
                  Description
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(row, index) in mtdRows"
                :key="row.value"
                :class="row.active ? '' : 'text-muted'"
              >
                <td class="px-3 py-2 ps-4 tabular-nums text-muted">
                  {{ index + 1 }}
                </td>
                <td class="px-3 py-2">
                  <p class="font-medium">
                    {{ row.label }}
                  </p>
                  <p class="font-mono text-xs text-muted">
                    {{ row.code }}{{ row.active ? '' : ' · inactive' }}
                  </p>
                </td>
                <td class="px-3 py-2">
                  {{ row.category ?? '—' }}
                </td>
                <td class="px-3 py-2 text-right tabular-nums">
                  {{ durationHours(row.value) }}
                </td>
                <td class="px-3 py-2">
                  <div class="flex flex-wrap gap-1">
                    <UBadge
                      v-if="row.use_it"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                      label="Part 2a (IT)"
                    />
                    <UBadge
                      v-if="row.use_non_it"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                      label="Part 2b (non-IT)"
                    />
                  </div>
                </td>
                <td class="px-3 py-2 pe-4 text-muted">
                  {{ row.description || '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <div
        v-else
        class="grid gap-4 sm:grid-cols-2"
      >
        <UFormField
          v-for="field in fields"
          :key="field.key"
          :label="field.label"
          :name="'payload.' + field.key"
          :help="field.key === 'loss_alert_idr' && veryHigh?.min_idr != null ? 'Set by the minimum of the Very High band in Financial loss matrix.' : undefined"
          required
        >
          <UInputNumber
            v-model="model[field.key]"
            :min="field.min"
            :max="field.max"
            :step="'step' in field ? field.step : 1"
            :disabled="field.key === 'loss_alert_idr' && veryHigh?.min_idr != null"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="selected === 'thresholds'"
          label="Allowed impact scores"
          help="Comma-separated scores 1–3. Include the highlighted score."
        >
          <UInput
            :model-value="model.scores.join(', ')"
            class="w-full"
            @update:model-value="model.scores = String($event).split(',').map(value => Number(value.trim()))"
          />
        </UFormField>
      </div>
    </fieldset>
  </AdminBiancaConfigSectionLayout>
</template>
