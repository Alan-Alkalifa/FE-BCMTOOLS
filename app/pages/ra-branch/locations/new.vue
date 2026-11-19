<script setup lang="ts">
/** Input building data is in Administration › Master building now. */
definePageMeta({
  permission: 'ra_branch.edit',
  redirect: (to) => ({ path: '/masterdata/masterbuilding/new', query: { type: 'branch', ...to.query } }),
})
</script>

<template>
  <div />
</template>
