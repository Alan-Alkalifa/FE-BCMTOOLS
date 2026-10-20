<script setup lang="ts">
import { formatPercent } from '~/utils/format'
import { sccaCategory, type SccaCategory } from '~/utils/scca'

const props = defineProps<{
  summary: {
    c: number | null | undefined
    i: number | null | undefined
    a: number | null | undefined
    cia: number | null | undefined
    ciaLevel: string | null
    poloss: number | null | undefined
    polossLevel: string | null
    category: SccaCategory | null | undefined
  } | null
}>()

function percent(value: number | null | undefined) {
  return formatPercent(value, 0) ?? '—'
}

const rows = computed(() => [
  { label: 'Confidentiality', value: props.summary?.c },
  { label: 'Integrity', value: props.summary?.i },
  { label: 'Availability', value: props.summary?.a },
  { label: 'CIA', value: props.summary?.cia, level: props.summary?.ciaLevel, strong: true },
  { label: 'PO-LOSS', value: props.summary?.poloss, level: props.summary?.polossLevel, strong: true },
])
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold">
        Summary
      </h2>
    </template>
    <dl class="space-y-2 text-sm">
      <div
        v-for="row in rows"
        :key="row.label"
        class="flex items-center justify-between gap-3"
      >
        <dt :class="row.strong ? 'font-medium' : 'text-muted'">
          {{ row.label }}
        </dt>
        <dd
          class="tabular-nums"
          :class="row.strong ? 'font-semibold' : 'font-medium'"
        >
          {{ percent(row.value) }}
          <span
            v-if="row.level"
            class="font-normal text-muted"
          > · {{ row.level }}</span>
        </dd>
      </div>
      <div class="flex items-center justify-between gap-3 border-t border-default pt-2">
        <dt class="font-medium">
          Category
        </dt>
        <dd>
          <StatusBadge
            v-if="summary?.category"
            :scale="sccaCategory"
            :value="summary.category"
            size="sm"
          />
          <span
            v-else
            class="text-muted"
          >—</span>
        </dd>
      </div>
    </dl>
  </UCard>
</template>
