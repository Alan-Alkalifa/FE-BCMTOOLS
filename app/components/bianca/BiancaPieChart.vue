<script setup lang="ts">
import type { EChartsOption } from 'echarts'

export interface BiancaPieDetail {
  label: string
  value: number
}

export interface BiancaPieItem {
  key: string
  label: string
  value: number
  pct: number
  color: string
  details?: BiancaPieDetail[]
}

const props = withDefaults(defineProps<{
  title: string
  summary?: string
  measure: string
  items: BiancaPieItem[]
  loading?: boolean
  empty?: string | null
  height?: number
}>(), {
  summary: '',
  loading: false,
  empty: null,
  height: 260,
})

const emit = defineEmits<{ select: [key: string] }>()

const chartItems = computed(() => props.items.filter((item) => item.value > 0))

const option = computed<EChartsOption>(() => ({
  aria: { enabled: true },
  tooltip: {
    trigger: 'item',
    confine: true,
    formatter: (params: unknown) => {
      const p = params as { name?: string, value?: number, percent?: number, data?: { details?: BiancaPieDetail[] } }
      const header = `<div><b>${p.name ?? ''}</b></div><div><b>${formatNumber(p.value ?? 0, 0)}</b> ${props.measure.toLowerCase()} (${p.percent ?? 0}%)</div>`
      const details = p.data?.details
      if (!details?.length) return header
      const rows = details
        .map((d) => `<div style="display:flex;justify-content:space-between;gap:14px;font-size:12px;line-height:1.5;${d.value === 0 ? 'opacity:0.6;' : ''}"><span>${d.label}</span><b>${formatNumber(d.value, 0) ?? '0'}</b></div>`)
        .join('')
      return `${header}<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(148,163,184,0.3);">${rows}</div>`
    },
  },
  legend: {
    orient: 'vertical',
    right: 8,
    top: 'middle',
    itemWidth: 10,
    itemHeight: 10,
    textStyle: { fontSize: 12 },
    formatter: (name: string) => {
      const found = props.items.find((item) => item.label === name)
      if (!found) return name
      return `${name}  ${formatNumber(found.value, 0)} (${found.pct}%)`
    },
  },
  series: [
    {
      name: props.title,
      type: 'pie',
      radius: '68%',
      center: ['28%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderColor: '#ffffff',
        borderWidth: 2,
      },
      label: { show: false },
      emphasis: {
        scale: true,
        scaleSize: 4,
      },
      data: chartItems.value.map((item) => ({
        name: item.label,
        value: item.value,
        details: item.details,
        itemStyle: { color: item.color },
      })),
    },
  ],
}))

const table = computed(() => ({
  columns: ['Status', props.measure, 'Share'],
  rows: props.items.map((item) => [item.label, formatNumber(item.value, 0) ?? '0', `${item.pct}%`]),
}))

function onSelect(params: unknown) {
  const p = params as { name?: string }
  const found = props.items.find((item) => item.label === p?.name)
  if (found) emit('select', found.key)
}
</script>

<template>
  <AppChart
    :title="title"
    :summary="summary"
    :option="option"
    :table="table"
    :loading="loading"
    :empty="chartItems.length ? null : empty"
    :height="height"
    @select="onSelect"
  />
</template>
