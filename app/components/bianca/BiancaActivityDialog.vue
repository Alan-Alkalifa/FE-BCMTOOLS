<script setup lang="ts">
import type { BiancaEvent } from '~/composables/useBiancaApproval'

/**
 * A BIA's activity log, newest first: created, uploaded, saved, attachments, renewal, submitted,
 * approved, returned, comments. Opened from the BIA's header (Activity).
 */
const props = defineProps<{ events: BiancaEvent[], refNo?: string | null }>()
const open = defineModel<boolean>('open', { default: false })

const ICONS: Record<string, string> = {
  created: 'i-lucide-file-plus',
  uploaded: 'i-lucide-file-up',
  saved: 'i-lucide-save',
  attached: 'i-lucide-paperclip',
  detached: 'i-lucide-paperclip',
  renewal_started: 'i-lucide-refresh-cw',
  renewal_created: 'i-lucide-refresh-cw',
  commented: 'i-lucide-message-square',
  submitted: 'i-lucide-send',
  approved: 'i-lucide-circle-check',
  rejected: 'i-lucide-undo-2',
  finalised: 'i-lucide-badge-check',
  reassigned: 'i-lucide-user-round-cog',
  nudged: 'i-lucide-bell',
}
const TONE: Record<string, string> = {
  approved: 'text-success',
  finalised: 'text-success',
  rejected: 'text-error',
  submitted: 'text-primary',
}
const rows = computed(() => [...props.events].reverse())
</script>

<template>
  <UModal
    v-model:open="open"
    :title="refNo ? `Activity · ${refNo}` : 'Activity'"
    description="What happened to this BIA, by whom and when (newest first). Saves close together show once."
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <p
        v-if="!rows.length"
        class="text-sm text-muted"
      >
        Nothing yet.
      </p>
      <ol
        v-else
        class="relative space-y-4 border-s border-default ps-5"
      >
        <li
          v-for="event in rows"
          :key="event.id"
          class="relative"
        >
          <span class="absolute -start-[1.85rem] flex size-6 items-center justify-center rounded-full bg-default ring-1 ring-default">
            <UIcon
              :name="ICONS[event.action] ?? 'i-lucide-dot'"
              class="size-3.5"
              :class="TONE[event.action] ?? 'text-muted'"
            />
          </span>
          <p class="text-sm">
            <span class="font-medium">{{ event.label ?? event.action }}</span>
            <span
              v-if="event.role_title"
              class="text-muted"
            > · {{ event.role_title }}</span>
          </p>
          <p class="text-xs text-muted">
            {{ event.actor || 'System' }} · {{ formatDateTime(event.created_at) || '—' }}
          </p>
          <p
            v-if="event.note"
            class="mt-1 whitespace-pre-line rounded-md bg-elevated/60 px-2 py-1 text-xs"
          >
            {{ event.note }}
          </p>
        </li>
      </ol>
    </template>
  </UModal>
</template>
