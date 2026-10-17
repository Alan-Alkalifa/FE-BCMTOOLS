<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const items: NavigationMenuItem[] = [
  { label: 'Home', icon: 'i-lucide-house', to: '/' },
  { label: 'Profile', icon: 'i-lucide-user', to: '/profile' },
]
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      collapsible
      :default-size="15"
      :collapsed-size="4"
      class="bg-muted"
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <AppLogo :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="items"
          orientation="vertical"
          tooltip
        />
      </template>

      <template #footer="{ collapsed }">
        <p
          v-if="!collapsed"
          class="text-xs text-dimmed"
        >
          Internal use only
        </p>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
