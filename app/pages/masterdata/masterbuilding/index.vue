<script setup lang="ts">
/** Administration › Master data › Master building: the Buildings register (every head office
 *  building and branch). A building opens here too (/masterdata/masterbuilding/{id}). It used to
 *  be /admin/buildings and /locations (those addresses still lead here). */
definePageMeta({ permission: ['location.master'] })
</script>

<template>
  <RaLocationsPage />
</template>
