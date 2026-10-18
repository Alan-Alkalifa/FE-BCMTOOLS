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
            class="border border-default px-2 py-2 text-center"
            :class="isCurrent(cia, poloss) ? 'ring-2 ring-inset ring-primary bg-elevated' : ''"
          >
            <span class="inline-flex flex-col items-center gap-1">
              <StatusBadge
                :scale="sccaCategory"
                :value="categoryAt(cia, poloss)"
                size="sm"
              />
              <span
                v-if="isCurrent(cia, poloss)"
                class="text-[10px] font-medium text-primary"
              >This system</span>
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
