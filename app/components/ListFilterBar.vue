<script setup lang="ts">
/**
 * The one filter bar of every list (Manage, Monitoring, Approval, Administration), so the
 * filters sit in the same place everywhere:
 *
 *   [search] [filters: status/step → category → reason → person → dates] [Clear filters] … [actions]
 *
 * Put the search box in `#search`, the select filters in the default slot in that order, and
 * export or primary buttons in `#actions`. "Clear filters" shows when `filtered` is true.
 * The bar wraps on small screens.
 */
defineProps<{ filtered?: boolean, bordered?: boolean }>()
const emit = defineEmits<{ clear: [] }>()
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-2 p-4"
    :class="bordered === false ? '' : 'border-b border-default'"
    role="search"
  >
    <div
      v-if="$slots.search"
      class="w-full sm:w-72"
    >
      <slot name="search" />
    </div>
    <slot />
    <UButton
      v-if="filtered"
      color="neutral"
      variant="link"
      icon="i-lucide-x"
      label="Clear filters"
      class="px-1"
      @click="emit('clear')"
    />
    <div
      v-if="$slots.actions"
      class="ms-auto flex flex-wrap items-center gap-2"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
