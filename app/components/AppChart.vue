<script setup lang="ts">
import type { EChartsOption } from 'echarts'

/**
 * One chart in a card, as the design system asks (docs/design-system.md > Charts): the title
 * in the header, a summary sentence under it, a "View as table" toggle with the same numbers,
 * a skeleton while loading and an empty message, all at the chart's fixed height so the page
 * doesn't jump. The chart is drawn by ECharts with the `bcm` theme.
 */
const props = withDefaults(defineProps<{
  title: string
  /** One sentence that says what the chart shows, e.g. "4 of 12 applications are Critical." */
  summary?: string
  option: EChartsOption
  /** The same data as a table: column headers, then one row per item. */
  table: { columns: string[], rows: (string | number)[][] }
  loading?: boolean
  /** Shown instead of the chart when there is nothing to draw. */
  empty?: string | null
  height?: number
}>(), { summary: '', loading: false, empty: null, height: 280 })

// Back from another in-app tab (docs/tabs.md): the chart was drawn off screen, size it again.
const chart = ref<{ resize?: () => void } | null>(null)
onActivated(() => nextTick(() => chart.value?.resize?.()))

// ECharts is large: load it with the first chart on the page, not with the app. If the chunk
// can't be fetched (a dropped connection, or a dev server that rebuilt its dependencies), try
// twice more, then say so instead of leaving an empty card; "View as table" still works.
const VChart = defineAsyncComponent({
  loader: () => import('~/charts/echarts'),
  onError(error, retry, fail, attempts) {
    if (attempts <= 2) setTimeout(retry, 500 * attempts)
    else fail()
  },
  errorComponent: defineComponent({
    setup: () => () => h('div', { class: 'flex size-full flex-col items-center justify-center gap-1 text-center text-sm text-muted' }, [
      h('p', 'The chart could not be drawn.'),
      h('p', 'Reload the page, or use View as table.'),
    ]),
  }),
})

const asTable = ref(false)
const id = useId()
const style = computed(() => ({ height: `${props.height}px` }))
const showSkeleton = useDelayedLoading(() => props.loading)
</script>

<template>
  <UCard :ui="{ header: 'p-4 sm:px-5', body: 'p-4 sm:p-5' }">
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h2
            :id="`${id}-title`"
            class="font-semibold text-highlighted"
          >
            {{ title }}
          </h2>
          <p
            v-if="summary && !loading && !empty"
            :id="`${id}-summary`"
            class="mt-0.5 text-sm text-muted"
          >
            {{ summary }}
          </p>
        </div>
        <USwitch
          v-if="!loading && !empty"
          v-model="asTable"
          size="sm"
          label="View as table"
          class="shrink-0"
        />
      </div>
    </template>

    <div
      v-if="loading"
      :style="style"
    >
      <div
        v-if="showSkeleton"
        class="skeleton size-full"
        aria-hidden="true"
      />
    </div>
    <div
      v-else-if="empty"
      :style="style"
      class="flex flex-col items-center justify-center gap-2 text-center"
    >
      <UIcon
        name="i-lucide-chart-no-axes-column"
        class="size-6 text-dimmed"
      />
      <p class="max-w-sm text-sm text-muted">
        {{ empty }}
      </p>
    </div>
    <div
      v-else-if="asTable"
      :style="style"
      class="overflow-auto"
    >
      <table class="w-full text-sm">
        <caption class="sr-only">
          {{ title }}
        </caption>
        <thead>
          <tr class="border-b border-default text-left text-xs uppercase text-muted">
            <th
              v-for="(column, index) in table.columns"
              :key="column"
              scope="col"
              class="py-2 font-medium"
              :class="index > 0 ? 'text-right' : ''"
            >
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="(row, index) in table.rows"
            :key="index"
          >
            <component
              :is="cell === 0 ? 'th' : 'td'"
              v-for="(value, cell) in row"
              :key="cell"
              :scope="cell === 0 ? 'row' : undefined"
              class="py-2"
              :class="cell === 0 ? 'text-left font-normal' : 'text-right tabular-nums'"
            >
              {{ value }}
            </component>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-else
      :style="style"
      role="img"
      :aria-labelledby="`${id}-title`"
      :aria-describedby="summary ? `${id}-summary` : undefined"
    >
      <VChart
        ref="chart"
        theme="bcm"
        :option="option"
        autoresize
        class="size-full"
      />
    </div>
  </UCard>
</template>
