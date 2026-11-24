<script setup lang="ts">
/**
 * The legend under a map, one row per kind of thing it draws: places, their status, events,
 * the pin colours (`residual`), WAQI's air quality (`aqi`) and GDELT's disaster news (`news`). The symbols are the map's own
 * (the same RaMapSymbol the pins use). Every map shows one (Location map, the disaster dialog
 * and the disaster page), listing only what that map can show.
 */
const props = withDefaults(defineProps<{
  items?: RaMapLegendItem[]
  /** Overrides a symbol's text, e.g. the disaster's own wording. */
  labels?: Partial<Record<RaMapLegendItem, string>>
  /** The colour row's heading; `false` hides the row. */
  residual?: string | false
  /** The map draws BMKG's weather warnings as areas. */
  weather?: boolean
  /** The map draws WAQI's air quality stations. */
  aqi?: boolean
  /** The map draws GDELT's disaster news places. */
  news?: boolean
}>(), {
  items: () => ['building', 'branch', 'waiting', 'rejected', 'inactive', 'crisis', 'crisis_pending', 'quake'],
  labels: () => ({}),
  residual: 'Latest residual risk',
  weather: false,
  aqi: false,
  news: false,
})

type Group = 'places' | 'status' | 'events'
const SYMBOLS: Record<RaMapLegendItem, { name: RaMapSymbolName, class: string, label: string, group: Group }> = {
  building: { name: 'building', class: 'text-muted', label: 'Head office building', group: 'places' },
  branch: { name: 'branch', class: 'text-muted', label: 'Branch', group: 'places' },
  waiting: { name: 'waiting', class: 'mr-1 text-muted', label: 'Waiting for approval (new, or to deactivate)', group: 'status' },
  rejected: { name: 'rejected', class: 'mr-1 text-muted', label: 'Rejected', group: 'status' },
  inactive: { name: 'inactive', class: 'mr-1 text-muted', label: 'Inactive', group: 'status' },
  crisis: { name: 'crisis', class: 'text-error', label: 'Disaster or incident and its affected area', group: 'events' },
  crisis_pending: { name: 'crisis', class: 'text-warning', label: 'Disaster or incident waiting for approval (dashed area)', group: 'events' },
  quake: { name: 'quake', class: 'text-warning', label: 'Earthquake (BMKG), red from M6.0, dotted ring for its alert radius', group: 'events' },
}
const GROUPS: { key: Group, label: string }[] = [
  { key: 'places', label: 'Places' },
  { key: 'status', label: 'Status' },
  { key: 'events', label: 'Events' },
]

const rows = computed(() => GROUPS
  .map((group) => ({
    ...group,
    items: props.items
      .filter((key) => SYMBOLS[key].group === group.key)
      .map((key) => ({ key, ...SYMBOLS[key], label: props.labels[key] ?? SYMBOLS[key].label })),
  }))
  .filter((group) => group.items.length || (group.key === 'events' && (props.weather || props.news))))
/** Faded markers are explained wherever the map can show a place not in service. */
const showsFaded = computed(() => props.items.includes('inactive') || props.items.includes('rejected'))
</script>

<template>
  <dl
    class="grid gap-x-4 gap-y-1.5 text-xs text-muted sm:grid-cols-[9rem_1fr]"
    role="group"
    aria-label="Map legend"
  >
    <template
      v-for="group in rows"
      :key="group.key"
    >
      <dt class="font-medium text-default">
        {{ group.label }}
      </dt>
      <dd class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span
          v-for="item in group.items"
          :key="item.key"
          class="flex items-center gap-1"
        ><RaMapSymbol
          :name="item.name"
          :class="item.class"
        /> {{ item.label }}</span>
        <span
          v-if="group.key === 'status' && showsFaded"
          class="flex items-center gap-1"
        ><RaMapSymbol
          name="building"
          class="text-muted opacity-40"
        /> Faded, not in service (inactive, new and waiting for approval, or rejected). No disaster or incident affects it.</span>
        <span
          v-if="group.key === 'events' && weather"
          class="flex items-center gap-1"
        ><span
          class="inline-block h-3 w-4 rounded-sm border border-dashed border-info bg-info/15"
          aria-hidden="true"
        /> Weather warning (BMKG) and its area</span>
        <span
          v-if="group.key === 'events' && news"
          class="flex items-center gap-1"
        ><span
          class="inline-flex h-3 w-4 items-center justify-center rounded-[3px] bg-[#7c3aed] text-[8px] font-semibold leading-none text-white"
          aria-hidden="true"
        >3</span> Disaster news (GDELT), the number of articles, dashed ring for the selected place's radius</span>
      </dd>
    </template>

    <template v-if="residual">
      <dt class="font-medium text-default">
        {{ residual }}
      </dt>
      <dd class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-error" />High</span>
        <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-warning" />Medium</span>
        <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-info" />Low</span>
        <span class="flex items-center gap-1"><span class="size-2.5 rounded-full bg-muted ring-1 ring-default" />No RA yet</span>
      </dd>
    </template>

    <template v-if="aqi">
      <dt class="font-medium text-default">
        Air quality, WAQI
      </dt>
      <dd class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span
          v-for="band in WAQI_BANDS"
          :key="band.code"
          class="flex items-center gap-1"
        ><span
          class="size-2.5 rounded-full"
          :style="{ backgroundColor: band.hex }"
          aria-hidden="true"
        />{{ band.label }} <span class="text-dimmed">{{ band.range }}</span></span>
        <span class="flex items-center gap-1"><span
          class="inline-block size-3 rounded-full border border-dashed border-(--ui-text-muted)"
          aria-hidden="true"
        /> Dashed ring for a station's area</span>
      </dd>
    </template>
  </dl>
</template>
