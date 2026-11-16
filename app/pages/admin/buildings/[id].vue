<script setup lang="ts">
/** A building's page, under Administration › Master building (its only page: old
 *  /locations/{id} links open it). */
definePageMeta({ permission: ['location.master'] })
</script>

<template>
  <RaLocationPage />
</template>
