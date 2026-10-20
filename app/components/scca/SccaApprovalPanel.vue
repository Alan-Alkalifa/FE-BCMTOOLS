<script setup lang="ts">
import type { SccaApprovalResult, SccaAssessment } from '~/composables/useScca'

/**
 * Approval status and actions: submit (Manage), approve or reject the current step (Approval),
 * and the history. There is no recall: once submitted, only a rejection returns it to draft.
 */
/** `actions: false` (Monitoring) shows the status and history only. */
const props = withDefaults(defineProps<{ assessment: SccaAssessment, actions?: boolean }>(), { actions: true })
const emit = defineEmits<{ saved: [assessment: SccaAssessment] }>()

const toast = useToast()
const confirm = useConfirm()
const dirty = useSccaDirty()
const note = ref('')
const noteError = ref<string | null>(null)
const busy = ref(false)

const permissions = computed(() => props.assessment.permissions)

const pendingSignoff = computed(() =>
  props.assessment.signoffs.find((row) => row.role === props.assessment.pending_role) ?? null,
)

// Required steps the assessor picks (fixed steps are set by BCM; optional ones may stay empty).
const config = useSccaConfigContext()
const unassigned = computed(() => {
  const steps = config.value?.steps
    ?? SCCA_SIGNOFF_ROLES.map((role) => ({ code: role.value, short: role.short, mandatory: true, signer_mode: 'chosen' }))
  return steps
    .filter((step) => step.mandatory && step.signer_mode !== 'fixed')
    .filter((step) => !props.assessment.signoffs.some((row) => row.role === step.code && row.user_id))
    .map((step) => step.short)
})

const submitBlockers = computed(() => {
  const blockers: string[] = []
  const missing = props.assessment.missing_answers.length
  if (missing) blockers.push(`Rate the ${missing} remaining question${missing === 1 ? '' : 's'}.`)
  if (unassigned.value.length) blockers.push(`Pick a user for: ${unassigned.value.join(', ')}.`)
  if (dirty?.value) blockers.push('Save your changes on this tab first.')
  return blockers
})

const EVENT_LABELS: Record<string, string> = {
  submitted: 'Submitted for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  recalled: 'Recalled to draft',
  finalised: 'Final: all steps approved',
  reassigned: 'Step reassigned by BCM',
  approved_on_behalf: 'Approved on behalf',
  nudged: 'Reminder from BCM',
  reminded: 'Automatic reminder',
  escalated: 'Escalated to BCM',
}

const history = computed(() => [...props.assessment.events].reverse())

function emailNote(result: SccaApprovalResult, who: string) {
  return result.email_sent ? `${who} has been emailed.` : `The email to ${who} could not be sent; please let them know.`
}

async function run(action: () => Promise<SccaApprovalResult>, success: (result: SccaApprovalResult) => { title: string, description?: string }) {
  busy.value = true
  try {
    const result = await action()
    note.value = ''
    noteError.value = null
    emit('saved', result)
    toast.add({ ...success(result), color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    const details = apiFieldErrors(error)
    if (details.length) {
      toast.add({ title: 'Not ready yet', description: details.map((item) => item.message).join(' '), color: 'error', icon: 'i-lucide-circle-alert' })
    } else {
      toast.add({ title: apiErrorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
    }
  } finally {
    busy.value = false
  }
}

function nextApprover(result: SccaApprovalResult) {
  const row = result.signoffs.find((item) => item.role === result.pending_role)
  return row?.name ?? signoffRoleLabel(result.pending_role, true)
}

async function submit() {
  const ok = await confirm({
    title: 'Submit for approval?',
    description: 'The assessment is locked while the 9 sign-off steps approve it in order. You can\'t recall it: to change it, an approver must reject it back to draft.',
    confirmLabel: 'Submit for approval',
  })
  if (!ok) return
  await run(() => sccaApi.submit(props.assessment.id), (result) => ({
    title: 'Submitted for approval',
    description: emailNote(result, nextApprover(result)),
  }))
}

async function approve() {
  await run(() => sccaApi.approve(props.assessment.id, note.value.trim() || null), (result) =>
    result.status === 'final'
      ? { title: 'Approved. The SCCA is final', description: emailNote(result, 'The assessor') }
      : { title: 'Approved', description: emailNote(result, nextApprover(result)) },
  )
}

async function reject() {
  if (!note.value.trim()) {
    noteError.value = 'Give a reason for the rejection.'
    return
  }
  const ok = await confirm({
    title: 'Reject this SCCA?',
    description: 'It goes back to draft for the assessor and contributor to fix.',
    confirmLabel: 'Reject',
    destructive: true,
  })
  if (!ok) return
  await run(() => sccaApi.reject(props.assessment.id, note.value.trim()), (result) => ({
    title: 'Rejected and returned to draft',
    description: emailNote(result, 'The assessor'),
  }))
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-semibold">
          Approval
        </h2>
        <StatusBadge
          :scale="sccaStatus"
          :value="assessment.status"
        />
      </div>
    </template>

    <div class="space-y-4">
      <p
        v-if="assessment.status === 'in_approval'"
        class="text-sm"
      >
        Waiting for <span class="font-medium">{{ signoffRoleLabel(assessment.pending_role) }}</span>:
        {{ pendingSignoff?.name || 'no user picked' }}.
      </p>
      <p
        v-else-if="assessment.status === 'final'"
        class="text-sm"
      >
        All sign-off steps approved on {{ formatDateTime(assessment.finalised_at) }}. The SCCA is final.
      </p>
      <p
        v-else
        class="text-sm text-muted"
      >
        Draft. When it is complete, submit it: the sign-off steps approve one by one and each person is emailed when it's their turn.
      </p>

      <div
        v-if="actions && permissions.can_submit"
        class="space-y-2"
      >
        <ul
          v-if="submitBlockers.length"
          class="list-disc space-y-1 pl-5 text-sm text-muted"
        >
          <li
            v-for="blocker in submitBlockers"
            :key="blocker"
          >
            {{ blocker }}
          </li>
        </ul>
        <UButton
          icon="i-lucide-send"
          label="Submit for approval"
          :disabled="submitBlockers.length > 0"
          :loading="busy"
          @click="submit"
        />
      </div>

      <div
        v-if="actions && permissions.can_decide"
        class="space-y-3"
      >
        <UFormField
          label="Note"
          help="Optional when you approve; required when you reject."
          :error="noteError ?? undefined"
        >
          <UTextarea
            v-model="note"
            class="w-full"
            :rows="2"
            aria-label="Approval note"
          />
        </UFormField>
        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-circle-check"
            :label="`Approve as ${signoffRoleLabel(assessment.pending_role, true)}`"
            :loading="busy"
            @click="approve"
          />
          <UButton
            color="error"
            variant="soft"
            icon="i-lucide-circle-x"
            label="Reject"
            :loading="busy"
            @click="reject"
          />
        </div>
      </div>

      <div v-if="history.length">
        <h3 class="mb-2 text-sm font-medium">
          History
        </h3>
        <ol class="space-y-2 text-sm">
          <li
            v-for="(event, index) in history"
            :key="index"
            class="border-l-2 border-default pl-3"
          >
            <p>
              <span class="font-medium">{{ EVENT_LABELS[event.action] ?? event.action }}</span>
              <span v-if="event.role"> · {{ signoffRoleLabel(event.role, true) }}</span>
              <span v-if="event.actor"> · {{ event.actor }}</span>
            </p>
            <p
              v-if="event.action === 'reassigned' && (event.from_user || event.to_user)"
              class="text-xs"
            >
              From {{ event.from_user || '—' }} to {{ event.to_user || '—' }}
            </p>
            <p
              v-else-if="event.action === 'approved_on_behalf' && event.from_user"
              class="text-xs"
            >
              For {{ event.from_user }}
            </p>
            <a
              v-if="event.attachment"
              :href="event.attachment.url"
              class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              download
            >
              <UIcon
                name="i-lucide-paperclip"
                class="size-3.5"
              />
              {{ event.attachment.filename }}
            </a>
            <p class="text-xs text-muted">
              {{ formatDateTime(event.created_at) }}
            </p>
            <p
              v-if="event.note"
              class="mt-0.5 whitespace-pre-line"
            >
              {{ event.note }}
            </p>
          </li>
        </ol>
      </div>
    </div>
  </UCard>
</template>
