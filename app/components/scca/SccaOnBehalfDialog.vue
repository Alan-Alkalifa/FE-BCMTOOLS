<script setup lang="ts">
import type { SccaApprovalResult } from '~/composables/useScca'
import type { SccaBottleneckRow } from '~/composables/useSccaWorkflow'

/** BCM board: approve the current step for its approver, with a reason and evidence. */
const props = defineProps<{ row: SccaBottleneckRow }>()
const emit = defineEmits<{ close: [result?: SccaApprovalResult] }>()

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
  if (!reason.value.trim()) errors.value.reason = 'Say how the approver approved, e.g. by email on 12 Oct.'
  if (!file.value) errors.value.file = 'Attach the evidence: the approver\'s email or memo.'
  else if (file.value.size > MAX_BYTES) errors.value.file = 'Use a file of 10 MB or less.'
  if (Object.values(errors.value).some(Boolean)) return
  busy.value = true
  try {
    const result = await sccaApi.approveOnBehalf(props.row.id, reason.value.trim(), file.value!)
    toast.add({
      title: `Approved on behalf of ${props.row.approver ?? 'the approver'}`,
      description: result.status === 'final' ? 'That was the last step: the SCCA is final.' : 'The next approver has been emailed.',
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
    title="Approve on behalf"
    :description="`${row.ref_no} · ${row.application_name}`"
  >
    <template #body>
      <form
        id="scca-on-behalf-form"
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
          :title="`You approve ${signoffRoleLabel(row.step)} for ${row.approver ?? 'its approver'}.`"
          description="Use this only when the approver approved outside BCM Tools. The step shows “on behalf, by you; evidence attached” on the SCCA and both reports, and the approver and assessor are emailed."
        />
        <UFormField
          label="Reason"
          name="reason"
          required
          :error="errors.reason"
        >
          <UTextarea
            v-model="reason"
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
            >Choose the approver's email or memo</span>
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
          form="scca-on-behalf-form"
          icon="i-lucide-badge-check"
          label="Approve on behalf"
          :loading="busy"
        />
      </div>
    </template>
  </UModal>
</template>
