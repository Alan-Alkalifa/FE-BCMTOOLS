<script setup lang="ts">
import type { RaApprovalCan } from '~/composables/useRa'
import RaCrisisNoteModal from '~/components/ra/RaCrisisNoteModal.vue'

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
const noteModal = useOverlay().create(RaCrisisNoteModal)
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
  if (props.can?.approve) return 'Check it, then approve it or reject it with a reason. You approve because someone else asked.'
  if (props.noun === 'incident') return 'Someone else with the approve permission confirms it. Until then it is on the map as pending and can\'t be updated or closed.'
  if (props.action === 'deactivate') return `Someone else with the approve permission approves it; the ${props.noun} stays active until then.`
  return `Someone else with the approve permission approves it. Its RAs can be drafted, but not submitted for sign-off until then.`
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
  const note = await noteModal.open({
    title: props.action === 'deactivate' ? `Make this ${props.noun} inactive?` : `Approve this ${props.noun}?`,
    description: props.action === 'deactivate'
      ? `It leaves the ${props.noun} lists, the map and New assessment. Its RAs are kept.`
      : props.noun === 'incident'
        ? 'It opens: everyone affected sees it on the building map with their instructions.'
        : `Its RAs can then be submitted for sign-off.`,
    confirmLabel: 'Approve',
    noteLabel: 'Comment',
    help: 'Optional. Kept with the approval.',
  }).result
  if (note === false) return
  await run('approve', () => props.approve(note || null), `${what.value} is approved`)
}

async function onReject() {
  const note = await noteModal.open({
    title: `Reject ${props.action === 'deactivate' ? 'the deactivation' : `this ${props.noun}`}?`,
    description: props.action === 'deactivate'
      ? `The ${props.noun} stays active. The reason is shown to who asked.`
      : props.noun === 'incident'
        ? 'It leaves the map and stays in the list as rejected, with the reason.'
        : `Who added it sees the reason, fixes the ${props.noun} and submits it again.`,
    confirmLabel: 'Reject',
    noteLabel: 'Reason',
    required: true,
    destructive: true,
  }).result
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
