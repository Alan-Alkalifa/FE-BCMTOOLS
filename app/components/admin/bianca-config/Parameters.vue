<script setup lang="ts">
import type { BiancaConfigPayload, BiancaGrade, BiancaSigner } from '~/composables/useBiancaConfigAdmin'

const model = defineModel<BiancaConfigPayload>({ required: true })
const props = defineProps<{ section: string, disabled: boolean, signers: Record<string, BiancaSigner>, versionId: number, exportDisabled: boolean, referenceGuides: Record<string, string> }>()

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
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-muted">
            Export the saved personnel configuration for this version.
          </p>
          <UButton
            type="button"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            label="Export to Excel"
            :href="`/api/admin/bianca-config/versions/${versionId}/personnel.xlsx`"
            :disabled="exportDisabled"
            external
          />
        </div>
        <p
          v-if="exportDisabled"
          class="mt-2 text-sm text-muted"
        >
          Save draft changes before exporting.
        </p>
      </template>
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

    <AdminBiancaConfigImpact
      v-else-if="section === 'impact'"
      v-model="model"
      :disabled="disabled"
    />

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

    <AdminBiancaConfigGuides
      v-else-if="section === 'guides'"
      v-model="model.guides"
      :disabled="disabled"
      :reference-guides="referenceGuides"
    />
  </div>
</template>
