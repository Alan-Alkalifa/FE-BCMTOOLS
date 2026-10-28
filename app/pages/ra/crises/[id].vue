<script setup lang="ts">
/** Incidents moved to the Locations menu. */
definePageMeta({
  permission: 'ra.access',
  redirect: (to) => ({ path: `/crises/${String(to.params.id)}`, query: to.query }),
})
</script>

<template>
  <div />
</template>
