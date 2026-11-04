<script setup lang="ts">
/** A location map symbol for a legend: the same markup the map draws, scaled to the text. */
defineProps<{ name: RaMapSymbolName }>()
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- static SVG constants from utils/ra-map-symbols.ts -->
  <span
    class="ra-map-symbol inline-flex size-4 shrink-0 drop-shadow-sm"
    data-testid="ra-map-symbol"
    :data-symbol="name"
    aria-hidden="true"
    v-html="RA_MAP_SYMBOLS[name]"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>

<style>
.ra-map-symbol svg {
  width: 100%;
  height: 100%;
}
</style>
