<script setup lang="ts">
/** Administration › Master data › Master building: the Buildings register (every head office
 *  building and branch). A building opens here too (/masterdata/masterbuilding/{id}), not in
 *  Location › Buildings. It used to be /admin/buildings (that address still leads here). */
definePageMeta({ permission: ['location.master'] })
</script>

<template>
  <RaLocationsPage master />
</template>
