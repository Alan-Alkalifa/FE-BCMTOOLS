<script setup lang="ts">
import type { BiancaComment, BiancaCommentTab } from '~/composables/useBianca'

/**
 * Review comments on one tab of a BIA. While it is in approval every approver writes here, on
 * every tab; everyone who opens the BIA reads them (the owner, to fix what was asked). Shown only
 * when there is a comment, or the reader can write one.
 */
const props = defineProps<{
  assessmentId?: number
  tab: BiancaCommentTab
  comments?: BiancaComment[]
  canComment?: boolean
}>()
const emit = defineEmits<{ changed: [comments: BiancaComment[]] }>()

const toast = useToast()
const rows = computed(() => (props.comments ?? []).filter((row) => row.tab === props.tab))
const text = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const writing = ref(false)

async function post() {
  if (!props.assessmentId || !text.value.trim()) return
  busy.value = true
  error.value = null
  try {
    const result = await biancaApi.addComment(props.assessmentId, props.tab, text.value)
    emit('changed', result.items)
    text.value = ''
    writing.value = false
    toast.add({ title: 'Comment added', color: 'success', icon: 'i-lucide-message-square' })
  } catch (failure) {
    const details = (failure as { data?: { details?: Record<string, string> } }).data?.details
    error.value = details ? Object.values(details).join(' ') : apiErrorMessage(failure)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    v-if="rows.length || canComment"
    class="rounded-md border border-info/30 bg-info/5 p-4"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="flex items-center gap-2 text-sm font-semibold">
        <UIcon
          name="i-lucide-messages-square"
          class="size-4 text-info"
        />
        Review comments
        <UBadge
          v-if="rows.length"
          :label="String(rows.length)"
          color="info"
          variant="subtle"
          size="sm"
        />
      </p>
      <UButton
        v-if="canComment && !writing"
        size="sm"
        color="neutral"
        variant="outline"
        icon="i-lucide-message-square-plus"
        label="Add a comment"
        @click="writing = true"
      />
    </div>

    <ul
      v-if="rows.length"
      class="mt-3 space-y-3"
    >
      <li
        v-for="row in rows"
        :key="row.id"
        class="rounded-md bg-default p-3 ring-1 ring-default"
      >
        <p class="text-xs text-muted">
          <span class="font-medium text-default">{{ row.author || 'Someone' }}</span>
          <template v-if="row.role_title">
            · {{ row.role_title }}
          </template>
          · {{ formatDateTime(row.created_at) }}
        </p>
        <p class="mt-1 whitespace-pre-line text-sm">
          {{ row.body }}
        </p>
      </li>
    </ul>
    <p
      v-else-if="!writing"
      class="mt-2 text-sm text-muted"
    >
      No comments on this tab yet.
    </p>

    <div
      v-if="canComment && writing"
      class="mt-3 space-y-2"
    >
      <UTextarea
        v-model="text"
        class="w-full"
        :rows="3"
        autoresize
        :maxlength="4000"
        placeholder="What should change on this tab?"
        aria-label="Your comment"
      />
      <p
        v-if="error"
        class="text-sm text-error"
      >
        {{ error }}
      </p>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          label="Cancel"
          @click="writing = false; text = ''; error = null"
        />
        <UButton
          icon="i-lucide-send"
          label="Post comment"
          :loading="busy"
          :disabled="!text.trim()"
          @click="post"
        />
      </div>
    </div>
  </div>
</template>
