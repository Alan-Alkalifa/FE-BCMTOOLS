<script setup lang="ts">
/** A building's page is in Administration › Master building now. */
definePageMeta({
  permission: 'ra_branch.access',
  redirect: (to) => ({ path: `/admin/buildings/${String(to.params.id)}`, query: to.query }),
})
</script>

<template>
  <div />
</template>
