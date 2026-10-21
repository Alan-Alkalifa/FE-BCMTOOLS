<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { MenuNode } from '~/composables/useAuth'

const { menu, fetchMenu, user } = useAuth()
const route = useRoute()

// The menu comes from the database (GET /api/me/menu), filtered by the user's permissions.
watch(() => user.value?.id, (id) => {
  if (id && !menu.value) void fetchMenu()
}, { immediate: true })

function routes(nodes: MenuNode[]): string[] {
  return nodes.flatMap((node) => [...(node.route ? [node.route] : []), ...routes(node.children)])
}

/** The menu route the current page belongs to: the longest one it starts with, so a record
 *  page (/scca/manage/12, /ra/locations/3) keeps its own section active and /ra stays off on
 *  /ra/locations. */
const activeRoute = computed(() => {
  const path = route.path
  if (path === '/') return '/'
  return routes(menu.value ?? [])
    .filter((item) => item !== '/' && (path === item || path.startsWith(`${item}/`)))
    .sort((a, b) => b.length - a.length)[0]
})

function toItem(node: MenuNode): NavigationMenuItem {
  const children = node.children.map(toItem)
  return {
    label: node.label,
    icon: node.icon ?? undefined,
    to: node.route ?? undefined,
    exact: node.route === '/',
    active: node.route ? node.route === activeRoute.value : undefined,
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
