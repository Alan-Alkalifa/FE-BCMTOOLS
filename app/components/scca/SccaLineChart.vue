<script setup lang="ts">
import type { EChartsOption } from 'echarts'

/** A count per month as a line with points (SCCAs finalised per month), in an `AppChart` card. */
const props = withDefaults(defineProps<{
  title: string
  points: { month: string, value: number }[]
  /** What the value counts, for the axis and the table header, e.g. "SCCAs finalised". */
  measure: string
  summary?: string
  loading?: boolean
  empty?: string | null
}>(), { summary: '', loading: false, empty: null })

const option = computed<EChartsOption>(() => ({
  aria: { enabled: true },
  grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis', valueFormatter: (value) => formatNumber(Number(value), 0) ?? '0' },
  // The card title names the measure; months sit between ticks so the first and last labels fit.
  xAxis: { type: 'category', boundaryGap: true, data: props.points.map((point) => (formatMonth(point.month) ?? point.month)) },
  yAxis: { type: 'value', min: 0, minInterval: 1 },
  series: [{
    type: 'line',
    name: props.measure,
    data: props.points.map((point) => point.value),
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: { width: 2 },
  }],
}))

const table = computed(() => ({
  columns: ['Month', props.measure],
  rows: props.points.map((point) => [(formatMonth(point.month) ?? point.month), formatNumber(point.value, 0) ?? '0']),
}))
</script>

<template>
  <AppChart
    :title="title"
    :summary="summary"
    :option="option"
    :table="table"
    :loading="loading"
    :empty="empty"
    :height="260"
  />
</template>
