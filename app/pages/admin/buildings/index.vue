<script setup lang="ts">
/** Administration › Master building: for now the Buildings register (every head office building
 *  and branch), under its own menu and permission. A building opens here too
 *  (/admin/buildings/{id}), not in Location › Buildings. */
definePageMeta({ permission: ['location.master'] })
</script>

<template>
  <RaLocationsPage master />
</template>
