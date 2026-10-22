<script setup lang="ts">
/** The crisis guidebook moved to the Locations menu. */
definePageMeta({
  permission: 'ra.access',
  redirect: (to) => ({ path: '/crises/guidebook', query: to.query }),
})
</script>

<template>
  <div />
</template>
