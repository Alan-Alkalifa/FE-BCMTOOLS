<script setup lang="ts">
import type { SccaAssessment } from '~/composables/useScca'

/**
 * Review comments for one tab. While the SCCA is in approval every approver can comment on
 * Result and sign-off; the other tabs only the BCM reviewer, at the BCM reviewer step. The
 * assessor and contributor only read them. Comments already written stay visible to everyone.
 * The API decides via `permissions.comment_tabs`; `readonly` (Monitoring) never offers the box.
 */
const props = defineProps<{ assessment: SccaAssessment, tab: SccaTab, readonly?: boolean }>()
const emit = defineEmits<{ saved: [assessment: SccaAssessment] }>()

const toast = useToast()
const body = ref('')
const busy = ref(false)

const comments = computed(() => props.assessment.comments.filter((row) => row.tab === props.tab))
const canComment = computed(() => !props.readonly && props.assessment.permissions.comment_tabs.includes(props.tab))
const readerNote = computed(() =>
  props.assessment.status === 'in_approval' && props.assessment.my_role
    ? 'You assess or contribute to this SCCA, so you can read the approvers\' comments but not add any. If it needs changes, an approver rejects it back to draft.'
    : null,
)
const tabLabel = computed(() => SCCA_TABS.find((item) => item.value === props.tab)?.label ?? props.tab)

async function add() {
  const text = body.value.trim()
  if (!text) return
  busy.value = true
  try {
    const saved = await sccaApi.comment(props.assessment.id, props.tab, text)
    body.value = ''
    emit('saved', saved)
    toast.add({ title: 'Comment added', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard v-if="comments.length || canComment">
    <template #header>
      <h2 class="flex items-center gap-2 text-lg font-semibold">
        <UIcon
          name="i-lucide-message-square-text"
          class="size-5"
        />
        Review comments · {{ tabLabel }}
      </h2>
    </template>

    <div class="space-y-4">
      <ol
        v-if="comments.length"
        class="space-y-3"
      >
        <li
          v-for="comment in comments"
          :key="comment.id"
          class="rounded-md bg-elevated p-3"
        >
          <p class="text-sm">
            <span class="font-medium">{{ comment.author || 'Unknown user' }}</span>
            <span class="text-muted"> · {{ commentRoleLabel(comment.author_role) }} · {{ formatDateTime(comment.created_at) }}</span>
          </p>
          <p class="mt-1 whitespace-pre-line text-sm">
            {{ comment.body }}
          </p>
        </li>
      </ol>
      <p
        v-else
        class="text-sm text-muted"
      >
        No comments on this tab yet.
      </p>
      <p
        v-if="readerNote && comments.length"
        class="text-xs text-muted"
      >
        {{ readerNote }}
      </p>

      <div
        v-if="canComment"
        class="space-y-2"
      >
        <UTextarea
          v-model="body"
          class="w-full"
          :rows="2"
          :aria-label="`Comment on ${tabLabel}`"
          placeholder="Write a review comment"
        />
        <div class="flex justify-end">
          <UButton
            icon="i-lucide-send"
            label="Add comment"
            :disabled="!body.trim()"
            :loading="busy"
            @click="add"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
