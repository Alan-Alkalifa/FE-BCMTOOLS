/** Keep in sync with --color-chart-* in assets/css/main.css. */
export const CHART_PALETTE = [
  '#0072b2',
  '#e69f00',
  '#009e73',
  '#d55e00',
  '#56b4e9',
  '#cc79a7',
  '#7a6f00',
  '#64748b',
] as const

/** Base ECharts theme: register with echarts.registerTheme('bcm', CHART_THEME). */
export const CHART_THEME = {
  color: [...CHART_PALETTE],
  textStyle: { fontFamily: 'Inter Variable, ui-sans-serif, system-ui, sans-serif', color: '#334155' },
  grid: { left: 48, right: 16, top: 32, bottom: 32, containLabel: true },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#cbd5e1' } },
    axisTick: { show: false },
    axisLabel: { color: '#64748b' },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisLabel: { color: '#64748b' },
    splitLine: { lineStyle: { color: '#e2e8f0' } },
  },
  legend: { textStyle: { color: '#334155' }, icon: 'roundRect', itemWidth: 12, itemHeight: 12 },
  tooltip: { borderColor: '#e2e8f0', textStyle: { color: '#0f172a' } },
}
