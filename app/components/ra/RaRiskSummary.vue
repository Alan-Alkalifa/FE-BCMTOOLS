<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RaAssessment, RaFormula, RaRating } from '~/composables/useRa'

const props = defineProps<{ assessment: RaAssessment, formula: RaFormula }>()
const emit = defineEmits<{ select: [code: string] }>()

const { hazards } = useRaFormulaIndex(() => props.formula)
const counts = computed(() => props.assessment.summary.counts.residual)

const tiles = computed(() => [
  { key: 'High' as const, label: 'High residual risk', value: counts.value.High },
  { key: 'Medium' as const, label: 'Medium residual risk', value: counts.value.Medium },
  { key: 'Low' as const, label: 'Low residual risk', value: counts.value.Low },
  { key: 'na' as const, label: 'Not applicable', value: counts.value.not_applicable },
])

const RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 }
const rows = computed(() =>
  props.assessment.ratings
    .filter((row) => row.result.residual_level)
    .sort((a, b) =>
      (RANK[b.result.residual_level!] ?? 0) - (RANK[a.result.residual_level!] ?? 0)
      || (hazards.value.get(a.code)?.no ?? 0) - (hazards.value.get(b.code)?.no ?? 0)),
)

// RA Branch rates one (residual) risk, so there is no gross column.
const columns = computed<TableColumn<RaRating>[]>(() => [
  { id: 'hazard', header: 'Hazard' },
  ...(props.formula.kind === 'branch' ? [] : [{ id: 'gross', header: 'Gross' }]),
  { id: 'residual', header: 'Residual' },
  { accessorKey: 'action_plan', header: 'Action plan' },
])
</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="counts.High > 0"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Follow up high residual risks through CIM"
      :description="formula.risk_summary_note ?? undefined"
      :ui="{ description: 'whitespace-pre-line' }"
    />

    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <UCard
        v-for="tile in tiles"
        :key="tile.key"
      >
        <p class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon
            :name="raRiskLevel[tile.key].icon"
            class="size-4"
            :class="{ 'text-error': tile.key === 'High', 'text-warning': tile.key === 'Medium', 'text-info': tile.key === 'Low' }"
          />
          {{ tile.label }}
        </p>
        <p class="mt-1 text-3xl font-semibold text-highlighted tabular-nums">
          {{ formatNumber(tile.value, 0) }}
        </p>
        <p class="mt-1 text-xs text-muted">
          of {{ formatNumber(assessment.summary.total, 0) }} hazards
        </p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          Risk summary
        </h2>
        <p class="text-sm text-muted">
          Applicable hazards by residual risk, highest first.
        </p>
      </template>
      <UTable
        :data="rows"
        :columns="columns"
      >
        <template #hazard-cell="{ row }">
          <button
            type="button"
            class="text-left font-medium text-primary hover:underline"
            @click="emit('select', row.original.code)"
          >
            {{ hazards.get(row.original.code)?.no }}. {{ hazards.get(row.original.code)?.short_name }}
          </button>
        </template>
        <template #gross-cell="{ row }">
          <span class="inline-flex items-center gap-2">
            <span class="tabular-nums">{{ raPairLabel(row.original.result.gross_probability, row.original.result.gross_impact) }}</span>
            <StatusBadge
              :scale="raRiskLevel"
              :value="raLevelKey({ level: row.original.result.gross_level, rated: true })"
              size="sm"
            />
          </span>
        </template>
        <template #residual-cell="{ row }">
          <span class="inline-flex items-center gap-2">
            <span class="tabular-nums">{{ raPairLabel(row.original.result.residual_probability, row.original.result.residual_impact) }}</span>
            <StatusBadge
              :scale="raRiskLevel"
              :value="row.original.result.residual_level"
              size="sm"
            />
          </span>
        </template>
        <template #action_plan-cell="{ row }">
          <UTooltip
            v-if="row.original.action_plan"
            :text="row.original.action_plan"
          >
            <span class="block max-w-xs truncate">{{ row.original.action_plan }}</span>
          </UTooltip>
          <span
            v-else
            class="text-muted"
          >—</span>
        </template>
      </UTable>
      <p
        v-if="!rows.length"
        class="py-6 text-center text-sm text-muted"
      >
        No hazards rated yet. Rate them on the Hazards tab.
      </p>
    </UCard>
  </div>
</template>
