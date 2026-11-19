<script setup lang="ts">
import type { SccaApprovalResult, SccaAssessment } from '~/composables/useScca'

/**
 * Approval status and actions: submit (Manage), approve or reject the current step (Approval),
 * and the history. There is no recall: once submitted, only a rejection returns it to draft.
 */
/** `actions: false` (Monitoring) shows the status and history only. */
const props = withDefaults(
  defineProps<{ assessment: SccaAssessment, actions?: boolean, standards?: SccaConfigStandard[] }>(),
  { actions: true, standards: () => [] },
)
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

// Every mandatory field on every tab must be filled before Submit (the API checks the same).
const config = useSccaConfigContext()
const missingCount = computed(() => sccaMissingCount(sccaMissing(props.assessment, config.value)))
const gapCount = computed(() => sccaMissingCount(sccaGaps(props.assessment, config.value, props.standards)))
const showChecks = computed(() => props.assessment.status !== 'final' || gapCount.value > 0)

const submitBlockers = computed(() => {
  const blockers: string[] = []
  if (missingCount.value) blockers.push('Fill in the fields listed above first.')
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

// How each history event looks: its icon and colour. Reminders are quiet, decisions stand out.
const EVENT_LOOK: Record<string, { icon: string, tone: string }> = {
  submitted: { icon: 'i-lucide-send', tone: 'primary' },
  approved: { icon: 'i-lucide-circle-check', tone: 'success' },
  approved_on_behalf: { icon: 'i-lucide-user-check', tone: 'success' },
  finalised: { icon: 'i-lucide-badge-check', tone: 'success' },
  rejected: { icon: 'i-lucide-circle-x', tone: 'error' },
  recalled: { icon: 'i-lucide-undo-2', tone: 'warning' },
  reassigned: { icon: 'i-lucide-arrow-left-right', tone: 'info' },
  nudged: { icon: 'i-lucide-bell-ring', tone: 'warning' },
  escalated: { icon: 'i-lucide-triangle-alert', tone: 'warning' },
  reminded: { icon: 'i-lucide-bell', tone: 'neutral' },
}
const TONES: Record<string, string> = {
  primary: 'bg-primary/10 text-primary ring-primary/25',
  success: 'bg-success/10 text-success ring-success/25',
  error: 'bg-error/10 text-error ring-error/25',
  warning: 'bg-warning/10 text-warning ring-warning/25',
  info: 'bg-info/10 text-info ring-info/25',
  neutral: 'bg-elevated text-muted ring-default',
}
function eventLook(action: string) {
  const look = EVENT_LOOK[action] ?? { icon: 'i-lucide-circle-dot', tone: 'neutral' }
  return { icon: look.icon, tone: TONES[look.tone] }
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
  const gaps = gapCount.value
  const ok = await confirm({
    title: gaps ? `Submit with ${gaps} gap${gaps === 1 ? '' : 's'}?` : 'Submit for approval?',
    description: `${gaps ? 'The approvers see the gap check as it is now. ' : ''}The assessment is locked while the sign-off steps approve it in order. You can't recall it: to change it, an approver must reject it back to draft.`,
    confirmLabel: gaps ? `Submit with ${gaps} gap${gaps === 1 ? '' : 's'}` : 'Submit for approval',
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
          :value="sccaStatusKey(assessment)"
        />
      </div>
    </template>

    <div class="space-y-4">
      <p
        v-if="assessment.status === 'in_approval'"
        class="flex items-start gap-2 rounded-md bg-elevated px-3 py-2 text-sm ring-1 ring-inset ring-default"
      >
        <UIcon
          name="i-lucide-hourglass"
          class="mt-0.5 size-4 shrink-0 text-warning"
        />
        <span>
          Waiting for <span class="font-medium">{{ signoffRoleLabel(assessment.pending_role) }}</span>:
          {{ pendingSignoff?.name || 'no user picked' }}.
        </span>
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

      <SccaGapSummary
        v-if="showChecks"
        :assessment="assessment"
        :standards="standards"
        :show-missing="actions && permissions.can_submit"
      />

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
          <template #hint>
            <FieldCount
              :value="note"
              :max="TEXT_LIMITS.long"
            />
          </template>
          <UTextarea
            v-model="note"
            :maxlength="TEXT_LIMITS.long"
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
        <div class="mb-3 flex items-center justify-between gap-2">
          <h3 class="text-sm font-medium">
            History
          </h3>
          <span class="text-xs text-muted">{{ history.length }} {{ history.length === 1 ? 'event' : 'events' }}, newest first</span>
        </div>
        <ol class="text-sm">
          <li
            v-for="(event, index) in history"
            :key="index"
            class="relative flex gap-3 pb-5 before:absolute before:bottom-0 before:left-3.5 before:top-8 before:w-px before:bg-(--ui-border) last:pb-0 last:before:hidden"
            :class="event.action === 'reminded' ? 'opacity-80' : ''"
          >
            <span
              class="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset"
              :class="eventLook(event.action).tone"
            >
              <UIcon
                :name="eventLook(event.action).icon"
                class="size-4"
              />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="font-medium">{{ EVENT_LABELS[event.action] ?? event.action }}</span>
                  <UBadge
                    v-if="event.role"
                    :label="signoffRoleLabel(event.role, true)"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  />
                </p>
                <time class="shrink-0 text-xs tabular-nums text-muted">{{ formatDateTime(event.created_at) }}</time>
              </div>
              <p
                v-if="event.actor"
                class="mt-0.5 flex items-center gap-1 text-xs text-muted"
              >
                <UIcon
                  name="i-lucide-user-round"
                  class="size-3.5"
                />
                {{ event.actor }}
              </p>
              <p
                v-if="event.action === 'reassigned' && (event.from_user || event.to_user)"
                class="mt-1 flex flex-wrap items-center gap-1.5 text-xs"
              >
                <span class="rounded bg-elevated px-1.5 py-0.5">{{ event.from_user || '—' }}</span>
                <UIcon
                  name="i-lucide-arrow-right"
                  class="size-3.5 text-muted"
                />
                <span class="rounded bg-elevated px-1.5 py-0.5 font-medium">{{ event.to_user || '—' }}</span>
              </p>
              <p
                v-else-if="event.action === 'approved_on_behalf' && event.from_user"
                class="mt-1 text-xs"
              >
                For <span class="font-medium">{{ event.from_user }}</span>
              </p>
              <a
                v-if="event.attachment"
                :href="event.attachment.url"
                class="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                download
              >
                <UIcon
                  name="i-lucide-paperclip"
                  class="size-3.5"
                />
                {{ event.attachment.filename }}
              </a>
              <p
                v-if="event.note"
                class="mt-2 whitespace-pre-line rounded-md border-l-2 border-default bg-elevated/60 px-3 py-2 text-sm"
              >
                {{ event.note }}
              </p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </UCard>
</template>
