<script setup lang="ts">
/** Administration › Master building: for now the Buildings register (every head office building
 *  and branch), under its own menu and permission. */
definePageMeta({ permission: ['location.master'] })
</script>

<template>
  <RaLocationsPage master />
</template>
