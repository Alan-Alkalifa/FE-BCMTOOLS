<script setup lang="ts">
/** The building map moved to Sites (/sites/map). */
definePageMeta({
  permission: ['ra.access', 'ra_branch.access'],
  redirect: (to) => ({ path: '/sites/map', query: to.query }),
})
</script>

<template>
  <div />
</template>
