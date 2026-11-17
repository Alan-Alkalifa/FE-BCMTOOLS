<script setup lang="ts">
import type { BiancaConfigPayload, BiancaGrade, BiancaListKey, BiancaSigner } from '~/composables/useBiancaConfigAdmin'

const model = defineModel<BiancaConfigPayload>({ required: true })
defineProps<{ section: string, disabled: boolean, signers: Record<string, BiancaSigner> }>()

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
}
const numeric = [
  { key: 'loss_alert_idr', label: 'Financial loss alert (IDR)', min: 0, max: 1e15 },
  { key: 'score_alert', label: 'Highlighted impact score', min: 1, max: 3 },
  { key: 'hours_per_day', label: 'Hours per day', min: 0.1, max: 24 },
  { key: 'days_per_week', label: 'Days per week', min: 0.1, max: 7 },
  { key: 'max_functions', label: 'Maximum functions', min: 1, max: 30 },
  { key: 'it_slots', label: 'IT rows per function', min: 1, max: 4 },
  { key: 'dependency_slots', label: 'Non-IT rows per function', min: 1, max: 4 },
] as const
</script>

<template>
  <fieldset
    :disabled="disabled"
    class="space-y-6"
  >
    <template v-if="section === 'personnel'">
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
    </template>

    <div
      v-else-if="section === 'lists'"
      class="grid gap-6 md:grid-cols-2"
    >
      <UFormField
        v-for="list in lists"
        :key="list.key"
        :label="list.label"
        :help="list.help"
      >
        <UTextarea
          :model-value="listText[list.key]"
          :rows="6"
          class="w-full"
          :disabled="disabled || list.locked"
          @update:model-value="setList(list.key, $event)"
        />
      </UFormField>
    </div>

    <template v-else-if="section === 'impact'">
      <div class="grid gap-4 md:grid-cols-3">
        <UFormField
          v-for="field in numeric"
          :key="field.key"
          :label="field.label"
          :name="`payload.${field.key}`"
          required
        >
          <UInputNumber
            v-model="model[field.key]"
            :min="field.min"
            :max="field.max"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField
        label="Allowed impact scores"
        help="Comma-separated scores from the workbook's 1–3 scale; include the highlighted score."
      >
        <UInput
          :model-value="model.scores.join(', ')"
          @update:model-value="model.scores = String($event).split(',').map(v => Number(v.trim()))"
        />
      </UFormField>
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">
          Expected MTD and function category
        </h2>
        <UButton
          v-if="!disabled"
          color="neutral"
          variant="outline"
          label="Add MTD"
          @click="model.expected_mtd.push({ value: '', category: 'Others' })"
        />
      </div>
      <div
        v-for="(item, i) in model.expected_mtd"
        :key="i"
        class="grid gap-3 sm:grid-cols-2"
      >
        <UFormField :label="`Expected MTD ${i + 1}`">
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
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="text-sm text-muted">
        These are parameter values, not editable program formulas. Suggested MTD remains selected by the assessor using the workbook guide.
      </p>
    </template>

    <template v-else-if="section === 'steps'">
      <UAlert
        color="info"
        variant="subtle"
        title="Four workbook roles"
        description="The coordinator prepares and submits. The next three roles are configured here. This screen manages the template; assessment approve/reject execution is a separate feature."
      />
      <div
        v-for="(step, i) in model.signoff_steps"
        :key="step.code"
        class="space-y-3 rounded-lg border border-default p-4"
      >
        <p class="text-xs text-muted">
          {{ i + 1 }} · {{ step.code }}
        </p>
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
          <UFormField
            label="Signer selection"
            :help="i === 0 ? 'The assessment creator signs by submitting.' : 'Chosen on the BIA, prefilled by default, or fixed by this template.'"
          >
            <USelect
              v-model="step.signer_mode"
              :items="i === 0 ? ['creator'] : ['chosen', 'default', 'fixed']"
              :disabled="disabled || i === 0"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="step.signer_mode === 'default' || step.signer_mode === 'fixed'"
            label="Signer"
            required
          >
            <UserPicker
              v-model="step.user_id"
              :selected="signers[String(step.user_id)] ?? null"
              permission="bianca.access"
              :disabled="disabled"
            />
          </UFormField>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <UCheckbox
            v-model="step.required"
            label="Required"
            :disabled="disabled || i === 0 || i === model.signoff_steps.length - 1"
          />
          <UButton
            v-if="!disabled && i > 0"
            color="neutral"
            variant="ghost"
            label="Move up"
            :disabled="i === 1"
            @click="moveStep(i, -1)"
          />
          <UButton
            v-if="!disabled && i > 0"
            color="neutral"
            variant="ghost"
            label="Move down"
            :disabled="i === model.signoff_steps.length - 1"
            @click="moveStep(i, 1)"
          />
        </div>
      </div>
      <p class="text-sm">
        <span class="font-medium">Flow preview:</span> {{ model.signoff_steps.map(s => s.title).join(' → ') }}
      </p>
    </template>

    <div
      v-else-if="section === 'guides'"
      class="space-y-5"
    >
      <UFormField
        v-for="(_value, key) in model.guides"
        :key="key"
        :label="String(key).replaceAll('_', ' ')"
      >
        <UTextarea
          v-model="model.guides[key]"
          :rows="4"
          :maxlength="20000"
          class="w-full"
        />
      </UFormField>
    </div>
  </fieldset>
</template>
