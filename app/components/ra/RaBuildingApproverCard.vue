<script setup lang="ts">
import type { RaAssessment, RaFormula } from '~/composables/useRa'

/**
 * The card on an RA whose building is new and waiting for approval: it must be signed by the
 * building approver first, before the other signers. Everything on it comes from RA
 * configuration: the steps set to sign while the building waits (Sign-off steps: their label,
 * title and signer) and the text (Statements and notes > Building approver card). Shown while
 * the RA is a draft or in approval, and only when such a step signs it.
 */
const props = defineProps<{ assessment: RaAssessment, formula: RaFormula }>()

const ra = useRaModule()

/** The building_pending steps that sign this RA, in order (they always sign first). */
const steps = computed(() => {
  const codes = props.assessment.signoff_step_codes ?? []
  return (props.formula.signoff_steps ?? []).filter((step) => step.condition === 'building_pending' && codes.includes(step.code))
})
const shown = computed(() => props.assessment.building_pending && props.assessment.status !== 'approved' && steps.value.length > 0)

/** "Building approver (the building waits for approval)" names the signer as "Building approver". */
function who(title: string) {
  return title.replace(/\s*\(.*\)\s*$/, '') || title
}
const heading = computed(() => {
  const names = [...new Set(steps.value.map((step) => who(step.title)))]
  return `Must be signed by the ${names.join(' and the ')} first`
})

function signoff(code: string) {
  return props.assessment.signoffs.find((row) => row.role === code)
}

function signer(code: string) {
  const row = signoff(code)
  return row?.signer?.name ?? row?.name ?? null
}

function status(code: string): { label: string, color: 'success' | 'info' | 'neutral' | 'warning', icon: string } {
  const row = signoff(code)
  if (row?.approved_at) return { label: `Signed ${formatDateTime(row.approved_at)}`, color: 'success', icon: 'i-lucide-badge-check' }
  if (props.assessment.status === 'in_signoff') {
    return code === props.assessment.current_signoff_role
      ? { label: 'Waiting for approval', color: 'info', icon: 'i-lucide-hourglass' }
      : { label: 'Not yet', color: 'neutral', icon: 'i-lucide-circle-dashed' }
  }
  return row?.signer
    ? { label: 'Signs first after Submit', color: 'neutral', icon: 'i-lucide-circle-dashed' }
    : { label: 'Signer needed', color: 'warning', icon: 'i-lucide-user-x' }
}
</script>

<template>
  <UCard
    v-if="shown"
    class="ring-2 ring-warning"
    :ui="{ header: 'bg-warning/10' }"
    data-testid="building-approver-card"
  >
    <template #header>
      <div class="flex items-start gap-3">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning"
          aria-hidden="true"
        >
          <UIcon
            name="i-lucide-building-2"
            class="size-5"
          />
        </span>
        <div>
          <p class="text-xs font-medium text-warning">
            The {{ ra.location.lower }} is waiting for approval
          </p>
          <h2 class="text-lg font-semibold text-highlighted">
            {{ heading }}
          </h2>
          <p
            v-if="formula.building_pending_note_en"
            class="mt-1 whitespace-pre-line text-sm text-muted"
          >
            {{ formula.building_pending_note_en }}
          </p>
        </div>
      </div>
    </template>

    <ul class="divide-y divide-default">
      <li
        v-for="step in steps"
        :key="step.code"
        class="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
      >
        <div>
          <p class="font-medium">
            {{ step.label }}
          </p>
          <p class="text-sm text-muted">
            {{ step.title }}<template v-if="signer(step.code)">
              · {{ signer(step.code) }}
            </template>
          </p>
        </div>
        <UBadge
          :color="status(step.code).color"
          variant="subtle"
          :icon="status(step.code).icon"
          :label="status(step.code).label"
        />
      </li>
    </ul>
  </UCard>
</template>
