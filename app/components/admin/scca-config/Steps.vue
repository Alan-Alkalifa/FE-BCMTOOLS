<script setup lang="ts">
import type { SccaConfigVersion, SccaSignerStep } from '~/composables/useSccaConfigAdmin'

/**
 * The sign-off steps in approval order: required or optional (the last is always required),
 * who picks the signer (chosen by the assessor, a default picked here that they can change,
 * or a fixed signer set by BCM), which roles may sign, the box on the Excel form, and whether
 * the step comments on every tab (the BCM reviewer in V4.2).
 */
const props = defineProps<{ version: SccaConfigVersion }>()
const emit = defineEmits<{ saved: [version: SccaConfigVersion] }>()

const part = useConfigPart(
  computed(() => props.version),
  (value) => value.steps.map(({ signer: _signer, ...step }) => step),
  (code, steps) => sccaConfigApi.setSteps(code, steps),
  (saved) => emit('saved', saved),
  'Sign-off steps saved',
)
const { draft, error, busy, dirty, submit, reset } = part

const modeItems = (Object.keys(sccaSignerModes) as SccaSignerMode[]).map((value) => ({
  label: sccaSignerModes[value].label,
  value,
  description: sccaSignerModes[value].description,
}))
const boxItems = [
  { label: 'Not on the form', value: 0 },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((box) => ({ label: `Box ${box}${box <= 4 ? ' (top row)' : ' (bottom row)'}`, value: box })),
]

function move(index: number, by: -1 | 1) {
  const rows = draft.value
  const target = index + by
  if (target < 0 || target >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(target, 0, row!)
}

function add() {
  draft.value.splice(draft.value.length - 1, 0, {
    code: '',
    title: '',
    short: '',
    mandatory: true,
    signer_mode: 'chosen',
    signer_roles: [],
    excel_box: null,
    comments_all_tabs: false,
  })
}

function remove(index: number) {
  draft.value.splice(index, 1)
}

const isNew = (code: string) => !props.version.steps.some((step) => step.code === code) || !code

// --- default and fixed signers -----------------------------------------------------------
// Live settings by step code, not part of a version: a default signer is filled in on new
// SCCAs (the assessor can change it); a fixed signer is applied at Submit.
const toast = useToast()
const { can } = useAuth()
const canPick = computed(() => can('scca.config.manage') || can('scca.settings.manage'))
const signers = useAsyncData('scca-signers', () => (canPick.value ? sccaConfigApi.signers() : Promise.resolve({ items: [] as SccaSignerStep[] })))
const picking = ref<string | null>(null)
const signerErrors = ref<Record<string, string>>({})

function savedMode(code: string) {
  return props.version.steps.find((step) => step.code === code)?.signer_mode ?? 'chosen'
}

function signerOf(code: string) {
  return signers.data.value?.items.find((row) => row.code === code)
}

async function pickSigner(code: string, userId: number | null | undefined) {
  const current = signerOf(code)
  if (!current || (userId ?? null) === (current.signer?.id ?? null)) return
  picking.value = code
  signerErrors.value = { ...signerErrors.value, [code]: '' }
  try {
    const saved = await sccaConfigApi.setSigner(code, userId ?? null)
    if (signers.data.value) signers.data.value.items = signers.data.value.items.map((row) => (row.code === code ? saved : row))
    clearNuxtData((key) => key.startsWith('scca-config-') && !key.startsWith('scca-config-version'))
    toast.add({
      title: saved.signer ? `${saved.title}: ${saved.signer.display_name ?? saved.signer.email}` : `${saved.title}: signer cleared`,
      description: saved.signer_mode === 'fixed' ? 'Applied to each SCCA at Submit.' : 'Filled in on new SCCAs.',
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
      <p class="max-w-3xl text-sm text-muted">
        Approvers sign in this order. An optional step without a signer is skipped ("Not required" on the reports). Pick the default or fixed signer under the step: it is saved at once and applies to every version. A fixed signer who is away is replaced by BCM with Reassign.
      </p>
      <div
        v-if="version.can.edit"
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
            :disabled="!version.can.edit"
            class="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]"
          >
            <legend class="sr-only">
              Step {{ index + 1 }}: {{ step.title }}
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
                :disabled="index === 0"
                :aria-label="`Move ${step.title || 'step'} up`"
                @click="move(index, -1)"
              />
              <UButton
                size="sm"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-down"
                :disabled="index === draft.length - 1"
                :aria-label="`Move ${step.title || 'step'} down`"
                @click="move(index, 1)"
              />
            </div>
            <div class="space-y-4">
              <div class="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <UFormField
                  label="Title"
                  required
                >
                  <UInput
                    v-model="step.title"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Short name"
                  required
                >
                  <UInput
                    v-model="step.short"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Code"
                  required
                  help="Lower case and _. Fixed once published."
                >
                  <UInput
                    v-model="step.code"
                    class="w-full font-mono"
                    :disabled="!isNew(step.code)"
                  />
                </UFormField>
              </div>
              <div class="grid gap-4 md:grid-cols-3">
                <UFormField
                  label="Signer"
                  :help="sccaSignerModes[step.signer_mode].description"
                >
                  <USelect
                    v-model="step.signer_mode"
                    :items="modeItems"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Who may sign"
                  help="Role codes, e.g. bcm_admin. Empty: any SCCA user."
                >
                  <UInputTags
                    v-model="step.signer_roles"
                    class="w-full"
                    placeholder="Add a role code"
                  />
                </UFormField>
                <UFormField
                  label="Excel form box"
                  help="Boxes 1–4: top row; 5–8: bottom row."
                >
                  <USelect
                    :model-value="step.excel_box ?? 0"
                    :items="boxItems"
                    class="w-full"
                    @update:model-value="step.excel_box = Number($event) || null"
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
                <UCheckbox
                  v-model="step.comments_all_tabs"
                  label="Comments on every tab"
                  description="At this step its signer comments on Application, Rating, Interdependencies and Recovery too."
                />
                <span class="grow" />
                <UButton
                  v-if="version.can.edit"
                  size="sm"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  label="Remove step"
                  @click="remove(index)"
                />
              </div>
            </div>
          </fieldset>
          <div
            v-if="step.signer_mode !== 'chosen' && step.code"
            class="mt-4 border-t border-default pt-4 lg:ms-12"
          >
            <UFormField
              v-if="signerOf(step.code) && savedMode(step.code) === step.signer_mode"
              :label="step.signer_mode === 'fixed' ? 'Fixed signer' : 'Default signer'"
              :name="`signer-${step.code}`"
              :help="step.signer_mode === 'fixed'
                ? 'Signs every SCCA at this step; applied at Submit. If they are away, BCM reassigns the step. Saved at once, for every version.'
                : 'Filled in on new SCCAs; the assessor can change it. Saved at once, for every version.'"
              :error="signerErrors[step.code] || signerOf(step.code)?.problem || undefined"
              class="max-w-xl"
            >
              <UserPicker
                :model-value="signerOf(step.code)?.signer?.id ?? null"
                :selected="signerOf(step.code)?.signer ?? null"
                :disabled="!canPick || picking === step.code"
                :aria-label="`${step.title} signer`"
                permission="scca.access"
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
