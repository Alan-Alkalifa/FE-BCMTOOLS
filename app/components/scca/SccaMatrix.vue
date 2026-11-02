<script setup lang="ts">
import type { SccaFormula } from '~/composables/useScca'

const props = defineProps<{
  cells: SccaFormula['matrix']
  ciaLevel?: number | null
  polossLevel?: number | null
}>()

const ciaLevels = [1, 2, 3, 4, 5]
const polossLevels = [5, 4, 3, 2, 1]

const lookup = computed(() => {
  const map = new Map<string, SccaCategory>()
  for (const cell of props.cells) {
    map.set(`${cell.cia_level}-${cell.poloss_level}`, cell.category)
  }
  return map
})

function categoryAt(cia: number, poloss: number) {
  return lookup.value.get(`${cia}-${poloss}`)
}

function isCurrent(cia: number, poloss: number) {
  return props.ciaLevel === cia && props.polossLevel === poloss
}

/** The workbook's (and the PDF's) category colours: every cell is filled with its category. */
const FILL: Record<string, { background: string, color: string }> = {
  'Critical': { background: '#FF0000', color: '#FFFFFF' },
  'Very Important': { background: '#FFC000', color: '#000000' },
  'Important': { background: '#FFFF00', color: '#000000' },
  'Necessary': { background: '#D8E4BC', color: '#000000' },
  'Other': { background: '#00B050', color: '#000000' },
}

function cellStyle(cia: number, poloss: number) {
  const fill = FILL[categoryAt(cia, poloss) ?? ''] ?? { background: 'transparent', color: 'inherit' }
  return isCurrent(cia, poloss)
    ? { ...fill, boxShadow: 'inset 0 0 0 3px #C00000', fontWeight: 700 }
    : fill
}

function cellLabel(cia: number, poloss: number) {
  const category = categoryAt(cia, poloss)
  const name = category ? (sccaCategory[category]?.label ?? category) : '—'
  return isCurrent(cia, poloss) ? `Result: ${name}, CIA ${cia}, Potential loss ${poloss}` : undefined
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-xl border-collapse text-sm">
      <caption class="sr-only">
        Criticality matrix: CIA level across the top, Potential Loss level down the side.
      </caption>
      <thead>
        <tr>
          <th
            scope="col"
            class="border border-default bg-muted px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Potential loss \ CIA
          </th>
          <th
            v-for="cia in ciaLevels"
            :key="cia"
            scope="col"
            class="border border-default bg-muted px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted"
          >
            CIA {{ cia }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="poloss in polossLevels"
          :key="poloss"
        >
          <th
            scope="row"
            class="border border-default bg-muted px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted"
          >
            PoLoss {{ poloss }}
          </th>
          <td
            v-for="cia in ciaLevels"
            :key="`${cia}-${poloss}`"
            class="border border-white px-2 py-3 text-center text-xs"
            :style="cellStyle(cia, poloss)"
            :aria-label="cellLabel(cia, poloss)"
            :aria-current="isCurrent(cia, poloss) ? 'true' : undefined"
          >
            {{ categoryAt(cia, poloss) ? (sccaCategory[categoryAt(cia, poloss)!]?.label ?? categoryAt(cia, poloss)) : '—' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
