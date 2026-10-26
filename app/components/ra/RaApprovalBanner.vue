<script setup lang="ts">
import type { RaApprovalCan } from '~/composables/useRa'

/**
 * Four-eyes approval of a building (a new one, or making it inactive) or of a declared
 * incident, like publishing an RA configuration version: one person asks, someone else with
 * ra.location.approve approves or rejects it with a reason. Shows where it stands and the
 * buttons the current user may use; the parent does the request and refreshes.
 */
const props = defineProps<{
  /** "building", "branch" or "incident". */
  noun: string
  /** pending / rejected (approved shows nothing, unless a decision note is worth showing). */
  status: 'pending' | 'approved' | 'rejected' | 'open' | 'closed'
  /** register (a new building) or deactivate; null for an incident. */
  action?: 'register' | 'deactivate' | null
  requestedBy: string | null
  requestedAt: string | null
  decidedBy?: string | null
  decidedAt?: string | null
  note?: string | null
  can: RaApprovalCan | undefined
  approve: (note: string | null) => Promise<unknown>
  reject: (note: string) => Promise<unknown>
  withdraw?: () => Promise<unknown>
  resubmit?: () => Promise<unknown>
}>()

const toast = useToast()
const dialogs = useRaApprovalDialogs()
const busy = ref<string | null>(null)
const failure = ref<string | null>(null)

const what = computed(() => (props.action === 'deactivate' ? `Making this ${props.noun} inactive` : `This ${props.noun}`))
const asked = computed(() => {
  const when = props.requestedAt ? ` on ${formatDateTime(props.requestedAt)}` : ''
  if (props.action === 'deactivate') return `${props.requestedBy ?? 'Someone'} asked to make this ${props.noun} inactive${when}.`
  if (props.noun === 'incident') return `${props.requestedBy ?? 'Someone'} declared this incident${when}.`
  return `${props.requestedBy ?? 'Someone'} added this ${props.noun}${when}.`
})
const waiting = computed(() => {
  if (props.can?.approve) return 'Please review the details, then approve or reject this request. A reason is required for a rejection.'
  const until = props.noun === 'incident'
    ? 'Until then, the incident is shown on the map as pending and cannot be updated or closed.'
    : props.action === 'deactivate'
      ? `The ${props.noun} remains active until the request is approved.`
      : 'Risk assessments may be drafted in the meantime, but cannot be submitted for sign-off until it is approved.'
  return `This request requires approval by another user with approval rights (BCM Admin or BCM Management). ${until}`
})

async function run(name: string, work: () => Promise<unknown>, done: string) {
  busy.value = name
  failure.value = null
  try {
    await work()
    toast.add({ title: done, color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    failure.value = apiErrorMessage(error)
  } finally {
    busy.value = null
  }
}

async function onApprove() {
  const note = await dialogs.approve(props.noun, props.action)
  if (note === false) return
  await run('approve', () => props.approve(note || null), `${what.value} is approved`)
}

async function onReject() {
  const note = await dialogs.reject(props.noun, props.action)
  if (note === false) return
  await run('reject', () => props.reject(note), 'Rejected')
}
</script>

<template>
  <div
    v-if="status === 'pending' || status === 'rejected'"
    class="space-y-3"
    data-testid="approval-banner"
  >
    <UAlert
      v-if="status === 'pending'"
      color="warning"
      variant="subtle"
      icon="i-lucide-hourglass"
      :title="`Waiting for approval. ${asked}`"
      :description="waiting"
    >
      <template
        v-if="can?.approve || can?.reject || can?.withdraw"
        #actions
      >
        <UButton
          v-if="can?.withdraw && withdraw"
          color="neutral"
          variant="outline"
          label="Withdraw request"
          :loading="busy === 'withdraw'"
          @click="run('withdraw', withdraw, 'Request withdrawn')"
        />
        <UButton
          v-if="can?.reject"
          color="error"
          variant="outline"
          icon="i-lucide-circle-x"
          label="Reject"
          :loading="busy === 'reject'"
          @click="onReject"
        />
        <UButton
          v-if="can?.approve"
          icon="i-lucide-badge-check"
          label="Approve"
          :loading="busy === 'approve'"
          @click="onApprove"
        />
      </template>
    </UAlert>
    <UAlert
      v-else
      color="error"
      variant="subtle"
      icon="i-lucide-circle-x"
      :title="`Rejected by ${decidedBy ?? 'an approver'}${decidedAt ? ` on ${formatDateTime(decidedAt)}` : ''}.`"
      :description="noun === 'incident'
        ? (note ?? undefined)
        : `${note ? `Reason: ${note}\n` : ''}Fix the ${noun} on its tabs, then submit it for approval again.`"
      :ui="{ description: 'whitespace-pre-line' }"
    >
      <template
        v-if="can?.resubmit && resubmit"
        #actions
      >
        <UButton
          icon="i-lucide-send"
          label="Submit for approval"
          :loading="busy === 'resubmit'"
          @click="run('resubmit', resubmit, 'Submitted for approval')"
        />
      </template>
    </UAlert>
    <UAlert
      v-if="failure"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Couldn't do that"
      :description="failure"
    />
  </div>
</template>
