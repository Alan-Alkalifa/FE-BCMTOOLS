<script setup lang="ts">
const props = defineProps<{ title: string, description?: string }>()

useHead({ title: () => `${props.title} · BCM Tools` })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <slot name="actions" />
          <UserMenu />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-6xl mx-auto space-y-6">
        <p
          v-if="description"
          class="text-sm text-muted -mt-2"
        >
          {{ description }}
        </p>
        <slot />
      </div>
    </template>
  </UDashboardPanel>
</template>
