<script setup lang="ts">
/** Administration › Master building: the Buildings register (every head office building and
 *  branch), under its own menu and permission. A building opens here too (/admin/buildings/{id}). */
definePageMeta({ permission: ['sites.master'] })
</script>

<template>
  <RaLocationsPage />
</template>
