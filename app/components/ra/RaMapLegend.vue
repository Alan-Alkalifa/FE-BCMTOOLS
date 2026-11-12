<script setup lang="ts">
/**
 * The legend under a map: the symbols it draws (the same RaMapSymbol the pins use) and, with
 * `residual`, what the pin colours mean. Every map shows one (Location map, the disaster dialog
 * and the disaster page), listing only what that map can show.
 */
const props = withDefaults(defineProps<{
  items?: RaMapLegendItem[]
  /** Overrides a symbol's text, e.g. the disaster's own wording. */
  labels?: Partial<Record<RaMapLegendItem, string>>
  /** The colour row's heading; `false` hides the row. */
  residual?: string | false
}>(), {
  items: () => ['building', 'branch', 'waiting', 'rejected', 'inactive', 'crisis', 'crisis_pending', 'quake'],
  labels: () => ({}),
  residual: 'Colour: latest residual risk',
})

const SYMBOLS: Record<RaMapLegendItem, { name: RaMapSymbolName, class: string, label: string }> = {
  building: { name: 'building', class: 'text-muted', label: 'Head office building' },
  branch: { name: 'branch', class: 'text-muted', label: 'Branch' },
  waiting: { name: 'waiting', class: 'mr-1 text-muted', label: 'Waiting for approval (new, or to deactivate)' },
  rejected: { name: 'rejected', class: 'mr-1 text-muted', label: 'Rejected' },
  inactive: { name: 'inactive', class: 'mr-1 text-muted', label: 'Inactive' },
  crisis: { name: 'crisis', class: 'text-error', label: 'Disaster and its affected area' },
  crisis_pending: { name: 'crisis', class: 'text-warning', label: 'Disaster waiting for approval (dashed area)' },
  quake: { name: 'quake', class: 'text-warning', label: 'Earthquake (BMKG), red from M6.0; dotted: its alert radius' },
}

const shown = computed(() => props.items.map((key) => ({ key, ...SYMBOLS[key], label: props.labels[key] ?? SYMBOLS[key].label })))
/** Faded markers are explained wherever the map can show a place not in service. */
const showsFaded = computed(() => props.items.includes('inactive') || props.items.includes('rejected'))
</script>

<template>
  <div
    class="space-y-1 text-xs text-muted"
    role="group"
    aria-label="Map legend"
  >
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span
        v-for="item in shown"
        :key="item.key"
        class="flex items-center gap-1"
      ><RaMapSymbol
        :name="item.name"
        :class="item.class"
      /> {{ item.label }}</span>
    </div>
    <p v-if="showsFaded">
      Faded: not in service (inactive, new and waiting for approval, or rejected). No disaster affects it.
    </p>
    <div
      v-if="residual"
      class="flex flex-wrap items-center gap-x-4 gap-y-1"
    >
      <span>{{ residual }}</span>
      <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-error" />High</span>
      <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-warning" />Medium</span>
      <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-info" />Low</span>
      <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-muted ring-1 ring-default" />No RA yet</span>
    </div>
  </div>
</template>
