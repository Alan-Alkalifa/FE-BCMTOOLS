<script setup lang="ts">
/** The register moved to Locations, with buildings and branches together. */
definePageMeta({
  permission: 'ra.access',
  redirect: (to) => ({ path: '/locations', query: { type: 'head_office', ...to.query } }),
})
</script>

<template>
  <div />
</template>
