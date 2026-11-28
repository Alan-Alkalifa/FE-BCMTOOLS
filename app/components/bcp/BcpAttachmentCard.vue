<script setup lang="ts">
import type { BcpPlan } from '~/composables/useBcp'

/**
 * The optional BCP appendix (D38, D44), as the production BCP's "Attachment Lampiran BCP": one
 * Word or PDF file. It is saved at once, apart from "Save summary", so unsaved edits on the tab
 * stay as they are.
 */
const props = defineProps<{ plan: BcpPlan }>()
const emit = defineEmits<{ changed: [plan: BcpPlan] }>()

const ACCEPT = '.docx,.pdf'
const MAX = 10 * 1024 * 1024
const toast = useToast()
const confirm = useConfirm()
const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const editable = computed(() => props.plan.permissions.can_edit)
const url = computed(() => `/api/bcp/plans/${props.plan.id}/attachment`)

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function pick() {
  error.value = null
  input.value?.click()
}
async function onPicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  if (file.size > MAX) {
    error.value = 'Use a file of 10 MB or less.'
    return
  }
  busy.value = true
  error.value = null
  try {
    emit('changed', await bcpApi.uploadAttachment(props.plan.id, file))
    toast.add({ title: 'Attachment uploaded', color: 'success', icon: 'i-lucide-paperclip' })
  } catch (failure) {
    error.value = bcpErrorText(failure)
  } finally {
    busy.value = false
  }
}
async function remove() {
  if (!await confirm({
    title: 'Remove the attachment?',
    description: 'The file is taken off this BCP. You can upload another one any time.',
    confirmLabel: 'Remove',
    destructive: true,
  })) return
  busy.value = true
  error.value = null
  try {
    emit('changed', await bcpApi.removeAttachment(props.plan.id))
  } catch (failure) {
    error.value = bcpErrorText(failure)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-highlighted">
        Attachment
      </h2>
      <p class="mt-1 text-sm text-muted">
        Optional: the BCP appendix document, Word (.docx) or PDF, 10 MB at most.
      </p>
    </template>
    <input
      ref="input"
      type="file"
      :accept="ACCEPT"
      class="hidden"
      aria-label="BCP attachment file"
      @change="onPicked"
    >
    <div
      v-if="plan.attachment"
      class="flex flex-wrap items-center gap-3 rounded-md border border-default p-3"
    >
      <UIcon
        name="i-lucide-file-text"
        class="size-6 shrink-0 text-primary"
      />
      <div class="min-w-0 flex-1">
        <a
          :href="url"
          class="block truncate text-sm font-medium text-primary hover:underline"
        >{{ plan.attachment.filename }}</a>
        <p class="text-xs text-muted">
          {{ size(plan.attachment.size) }} · uploaded by {{ plan.attachment.uploaded_by ?? 'someone' }}{{ plan.attachment.uploaded_at ? `, ${formatDateTime(plan.attachment.uploaded_at)}` : '' }}
        </p>
      </div>
      <div
        v-if="editable"
        class="flex gap-2"
      >
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-replace"
          label="Replace"
          :loading="busy"
          @click="pick"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash-2"
          aria-label="Remove the attachment"
          :disabled="busy"
          @click="remove"
        />
      </div>
    </div>
    <div
      v-else-if="editable"
      class="flex flex-wrap items-center gap-3"
    >
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-upload"
        label="Upload attachment"
        :loading="busy"
        @click="pick"
      />
      <span class="text-sm text-muted">No attachment yet.</span>
    </div>
    <p
      v-else
      class="text-sm text-muted"
    >
      No attachment.
    </p>
    <p
      v-if="error"
      class="mt-2 text-sm text-error"
      role="alert"
    >
      {{ error }}
    </p>
  </UCard>
</template>
