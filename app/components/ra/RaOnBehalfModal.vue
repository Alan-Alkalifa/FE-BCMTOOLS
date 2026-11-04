<script setup lang="ts">
import type { RaAssessment } from '~/composables/useRa'
import type { RaWaitingStep } from '~/components/ra/RaChangeSignerModal.vue'

/** BCM: approve the waiting step for its signer, who approved outside BCM Tools, with a reason
 * and the evidence (as SCCA's approve on behalf). */
const props = defineProps<{ step: RaWaitingStep }>()
const emit = defineEmits<{ close: [assessment?: RaAssessment] }>()

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.msg,.eml,application/pdf,image/png,image/jpeg'
const MAX_BYTES = 10 * 1024 * 1024

const toast = useToast()
const reason = ref('')
const file = ref<File | null>(null)
const busy = ref(false)
const errors = ref<Record<string, string>>({})

function pick(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
  errors.value.file = ''
  if (file.value && file.value.size > MAX_BYTES) errors.value.file = 'Use a file of 10 MB or less.'
}

function size(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

async function save() {
  errors.value = {}
  if (!reason.value.trim()) errors.value.reason = 'Say how the signer approved, e.g. by email on 12 Oct.'
  if (!file.value) errors.value.file = 'Attach the evidence: the signer\'s email or memo.'
  else if (file.value.size > MAX_BYTES) errors.value.file = 'Use a file of 10 MB or less.'
  if (Object.values(errors.value).some(Boolean)) return
  busy.value = true
  try {
    const result = await raApi.approveOnBehalf(props.step.id, reason.value.trim(), file.value!)
    toast.add({
      title: `Approved on behalf of ${props.step.signer ?? 'the signer'}`,
      description: result.assessment.status === 'approved' ? 'That was the last step: the RA is approved.' : 'The next signer is up.',
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
    title="Approve on behalf"
    :description="`${step.ref} · ${step.location}`"
  >
    <template #body>
      <form
        id="ra-on-behalf-form"
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
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`You approve ${step.step} for ${step.signer ?? 'its signer'}.`"
          description="Use this only when the signer approved outside BCM Tools. The step shows “by you on their behalf” and “Evidence attached” on the RA and both reports, and the signer is emailed."
        />
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
            placeholder="e.g. Approved by email on 12 Oct 2026, attached."
          />
        </UFormField>
        <UFormField
          label="Evidence"
          name="file"
          required
          help="PDF, PNG, JPG, Outlook .msg or .eml, up to 10 MB."
          :error="errors.file || undefined"
        >
          <label class="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-accented p-3 text-sm hover:bg-elevated/40">
            <UIcon
              name="i-lucide-paperclip"
              class="size-5 shrink-0 text-muted"
            />
            <span
              v-if="file"
              class="min-w-0 flex-1"
            >
              <span class="block truncate font-medium text-highlighted">{{ file.name }}</span>
              <span class="text-xs text-muted">{{ size(file.size) }}</span>
            </span>
            <span
              v-else
              class="flex-1 text-muted"
            >Choose the signer's email or memo</span>
            <input
              type="file"
              class="sr-only"
              :accept="ACCEPT"
              aria-label="Evidence file"
              @change="pick"
            >
          </label>
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
          form="ra-on-behalf-form"
          icon="i-lucide-badge-check"
          label="Approve on behalf"
          :loading="busy"
        />
      </div>
    </template>
  </UModal>
</template>
