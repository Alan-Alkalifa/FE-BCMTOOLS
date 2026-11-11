<script setup lang="ts">
/** Disasters moved to /disasters: old links (emails, bookmarks) keep working. */
definePageMeta({
  permission: ['location.access', 'ra.access', 'ra_branch.access'],
  redirect: (to) => ({ path: `/disasters/${String(to.params.id)}`, query: to.query }),
})
</script>

<template>
  <div />
</template>
