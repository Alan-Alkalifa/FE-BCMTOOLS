<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { PROFILE_PHOTO_URL } from '~/composables/useProfile'

const { user } = useAuth()
const { data: profile } = useProfile()

const items: NavigationMenuItem[] = [
  { label: 'Home', icon: 'i-lucide-house', to: '/' },
  { label: 'Profile', icon: 'i-lucide-user', to: '/profile' },
]
</script>

<template>
  <div>
    <UHeader
      title="BCM Tools"
      to="/"
    >
      <UNavigationMenu :items="items" />

      <template #right>
        <ULink
          v-if="user"
          to="/profile"
          class="flex items-center gap-2 text-sm text-muted"
        >
          <UAvatar
            :src="profile?.has_photo ? PROFILE_PHOTO_URL : undefined"
            :alt="user.name ?? undefined"
            size="xs"
          />
          <span class="hidden sm:inline">{{ user.name }}</span>
        </ULink>
        <UButton
          to="/auth/logout"
          external
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-out"
          label="Sign out"
        />
      </template>

      <template #body>
        <UNavigationMenu
          :items="items"
          orientation="vertical"
          class="-mx-2.5"
        />
      </template>
    </UHeader>

    <UMain>
      <slot />
    </UMain>
  </div>
</template>
