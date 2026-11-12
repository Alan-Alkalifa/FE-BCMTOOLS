<script setup lang="ts">
/** Disasters moved to /disasters: old links keep working. */
definePageMeta({
  permission: ['location.access', 'ra.access', 'ra_branch.access'],
  redirect: (to) => ({ path: '/disasters', query: to.query }),
})
</script>

<template>
  <div />
</template>
