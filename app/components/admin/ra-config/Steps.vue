<script setup lang="ts">
import type { RaSignoffStep } from '~/composables/useRa'
import type { RaConfigVersion, RaSignerStep } from '~/composables/useRaConfigAdmin'

/**
 * The sign-off steps of this version in approval order, like SCCA's: added, removed, reordered
 * and renamed. Each is required or optional (the last is always required), says who picks the
 * signer (chosen on the Sign-off tab, a default picked here that the assessor can change, a
 * fixed signer set here, or the LIC / LICOM of the Details tab), which roles may sign and which
 * box of the Excel report it fills, and when it signs: always, or only an RA whose building is
 * new and waiting for approval (the building approver; without such a step that RA can't be
 * submitted until the building is approved). Those steps always sign first: they stay at the
 * top here, and the API stores them first too.
 */
const props = defineProps<{ version: RaConfigVersion }>()
const emit = defineEmits<{ saved: [version: RaConfigVersion] }>()

const part = useRaConfigPart<RaSignoffStep[]>(
  computed(() => props.version),
  (value) => (value.signoff_steps ?? []).map(({ role: _role, ...step }) => ({ ...step, signer_roles: [...step.signer_roles] })),
  (code, steps) => raConfigApi.setSteps(code, steps),
  (saved) => emit('saved', saved),
  'Sign-off steps saved',
)
const { draft, error, busy, dirty, submit, reset } = part
const editable = computed(() => props.version.can.edit)

const conditionItems = RA_STEP_CONDITIONS.map(({ value, label, description }) => ({ value, label, description }))
function conditionHelp(value: RaStepCondition | undefined) {
  return RA_STEP_CONDITIONS.find((item) => item.value === (value ?? 'always'))!.description
}

const modeItems = (Object.keys(raSignerModes) as RaSignerMode[]).map((value) => ({
  label: raSignerModes[value].label,
  value,
  description: raSignerModes[value].description,
}))
/** The report boxes of this kind's workbook: 4 for RA, 3 for RA Branch. */
const boxCount = computed(() => (props.version.kind === 'branch' ? 3 : 4))
const boxItems = computed(() => [
  { label: 'Not on the report', value: 0 },
  ...Array.from({ length: boxCount.value }, (_, index) => ({ label: `Box ${index + 1}`, value: index + 1 })),
])

const pendingFirst = (step: RaSignoffStep) => (step.condition === 'building_pending' ? 0 : 1)

/** A step moves only among the steps that sign at the same time: the building_pending ones
 *  always sign first. */
function canMove(index: number, by: -1 | 1) {
  const rows = draft.value
  const target = rows[index + by]
  return !!target && pendingFirst(target) === pendingFirst(rows[index]!)
}

function move(index: number, by: -1 | 1) {
  if (!canMove(index, by)) return
  const rows = draft.value
  const [row] = rows.splice(index, 1)
  rows.splice(index + by, 0, row!)
}

/** A step changed to sign while the building waits for approval goes to the top (and back). */
function setCondition(index: number, condition: RaStepCondition) {
  draft.value[index]!.condition = condition
  draft.value = [...draft.value].sort((a, b) => pendingFirst(a) - pendingFirst(b))
}

function add() {
  draft.value.splice(draft.value.length - 1, 0, {
    code: '',
    label: '',
    title: '',
    mandatory: true,
    signer_mode: 'chosen',
    signer_roles: [],
    report_box: null,
    condition: 'always',
  })
}

function remove(index: number) {
  draft.value.splice(index, 1)
}

const isNew = (code: string) => !code || !props.version.signoff_steps?.some((step) => step.code === code)

/** Back to the workbook's wording, for a step the workbook has. */
function fallback(code: string) {
  return props.version.default_steps.find((row) => row.code === code)
}
function restore(index: number) {
  const row = draft.value[index]!
  const original = fallback(row.code)
  if (original) draft.value[index] = { ...row, label: original.label, title: original.title }
}

// --- default and fixed signers -----------------------------------------------------------
// Live settings per kind and step code, not part of a version: a default signer is filled in
// on new RAs (the assessor can change it); a fixed signer is put on the step at Submit.
const toast = useToast()
const { can } = useAuth()
const canPick = computed(() => can('ra.config.manage'))
const signers = useAsyncData(
  () => `ra-signers-${props.version.kind}`,
  () => raConfigApi.signers(props.version.kind),
  { watch: [() => props.version.kind, () => props.version.code] },
)
// Saving the steps can make a step default or fixed: list its live signer then.
watch(() => (props.version.signoff_steps ?? []).map((step) => `${step.code}:${step.signer_mode}`).join(), () => signers.refresh())
const picking = ref<string | null>(null)
const signerErrors = ref<Record<string, string>>({})
const side = computed(() => RA_MODULES[props.version.kind])

function savedMode(code: string) {
  return props.version.signoff_steps?.find((step) => step.code === code)?.signer_mode ?? 'chosen'
}

function signerOf(code: string): RaSignerStep | undefined {
  return signers.data.value?.items.find((row) => row.code === code)
}

async function pickSigner(code: string, userId: number | null | undefined) {
  const current = signerOf(code)
  if (!current || (userId ?? null) === (current.signer?.id ?? null)) return
  picking.value = code
  signerErrors.value = { ...signerErrors.value, [code]: '' }
  try {
    const saved = await raConfigApi.setSigner(props.version.kind, code, userId ?? null)
    if (signers.data.value) signers.data.value.items = signers.data.value.items.map((row) => (row.code === code ? saved : row))
    toast.add({
      title: saved.signer ? `${saved.label} (${saved.title}): ${saved.signer.display_name ?? saved.signer.email}` : `${saved.label} (${saved.title}): signer cleared`,
      description: saved.signer_mode === 'fixed' ? 'Put on each RA at Submit.' : 'Filled in on new RAs.',
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    signerErrors.value = { ...signerErrors.value, [code]: details?.user_id ?? details?.step ?? configErrorText(failure) }
    await signers.refresh()
  } finally {
    picking.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="font-semibold text-highlighted">
          Sign-off steps
        </h2>
        <p class="mt-1 max-w-3xl text-sm text-muted">
          Approvers sign in this order. The label heads the sign-off box and the title is who signs, as Monitoring, Approval and the reports show the step. An optional step without a signer is skipped ("Not required" on the reports). A step set to sign when the building is waiting for approval signs only the RAs of new buildings not approved yet, and always signs first, before the other steps. Pick the default or fixed signer under the step: it is saved at once and applies to every version.
        </p>
      </div>
      <div
        v-if="editable"
        class="flex gap-2"
      >
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-plus"
          label="Add step"
          @click="add"
        />
        <UButton
          v-if="dirty"
          color="neutral"
          variant="outline"
          label="Undo changes"
          @click="reset"
        />
        <UButton
          icon="i-lucide-save"
          label="Save steps"
          :disabled="!dirty"
          :loading="busy"
          @click="submit"
        />
      </div>
    </div>
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't save the sign-off steps"
      :ui="{ description: 'whitespace-pre-line' }"
      :description="error"
    />
    <ol class="space-y-3">
      <li
        v-for="(step, index) in draft"
        :key="index"
      >
        <UCard>
          <fieldset
            :disabled="!editable"
            class="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]"
          >
            <legend class="sr-only">
              Step {{ index + 1 }}: {{ step.label }} {{ step.title }}
            </legend>
            <div class="flex items-start gap-1 lg:flex-col">
              <span
                class="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums"
                aria-hidden="true"
              >{{ index + 1 }}</span>
              <UButton
                size="sm"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-up"
                :disabled="!canMove(index, -1)"
                :aria-label="`Move step ${index + 1} up`"
                @click="move(index, -1)"
              />
              <UButton
                size="sm"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-down"
                :disabled="!canMove(index, 1)"
                :aria-label="`Move step ${index + 1} down`"
                @click="move(index, 1)"
              />
            </div>
            <div class="space-y-4">
              <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
                <UFormField
                  label="Label"
                  :name="`steps.${index}.label`"
                  help="The box heading, e.g. Prepared by."
                  required
                >
                  <template #hint>
                    <FieldCount
                      :value="step.label"
                      :max="TEXT_LIMITS.name"
                    />
                  </template>
                  <UInput
                    v-model="step.label"
                    :maxlength="TEXT_LIMITS.name"
                    :aria-label="`Label of step ${index + 1}`"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Title (who signs)"
                  :name="`steps.${index}.title`"
                  required
                >
                  <template #hint>
                    <FieldCount
                      :value="step.title"
                      :max="TEXT_LIMITS.name"
                    />
                  </template>
                  <UInput
                    v-model="step.title"
                    :maxlength="TEXT_LIMITS.name"
                    :aria-label="`Title of step ${index + 1}`"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Code"
                  :name="`steps.${index}.code`"
                  required
                  help="Lower case and _. Fixed once published."
                >
                  <template #hint>
                    <FieldCount
                      :value="step.code"
                      :max="TEXT_LIMITS.short"
                    />
                  </template>
                  <UInput
                    v-model="step.code"
                    :maxlength="TEXT_LIMITS.short"
                    :aria-label="`Code of step ${index + 1}`"
                    class="w-full font-mono"
                    :disabled="!isNew(step.code)"
                  />
                </UFormField>
              </div>
              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <UFormField
                  label="Signs"
                  :name="`steps.${index}.condition`"
                  :help="conditionHelp(step.condition)"
                >
                  <USelect
                    :model-value="step.condition ?? 'always'"
                    :items="conditionItems"
                    :aria-label="`When step ${index + 1} signs`"
                    class="w-full"
                    @update:model-value="setCondition(index, $event as RaStepCondition)"
                  />
                </UFormField>
                <UFormField
                  label="Signer"
                  :name="`steps.${index}.signer_mode`"
                  :help="raSignerModes[step.signer_mode].description"
                >
                  <USelect
                    v-model="step.signer_mode"
                    :items="modeItems"
                    :aria-label="`Signer of step ${index + 1}`"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Who may sign"
                  :name="`steps.${index}.signer_roles`"
                  :help="`Role codes, e.g. bcm_admin. Empty: any user with ${side.title} access.`"
                >
                  <UInputTags
                    v-model="step.signer_roles"
                    :aria-label="`Who may sign step ${index + 1}`"
                    class="w-full"
                    placeholder="Add a role code"
                  />
                </UFormField>
                <UFormField
                  label="Report box"
                  :name="`steps.${index}.report_box`"
                  :help="`The sign-off box on the Excel report (${boxCount} boxes, left to right).`"
                >
                  <USelect
                    :model-value="step.report_box ?? 0"
                    :items="boxItems"
                    :aria-label="`Report box of step ${index + 1}`"
                    class="w-full"
                    @update:model-value="step.report_box = Number($event) || null"
                  />
                </UFormField>
              </div>
              <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
                <USwitch
                  v-model="step.mandatory"
                  label="Required"
                  :disabled="index === draft.length - 1"
                  :description="index === draft.length - 1 ? 'The last step is always required.' : undefined"
                />
                <span class="grow" />
                <UButton
                  v-if="editable && fallback(step.code)"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-rotate-ccw"
                  label="Workbook wording"
                  :aria-label="`Reset the wording of step ${index + 1}`"
                  @click="restore(index)"
                />
                <UButton
                  v-if="editable && draft.length > 1"
                  size="sm"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  label="Remove step"
                  :aria-label="`Remove step ${index + 1}`"
                  @click="remove(index)"
                />
              </div>
            </div>
          </fieldset>
          <div
            v-if="(step.signer_mode === 'default' || step.signer_mode === 'fixed') && step.code"
            class="mt-4 border-t border-default pt-4 lg:ms-12"
          >
            <UFormField
              v-if="signerOf(step.code) && savedMode(step.code) === step.signer_mode"
              :label="step.signer_mode === 'fixed' ? 'Fixed signer' : 'Default signer'"
              :name="`signer-${step.code}`"
              :help="step.signer_mode === 'fixed'
                ? 'Signs every RA at this step and is put on it at Submit. If they are away, BCM changes the signer of the waiting step. Saved at once, for every version.'
                : 'Filled in on new RAs. The assessor can change it. Saved at once, for every version.'"
              :error="signerErrors[step.code] || signerOf(step.code)?.problem || undefined"
              class="max-w-xl"
            >
              <UserPicker
                :model-value="signerOf(step.code)?.signer?.id ?? null"
                :selected="signerOf(step.code)?.signer ?? null"
                :disabled="!canPick || picking === step.code"
                :aria-label="`${step.label} (${step.title}) signer`"
                :permission="side.perm.access"
                :placeholder="step.signer_mode === 'fixed' ? 'Pick the fixed signer' : 'Pick the default signer'"
                @update:model-value="(value) => pickSigner(step.code, value)"
              />
            </UFormField>
            <p
              v-else
              class="flex items-center gap-1.5 text-sm text-muted"
            >
              <UIcon
                name="i-lucide-info"
                class="size-4"
              />
              Save the steps, then pick the {{ step.signer_mode }} signer here.
            </p>
            <p
              v-if="signerOf(step.code)?.updated_by && savedMode(step.code) === step.signer_mode"
              class="mt-1 text-xs text-muted"
            >
              Changed by {{ signerOf(step.code)!.updated_by }}, {{ formatDateTime(signerOf(step.code)!.updated_at) }}
            </p>
          </div>
        </UCard>
      </li>
    </ol>
  </div>
</template>
