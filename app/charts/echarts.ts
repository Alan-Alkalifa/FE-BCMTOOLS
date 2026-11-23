import { BarChart, LineChart } from 'echarts/charts'
import { AriaComponent, GridComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { CHART_THEME } from '~/utils/chart'

/**
 * ECharts with only the parts the app uses (docs/design-system.md > Charts): bar and line
 * charts, the grid, tooltips, mark lines and areas (thresholds, bands) and generated ARIA
 * descriptions, drawn as SVG so text stays the
 * same size at any width. `<VChart theme="bcm">` uses CHART_THEME from utils/chart.ts.
 *
 * Loaded on demand by AppChart.vue, so pages without a chart don't download ECharts.
 */
echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, AriaComponent, MarkLineComponent, MarkAreaComponent, SVGRenderer])
echarts.registerTheme('bcm', CHART_THEME)

export default VChart
