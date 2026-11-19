<script setup lang="ts">
/** The register is in Administration › Master building now. */
definePageMeta({
  permission: 'ra_branch.access',
  redirect: (to) => ({ path: '/masterdata/masterbuilding', query: { type: 'branch', ...to.query } }),
})
</script>

<template>
  <div />
</template>
