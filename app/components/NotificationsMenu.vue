<script setup lang="ts">
/** The bell in the top bar. A placeholder for now: see composables/useNotifications.ts. */
const { items, unread, available, refresh, markAllRead } = useNotifications()
const open = ref(false)

watch(open, (isOpen) => {
  if (isOpen) void refresh()
})

const label = computed(() => (unread.value ? `Notifications, ${unread.value} unread` : 'Notifications'))
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: 'end', side: 'bottom', sideOffset: 8, collisionPadding: 12 }"
  >
    <UChip
      :show="unread > 0"
      color="primary"
      inset
      size="sm"
    >
      <UButton
        color="neutral"
        variant="ghost"
        square
        icon="i-lucide-bell"
        :aria-label="label"
        class="data-[state=open]:bg-elevated"
      />
    </UChip>

    <template #content>
      <section
        class="w-[min(22rem,calc(100vw-1.5rem))]"
        aria-labelledby="notifications-title"
      >
        <header class="flex items-center justify-between gap-2 border-b border-default px-4 py-3">
          <div class="flex items-center gap-2">
            <h2
              id="notifications-title"
              class="text-sm font-semibold text-highlighted"
            >
              Notifications
            </h2>
            <UBadge
              v-if="!available"
              label="Coming soon"
              color="neutral"
              variant="subtle"
              size="sm"
            />
          </div>
          <UButton
            v-if="unread"
            variant="link"
            size="xs"
            label="Mark all as read"
            class="p-0"
            @click="markAllRead"
          />
        </header>

        <ul
          v-if="items.length"
          class="max-h-96 divide-y divide-default overflow-y-auto"
        >
          <li
            v-for="item in items"
            :key="item.id"
          >
            <ULink
              :to="item.link"
              class="flex gap-3 px-4 py-3 hover:bg-elevated/50"
              @click="open = false"
            >
              <UIcon
                :name="NOTIFICATION_ICONS[item.kind]"
                class="mt-0.5 size-4 shrink-0 text-muted"
              />
              <span class="min-w-0 flex-1">
                <span
                  class="block text-sm"
                  :class="item.read_at ? 'text-default' : 'font-medium text-highlighted'"
                >{{ item.title }}</span>
                <span
                  v-if="item.body"
                  class="block truncate text-xs text-muted"
                >{{ item.body }}</span>
                <span class="block text-xs text-dimmed">{{ formatDateTime(item.created_at) }}</span>
              </span>
              <span
                v-if="!item.read_at"
                class="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                aria-label="Unread"
              />
            </ULink>
          </li>
        </ul>

        <div
          v-else
          class="flex flex-col items-center px-6 py-8 text-center"
        >
          <span class="flex size-10 items-center justify-center rounded-full bg-elevated text-muted">
            <UIcon
              name="i-lucide-bell-off"
              class="size-5"
            />
          </span>
          <p class="mt-3 text-sm font-medium text-highlighted">
            No notifications yet
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ available
              ? 'You\'re all caught up.'
              : 'SCCA approvals, comments and system news will show here. Until then, BCM Tools emails you.' }}
          </p>
        </div>
      </section>
    </template>
  </UPopover>
</template>
