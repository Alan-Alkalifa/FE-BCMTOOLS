<script setup lang="ts">
/** The disaster guidebook moved to /disasters/guidebook: old links keep working. */
definePageMeta({
  permission: ['sites.access', 'ra.access', 'ra_branch.access'],
  redirect: (to) => ({ path: '/disasters/guidebook', query: to.query }),
})
</script>

<template>
  <div />
</template>
