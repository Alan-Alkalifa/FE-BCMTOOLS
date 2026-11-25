<script setup lang="ts">
/** The building map moved to /sites/map (25 Nov 2026): old links and bookmarks still open it. */
definePageMeta({
  permission: ['sites.access', 'ra.access', 'ra_branch.access'],
  redirect: (to) => ({ path: '/sites/map', query: to.query }),
})
</script>

<template>
  <div />
</template>
