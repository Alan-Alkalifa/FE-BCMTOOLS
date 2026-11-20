<script setup lang="ts">
import type { BiancaConfigPayload, BiancaListItems, BiancaMtdOption } from '~/composables/useBiancaConfigAdmin'

const model = defineModel<BiancaConfigPayload>({ required: true })
const props = defineProps<{ disabled: boolean, listItems: BiancaListItems }>()
const route = useRoute()
const router = useRouter()
const items = [
  { value: 'thresholds', label: 'Impact thresholds', description: 'Financial loss and score alerts used by the assessment.' },
  { value: 'financial-bands', label: 'Financial loss matrix', description: 'Five risk bands transcribed from Part 1 of the completed workbook.' },
  { value: 'customer-matrix', label: 'Customer impact matrix', description: 'Workbook guidance for customer service impact scores 1–3.' },
  { value: 'regulator-matrix', label: 'Regulatory impact matrix', description: 'Workbook guidance for regulatory impact scores 1–3.' },
  { value: 'mtd-guide', label: 'Suggested MTD rule', description: 'First qualifying impact period, with the workbook fallback.' },
  { value: 'expected-mtd', label: 'Expected MTD', description: 'Expected MTD must be equal to or shorter than Suggested MTD. Categories follow the workbook mapping.' },
  { value: 'conversion', label: 'Time conversion', description: 'Convert days and weeks to hours for duration comparisons.' },
  { value: 'limits', label: 'Workbook limits', description: 'Rows of the Excel template: business functions and dependency rows. The web form takes any number of functions.' },
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
const categories = ['Business Critical', 'Important', 'Others']
function changeMtd(index: number, patch: Partial<BiancaMtdOption>) {
  const rows = mtdRows.value.map((row) => ({ ...row }))
  const next = { ...rows[index]!, ...patch }
  if (next.value === 'NA' || next.value === 'SLA') {
    next.use_it = false
    next.category = null
  }
  rows[index] = next
  model.value.mtd_options = rows
}
function moveMtd(index: number, delta: number) {
  const rows = [...mtdRows.value]
  const [row] = rows.splice(index, 1)
  if (row) rows.splice(index + delta, 0, row)
  model.value.mtd_options = rows
}
function addMtd() {
  model.value.mtd_options = [...mtdRows.value, {
    code: '', value: '', label: '', category: 'Others', description: null, use_it: true, use_non_it: true, active: true,
  }]
}
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
const noCategory = '__no_category__'
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
          v-if="selected === 'expected-mtd' && !disabled"
          type="button"
          color="neutral"
          variant="outline"
          icon="i-lucide-plus"
          label="Add MTD"
          :disabled="mtdRows.length >= 66"
          @click="addMtd"
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
          title="Reference matrix"
          description="These are workbook descriptions. The workbook does not fully define equal-to boundaries between bands; only the financial loss alert drives highlighting. Editing this matrix changes guidance."
        />
        <div
          v-for="band in model.financial_bands"
          :key="band.code"
          class="grid gap-3 border-b border-default pb-4 sm:grid-cols-[10rem_minmax(0,1fr)]"
        >
          <UFormField label="Risk impact">
            <UInput
              v-model="band.label"
              :maxlength="255"
              class="w-full"
              :aria-label="band.code + ' label'"
            />
          </UFormField>
          <UFormField label="Potential cumulative financial loss">
            <UInput
              v-model="band.description"
              :maxlength="2000"
              class="w-full"
              :aria-label="band.code + ' description'"
            />
          </UFormField>
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
          Review written guidance whenever alert parameters change. Impact periods and Suggested MTD choices are managed under Lists.
        </p>
      </template>
      <template v-else-if="selected === 'expected-mtd'">
        <p class="text-sm text-muted">
          This master supplies the IT and non-IT choices. NA and SLA have no category or hours and are non-IT only. Converted hours follow Time conversion.
        </p>
        <UCard
          v-for="(row, index) in mtdRows"
          :key="index"
        >
          <div class="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div class="flex items-start gap-1 lg:flex-col">
              <span class="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">{{ index + 1 }}</span>
              <UButton
                type="button"
                size="sm"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-up"
                :aria-label="`Move ${row.label || 'MTD'} up`"
                :disabled="disabled || index === 0"
                @click="moveMtd(index, -1)"
              />
              <UButton
                type="button"
                size="sm"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-down"
                :aria-label="`Move ${row.label || 'MTD'} down`"
                :disabled="disabled || index === mtdRows.length - 1"
                @click="moveMtd(index, 1)"
              />
            </div>
            <div class="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <UFormField
                label="Code"
                required
              >
                <UInput
                  :model-value="row.code"
                  :maxlength="64"
                  class="w-full"
                  @update:model-value="changeMtd(index, { code: $event })"
                />
              </UFormField>
              <UFormField
                label="Name"
                required
              >
                <UInput
                  :model-value="row.label"
                  :maxlength="255"
                  class="w-full"
                  @update:model-value="changeMtd(index, { label: $event })"
                />
              </UFormField>
              <UFormField
                label="Workbook value"
                required
              >
                <UInput
                  :model-value="row.value"
                  :maxlength="16"
                  class="w-full"
                  @update:model-value="changeMtd(index, { value: $event })"
                />
              </UFormField>
              <UFormField label="Business function category">
                <USelect
                  :model-value="row.category ?? noCategory"
                  :items="[{ label: 'No category', value: noCategory }, ...categories.map(value => ({ value, label: value }))]"
                  :disabled="disabled || ['NA', 'SLA'].includes(row.value)"
                  class="w-full"
                  @update:model-value="changeMtd(index, { category: $event === noCategory ? null : $event })"
                />
              </UFormField>
              <UFormField label="Converted hours">
                <UInput
                  :model-value="durationHours(row.value) ?? '—'"
                  readonly
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Description">
                <UInput
                  :model-value="row.description ?? ''"
                  :maxlength="2000"
                  class="w-full"
                  @update:model-value="changeMtd(index, { description: $event || null })"
                />
              </UFormField>
              <div class="flex flex-wrap gap-4 sm:col-span-2 xl:col-span-3">
                <USwitch
                  :model-value="row.use_it"
                  :disabled="disabled || ['NA', 'SLA'].includes(row.value)"
                  label="MTD IT"
                  @update:model-value="changeMtd(index, { use_it: $event })"
                />
                <USwitch
                  :model-value="row.use_non_it"
                  :disabled="disabled"
                  label="MTD Non IT"
                  @update:model-value="changeMtd(index, { use_non_it: $event })"
                />
                <USwitch
                  :model-value="row.active"
                  :disabled="disabled"
                  label="Active"
                  @update:model-value="changeMtd(index, { active: $event })"
                />
                <UButton
                  v-if="!disabled"
                  type="button"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  label="Remove"
                  @click="model.mtd_options = mtdRows.filter((_, position) => position !== index)"
                />
              </div>
            </div>
          </div>
        </UCard>
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
          required
        >
          <UInputNumber
            v-model="model[field.key]"
            :min="field.min"
            :max="field.max"
            :step="'step' in field ? field.step : 1"
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
