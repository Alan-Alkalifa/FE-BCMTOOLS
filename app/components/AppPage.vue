<script setup lang="ts">
const props = defineProps<{
  title: string
  description?: string
  icon?: string
  crumbs?: { label: string, to?: string }[]
  /** The in-app tab's name, when it should differ from the title (a record: its ref. no.). */
  tabTitle?: string
}>()

useHead({ title: () => `${props.title} · BCM Tools` })

// In-app tabs (docs/tabs.md): this page names its tab, and keeps its scroll while in the background.
const tabs = useTabs()
const tabId = useTabId()
const inTab = computed(() => tabs.enabled.value && !!tabId)
watch(() => props.tabTitle || props.title, (title) => {
  if (tabId) tabs.setTitle(tabId, title)
}, { immediate: true })
const content = ref<HTMLElement | null>(null)
let scrollTop = 0
onDeactivated(() => {
  scrollTop = content.value?.parentElement?.scrollTop ?? 0
})
onActivated(async () => {
  await nextTick()
  const body = content.value?.parentElement
  if (body && scrollTop) body.scrollTop = scrollTop
})

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
          <AppTabSwitcher v-if="inTab && narrow" />
          <NotificationsMenu />
          <UserMenu />
        </template>
      </UDashboardNavbar>
      <AppTabBar v-if="inTab && !narrow" />
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
        ref="content"
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
