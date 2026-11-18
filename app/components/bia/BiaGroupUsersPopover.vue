<script setup lang="ts">
import type { BiaGroupUser } from '~/composables/useBiaWorkflow'

const props = withDefaults(defineProps<{
  groupName: string
  users: BiaGroupUser[]
  variant?: 'link' | 'soft'
}>(), {
  variant: 'soft',
})

const label = computed(() => `${props.users.length} ${props.users.length === 1 ? 'BIA user' : 'BIA users'}`)
</script>

<template>
  <UPopover v-if="users.length">
    <UButton
      type="button"
      color="neutral"
      :variant="variant"
      size="xs"
      icon="i-lucide-users"
      :label="label"
      :class="variant === 'link' ? 'px-0 text-xs text-muted' : undefined"
    />
    <template #content>
      <div class="w-72 space-y-2 p-3 text-xs">
        <p class="font-semibold text-highlighted">
          BIA users in {{ groupName }}
        </p>
        <ul class="divide-y divide-default">
          <li
            v-for="u in users"
            :key="u.id"
            class="py-1.5"
          >
            <p class="font-medium text-highlighted">
              {{ u.name }}
              <span
                v-if="u.roles.length"
                class="font-normal text-muted"
              >· {{ u.roles.join(', ') }}</span>
            </p>
            <p
              v-if="u.job_title || u.email"
              class="text-muted"
            >
              {{ [u.job_title, u.email].filter(Boolean).join(' · ') }}
            </p>
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>
