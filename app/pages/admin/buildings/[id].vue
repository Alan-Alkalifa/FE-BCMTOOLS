<script setup lang="ts">
/** A building's page under Administration › Master building (the same page as Location ›
 *  Buildings › the building, with Master building's crumbs and links). */
definePageMeta({ permission: ['location.master'] })
</script>

<template>
  <RaLocationPage master />
</template>
