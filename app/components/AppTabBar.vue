<script setup lang="ts">
import type { AppTab } from '~/composables/useTabs'

/**
 * The in-app tab bar under the top bar (docs/tabs.md): one tab per open page. Click to switch,
 * middle-click or × to close, right-click for Pin / Close / Close others / Close to the right /
 * Open in a new browser tab, drag to reorder. An orange dot marks unsaved edits.
 */
const tabs = useTabs()
const actions = useTabActions()

const activeId = computed(() => tabs.activeTab.value?.id)

function onAuxClick(event: MouseEvent, tab: AppTab) {
  if (event.button === 1) {
    event.preventDefault()
    void actions.close(tab)
  }
}

// Drag and drop reordering (within pinned or within the rest).
const dragging = ref<string | null>(null)
function onDrop(target: AppTab) {
  if (dragging.value) tabs.move(dragging.value, target.id)
  dragging.value = null
}

// Keyboard: arrow keys move between tabs (tablist pattern).
const strip = ref<HTMLElement | null>(null)
function onKeydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const buttons = [...(strip.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])]
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (at === -1) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (at + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
  buttons[next]?.focus()
}

// The tab in front stays in view.
watch(activeId, async () => {
  await nextTick()
  strip.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

const allItems = computed(() => [
  tabs.list.value.map((tab) => ({
    label: tab.title,
    icon: tab.pinned ? 'i-lucide-pin' : undefined,
    trailingIcon: tab.dirty ? 'i-lucide-circle-dot' : undefined,
    active: tab.id === activeId.value,
    onSelect: () => actions.show(tab),
  })),
])
</script>

<template>
  <div class="flex h-10 items-end gap-2 border-b border-default bg-elevated/60 ps-2 pe-3 print:hidden">
    <div
      ref="strip"
      role="tablist"
      aria-label="Open pages"
      class="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto [scrollbar-width:none]"
      @keydown="onKeydown"
    >
      <UContextMenu
        v-for="tab in tabs.list.value"
        :key="tab.id"
        :items="actions.menu(tab)"
      >
        <div
          class="group relative flex h-9 shrink-0 items-center rounded-t-md border border-b-0 text-sm"
          :class="[
            tab.id === activeId
              ? 'z-10 -mb-px h-[calc(2.25rem+1px)] border-default border-t-2 border-t-primary bg-default text-highlighted'
              : 'h-8 border-transparent text-muted hover:bg-accented/50 hover:text-default',
            dragging === tab.id ? 'opacity-50' : '',
          ]"
          draggable="true"
          @dragstart="dragging = tab.id"
          @dragend="dragging = null"
          @dragover.prevent
          @drop.prevent="onDrop(tab)"
          @auxclick="onAuxClick($event, tab)"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="tab.id === activeId"
            :tabindex="tab.id === activeId ? 0 : -1"
            :title="tab.title"
            class="flex h-full max-w-56 items-center gap-1.5 ps-3 focus-visible:outline-2 focus-visible:outline-primary"
            :class="tab.pinned ? 'pe-3' : 'pe-1'"
            @click="actions.show(tab)"
          >
            <UIcon
              v-if="tab.pinned"
              :name="tab.key === HOME_TAB_KEY ? 'i-lucide-house' : 'i-lucide-pin'"
              class="size-3.5 shrink-0"
              :class="tab.id === activeId ? 'text-primary' : ''"
            />
            <span class="truncate">{{ tab.title }}</span>
            <span
              v-if="tab.dirty && tab.pinned"
              class="size-2 shrink-0 rounded-full bg-warning"
              role="img"
              aria-label="Unsaved changes"
            />
          </button>
          <span
            v-if="!tab.pinned"
            class="flex size-6 shrink-0 items-center justify-center pe-1"
          >
            <span
              v-if="tab.dirty"
              class="size-2 rounded-full bg-warning group-hover:hidden"
              role="img"
              aria-label="Unsaved changes"
            />
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`Close ${tab.title}`"
              class="rounded-sm p-0.5"
              :class="tab.dirty ? 'hidden group-hover:inline-flex' : tab.id === activeId ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'"
              @click.stop="actions.close(tab)"
            />
          </span>
        </div>
      </UContextMenu>
    </div>
    <UDropdownMenu
      :items="allItems"
      :content="{ align: 'end' }"
      :ui="{ content: 'max-h-96 w-80' }"
    >
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        trailing-icon="i-lucide-chevron-down"
        :label="`${tabs.list.value.length} of ${TAB_LIMIT} tabs`"
        :aria-label="`All open tabs (${tabs.list.value.length} of ${TAB_LIMIT})`"
        class="mb-1.5 shrink-0 text-muted"
      />
    </UDropdownMenu>
  </div>
</template>
