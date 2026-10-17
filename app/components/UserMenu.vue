<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { PROFILE_PHOTO_URL } from '~/composables/useProfile'

const { user } = useAuth()
const { data: profile } = useProfile()

const avatar = computed(() => ({
  src: profile.value?.has_photo ? PROFILE_PHOTO_URL : undefined,
  alt: user.value?.name ?? undefined,
}))

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: user.value?.name ?? '', description: user.value?.email ?? undefined }],
  [{ label: 'Profile', icon: 'i-lucide-user', to: '/profile' }],
  [{ label: 'Sign out', icon: 'i-lucide-log-out', to: '/auth/logout', external: true }],
])
</script>

<template>
  <UDropdownMenu
    v-if="user"
    :items="items"
    :content="{ align: 'end' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      :avatar="avatar"
      :label="user.name ?? undefined"
      trailing-icon="i-lucide-chevron-down"
      aria-label="User menu"
      :ui="{ label: 'hidden sm:inline' }"
    />
  </UDropdownMenu>
</template>
