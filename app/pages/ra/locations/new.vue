<script setup lang="ts">
/** Adding a location moved to Locations. */
definePageMeta({
  permission: 'ra.edit',
  redirect: (to) => ({ path: '/locations/new', query: { type: 'head_office', ...to.query } }),
})
</script>

<template>
  <div />
</template>
