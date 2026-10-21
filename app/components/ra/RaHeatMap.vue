<script setup lang="ts">
import type { RaFormula, RaHeatMapCell } from '~/composables/useRa'

const props = defineProps<{
  title: string
  description: string
  cells: RaHeatMapCell[]
  formula: RaFormula
}>()
const emit = defineEmits<{ select: [code: string] }>()

const { hazards } = useRaFormulaIndex(() => props.formula)
const showTable = ref(false)

const probabilities = [5, 4, 3, 2, 1]
const impacts = [1, 2, 3, 4, 5]

function cell(probability: number, impact: number) {
  return props.cells.find((item) => item.probability === probability && item.impact === impact)
}

function label(scale: 'probability' | 'monetary', rating: number) {
  return props.formula.guides[scale].find((guide) => guide.rating === rating)?.label ?? ''
}

const TINT: Record<RaLevel, string> = {
  Low: 'bg-info/5',
  Medium: 'bg-warning/10',
  High: 'bg-error/10',
}

const placed = computed(() =>
  props.cells
    .flatMap((item) => item.hazards.map((code) => ({ code, ...item })))
    .sort((a, b) => (hazards.value.get(a.code)?.no ?? 0) - (hazards.value.get(b.code)?.no ?? 0)),
)

const summary = computed(() => {
  const count = (level: RaLevel) => placed.value.filter((item) => item.level === level).length
  if (!placed.value.length) return 'No rated hazards on this map yet.'
  return `${placed.value.length} hazards plotted: ${count('High')} high, ${count('Medium')} medium and ${count('Low')} low.`
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">
            {{ title }}
          </h2>
          <p class="text-sm text-muted">
            {{ description }}
          </p>
        </div>
        <USwitch
          v-model="showTable"
          label="View as table"
        />
      </div>
    </template>

    <p class="mb-4 text-sm text-default">
      {{ summary }}
    </p>

    <div
      v-if="!showTable"
      class="overflow-x-auto"
    >
      <table class="w-full min-w-3xl table-fixed border-collapse text-sm">
        <caption class="sr-only">
          {{ title }}: probability down the side (5 at the top), impact across (1 on the left).
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              class="w-28 border border-default bg-muted px-2 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase"
            >
              Probability \ impact
            </th>
            <th
              v-for="impact in impacts"
              :key="impact"
              scope="col"
              class="border border-default bg-muted px-2 py-2 text-center text-xs font-semibold tracking-wide text-muted uppercase"
            >
              {{ impact }}
              <span class="block font-normal normal-case">{{ label('monetary', impact) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="probability in probabilities"
            :key="probability"
          >
            <th
              scope="row"
              class="border border-default bg-muted px-2 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase"
            >
              {{ probability }}
              <span class="block font-normal normal-case">{{ label('probability', probability) }}</span>
            </th>
            <td
              v-for="impact in impacts"
              :key="impact"
              class="h-24 border border-default px-2 py-2 align-top"
              :class="cell(probability, impact) ? TINT[cell(probability, impact)!.level] : ''"
            >
              <template v-if="cell(probability, impact)">
                <StatusBadge
                  :scale="raRiskLevel"
                  :value="cell(probability, impact)!.level"
                  size="sm"
                />
                <ul class="mt-1 space-y-0.5">
                  <li
                    v-for="code in cell(probability, impact)!.hazards"
                    :key="code"
                  >
                    <button
                      type="button"
                      class="text-left text-xs text-highlighted hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                      @click="emit('select', code)"
                    >
                      {{ hazards.get(code)?.short_name ?? code }}
                    </button>
                  </li>
                </ul>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UTable
      v-else
      :data="placed"
      :columns="[
        { id: 'hazard', header: 'Hazard' },
        { accessorKey: 'probability', header: 'Probability', meta: { class: { th: 'text-right', td: 'text-right' } } },
        { accessorKey: 'impact', header: 'Impact', meta: { class: { th: 'text-right', td: 'text-right' } } },
        { accessorKey: 'level', header: 'Level' },
      ]"
    >
      <template #hazard-cell="{ row }">
        {{ hazards.get(row.original.code)?.no }}. {{ hazards.get(row.original.code)?.short_name }}
      </template>
      <template #level-cell="{ row }">
        <StatusBadge
          :scale="raRiskLevel"
          :value="row.original.level"
          size="sm"
        />
      </template>
    </UTable>
  </UCard>
</template>
