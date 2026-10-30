<script setup lang="ts">
/**
 * A table column header that sorts the list by that column (on the server). Shows an arrow for
 * the current direction; a click on the sorted column turns the direction around, a click on
 * another column sorts by it.
 */
const props = defineProps<{
  label: string
  /** The direction this column is sorted in, or null when the list is sorted by another one. */
  direction: 'asc' | 'desc' | null
  /** Right-align the button (number columns). */
  end?: boolean
}>()
const emit = defineEmits<{ sort: [] }>()

const icon = computed(() => {
  if (props.direction === 'asc') return 'i-lucide-arrow-up'
  if (props.direction === 'desc') return 'i-lucide-arrow-down'
  return 'i-lucide-arrow-up-down'
})
const ariaLabel = computed(() => {
  if (props.direction === 'asc') return `${props.label}, sorted ascending. Sort descending`
  if (props.direction === 'desc') return `${props.label}, sorted descending. Sort ascending`
  return `Sort by ${props.label}`
})
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    size="sm"
    :label="label"
    :trailing-icon="icon"
    :aria-label="ariaLabel"
    :class="[
      // The table's header type (app.config.ts: table th), which a button doesn't inherit.
      'text-xs font-semibold uppercase tracking-wide',
      end ? '-me-2.5' : '-ms-2.5',
      direction ? 'text-highlighted' : 'text-muted',
    ]"
    :ui="{ trailingIcon: direction ? 'size-4' : 'size-4 opacity-50' }"
    @click="emit('sort')"
  />
</template>
