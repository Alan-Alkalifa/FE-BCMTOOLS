<script setup lang="ts">
/** Disasters moved to the Locations menu. */
definePageMeta({
  permission: ['ra.access', 'ra_branch.access'],
  redirect: (to) => ({ path: '/disasters', query: to.query }),
})
</script>

<template>
  <div />
</template>
