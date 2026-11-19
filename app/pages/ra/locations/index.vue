<script setup lang="ts">
/** The register is in Administration › Master building now. */
definePageMeta({
  permission: 'ra.access',
  redirect: (to) => ({ path: '/masterdata/masterbuilding', query: { type: 'head_office', ...to.query } }),
})
</script>

<template>
  <div />
</template>
