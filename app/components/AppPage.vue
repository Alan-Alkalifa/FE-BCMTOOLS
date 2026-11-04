<script setup lang="ts">
const props = defineProps<{
  title: string
  description?: string
  icon?: string
  crumbs?: { label: string, to?: string }[]
}>()

useHead({ title: () => `${props.title} · BCM Tools` })

// On phones the page's own buttons move to a row under the top bar, so the bell and the
// user menu always fit next to the title.
const narrow = ref(false)
let query: MediaQueryList | undefined
function update() {
  narrow.value = !!query?.matches
}
onMounted(() => {
  query = window.matchMedia('(max-width: 639.98px)')
  update()
  query.addEventListener('change', update)
})
onBeforeUnmount(() => query?.removeEventListener('change', update))

const breadcrumbItems = computed(() =>
  props.crumbs?.length ? [{ label: 'Home', to: '/' }, ...props.crumbs] : [],
)
</script>

<template>
  <UDashboardPanel
    :ui="{
      root: 'print:block print:min-h-0 print:border-0',
      body: 'bg-default print:overflow-visible print:p-0',
    }"
  >
    <template #header>
      <UDashboardNavbar
        :title="title"
        :icon="icon"
        class="bg-default print:hidden"
        :ui="{ right: 'gap-2', title: 'text-base' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse
            class="hidden lg:inline-flex"
            aria-label="Collapse or expand the sidebar"
          />
        </template>
        <template #right>
          <template v-if="!narrow && $slots.actions">
            <slot name="actions" />
            <USeparator
              orientation="vertical"
              class="mx-1 h-6"
            />
          </template>
          <NotificationsMenu />
          <UserMenu />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar
        v-if="narrow && $slots.actions"
        class="bg-default print:hidden"
        :ui="{ root: 'h-auto py-2', left: 'flex-wrap gap-2' }"
      >
        <template #left>
          <slot name="actions" />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <main
        id="main-content"
        class="mx-auto w-full max-w-7xl space-y-6"
      >
        <div
          v-if="breadcrumbItems.length || description"
          class="space-y-1 print:hidden"
        >
          <UBreadcrumb
            v-if="breadcrumbItems.length"
            :items="breadcrumbItems"
          />
          <p
            v-if="description"
            class="text-sm text-muted"
          >
            {{ description }}
          </p>
        </div>
        <slot />
      </main>
    </template>
  </UDashboardPanel>
</template>
