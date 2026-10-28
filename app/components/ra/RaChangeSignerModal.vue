<script setup lang="ts">
import type { RaAssessment } from '~/composables/useRa'

/** The waiting step an RA action is for, as the BCM board or the Sign-off tab shows it. */
export interface RaWaitingStep {
  id: number
  /** Ref. no. (or "#12") and the building, for the dialog's description. */
  ref: string
  location: string
  /** e.g. "Acknowledged by Unit (Head of Unit)". */
  step: string
  signer: string | null
  working_days_waiting?: number | null
}

/** BCM: give the waiting sign-off step to another user, with a reason (as SCCA's reassign). */
const props = defineProps<{ step: RaWaitingStep }>()
const emit = defineEmits<{ close: [assessment?: RaAssessment] }>()

const waited = computed(() => {
  const days = props.step.working_days_waiting
  if (days == null) return ''
  return days <= 0 ? ' since today' : ` and has waited ${raWaiting(days)}`
})
const toast = useToast()
const userId = ref<number | null>(null)
const reason = ref('')
const busy = ref(false)
const errors = ref<Record<string, string>>({})

async function save() {
  errors.value = {}
  if (!userId.value) errors.value.user_id = 'Pick the new signer.'
  if (!reason.value.trim()) errors.value.reason = 'Say why the step moves, e.g. the signer is on leave.'
  if (Object.keys(errors.value).length) return
  busy.value = true
  try {
    const result = await raApi.changeSigner(props.step.id, userId.value!, reason.value.trim())
    toast.add({
      title: 'Signer changed',
      description: result.sent ? 'The new signer has been emailed.' : 'The email could not be sent; please let the new signer know.',
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    emit('close', result.assessment)
  } catch (failure) {
    const data = (failure as { data?: { details?: Record<string, string>, message?: string } }).data
    errors.value = data?.details ? { ...data.details } : { form: data?.message ?? apiErrorMessage(failure) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    title="Change the signer"
    :description="`${step.ref} · ${step.location}`"
  >
    <template #body>
      <form
        id="ra-change-signer-form"
        class="space-y-4"
        novalidate
        @submit.prevent="save"
      >
        <UAlert
          v-if="errors.form"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errors.form"
        />
        <p class="text-sm">
          <span class="font-medium">{{ step.step }}</span> is with
          <span class="font-medium">{{ step.signer || 'nobody' }}</span>{{ waited }}.
          The new signer is emailed and the reminder clock starts again.
        </p>
        <UFormField
          label="New signer"
          name="user_id"
          required
          help="An active user with RA access."
          :error="errors.user_id"
        >
          <UserPicker
            v-model="userId"
            permission="ra.access"
            aria-label="New signer"
          />
        </UFormField>
        <UFormField
          label="Reason"
          name="reason"
          required
          :error="errors.reason"
        >
          <template #hint>
            <FieldCount
              :value="reason"
              :max="TEXT_LIMITS.long"
            />
          </template>
          <UTextarea
            v-model="reason"
            :maxlength="TEXT_LIMITS.long"
            :rows="3"
            class="w-full"
            placeholder="e.g. Kurniawati is on leave until 30 Oct; her deputy signs."
          />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="emit('close')"
        />
        <UButton
          type="submit"
          form="ra-change-signer-form"
          icon="i-lucide-user-round-cog"
          label="Change signer"
          :loading="busy"
        />
      </div>
    </template>
  </UModal>
</template>
