<script setup lang="ts">
/** Adding a location moved to Locations. */
definePageMeta({
  permission: 'ra_branch.edit',
  redirect: (to) => ({ path: '/locations/new', query: { type: 'branch', ...to.query } }),
})
</script>

<template>
  <div />
</template>
