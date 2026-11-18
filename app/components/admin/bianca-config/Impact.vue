<script setup lang="ts">
import type { BiancaConfigPayload } from '~/composables/useBiancaConfigAdmin'

const model = defineModel<BiancaConfigPayload>({ required: true })
defineProps<{ disabled: boolean }>()
const route = useRoute()
const router = useRouter()
const items = [
  { value: 'thresholds', label: 'Impact thresholds', description: 'Financial loss and score alerts used by the assessment.' },
  { value: 'financial-bands', label: 'Financial loss matrix', description: 'Five risk bands transcribed from Part 1 of the completed workbook.' },
  { value: 'impact-matrix', label: 'Regulatory and customer matrix', description: 'Meaning of scores 1–3 for regulatory and customer service impact.' },
  { value: 'mtd-guide', label: 'Suggested MTD rule', description: 'First qualifying impact period, with the workbook fallback.' },
  { value: 'expected-mtd', label: 'Expected MTD', description: 'Expected MTD must be equal to or shorter than Suggested MTD. Categories follow the workbook mapping.' },
  { value: 'conversion', label: 'Time conversion', description: 'Convert days and weeks to hours for duration comparisons.' },
  { value: 'limits', label: 'Workbook limits', description: 'Maximum business functions and dependency rows.' },
]
const selected = computed({
  get: () => items.find((item) => item.value === route.query.impact)?.value ?? 'thresholds',
  set: (value: string) => router.replace({ query: { ...route.query, impact: value } }),
})
const current = computed(() => items.find((item) => item.value === selected.value)!)
const numeric = [
  { group: 'thresholds', key: 'loss_alert_idr', label: 'Financial loss alert (IDR)', min: 0, max: 1e15 },
  { group: 'thresholds', key: 'score_alert', label: 'Highlighted impact score', min: 1, max: 3 },
  { group: 'conversion', key: 'hours_per_day', label: 'Hours per day', min: 0.1, max: 24, step: 0.1 },
  { group: 'conversion', key: 'days_per_week', label: 'Days per week', min: 0.1, max: 7, step: 0.1 },
  { group: 'limits', key: 'max_functions', label: 'Maximum functions', min: 1, max: 30 },
  { group: 'limits', key: 'it_slots', label: 'IT rows per function', min: 1, max: 4 },
  { group: 'limits', key: 'dependency_slots', label: 'Non-IT rows per function', min: 1, max: 4 },
] as const
const fields = computed(() => numeric.filter((field) => field.group === selected.value))
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
          @click="model.expected_mtd.push({ value: '', category: 'Others' })"
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
      <template v-else-if="selected === 'impact-matrix'">
        <UAlert
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
          <div class="grid gap-4 xl:grid-cols-2">
            <UFormField label="Regulatory impact (A)">
              <UTextarea
                v-model="row.regulatory"
                :rows="4"
                autoresize
                :maxlength="2000"
                class="w-full"
                :aria-label="'Regulatory score ' + row.score"
              />
            </UFormField>
            <UFormField label="Customer service impact (B)">
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
            Workbook fallback: 4 weeks if no trigger is met. Suggested MTD remains selected by the assessor.
          </p>
        </div>
        <div>
          <h3 class="mb-2 text-sm font-semibold">
            Configured impact timeline
          </h3><ol class="flex flex-wrap gap-2">
            <li
              v-for="(period, index) in model.periods"
              :key="period"
              class="rounded-md border border-default px-3 py-2 text-sm"
            >
              {{ index + 1 }}. {{ period }}
            </li>
          </ol>
        </div>
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
        <div
          v-for="(row, index) in model.expected_mtd"
          :key="index"
          class="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <UFormField :label="'Expected MTD ' + (index + 1)">
            <UInput
              v-model="row.value"
              :maxlength="16"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Category">
            <USelect
              v-model="row.category"
              :items="['Business Critical', 'Important', 'Others']"
              :disabled="disabled"
              class="w-full"
            />
          </UFormField>
          <UButton
            v-if="!disabled"
            type="button"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            :disabled="model.expected_mtd.length === 1"
            :aria-label="'Remove MTD ' + (index + 1)"
            @click="model.expected_mtd.splice(index, 1)"
          />
        </div>
        <p class="text-sm text-muted">
          NA and SLA exist in the workbook master but have no function category. They remain reference values and are available for dependencies.
        </p>
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
