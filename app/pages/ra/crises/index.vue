<script setup lang="ts">
/** Incidents moved to the Locations menu. */
definePageMeta({
  permission: ['ra.access', 'ra_branch.access'],
  redirect: (to) => ({ path: '/crises', query: to.query }),
})
</script>

<template>
  <div />
</template>
