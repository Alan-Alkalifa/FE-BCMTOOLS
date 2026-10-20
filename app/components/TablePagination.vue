<script setup lang="ts">
/**
 * The footer of a server-paginated table (docs/design-system.md > Tables): "Showing x–y of z"
 * on the left, the pager on the right, in a `border-t p-4` strip. Shown whenever there are
 * rows, even on a single page, so the count is always visible.
 *
 * Pass `to` to keep the page in the URL (`?page=2`, the default for list pages), or bind
 * `v-model:page` for a list inside a tab or a dialog.
 */
const props = withDefaults(defineProps<{
  total: number
  perPage?: number
  /** What the rows are, for screen readers: "Assessments", "SCCA activity". */
  label?: string
  to?: (page: number) => string | Record<string, unknown>
}>(), { perPage: 25, label: 'Results', to: undefined })

const page = defineModel<number>('page', { default: 1 })

const range = computed(() => {
  const from = (page.value - 1) * props.perPage + 1
  return { from: Math.min(from, props.total), to: Math.min(from + props.perPage - 1, props.total) }
})
</script>

<template>
  <nav
    v-if="total > 0"
    class="flex flex-wrap items-center justify-between gap-3 border-t border-default p-4"
    :aria-label="`${label} pages`"
  >
    <p class="text-sm text-muted">
      Showing {{ formatNumber(range.from, 0) }}–{{ formatNumber(range.to, 0) }} of {{ formatNumber(total, 0) }}
    </p>
    <UPagination
      v-if="to"
      :page="page"
      :items-per-page="perPage"
      :total="total"
      :to="to"
    />
    <UPagination
      v-else
      v-model:page="page"
      :items-per-page="perPage"
      :total="total"
    />
  </nav>
</template>
