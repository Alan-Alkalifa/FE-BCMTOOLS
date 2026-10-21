<script setup lang="ts">
import type { EChartsOption } from 'echarts'

/**
 * Horizontal bars, one measure across a few items (applications per category, working days
 * per sign-off step), in an `AppChart` card: value axis from zero with light gridlines, the
 * value printed at the end of each bar, and the same numbers as a table.
 */
const props = withDefaults(defineProps<{
  title: string
  items: { label: string, value: number }[]
  /** What the value counts, for the axis and the table header, e.g. "Applications". */
  measure: string
  /** Shown after each value, e.g. " d". */
  unit?: string
  digits?: number
  summary?: string
  loading?: boolean
  empty?: string | null
  /** Fixed card height; by default it fits the bars. */
  height?: number
}>(), { unit: '', digits: 0, summary: '', loading: false, empty: null, height: undefined })

const format = (value: number) => `${formatNumber(value, props.digits) ?? '0'}${props.unit}`

// Top to bottom in the order given: ECharts draws category axes from the bottom up.
const ordered = computed(() => [...props.items].reverse())

const option = computed<EChartsOption>(() => ({
  aria: { enabled: true },
  grid: { left: 8, right: 48, top: 8, bottom: 28, containLabel: true },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (value) => format(Number(value)) },
  xAxis: {
    type: 'value',
    min: 0,
    minInterval: props.digits ? undefined : 1,
    name: props.measure,
    nameLocation: 'middle',
    nameGap: 24,
    nameTextStyle: { color: '#64748b', fontSize: 12 },
  },
  yAxis: { type: 'category', data: ordered.value.map((item) => item.label), axisLabel: { fontSize: 12 } },
  series: [{
    type: 'bar',
    name: props.measure,
    data: ordered.value.map((item) => item.value),
    barMaxWidth: 20,
    itemStyle: { borderRadius: [0, 3, 3, 0] },
    label: { show: true, position: 'right', fontSize: 12, color: '#0f172a', formatter: ({ value }) => format(Number(value)) },
  }],
}))

const table = computed(() => ({
  columns: ['', props.measure],
  rows: props.items.map((item) => [item.label, format(item.value)]),
}))
const height = computed(() => props.height ?? Math.max(160, props.items.length * 32 + 48))
</script>

<template>
  <AppChart
    :title="title"
    :summary="summary"
    :option="option"
    :table="table"
    :loading="loading"
    :empty="empty"
    :height="height"
  />
</template>
