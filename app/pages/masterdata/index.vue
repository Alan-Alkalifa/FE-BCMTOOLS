<script setup lang="ts">
import type { MenuNode } from '~/composables/useAuth'

/** Administration › Master data: the masters the user may open, one card each. */
definePageMeta({ permission: ['masterdata.access', 'bianca.config.view', 'sites.master', 'masterdata.organization.manage', 'masterdata.bcm_roles.view', 'masterdata.bcm_roles.manage', 'scca.application.view', 'scca.application.manage'] })

const { menu, fetchMenu } = useAuth()
if (!menu.value) await fetchMenu()
function findGroup(nodes: MenuNode[]): MenuNode | undefined {
  for (const node of nodes) {
    if (node.code === 'admin.masterdata') return node
    const match = findGroup(node.children)
    if (match) return match
  }
}
const masters = computed(() => findGroup(menu.value ?? [])?.children
  .filter((entry) => entry.route && entry.route !== MASTER_DATA_PATH) ?? [])
</script>

<template>
  <AppPage
    title="Master data"
    icon="i-lucide-database"
    description="The lists the modules pick from. Change them here; what a form or the Excel template offers follows."
    :crumbs="[{ label: 'Administration' }, { label: 'Master data' }]"
  >
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="entry in masters"
        :key="entry.id"
        :to="entry.route!"
        class="group rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
      >
        <UCard
          class="h-full transition-colors group-hover:ring-primary/50"
          :ui="{ body: 'flex h-full flex-col gap-3' }"
        >
          <div class="flex items-center gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UIcon
                :name="entry.icon || 'i-lucide-folder'"
                class="size-5"
              />
            </span>
            <h2 class="font-semibold text-highlighted group-hover:text-primary">
              {{ entry.label }}
            </h2>
          </div>
        </UCard>
      </NuxtLink>
    </div>
    <p
      v-if="!masters.length"
      class="text-sm text-muted"
    >
      You don't have access to any master yet.
    </p>
  </AppPage>
</template>
