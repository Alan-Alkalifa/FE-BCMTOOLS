<script setup lang="ts">
import type { BiancaAssessment, BiancaAttachment } from '~/composables/useBianca'

/**
 * The Group's organisation structure, attached on the RA Questionnaire (the workbook asks for the
 * current one). A saved draft uploads right away; a BIA not saved yet keeps the picked file
 * (`pending`) and BiancaForm attaches it once the draft is created.
 */
const props = defineProps<{
  attachment: BiancaAttachment | null
  /** The BIA's id; none while it isn't saved yet. */
  assessmentId?: number
  disabled?: boolean
}>()
const pending = defineModel<File | null>('pending', { default: null })
const emit = defineEmits<{ changed: [assessment: BiancaAssessment] }>()

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.pptx,.docx,.xlsx,.vsdx'
const MAX = 10 * 1024 * 1024
const toast = useToast()
const confirm = useConfirm()
const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function icon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'i-lucide-file-text'
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return 'i-lucide-file-image'
  if (ext === 'xlsx') return 'i-lucide-file-spreadsheet'
  return 'i-lucide-network'
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
  if (!props.assessmentId) {
    pending.value = file
    return
  }
  busy.value = true
  error.value = null
  try {
    const result = await biancaApi.uploadOrgStructure(props.assessmentId, file)
    toast.add({ title: 'Organisation structure attached', color: 'success', icon: 'i-lucide-paperclip' })
    emit('changed', result)
  } catch (failure) {
    error.value = apiErrorMessage(failure)
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (!props.assessmentId) {
    pending.value = null
    return
  }
  if (!await confirm({
    title: 'Remove the organisation structure?',
    description: 'The file is taken off this BIA. You can attach another one any time.',
    confirmLabel: 'Remove',
    destructive: true,
  })) return
  busy.value = true
  try {
    emit('changed', await biancaApi.removeOrgStructure(props.assessmentId))
  } catch (failure) {
    error.value = apiErrorMessage(failure)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <input
      ref="input"
      type="file"
      :accept="ACCEPT"
      class="hidden"
      @change="onPicked"
    >

    <!-- Attached -->
    <div
      v-if="attachment || pending"
      class="flex flex-wrap items-center gap-3 rounded-md border border-default p-3"
    >
      <UIcon
        :name="icon(attachment?.filename ?? pending!.name)"
        class="size-6 shrink-0 text-primary"
      />
      <div class="min-w-0 flex-1">
        <a
          v-if="attachment"
          :href="attachment.url"
          class="block truncate text-sm font-medium text-primary hover:underline"
        >{{ attachment.filename }}</a>
        <p
          v-else
          class="truncate text-sm font-medium"
        >
          {{ pending!.name }}
        </p>
        <p class="text-xs text-muted">
          <template v-if="attachment">
            {{ size(attachment.size) }} · attached by {{ attachment.uploaded_by ?? 'someone' }}{{ attachment.uploaded_at ? `, ${formatDateTime(attachment.uploaded_at)}` : '' }}
          </template>
          <template v-else>
            {{ size(pending!.size) }} · attached when you save the draft
          </template>
        </p>
      </div>
      <div
        v-if="!disabled"
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
          aria-label="Remove the organisation structure"
          :disabled="busy"
          @click="remove"
        />
      </div>
    </div>

    <!-- Nothing yet -->
    <button
      v-else-if="!disabled"
      type="button"
      class="flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-accented p-5 text-center hover:bg-elevated/50 disabled:opacity-60"
      :disabled="busy"
      @click="pick"
    >
      <UIcon
        :name="busy ? 'i-lucide-loader-circle' : 'i-lucide-upload'"
        class="size-6 text-muted"
        :class="busy ? 'animate-spin' : ''"
      />
      <span class="text-sm font-medium">Attach the organisation structure</span>
      <span class="text-xs text-muted">PDF, image, PowerPoint, Word, Excel or Visio · up to 10 MB</span>
    </button>
    <p
      v-else
      class="text-sm text-muted"
    >
      Not attached.
    </p>

    <p
      v-if="error"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
  </div>
</template>
