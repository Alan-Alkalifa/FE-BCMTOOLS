<script setup lang="ts">
import type { RaAssessment, RaFormula, RaRating } from '~/composables/useRa'

/**
 * The Risk Summary tab: the Risk Summary note (the CIM follow-up), the Type of Hazard counted by
 * residual risk (High, Medium, Low, NA), each level opening to its hazards with the action
 * plan, and the Risk Matrix as two tables, gross and residual side by side (RA Branch
 * rates one residual risk, so it has only that one). Text is left-aligned, numbers right.
 */
const props = defineProps<{ assessment: RaAssessment, formula: RaFormula }>()
const emit = defineEmits<{ select: [code: string] }>()

const { hazards } = useRaFormulaIndex(() => props.formula)
const singleRisk = computed(() => props.formula.kind === 'branch')

type LevelKey = RaLevel | 'na'
const LEVELS: { key: LevelKey, label: string }[] = [
  { key: 'High', label: 'High' },
  { key: 'Medium', label: 'Medium' },
  { key: 'Low', label: 'Low' },
  { key: 'na', label: 'NA' },
]

function byNumber(a: RaRating, b: RaRating) {
  return (hazards.value.get(a.code)?.no ?? 0) - (hazards.value.get(b.code)?.no ?? 0)
}

const rated = computed(() => props.assessment.ratings.filter((row) => row.result.is_rated).sort(byNumber))
const groups = computed(() => LEVELS.map((level) => ({
  ...level,
  rows: rated.value.filter((row) => (row.result.residual_level ?? 'na') === level.key),
})))
const unrated = computed(() => props.assessment.summary.total - rated.value.length)

const open = ref<Record<string, boolean>>({ High: true, Medium: true, Low: false, na: false })
function toggle(key: string) {
  open.value = { ...open.value, [key]: !open.value[key] }
}

function name(code: string) {
  return hazards.value.get(code)?.short_name ?? code
}
function group(code: string) {
  return hazards.value.get(code)?.category.label ?? ''
}
function rating(value: number | null) {
  return value === null ? '—' : value === 0 ? 'N/A' : String(value)
}

/** The Risk Matrix as tables: every rated hazard with its probability, impact and level. */
const matrices = computed(() => [
  ...(singleRisk.value
    ? []
    : [{
        key: 'gross',
        title: 'Gross',
        description: 'Before the existing mitigation measures.',
        rows: rated.value.map((row) => ({
          code: row.code,
          probability: row.result.gross_probability,
          impact: row.result.gross_impact,
          level: raLevelKey({ level: row.result.gross_level, rated: true }),
        })),
      }]),
  {
    key: 'residual',
    title: 'Residual',
    description: singleRisk.value
      ? 'Probability against the impact after the existing mitigation measures.'
      : 'After the existing mitigation measures.',
    rows: rated.value.map((row) => ({
      code: row.code,
      probability: row.result.residual_probability,
      impact: row.result.residual_impact,
      level: raLevelKey({ level: row.result.residual_level, rated: true }),
    })),
  },
])
const matrixOpen = ref<Record<string, boolean>>({ gross: false, residual: false })
</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="formula.risk_summary_note_en"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Risk Summary"
      :description="formula.risk_summary_note_en"
      :ui="{ description: 'whitespace-pre-line' }"
      data-testid="cim-note"
    />

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <h2 class="text-lg font-semibold">
          Risk Summary
        </h2>
        <p class="text-sm text-muted">
          The Type of Hazard by residual risk. Open a level to see its hazards and action plans.
          <template v-if="unrated">
            {{ formatNumber(unrated, 0) }} {{ unrated === 1 ? 'hazard is' : 'hazards are' }} not rated yet.
          </template>
        </p>
      </template>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[48rem] text-left text-sm">
          <thead class="border-b border-default text-muted">
            <tr>
              <th
                scope="col"
                class="px-4 py-2 font-medium"
              >
                Residual risk
              </th>
              <th
                scope="col"
                class="px-4 py-2 text-right font-medium"
              >
                Type of Hazard
              </th>
              <th
                scope="col"
                class="px-4 py-2 font-medium"
              >
                Hazard
              </th>
              <th
                scope="col"
                class="px-4 py-2 font-medium"
              >
                Hazard group
              </th>
              <th
                v-if="!singleRisk"
                scope="col"
                class="px-4 py-2 font-medium"
              >
                Gross risk
              </th>
              <th
                scope="col"
                class="px-4 py-2 font-medium"
              >
                CIM ref. no.
              </th>
              <th
                scope="col"
                class="px-4 py-2 font-medium"
              >
                Action plan
              </th>
            </tr>
          </thead>
          <tbody
            v-for="level in groups"
            :key="level.key"
            class="border-b border-default last:border-b-0"
          >
            <tr class="bg-elevated/50">
              <th
                scope="row"
                class="px-4 py-2 text-left font-medium"
              >
                <StatusBadge
                  :scale="raRiskLevel"
                  :value="level.key"
                  size="sm"
                />
              </th>
              <td class="px-4 py-2 text-right">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :trailing-icon="open[level.key] ? 'i-lucide-minus' : 'i-lucide-plus'"
                  :label="formatNumber(level.rows.length, 0) ?? '0'"
                  :aria-expanded="open[level.key] ? 'true' : 'false'"
                  :aria-label="`${level.label}: ${level.rows.length} ${level.rows.length === 1 ? 'hazard' : 'hazards'}`"
                  :disabled="!level.rows.length"
                  class="tabular-nums"
                  @click="toggle(level.key)"
                />
              </td>
              <td
                :colspan="singleRisk ? 4 : 5"
                class="px-4 py-2 text-muted"
              >
                <template v-if="!open[level.key] && level.rows.length">
                  {{ level.rows.slice(0, 3).map((row) => name(row.code)).join(', ') }}{{ level.rows.length > 3 ? ', …' : '' }}
                </template>
              </td>
            </tr>
            <template v-if="open[level.key]">
              <tr
                v-for="row in level.rows"
                :key="row.code"
                class="align-top"
              >
                <td class="px-4 py-2" />
                <td class="px-4 py-2 text-right text-muted tabular-nums">
                  {{ hazards.get(row.code)?.no }}
                </td>
                <td class="px-4 py-2">
                  <button
                    type="button"
                    class="text-left font-medium text-primary hover:underline"
                    @click="emit('select', row.code)"
                  >
                    {{ name(row.code) }}
                  </button>
                </td>
                <td class="px-4 py-2">
                  {{ group(row.code) }}
                </td>
                <td
                  v-if="!singleRisk"
                  class="px-4 py-2"
                >
                  <StatusBadge
                    :scale="raRiskLevel"
                    :value="raLevelKey({ level: row.result.gross_level, rated: true })"
                    size="sm"
                  />
                </td>
                <td class="px-4 py-2">
                  {{ row.cim_ref_no || '—' }}
                </td>
                <td class="max-w-sm px-4 py-2 whitespace-pre-line">
                  {{ row.action_plan || '—' }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </UCard>

    <section
      aria-labelledby="ra-heat-map-matrix"
      class="space-y-3"
    >
      <h2
        id="ra-heat-map-matrix"
        class="text-lg font-semibold"
      >
        Risk Matrix
      </h2>
      <div
        class="grid items-start gap-6"
        :class="{ 'lg:grid-cols-2': matrices.length > 1 }"
      >
        <UCard
          v-for="matrix in matrices"
          :key="matrix.key"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <template #header>
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="font-semibold">
                  {{ matrix.title }}
                </h3>
                <p class="text-sm text-muted">
                  {{ matrix.description }}
                </p>
              </div>
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                :icon="matrixOpen[matrix.key] ? 'i-lucide-minus' : 'i-lucide-plus'"
                :label="matrixOpen[matrix.key] ? 'Hide' : 'Show'"
                :aria-expanded="matrixOpen[matrix.key] ? 'true' : 'false'"
                :aria-label="`${matrixOpen[matrix.key] ? 'Hide' : 'Show'} the ${matrix.title.toLowerCase()} risk table`"
                @click="matrixOpen = { ...matrixOpen, [matrix.key]: !matrixOpen[matrix.key] }"
              />
            </div>
          </template>
          <div
            v-if="matrixOpen[matrix.key]"
            class="overflow-x-auto"
          >
            <table
              class="w-full text-left text-sm"
              :aria-label="`${matrix.title} risk`"
            >
              <thead class="border-b border-default text-muted">
                <tr>
                  <th
                    scope="col"
                    class="px-4 py-2 text-right font-medium"
                  >
                    No
                  </th>
                  <th
                    scope="col"
                    class="px-4 py-2 font-medium"
                  >
                    Type of Hazard
                  </th>
                  <th
                    scope="col"
                    class="px-4 py-2 text-right font-medium"
                  >
                    Probability
                  </th>
                  <th
                    scope="col"
                    class="px-4 py-2 text-right font-medium"
                  >
                    Impact
                  </th>
                  <th
                    scope="col"
                    class="px-4 py-2 font-medium"
                  >
                    Risk level
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="row in matrix.rows"
                  :key="row.code"
                >
                  <td class="px-4 py-2 text-right text-muted tabular-nums">
                    {{ hazards.get(row.code)?.no }}
                  </td>
                  <td class="px-4 py-2">
                    {{ name(row.code) }}
                  </td>
                  <td class="px-4 py-2 text-right tabular-nums">
                    {{ rating(row.probability) }}
                  </td>
                  <td class="px-4 py-2 text-right tabular-nums">
                    {{ rating(row.impact) }}
                  </td>
                  <td class="px-4 py-2">
                    <StatusBadge
                      v-if="row.level"
                      :scale="raRiskLevel"
                      :value="row.level"
                      size="sm"
                    />
                  </td>
                </tr>
                <tr v-if="!matrix.rows.length">
                  <td
                    colspan="5"
                    class="px-4 py-6 text-center text-muted"
                  >
                    No hazards rated yet. Rate them on the Hazards tab.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>
