<script setup lang="ts">
import type { BiancaConfigPayload, BiancaGrade, BiancaListItems, BiancaSigner, BiancaStep } from '~/composables/useBiancaConfigAdmin'
import type { BiancaLocationMode } from '~/composables/useBianca'

const model = defineModel<BiancaConfigPayload>({ required: true })
const props = defineProps<{ section: string, disabled: boolean, signers: Record<string, BiancaSigner>, savedStepCodes: string[], savedGradeCodes?: string[], versionId: number, exportDisabled: boolean, referenceGuides: Record<string, string>, listItems: BiancaListItems }>()
const confirm = useConfirm()
const { can } = useAuth()
const locationDefaults = { work_from_home: 'Work From Home', hyspace: 'Hyspace' }
const locationLabels = computed(() => model.value.office_location_labels ?? locationDefaults)
function setLocationLabel(key: BiancaLocationMode, value: string) {
  model.value.office_location_labels = { ...locationLabels.value, [key]: value }
}

function canRemoveGrade(grade: BiancaGrade) {
  return model.value.staff_grades.length > 1
    && (!grade.active || model.value.staff_grades.filter((item) => item.active).length > 1)
}
async function removeGrade(grade: BiancaGrade) {
  if (props.disabled || !canRemoveGrade(grade)) return
  const confirmed = await confirm({
    title: 'Remove ' + (grade.label || 'personnel category') + '?',
    description: 'This removes the category from this draft. Existing BIAs keep their saved configuration. Save and publish the draft to apply this change to new BIAs.',
    confirmLabel: 'Remove category',
    destructive: true,
  })
  if (!confirmed || props.disabled || !canRemoveGrade(grade)) return
  const index = model.value.staff_grades.indexOf(grade)
  if (index >= 0) model.value.staff_grades.splice(index, 1)
}

function addGrade() {
  if (props.disabled || model.value.staff_grades.length >= 50) return
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
  if (props.disabled || next < 0 || next >= rows.length) return
  const row = rows.splice(index, 1)[0]!
  rows.splice(next, 0, row)
}
function moveStep(index: number, delta: number) {
  const next = index + delta
  if (props.disabled || index === 0 || next < 1 || next >= model.value.signoff_steps.length) return
  const row = model.value.signoff_steps.splice(index, 1)[0]!
  model.value.signoff_steps.splice(next, 0, row)
  model.value.signoff_steps.at(-1)!.required = true
}
function addStep() {
  if (props.disabled || model.value.signoff_steps.length >= 20) return
  let i = model.value.signoff_steps.length + 1
  while (model.value.signoff_steps.some((step) => step.code === `approval_step_${i}`)) i++
  model.value.signoff_steps.splice(model.value.signoff_steps.length - 1, 0, {
    code: `approval_step_${i}`, title: 'New approval step', required: true, signer_mode: 'chosen', user_id: null,
  })
}
async function removeStep(step: BiancaStep) {
  if (props.disabled || model.value.signoff_steps.length <= 2 || model.value.signoff_steps.indexOf(step) <= 0) return
  const confirmed = await confirm({
    title: 'Remove ' + (step.title || 'approval step') + '?',
    description: 'This removes the step from this draft. Existing BIAs keep their saved approval template. Save and publish the draft to apply this change to new BIAs.',
    confirmLabel: 'Remove step',
    destructive: true,
  })
  const index = model.value.signoff_steps.indexOf(step)
  if (!confirmed || props.disabled || model.value.signoff_steps.length <= 2 || index <= 0) return
  model.value.signoff_steps.splice(index, 1)
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
    <div
      v-if="section === 'personnel'"
      class="space-y-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <p class="max-w-3xl text-sm text-muted">
          Remove categories from a draft or deactivate them to keep them listed. Existing BIAs keep their saved configuration. Keep at least one category active; active U ranges cannot overlap.
        </p>
        <div class="flex flex-wrap gap-2">
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
          <UButton
            v-if="!disabled"
            type="button"
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            label="Add category"
            :disabled="model.staff_grades.length >= 50"
            @click="addGrade"
          />
        </div>
      </div>
      <p
        v-if="exportDisabled"
        class="mt-2 text-sm text-muted"
      >
        Save draft changes before exporting.
      </p>
      <div class="min-w-0 space-y-4">
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <fieldset
            :disabled="disabled"
            class="min-w-0 overflow-x-auto"
          >
            <legend class="sr-only">
              Personnel categories
            </legend>
            <table class="w-full min-w-[52rem] text-sm">
              <thead class="bg-muted text-left text-xs uppercase text-muted">
                <tr>
                  <th class="w-24 px-3 py-2 ps-4">
                    Order
                  </th>
                  <th class="px-3 py-2">
                    Category name
                  </th>
                  <th class="w-64 px-3 py-2">
                    U levels (optional)
                  </th>
                  <th class="w-20 px-3 py-2">
                    Active
                  </th>
                  <th class="w-44 px-3 py-2">
                    Note when headcount above 0
                  </th>
                  <th class="w-12 px-3 py-2 pe-4">
                    <span class="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="(grade, i) in model.staff_grades"
                  :key="i"
                  :class="grade.active ? '' : 'text-muted'"
                >
                  <td class="px-3 py-2 ps-4 align-top">
                    <div class="flex h-8 items-center gap-0.5 tabular-nums">
                      <span class="me-1 min-w-4 text-xs text-muted">{{ i + 1 }}</span>
                      <template v-if="!disabled">
                        <UButton
                          type="button"
                          size="sm"
                          color="neutral"
                          variant="ghost"
                          icon="i-lucide-arrow-up"
                          :disabled="i === 0"
                          :aria-label="'Move ' + (grade.label || 'category') + ' up'"
                          @click="move(i, -1)"
                        />
                        <UButton
                          type="button"
                          size="sm"
                          color="neutral"
                          variant="ghost"
                          icon="i-lucide-arrow-down"
                          :disabled="i === model.staff_grades.length - 1"
                          :aria-label="'Move ' + (grade.label || 'category') + ' down'"
                          @click="move(i, 1)"
                        />
                      </template>
                    </div>
                  </td>
                  <td class="px-3 py-2 align-top">
                    <UFormField
                      :name="`payload.staff_grades.${i}.label`"
                      required
                    >
                      <UInput
                        v-model="grade.label"
                        :maxlength="255"
                        class="w-full"
                        :aria-label="'Category name ' + (i + 1)"
                      />
                    </UFormField>
                    <p
                      v-if="savedGradeCodes?.includes(grade.code)"
                      class="mt-1 font-mono text-[11px] text-dimmed"
                    >
                      Code {{ grade.code }} · fixed once saved
                    </p>
                    <UFormField
                      v-else
                      :name="`payload.staff_grades.${i}.code`"
                      class="mt-2"
                      help="Code: lower case and _, fixed once saved."
                    >
                      <UInput
                        v-model="grade.code"
                        :maxlength="64"
                        size="sm"
                        class="w-full font-mono"
                        :aria-label="'Code of ' + (grade.label || 'category ' + (i + 1))"
                      />
                    </UFormField>
                  </td>
                  <td class="px-3 py-2 align-top">
                    <div class="flex items-center gap-2">
                      <span class="text-muted">U</span>
                      <UInput
                        type="number"
                        :model-value="grade.min_level == null ? '' : String(grade.min_level)"
                        min="1"
                        max="99"
                        placeholder="From"
                        class="w-20"
                        :aria-label="'First U level of ' + (grade.label || 'category')"
                        @update:model-value="range(grade, 'min_level', $event)"
                      />
                      <span class="text-muted">to U</span>
                      <UInput
                        type="number"
                        :model-value="grade.max_level == null ? '' : String(grade.max_level)"
                        min="1"
                        max="99"
                        placeholder="To"
                        class="w-20"
                        :aria-label="'Last U level of ' + (grade.label || 'category')"
                        @update:model-value="range(grade, 'max_level', $event)"
                      />
                    </div>
                  </td>
                  <td class="px-3 py-2 align-top">
                    <USwitch
                      v-model="grade.active"
                      class="pt-1.5"
                      :aria-label="(grade.label || 'Category') + ' active'"
                    />
                  </td>
                  <td class="px-3 py-2 align-top">
                    <USwitch
                      v-model="grade.requires_note"
                      class="pt-1.5"
                      :aria-label="'Require a note when ' + (grade.label || 'this category') + ' has a headcount'"
                    />
                  </td>
                  <td class="px-3 py-2 pe-4 text-right align-top">
                    <UButton
                      v-if="!disabled"
                      type="button"
                      size="sm"
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      :aria-label="'Remove category ' + (grade.label || grade.code)"
                      :disabled="!canRemoveGrade(grade)"
                      @click="removeGrade(grade)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </fieldset>
        </UCard>
        <UCard>
          <template #header>
            <h3 class="font-semibold text-highlighted">
              Questionnaire preview
            </h3>
          </template>
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
        </UCard>
      </div>
    </div>

    <AdminBiancaConfigImpact
      v-else-if="section === 'impact'"
      v-model="model"
      :disabled="disabled"
      :list-items="listItems"
    />

    <UCard v-else-if="section === 'locations'">
      <template #header>
        <h2 class="font-semibold text-highlighted">
          Office location types
        </h2>
        <p class="mt-1 text-sm text-muted">
          These labels appear in both location fields on the Sign Off Page and in the Excel template.
        </p>
      </template>
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Work From Home label"
            help="Address and floor are not applicable."
            required
          >
            <UInput
              :model-value="locationLabels.work_from_home"
              :maxlength="255"
              :disabled="disabled"
              class="w-full"
              @update:model-value="setLocationLabel('work_from_home', $event)"
            />
          </UFormField>
          <UFormField
            label="Hyspace label"
            help="The site and floor are optional; a selected site supplies the address."
            required
          >
            <UInput
              :model-value="locationLabels.hyspace"
              :maxlength="255"
              :disabled="disabled"
              class="w-full"
              @update:model-value="setLocationLabel('hyspace', $event)"
            />
          </UFormField>
        </div>
        <p class="text-sm text-muted">
          Physical buildings, addresses and available sites follow Master Building.
        </p>
        <UButton
          v-if="can('sites.master')"
          :to="MASTER_BUILDINGS_PATH"
          label="Open Master Building"
          color="neutral"
          variant="outline"
        />
      </div>
    </UCard>

    <div
      v-else-if="section === 'steps'"
      class="space-y-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <p class="max-w-3xl text-sm text-muted">
          Approvers sign in this order. The coordinator always submits first. Keep at least one approver; the final step is always required. Optional steps without a signer are skipped.
        </p>
        <UButton
          v-if="!disabled"
          type="button"
          color="neutral"
          variant="outline"
          icon="i-lucide-plus"
          label="Add step"
          :disabled="model.signoff_steps.length >= 20"
          @click="addStep"
        />
      </div>
      <ol class="space-y-3">
        <li
          v-for="(step, i) in model.signoff_steps"
          :key="i"
        >
          <UCard>
            <fieldset
              :disabled="disabled"
              class="grid min-w-0 gap-4 lg:grid-cols-[auto_minmax(0,1fr)]"
            >
              <legend class="sr-only">
                Step {{ i + 1 }}: {{ step.title }}
              </legend>
              <div class="flex items-start gap-1 lg:flex-col">
                <span
                  aria-hidden="true"
                  class="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums"
                >{{ i + 1 }}</span>
                <UButton
                  type="button"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-up"
                  :disabled="disabled || i <= 1"
                  :aria-label="'Move ' + (step.title || 'step') + ' up'"
                  @click="moveStep(i, -1)"
                />
                <UButton
                  type="button"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-down"
                  :disabled="disabled || i === 0 || i === model.signoff_steps.length - 1"
                  :aria-label="'Move ' + (step.title || 'step') + ' down'"
                  @click="moveStep(i, 1)"
                />
              </div>
              <div class="min-w-0 space-y-4">
                <div class="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                    label="Code"
                    help="Lower case and _. Fixed once saved."
                    required
                  >
                    <UInput
                      v-model="step.code"
                      :maxlength="40"
                      class="w-full font-mono"
                      :readonly="savedStepCodes.includes(step.code)"
                    />
                  </UFormField>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
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
                      :key="step.bcm_role ?? 'all'"
                      v-model="step.user_id"
                      :endpoint="bcmSignerEndpoint(step.bcm_role)"
                      :selected="selectedSigner(step.user_id)"
                      permission="bianca.access"
                      :disabled="disabled"
                      :aria-label="step.title + ' signer'"
                      @pick="rememberSigner"
                    />
                  </UFormField>
                  <UFormField
                    v-if="i > 0"
                    label="Operational BCM role"
                    help="Restrict eligible signers for this step to users with an active assignment in Master Data."
                  >
                    <USelect
                      :model-value="step.bcm_role ?? 'all'"
                      :items="[{ label: 'Any BIA signer', value: 'all' as const }, ...bcmRoleTabs]"
                      :disabled="disabled"
                      :aria-label="`${step.title} operational BCM role`"
                      class="w-full"
                      @update:model-value="step.bcm_role = $event === 'all' ? null : $event; step.user_id = null"
                    />
                  </UFormField>
                </div>
                <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <USwitch
                    v-model="step.required"
                    label="Required"
                    :disabled="disabled || i === 0 || i === model.signoff_steps.length - 1"
                    :description="i === 0 ? 'The coordinator always submits.' : i === model.signoff_steps.length - 1 ? 'The final step is always required.' : undefined"
                  />
                  <span class="grow" />
                  <UButton
                    v-if="!disabled && i > 0"
                    type="button"
                    size="sm"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    label="Remove step"
                    :aria-label="'Remove step ' + (step.title || step.code)"
                    :disabled="model.signoff_steps.length <= 2"
                    @click="removeStep(step)"
                  />
                </div>
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
