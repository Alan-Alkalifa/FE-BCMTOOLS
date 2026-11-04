<script setup lang="ts">
/** The location map moved to the Locations menu. */
definePageMeta({
  permission: ['ra.access', 'ra_branch.access'],
  redirect: (to) => ({ path: '/locations/map', query: to.query }),
})
</script>

<template>
  <div />
</template>
