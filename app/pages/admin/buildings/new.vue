<script setup lang="ts">
/** Input building data from Administration › Master building: saved, the building opens in
 *  Master building. */
definePageMeta({ permission: ['location.master'] })
</script>

<template>
  <RaNewLocationPage master />
</template>
