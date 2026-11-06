<script setup lang="ts">
/**
 * A note for the history: closing or reopening an incident, approving or rejecting a building or
 * an incident. Closes with the note ('' without one), or false. `required` (rejecting) needs a
 * note; `destructive` makes the confirm button the destructive one.
 */
const props = defineProps<{
  title: string
  description: string
  confirmLabel: string
  noteLabel: string
  help?: string
  required?: boolean
  /** The error when a required note is left empty (default: "Enter the reason."). */
  requiredMessage?: string
  destructive?: boolean
}>()
const emit = defineEmits<{ close: [note: string | false] }>()
const note = ref('')
const missing = ref(false)

function confirm() {
  if (props.required && !note.value.trim()) {
    missing.value = true
    return
  }
  emit('close', note.value.trim())
}
</script>

<template>
  <UModal
    :title="props.title"
    :description="props.description"
    @update:open="(open) => !open && emit('close', false)"
  >
    <template #body>
      <UFormField
        :label="props.noteLabel"
        :required="props.required"
        :help="props.help ?? (props.required ? undefined : 'Optional. Kept in the incident history.')"
        :error="missing && !note.trim() ? (props.requiredMessage ?? 'Enter the reason.') : undefined"
      >
        <UTextarea
          v-model="note"
          :rows="3"
          autoresize
          autofocus
          class="w-full"
        />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="emit('close', false)"
        />
        <UButton
          :color="props.destructive ? 'error' : 'primary'"
          :label="props.confirmLabel"
          @click="confirm"
        />
      </div>
    </template>
  </UModal>
</template>
