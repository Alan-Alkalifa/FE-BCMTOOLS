<script setup lang="ts">
/** Input building data is in Administration › Master building now. */
definePageMeta({
  permission: 'ra.edit',
  redirect: (to) => ({ path: '/masterdata/masterbuilding/new', query: { type: 'head_office', ...to.query } }),
})
</script>

<template>
  <div />
</template>
