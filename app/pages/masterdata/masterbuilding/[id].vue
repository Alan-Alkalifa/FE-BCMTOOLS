<script setup lang="ts">
/** A building's page, under Administration › Master data › Master building (its only page:
 *  old /locations/{id} and /admin/buildings/{id} links open it). */
definePageMeta({ permission: ['sites.master'] })
</script>

<template>
  <RaLocationPage />
</template>
