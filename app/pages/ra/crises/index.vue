<script setup lang="ts">
/** Crises moved to the Locations menu. */
definePageMeta({
  permission: 'ra.access',
  redirect: (to) => ({ path: '/crises', query: to.query }),
})
</script>

<template>
  <div />
</template>
