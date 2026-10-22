<script setup lang="ts">
/** Closing or reopening a crisis, with an optional note for the history. Closes with the note
 *  ('' without one), or false. */
const props = defineProps<{
  title: string
  description: string
  confirmLabel: string
  noteLabel: string
}>()
const emit = defineEmits<{ close: [note: string | false] }>()
const note = ref('')
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
        help="Optional. Kept in the crisis history."
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
          :label="props.confirmLabel"
          @click="emit('close', note.trim())"
        />
      </div>
    </template>
  </UModal>
</template>
