<script setup lang="ts">
/** Location profiles moved to /locations/{id}. */
definePageMeta({
  permission: 'ra_branch.access',
  redirect: (to) => ({ path: `/locations/${String(to.params.id)}`, query: to.query }),
})
</script>

<template>
  <div />
</template>
