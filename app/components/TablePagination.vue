<script setup lang="ts">
/**
 * The footer of a server-paginated table (docs/design-system.md > Tables): the range and
 * page-size selector on the left, the pager on the right, in a `border-t p-4` strip.
 * Shown whenever there are rows, even on a single page, so the count is always visible.
 *
 * Pass `to` to keep the page in the URL (`?page=2`, the default for list pages), or bind
 * `v-model:page` for a list inside a tab or a dialog. Bind `v-model:per-page` to react to
 * page-size changes (and refetch).
 */
const props = withDefaults(defineProps<{
  total: number
  /** What the rows are, for screen readers: "Assessments", "SCCA activity". */
  label?: string
  to?: (page: number) => string | Record<string, unknown>
  pageSizeOptions?: number[]
}>(), { label: 'Results', to: undefined, pageSizeOptions: () => [10, 20, 30] })

const page = defineModel<number>('page', { default: 1 })
const perPage = defineModel<number>('perPage', { default: 10 })
const pageSizeItems = computed(() => props.pageSizeOptions.map((size) => ({
  label: String(size),
  value: size,
})))

// Changing the page size invalidates the current page, so go back to the first one.
watch(perPage, () => {
  page.value = 1
})

const range = computed(() => {
  const from = (page.value - 1) * perPage.value + 1
  return { from: Math.min(from, props.total), to: Math.min(from + perPage.value - 1, props.total) }
})
</script>

<template>
  <nav
    v-if="total > 0"
    class="flex flex-wrap items-center justify-between gap-3 border-t border-default p-4"
    :aria-label="`${label} pages`"
  >
    <div class="flex items-center gap-3">
      <p class="text-sm text-muted">
        Showing {{ formatNumber(range.from, 0) }}–{{ formatNumber(range.to, 0) }} of {{ formatNumber(total, 0) }}
      </p>
      <USelect
        v-model="perPage"
        :items="pageSizeItems"
        value-key="value"
        size="sm"
        class="w-16"
        :aria-label="`${label} per page`"
      />
    </div>
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
