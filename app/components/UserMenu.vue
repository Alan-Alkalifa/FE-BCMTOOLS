<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { PROFILE_PHOTO_URL } from '~/composables/useProfile'

/** The signed-in user, top right of the navbar: avatar (with name and role on wider screens). */
const { user, logout } = useAuth()

const avatar = computed(() => ({
  src: user.value?.has_photo ? PROFILE_PHOTO_URL : undefined,
  alt: user.value?.name ?? undefined,
}))

const roleNames = computed(() => user.value?.roles.map((role) => role.name).join(', ') || 'No role yet')

async function signOut() {
  await logout()
  await navigateTo({ path: '/login', query: { signed_out: '1' } })
}

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: user.value?.name ?? '', description: user.value?.email ?? undefined, avatar: avatar.value }],
  [
    { label: 'Profile', icon: 'i-lucide-user', to: '/profile' },
    { label: 'Change password', icon: 'i-lucide-key-round', to: '/account/password' },
  ],
  [{ label: 'Sign out', icon: 'i-lucide-log-out', onSelect: signOut }],
])
</script>

<template>
  <UDropdownMenu
    v-if="user"
    :items="items"
    :content="{ align: 'end', sideOffset: 8, collisionPadding: 12 }"
    :ui="{ content: 'w-64' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      aria-label="User menu"
      class="gap-2 px-1.5 data-[state=open]:bg-elevated lg:pe-2"
    >
      <UAvatar
        v-bind="avatar"
        size="sm"
      />
      <span class="hidden min-w-0 max-w-44 flex-col text-start leading-tight lg:flex">
        <span class="truncate text-sm font-medium text-highlighted">{{ user.name }}</span>
        <span class="truncate text-xs text-muted">{{ roleNames }}</span>
      </span>
      <UIcon
        name="i-lucide-chevron-down"
        class="hidden size-4 text-dimmed lg:block"
      />
    </UButton>
  </UDropdownMenu>
</template>
