<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { MenuNode } from '~/composables/useAuth'

const { menu, fetchMenu, user } = useAuth()
const route = useRoute()

// The menu comes from the database (GET /api/me/menu), filtered by the user's permissions.
watch(() => user.value?.id, (id) => {
  if (id && !menu.value) void fetchMenu()
}, { immediate: true })

function toItem(node: MenuNode): NavigationMenuItem {
  const children = node.children.map(toItem)
  const active = node.route === '/'
    ? route.path === '/'
    : !!node.route && (route.path === node.route || route.path.startsWith(`${node.route}/`))
  return {
    label: node.label,
    icon: node.icon ?? undefined,
    to: node.route ?? undefined,
    exact: node.route === '/',
    // Each SCCA section stays active on its own record pages (/scca/manage/12, ...).
    active: node.route?.startsWith('/scca/') ? active : undefined,
    defaultOpen: children.length > 0,
    children: children.length ? children : undefined,
  }
}

const items = computed<NavigationMenuItem[]>(() => (menu.value ?? []).map(toItem))
</script>

<template>
  <UDashboardGroup
    unit="rem"
    class="print:static print:block print:overflow-visible"
  >
    <UDashboardSidebar
      id="main"
      collapsible
      resizable
      :min-size="14"
      :default-size="16"
      :max-size="20"
      :collapsed-size="4"
      :ui="{
        root: 'bg-muted/60 print:hidden',
        header: 'border-b border-default',
        body: 'py-4',
      }"
    >
      <template #header="{ collapsed }">
        <AppLogo :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <nav aria-label="Main">
          <UNavigationMenu
            v-if="items.length"
            :collapsed="collapsed"
            :items="items"
            orientation="vertical"
            tooltip
            popover
            :ui="{
              link: 'py-2 text-sm',
              childList: 'ms-4.5 border-s border-default',
            }"
          />
          <div
            v-else
            class="space-y-2 px-1"
            aria-hidden="true"
          >
            <div
              v-for="n in 4"
              :key="n"
              class="skeleton h-7"
            />
          </div>
        </nav>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
