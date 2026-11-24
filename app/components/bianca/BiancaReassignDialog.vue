<script setup lang="ts">
import type { BiancaBoardResult, BiancaBoardRow } from '~/composables/useBiancaApproval'

/** BCM board: hand the current step of a BIA to another user, with a reason. */
const props = defineProps<{ row: BiancaBoardRow }>()
const emit = defineEmits<{ close: [result?: BiancaBoardResult] }>()

const toast = useToast()
const userId = ref<number | null>(null)
const reason = ref('')
const busy = ref(false)
const errors = ref<Record<string, string>>({})

async function save() {
  errors.value = {}
  if (!userId.value) errors.value.user_id = 'Pick the new approver.'
  if (!reason.value.trim()) errors.value.reason = 'Say why the step moves, e.g. the approver is on leave.'
  if (Object.keys(errors.value).length) return
  busy.value = true
  try {
    const result = await biancaBoardApi.reassign(props.row.id, userId.value!, reason.value.trim())
    toast.add({
      title: 'Step reassigned',
      description: result.email_sent ? 'The new approver has been emailed.' : 'The email could not be sent; please let the new approver know.',
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    emit('close', result)
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
    title="Reassign the step"
    :description="`${row.ref_no ?? `#${row.id}`} · ${row.org_group ?? 'BIA'}`"
  >
    <template #body>
      <form
        id="bianca-reassign-form"
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
          <span class="font-medium">{{ row.step_title || row.step || 'Current step' }}</span> is with
          <span class="font-medium">{{ row.approver || 'nobody' }}</span> and has waited {{ biancaWaiting(row.working_days_waiting) }}.
          The new approver is emailed and the reminder clock starts again.
        </p>
        <UFormField
          label="New approver"
          name="user_id"
          required
          help="An active user with BIANCA access; not the BIA owner, coordinator or alternate."
          :error="errors.user_id"
        >
          <UserPicker
            v-model="userId"
            permission="bianca.access"
            aria-label="New approver"
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
            placeholder="e.g. Approver is on leave until 30 Nov; deputy approves."
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
          form="bianca-reassign-form"
          icon="i-lucide-user-round-cog"
          label="Reassign"
          :loading="busy"
        />
      </div>
    </template>
  </UModal>
</template>
