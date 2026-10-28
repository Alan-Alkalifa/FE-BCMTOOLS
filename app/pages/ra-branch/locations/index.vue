<script setup lang="ts">
/** The register moved to Locations, with buildings and branches together. */
definePageMeta({
  permission: 'ra_branch.access',
  redirect: (to) => ({ path: '/locations', query: { type: 'branch', ...to.query } }),
})
</script>

<template>
  <div />
</template>
