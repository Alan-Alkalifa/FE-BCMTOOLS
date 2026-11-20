<script setup lang="ts">
/** Input building data is in Administration › Master building now. */
definePageMeta({
  permission: 'ra_branch.edit',
  redirect: (to) => ({ path: '/admin/buildings/new', query: { type: 'branch', ...to.query } }),
})
</script>

<template>
  <div />
</template>
