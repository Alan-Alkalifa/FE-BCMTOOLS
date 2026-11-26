<script setup lang="ts">
import type { BiancaAssessment } from '~/composables/useBianca'

/**
 * The top of a BIA opened from Approval: where its sign-off stands and, for the signer of the
 * step it waits on, Approve and Return for changes (a reason is required to return it). The
 * page refreshes the BIA with what the API answers (`decided`).
 */
const props = defineProps<{ assessment: BiancaAssessment }>()
const emit = defineEmits<{ decided: [assessment: BiancaAssessment] }>()

const toast = useToast()
const { $posthog } = useNuxtApp()
const dialog = ref<'approve' | 'reject' | null>(null)
const note = ref('')
const busy = ref(false)
const failure = ref<string | null>(null)

const current = computed(() => props.assessment.signoffs.find((step) => step.current) ?? null)
const returned = computed(() => props.assessment.status === 'draft' && props.assessment.in_revision
  ? props.assessment.signoffs.find((step) => step.status === 'rejected') ?? null
  : null)
const isLast = computed(() => {
  const steps = props.assessment.signoffs
  const at = steps.findIndex((step) => step.current)
  return at >= 0 && !steps.slice(at + 1).some((step) => step.status === 'pending')
})

function open(kind: 'approve' | 'reject') {
  note.value = ''
  failure.value = null
  dialog.value = kind
}

async function decide() {
  if (!dialog.value) return
  const kind = dialog.value
  if (kind === 'reject' && !note.value.trim()) {
    failure.value = 'Say what has to change.'
    return
  }
  busy.value = true
  failure.value = null
  try {
    const result = kind === 'approve'
      ? await biancaApprovalApi.approve(props.assessment.id, note.value.trim() || null)
      : await biancaApprovalApi.reject(props.assessment.id, note.value.trim())
    $posthog?.capture('bianca_approval_decided', { decision: kind, is_final: result.status === 'final' })
    dialog.value = null
    toast.add(kind === 'approve'
      ? {
          title: result.status === 'final' ? 'Approved: the BIA is final' : 'Approved',
          description: result.status === 'final' ? undefined : `It goes on to ${result.signoffs.find((step) => step.current)?.name ?? 'the next signer'}.`,
          color: 'success',
          icon: 'i-lucide-badge-check',
        }
      : { title: 'Returned for changes', description: 'The BCM Coordinator gets an email with your reason.', color: 'warning', icon: 'i-lucide-undo-2' })
    emit('decided', result)
  } catch (error) {
    failure.value = apiErrorMessage(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="assessment.can_decide && current"
      color="warning"
      variant="subtle"
      icon="i-lucide-hourglass"
      :title="`Waiting for your sign-off as ${current.title}`"
      :description="`Submitted by ${assessment.created_by ?? 'the BCM Coordinator'}${assessment.submitted_at ? ` on ${formatDateTime(assessment.submitted_at)}` : ''}. Review the BIA on its tabs below, then approve it or return it for changes.`"
    >
      <template #actions>
        <UButton
          color="error"
          variant="outline"
          icon="i-lucide-undo-2"
          label="Return for changes"
          @click="open('reject')"
        />
        <UButton
          icon="i-lucide-badge-check"
          :label="isLast ? 'Approve (final)' : 'Approve'"
          @click="open('approve')"
        />
      </template>
    </UAlert>
    <UAlert
      v-else-if="assessment.status === 'in_approval'"
      color="neutral"
      variant="subtle"
      icon="i-lucide-hourglass"
      :title="`In approval: waiting for ${current?.name ?? 'the signer'}${current ? ` (${current.title})` : ''}`"
      description="You can read it here; only the signer of the current step decides it."
    />
    <UAlert
      v-else-if="assessment.status === 'final'"
      color="success"
      variant="subtle"
      icon="i-lucide-badge-check"
      :title="`Final${assessment.finalised_at ? ` since ${formatDateTime(assessment.finalised_at)}` : ''}`"
      description="Every sign-off step approved this BIA."
    />
    <UAlert
      v-else-if="returned"
      color="error"
      variant="subtle"
      icon="i-lucide-undo-2"
      :title="`Returned for changes by ${returned.name ?? returned.title}${returned.decided_at ? ` on ${formatDateTime(returned.decided_at)}` : ''}`"
      :description="`${returned.decision_note ? `Reason: ${returned.decision_note}\n` : ''}The BCM Coordinator fixes it in Manage and submits it again.`"
      :ui="{ description: 'whitespace-pre-line' }"
    />

    <UCard v-if="assessment.signoffs.length">
      <template #header>
        <h2 class="text-sm font-semibold">
          Sign-off · {{ assessment.config_version }}
        </h2>
      </template>
      <BiancaSignoffSteps :steps="assessment.signoffs" />
    </UCard>

    <UModal
      :open="dialog !== null"
      :title="dialog === 'reject' ? 'Return this BIA for changes?' : isLast ? 'Approve this BIA? It becomes final.' : 'Approve this BIA?'"
      :description="dialog === 'reject'
        ? 'It goes back to its BCM Coordinator as a draft. They get an email with your reason, fix it and submit it again.'
        : isLast
          ? 'Yours is the last sign-off step: the BIA becomes final.'
          : 'It goes on to the signer of the next step, who gets an email.'"
      @update:open="(value) => { if (!value && !busy) dialog = null }"
    >
      <template #body>
        <UFormField
          :label="dialog === 'reject' ? 'What has to change' : 'Note (optional)'"
          :required="dialog === 'reject'"
          :error="failure ?? undefined"
        >
          <UTextarea
            v-model="note"
            :rows="4"
            :maxlength="2000"
            autofocus
            class="w-full"
            :placeholder="dialog === 'reject' ? 'E.g. clarify the backlog hours of Function 2.' : undefined"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            :disabled="busy"
            @click="dialog = null"
          />
          <UButton
            v-if="dialog === 'reject'"
            color="error"
            icon="i-lucide-undo-2"
            label="Return for changes"
            :loading="busy"
            @click="decide"
          />
          <UButton
            v-else
            icon="i-lucide-badge-check"
            :label="isLast ? 'Approve (final)' : 'Approve'"
            :loading="busy"
            @click="decide"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
