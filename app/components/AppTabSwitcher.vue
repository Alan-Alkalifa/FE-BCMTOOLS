<script setup lang="ts">
import type { AppTab } from '~/composables/useTabs'

/**
 * In-app tabs on a phone (docs/tabs.md): a button with the number of open tabs in the top bar
 * opens a sheet listing them; tap to switch, × to close.
 */
const tabs = useTabs()
const actions = useTabActions()
const open = ref(false)

async function show(tab: AppTab) {
  open.value = false
  await actions.show(tab)
}

async function closeAll() {
  const keep = tabs.list.value.find((tab) => tab.key === HOME_TAB_KEY) ?? tabs.list.value[0]
  if (keep) await actions.closeOthers(keep)
  open.value = false
}
</script>

<template>
  <USlideover
    v-model:open="open"
    side="bottom"
    :title="`Open tabs (${tabs.list.value.length} of ${TAB_LIMIT})`"
    :ui="{ content: 'max-h-[80vh] rounded-t-xl', body: 'p-2 sm:p-2' }"
  >
    <UButton
      color="neutral"
      variant="outline"
      size="sm"
      :label="String(tabs.list.value.length)"
      :aria-label="`Open tabs (${tabs.list.value.length})`"
      class="min-w-9 justify-center font-semibold"
    />
    <template #body>
      <ul class="space-y-1">
        <li
          v-for="tab in tabs.list.value"
          :key="tab.id"
          class="flex min-h-12 items-center gap-2 rounded-md ps-3"
          :class="tab.id === tabs.activeTab.value?.id ? 'bg-primary/10' : ''"
        >
          <UIcon
            v-if="tab.pinned"
            :name="tab.key === HOME_TAB_KEY ? 'i-lucide-house' : 'i-lucide-pin'"
            class="size-4 shrink-0 text-primary"
          />
          <button
            type="button"
            class="min-h-11 min-w-0 flex-1 truncate text-start"
            :class="tab.id === tabs.activeTab.value?.id ? 'font-medium text-highlighted' : ''"
            :aria-current="tab.id === tabs.activeTab.value?.id ? 'page' : undefined"
            @click="show(tab)"
          >
            {{ tab.title }}
          </button>
          <span
            v-if="tab.dirty"
            class="size-2 shrink-0 rounded-full bg-warning"
            role="img"
            aria-label="Unsaved changes"
          />
          <UButton
            v-if="!tab.pinned"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            :aria-label="`Close ${tab.title}`"
            class="size-11 justify-center"
            @click="actions.close(tab)"
          />
        </li>
      </ul>
    </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        label="Close all but Home"
        :disabled="tabs.list.value.every((tab) => tab.pinned)"
        @click="closeAll"
      />
    </template>
  </USlideover>
</template>
