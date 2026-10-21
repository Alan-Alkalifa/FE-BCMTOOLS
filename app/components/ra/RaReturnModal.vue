<script setup lang="ts">
import { z } from 'zod'

/** Asks why the assessment goes back to draft. Closes with the comment, or false. */
const props = withDefaults(defineProps<{ reopen?: boolean }>(), { reopen: false })
const emit = defineEmits<{ close: [comment: string | false] }>()

const schema = z.object({ comment: z.string().trim().min(1, 'Say what needs to change.') })
const state = reactive({ comment: '' })

function onSubmit() {
  emit('close', state.comment.trim())
}
</script>

<template>
  <UModal
    :title="props.reopen ? 'Reopen the approved assessment?' : 'Return for changes?'"
    :description="props.reopen
      ? 'It goes back to draft and every approval is cleared. The signers stay assigned.'
      : 'It goes back to draft so it can be changed. Approvals given so far are cleared; the signers stay assigned.'"
    @update:open="(open) => !open && emit('close', false)"
  >
    <template #body>
      <UForm
        id="ra-return-form"
        :schema="schema"
        :state="state"
        @submit="onSubmit"
      >
        <UFormField
          label="Comment"
          name="comment"
          required
          help="Shown on the assessment until it is submitted again."
          eager-validation
        >
          <UTextarea
            v-model="state.comment"
            :rows="4"
            autoresize
            autofocus
            class="w-full"
          />
        </UFormField>
      </UForm>
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
          type="submit"
          form="ra-return-form"
          color="error"
          :label="props.reopen ? 'Reopen' : 'Return to draft'"
        />
      </div>
    </template>
  </UModal>
</template>
