<script setup lang="ts">
/** The disaster guidebook moved to the Locations menu. */
definePageMeta({
  permission: ['ra.access', 'ra_branch.access'],
  redirect: (to) => ({ path: '/disasters/guidebook', query: to.query }),
})
</script>

<template>
  <div />
</template>
