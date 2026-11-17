<script setup lang="ts">
import type { BiancaConfigPayload, BiancaGrade, BiancaListKey, BiancaSigner } from '~/composables/useBiancaConfigAdmin'

const model = defineModel<BiancaConfigPayload>({ required: true })
const props = defineProps<{ section: string, disabled: boolean, signers: Record<string, BiancaSigner> }>()

const route = useRoute()
const router = useRouter()

const lists: { key: BiancaListKey, label: string, help: string, locked?: boolean }[] = [
  { key: 'periods', label: 'Impact periods', help: 'One period per line, in time order. New versions can have 1–24 periods.' },
  { key: 'suggested_mtd', label: 'Suggested MTD', help: 'Positive durations, for example 4 hours or 1 day.' },
  { key: 'dependency_mtd', label: 'Dependency MTD', help: 'Durations, NA or SLA.' },
  { key: 'percentages', label: 'Planned capacity', help: 'One percentage per line, between 0% and 100%.' },
  { key: 'upstream_capacity', label: 'Dependency capacity', help: 'Configured percentages, NA or SLA.' },
  { key: 'alt_site_strategies', label: 'Alternate site strategies', help: 'One strategy per line.' },
  { key: 'frequencies', label: 'Critical timing frequencies', help: 'One choice per line. Keep legacy values when needed.' },
  { key: 'system_usage', label: 'System dependency codes', help: 'Semantic codes used by the gap rule; maintained by the application.', locked: true },
  { key: 'yes_no', label: 'Yes / No codes', help: 'Semantic codes; maintained by the application.', locked: true },
]

const selectedList = computed({
  get: () => lists.find((list) => list.key === route.query.list)?.key ?? 'periods',
  set: (value: string) => router.replace({ query: { ...route.query, list: value } }),
})
const list = computed(() => lists.find((entry) => entry.key === selectedList.value)!)
const listItems = computed(() => lists.map(({ key, label }) => ({ value: key, label, count: model.value[key].length })))

const listText = reactive({} as Record<BiancaListKey, string>)
watch(() => model.value, () => {
  for (const list of lists) listText[list.key] = model.value[list.key].join('\n')
}, { immediate: true })
function setList(key: BiancaListKey, value: string) {
  listText[key] = value
  model.value[key] = value.split('\n').map((v) => v.trim()).filter(Boolean)
}
function addGrade() {
  let i = model.value.staff_grades.length + 1
  while (model.value.staff_grades.some((g) => g.code === `grade_${i}`)) i++
  model.value.staff_grades.push({ code: `grade_${i}`, label: 'New category', min_level: null, max_level: null, active: true, requires_note: false })
}
function range(grade: BiancaGrade, field: 'min_level' | 'max_level', value: string | number) {
  grade[field] = value === '' ? null : Number(value)
}
function move(index: number, delta: number) {
  const rows = model.value.staff_grades
  const next = index + delta
  if (next < 0 || next >= rows.length) return
  const row = rows.splice(index, 1)[0]!
  rows.splice(next, 0, row)
}
function moveStep(index: number, delta: number) {
  const next = index + delta
  if (next < 1 || next >= model.value.signoff_steps.length) return
  const row = model.value.signoff_steps.splice(index, 1)[0]!
  model.value.signoff_steps.splice(next, 0, row)
  model.value.signoff_steps.at(-1)!.required = true
}
const impacts = [
  { value: 'thresholds', label: 'Impact thresholds', description: 'Set the financial loss alert and the scores used by the impact assessment.' },
  { value: 'conversion', label: 'Time conversion', description: 'Set how BIA converts days and weeks to hours.' },
  { value: 'limits', label: 'Workbook limits', description: 'Set the number of functions and dependency rows available in a BIA.' },
  { value: 'expected-mtd', label: 'Expected MTD', description: 'Map expected downtime to a function category.' },
]
const selectedImpact = computed({
  get: () => impacts.find((item) => item.value === route.query.impact)?.value ?? 'thresholds',
  set: (value: string) => router.replace({ query: { ...route.query, impact: value } }),
})
const impact = computed(() => impacts.find((item) => item.value === selectedImpact.value)!)
const numeric = [
  { group: 'thresholds', key: 'loss_alert_idr', label: 'Financial loss alert (IDR)', min: 0, max: 1e15 },
  { group: 'thresholds', key: 'score_alert', label: 'Highlighted impact score', min: 1, max: 3 },
  { group: 'conversion', key: 'hours_per_day', label: 'Hours per day', min: 0.1, max: 24, step: 0.1 },
  { group: 'conversion', key: 'days_per_week', label: 'Days per week', min: 0.1, max: 7, step: 0.1 },
  { group: 'limits', key: 'max_functions', label: 'Maximum functions', min: 1, max: 30 },
  { group: 'limits', key: 'it_slots', label: 'IT rows per function', min: 1, max: 4 },
  { group: 'limits', key: 'dependency_slots', label: 'Non-IT rows per function', min: 1, max: 4 },
] as const
const impactFields = computed(() => numeric.filter((field) => field.group === selectedImpact.value))

const guideDetails: Record<string, { label: string, description: string }> = {
  suggested_mtd: { label: 'Suggested MTD', description: 'Explain how assessors should select a Suggested MTD.' },
  regulatory: { label: 'Regulatory impact', description: 'Explain how assessors should score regulatory impact.' },
  customer: { label: 'Customer impact', description: 'Explain how assessors should score customer impact.' },
  recovery: { label: 'Recovery', description: 'Guide assessors through recovery planning and vital records.' },
  attestation: { label: 'Attestation statement', description: 'The statement assessors see when confirming their BIA.' },
}
const guides = computed(() => Object.keys(model.value.guides).map((key) => ({
  key,
  label: guideDetails[key]?.label ?? key.replaceAll('_', ' '),
  description: guideDetails[key]?.description,
})))

const signerModes = {
  creator: { label: 'Assessment creator', value: 'creator', description: 'The coordinator signs by submitting the BIA.' },
  chosen: { label: 'Chosen by assessor', value: 'chosen', description: 'The assessor selects the signer on the BIA.' },
  default: { label: 'Default signer', value: 'default', description: 'Prefilled on the BIA. The assessor can change it.' },
  fixed: { label: 'Fixed signer', value: 'fixed', description: 'The template assigns this signer.' },
} as const
const pickedSigners = reactive<Record<string, BiancaSigner>>({})
function rememberSigner(signer: BiancaSigner | null) {
  if (signer) pickedSigners[signer.id] = signer
}
function selectedSigner(id: number | null) {
  return id == null ? null : props.signers[id] ?? pickedSigners[id] ?? null
}
</script>

<template>
  <div class="min-w-0">
    <UCard v-if="section === 'personnel'">
      <fieldset
        :disabled="disabled"
        class="min-w-0 space-y-6"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              Personnel levels
            </h2>
            <p class="text-sm text-muted">
              Category codes are stable. Deactivate published categories instead of deleting them. Active U ranges cannot overlap.
            </p>
          </div>
          <UButton
            v-if="!disabled"
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            label="Add category"
            @click="addGrade"
          />
        </div>
        <div
          v-for="(grade, i) in model.staff_grades"
          :key="i"
          class="space-y-3 rounded-lg border border-default p-4"
        >
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <UFormField
              label="Code"
              :name="`payload.staff_grades.${i}.code`"
              required
            >
              <UInput
                v-model="grade.code"
                :maxlength="64"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Category name"
              :name="`payload.staff_grades.${i}.label`"
              required
            >
              <UInput
                v-model="grade.label"
                :maxlength="255"
                class="w-full"
              />
            </UFormField>
            <UFormField label="First U level (optional)">
              <UInput
                type="number"
                :model-value="grade.min_level == null ? '' : String(grade.min_level)"
                min="1"
                max="99"
                class="w-full"
                @update:model-value="range(grade, 'min_level', $event)"
              />
            </UFormField>
            <UFormField label="Last U level (optional)">
              <UInput
                type="number"
                :model-value="grade.max_level == null ? '' : String(grade.max_level)"
                min="1"
                max="99"
                class="w-full"
                @update:model-value="range(grade, 'max_level', $event)"
              />
            </UFormField>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <UCheckbox
              v-model="grade.active"
              label="Active"
            />
            <UCheckbox
              v-model="grade.requires_note"
              label="Require a note when headcount is above zero"
            />
            <UButton
              v-if="!disabled"
              color="neutral"
              variant="ghost"
              label="Move up"
              :disabled="i === 0"
              @click="move(i, -1)"
            />
            <UButton
              v-if="!disabled"
              color="neutral"
              variant="ghost"
              label="Move down"
              :disabled="i === model.staff_grades.length - 1"
              @click="move(i, 1)"
            />
          </div>
        </div>
        <section class="space-y-2 border-t border-default pt-4">
          <h3 class="font-semibold">
            Questionnaire preview
          </h3>
          <div class="grid gap-3 md:grid-cols-3">
            <UFormField
              v-for="grade in model.staff_grades.filter(g => g.active)"
              :key="grade.code"
              :label="biancaGradeLabel(grade)"
            >
              <UInput
                type="number"
                placeholder="Head count"
                disabled
                class="w-full"
              />
            </UFormField>
          </div>
        </section>
      </fieldset>
    </UCard>

    <AdminBiancaConfigSectionLayout
      v-else-if="section === 'lists'"
      v-model="selectedList"
      label="Lists"
      :items="listItems"
    >
      <template #header>
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="font-semibold text-highlighted">
            {{ list.label }}
          </h2>
          <UBadge
            v-if="list.locked"
            color="neutral"
            variant="subtle"
            icon="i-lucide-lock"
            label="Fixed codes"
          />
        </div>
        <p class="mt-1 text-sm text-muted">
          {{ list.help }}
        </p>
      </template>
      <UFormField
        :label="list.label"
        :ui="{ label: 'sr-only' }"
      >
        <UTextarea
          :key="list.key"
          :model-value="listText[list.key]"
          :rows="8"
          autoresize
          :maxrows="16"
          class="w-full max-w-2xl"
          :disabled="disabled || list.locked"
          @update:model-value="setList(list.key, $event)"
        />
      </UFormField>
    </AdminBiancaConfigSectionLayout>

    <AdminBiancaConfigSectionLayout
      v-else-if="section === 'impact'"
      v-model="selectedImpact"
      label="Impact and MTD"
      :items="impacts"
    >
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold text-highlighted">
              {{ impact.label }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ impact.description }}
            </p>
          </div>
          <UButton
            v-if="selectedImpact === 'expected-mtd' && !disabled"
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
        v-if="selectedImpact === 'expected-mtd'"
        :disabled="disabled"
        class="min-w-0 space-y-4"
      >
        <div
          v-for="(item, i) in model.expected_mtd"
          :key="i"
          class="grid gap-3 sm:grid-cols-2"
        >
          <UFormField :label="'Expected MTD ' + (i + 1)">
            <UInput
              v-model="item.value"
              :maxlength="16"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Category">
            <USelect
              v-model="item.category"
              :items="['Business Critical', 'Important', 'Others']"
              :disabled="disabled"
              class="w-full"
            />
          </UFormField>
        </div>
      </fieldset>
      <fieldset
        v-else
        :disabled="disabled"
        class="grid min-w-0 gap-4 sm:grid-cols-2"
      >
        <UFormField
          v-for="field in impactFields"
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
          v-if="selectedImpact === 'thresholds'"
          label="Allowed impact scores"
          help="Comma-separated scores from 1 to 3. Include the highlighted score."
        >
          <UInput
            :model-value="model.scores.join(', ')"
            class="w-full"
            @update:model-value="model.scores = String($event).split(',').map(v => Number(v.trim()))"
          />
        </UFormField>
      </fieldset>
    </AdminBiancaConfigSectionLayout>

    <div
      v-else-if="section === 'steps'"
      class="space-y-4"
    >
      <p class="text-sm text-muted">
        This template sets the sign-off order recorded when the coordinator submits the BIA. Optional steps without a signer are skipped.
      </p>
      <ol class="space-y-3">
        <li
          v-for="(step, i) in model.signoff_steps"
          :key="step.code"
        >
          <UCard>
            <fieldset
              :disabled="disabled"
              class="grid min-w-0 gap-4 sm:grid-cols-[auto_minmax(0,1fr)]"
            >
              <legend class="sr-only">
                Step {{ i + 1 }}: {{ step.title }}
              </legend>
              <div class="flex items-start gap-1 sm:flex-col">
                <span
                  aria-hidden="true"
                  class="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums"
                >{{ i + 1 }}</span>
                <template v-if="!disabled && i > 0">
                  <UButton
                    type="button"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-arrow-up"
                    :disabled="i === 1"
                    :aria-label="'Move ' + (step.title || 'step') + ' up'"
                    @click="moveStep(i, -1)"
                  />
                  <UButton
                    type="button"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-arrow-down"
                    :disabled="i === model.signoff_steps.length - 1"
                    :aria-label="'Move ' + (step.title || 'step') + ' down'"
                    @click="moveStep(i, 1)"
                  />
                </template>
              </div>
              <div class="min-w-0 space-y-4">
                <div class="grid gap-4 md:grid-cols-2">
                  <UFormField
                    label="Step title"
                    required
                  >
                    <UInput
                      v-model="step.title"
                      :maxlength="255"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Workbook role">
                    <UInput
                      :model-value="step.code"
                      class="w-full font-mono"
                      readonly
                    />
                  </UFormField>
                  <UFormField
                    label="Signer selection"
                    :help="signerModes[step.signer_mode].description"
                  >
                    <USelect
                      v-model="step.signer_mode"
                      :items="i === 0 ? [signerModes.creator] : [signerModes.chosen, signerModes.default, signerModes.fixed]"
                      :disabled="disabled || i === 0"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField
                    v-if="step.signer_mode === 'default' || step.signer_mode === 'fixed'"
                    :label="signerModes[step.signer_mode].label"
                    required
                  >
                    <UserPicker
                      v-model="step.user_id"
                      :selected="selectedSigner(step.user_id)"
                      permission="bianca.access"
                      :disabled="disabled"
                      :aria-label="step.title + ' signer'"
                      @pick="rememberSigner"
                    />
                  </UFormField>
                </div>
                <USwitch
                  v-model="step.required"
                  label="Required"
                  :disabled="disabled || i === 0 || i === model.signoff_steps.length - 1"
                  :description="i === 0 ? 'The coordinator always submits.' : i === model.signoff_steps.length - 1 ? 'The final step is always required.' : undefined"
                />
              </div>
            </fieldset>
          </UCard>
        </li>
      </ol>
      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">
            Flow preview
          </h2>
        </template>
        <ol class="flex flex-wrap items-center gap-2 text-sm">
          <li
            v-for="(step, i) in model.signoff_steps"
            :key="step.code"
            class="flex min-w-0 items-center gap-2"
          >
            <UIcon
              v-if="i > 0"
              name="i-lucide-arrow-right"
              class="size-4 shrink-0 text-muted"
              aria-hidden="true"
            />
            <span class="rounded-md bg-muted px-2.5 py-1.5 wrap-anywhere">{{ step.title || step.code }}</span>
          </li>
        </ol>
      </UCard>
    </div>

    <div
      v-else-if="section === 'guides'"
      class="space-y-4"
    >
      <UCard
        v-for="guide in guides"
        :key="guide.key"
      >
        <template #header>
          <h2 class="font-semibold text-highlighted">
            {{ guide.label }}
          </h2>
          <p
            v-if="guide.description"
            class="mt-1 text-sm text-muted"
          >
            {{ guide.description }}
          </p>
        </template>
        <UFormField
          :label="guide.label"
          :ui="{ label: 'sr-only' }"
        >
          <UTextarea
            v-model="model.guides[guide.key]"
            :rows="3"
            autoresize
            :maxrows="12"
            :maxlength="20000"
            :disabled="disabled"
            class="w-full"
          />
        </UFormField>
      </UCard>
    </div>
  </div>
</template>
