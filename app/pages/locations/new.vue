<script setup lang="ts">
/** Input building data is in Administration › Master building now: old links open it there. */
definePageMeta({
  permission: 'sites.master',
  redirect: (to) => ({ path: '/masterdata/masterbuilding/new', query: to.query }),
})
</script>

<template>
  <div />
</template>
