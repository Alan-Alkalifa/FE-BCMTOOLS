<script setup lang="ts">
import type { BcpApprovalStep, BcpConfigVersion } from '~/composables/useBcpConfigAdmin'

/**
 * Who signs the Proposal for Approval page, in order. The first step prepares the BCP (Ketua RTF
 * or Ketua IMT, from the BCP); the last step is required. Approval itself comes with BCP Approval.
 */
const props = defineProps<{ version: BcpConfigVersion }>()
const emit = defineEmits<{ saved: [version: BcpConfigVersion] }>()

const { draft, error, busy, dirty, submit } = useBcpConfigPart(toRef(props, 'version'), 'approval_steps', (saved) => emit('saved', saved), 'Approval template saved')
const GROUPS = [
  { label: 'Prepared by', value: 'prepared' }, { label: 'Reviewed by', value: 'reviewed' },
  { label: 'Risk Control Unit', value: 'rcu' }, { label: 'Mandatory reviewer', value: 'mandatory' },
  { label: 'Approval by', value: 'approval' },
]
const MODES = [
  { label: 'From the BCP', value: 'plan_role' }, { label: 'Fixed person', value: 'fixed' },
  { label: 'Chosen on the BCP', value: 'chosen' },
]
const ROLES = [{ label: 'Ketua RTF', value: 'rtf_lead' }, { label: 'Ketua IMT', value: 'imt_lead' }]

function setMode(step: BcpApprovalStep, mode: BcpApprovalStep['signer_mode']) {
  step.signer_mode = mode
  step.plan_role = mode === 'plan_role' ? (step.plan_role ?? 'rtf_lead') : null
  if (mode !== 'fixed') {
    step.name = null
    step.position = null
  }
}
function add() {
  draft.value.push({ code: bcpCodeFrom('step', draft.value.map((row) => row.code)), group: 'mandatory', title: '', signer_mode: 'fixed', plan_role: null, name: '', position: '', required: true })
}
function move(index: number, by: number) {
  const [row] = draft.value.splice(index, 1)
  draft.value.splice(index + by, 0, row!)
}
</script>

<template>
  <AdminBcpConfigPartForm
    title="Approval template"
    description="The signers of the Proposal for Approval page, in order. Fixed people are printed by name; the others are picked on each BCP."
    save-label="Save approval template"
    :editable="version.can.edit"
    :dirty="dirty"
    :busy="busy"
    :error="error"
    @submit="submit"
  >
    <div class="overflow-x-auto">
      <table class="w-full min-w-[60rem] text-sm">
        <caption class="sr-only">
          Approval steps
        </caption>
        <thead class="bg-muted text-left text-xs uppercase text-muted">
          <tr>
            <th class="w-10 px-3 py-2">
              #
            </th>
            <th class="w-44 px-3 py-2">
              Group
            </th>
            <th class="px-3 py-2">
              Title
            </th>
            <th class="w-44 px-3 py-2">
              Signer
            </th>
            <th class="w-64 px-3 py-2">
              Person
            </th>
            <th class="w-20 px-3 py-2">
              Required
            </th>
            <th class="w-28 px-3 py-2" />
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="(step, index) in draft"
            :key="step.code"
          >
            <td class="px-3 py-2 align-top tabular-nums">
              {{ index + 1 }}
            </td>
            <td class="px-3 py-2 align-top">
              <USelect
                v-model="step.group"
                :items="GROUPS"
                class="w-full"
                :aria-label="`Group of step ${index + 1}`"
              />
            </td>
            <td class="px-3 py-2 align-top">
              <UInput
                v-model="step.title"
                class="w-full"
                maxlength="255"
                :aria-label="`Title of step ${index + 1}`"
              />
            </td>
            <td class="px-3 py-2 align-top">
              <USelect
                :model-value="step.signer_mode"
                :items="MODES"
                class="w-full"
                :aria-label="`Signer of step ${index + 1}`"
                @update:model-value="(value) => setMode(step, value as BcpApprovalStep['signer_mode'])"
              />
            </td>
            <td class="space-y-2 px-3 py-2 align-top">
              <USelect
                v-if="step.signer_mode === 'plan_role'"
                v-model="step.plan_role!"
                :items="ROLES"
                class="w-full"
                :aria-label="`BCP role signing step ${index + 1}`"
              />
              <template v-else-if="step.signer_mode === 'fixed'">
                <UInput
                  :model-value="step.name ?? ''"
                  class="w-full"
                  maxlength="255"
                  placeholder="Name"
                  :aria-label="`Name of the signer of step ${index + 1}`"
                  @update:model-value="(value) => (step.name = String(value))"
                />
                <UInput
                  :model-value="step.position ?? ''"
                  class="w-full"
                  maxlength="255"
                  placeholder="Position"
                  :aria-label="`Position of the signer of step ${index + 1}`"
                  @update:model-value="(value) => (step.position = String(value))"
                />
              </template>
              <span
                v-else
                class="text-muted"
              >Picked on each BCP</span>
            </td>
            <td class="px-3 py-2 align-top">
              <USwitch
                v-model="step.required"
                :aria-label="`Step ${index + 1} is required`"
              />
            </td>
            <td class="px-3 py-2 text-right align-top">
              <div
                v-if="version.can.edit"
                class="flex justify-end gap-1"
              >
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-up"
                  :disabled="index === 0"
                  :aria-label="`Move step ${index + 1} up`"
                  @click="move(index, -1)"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-down"
                  :disabled="index === draft.length - 1"
                  :aria-label="`Move step ${index + 1} down`"
                  @click="move(index, 1)"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :disabled="draft.length <= 2"
                  :aria-label="`Remove step ${index + 1}`"
                  @click="draft.splice(index, 1)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-sm text-muted">
      The first step is the one who prepares the BCP (Disiapkan oleh). The last step must be required.
    </p>
    <UButton
      v-if="version.can.edit && draft.length < 20"
      color="neutral"
      variant="outline"
      icon="i-lucide-plus"
      label="Add step"
      @click="add"
    />
  </AdminBcpConfigPartForm>
</template>
