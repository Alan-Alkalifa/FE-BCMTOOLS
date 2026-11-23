<script setup lang="ts">
/** The Buildings register is in Administration › Master building now: old links open it there. */
definePageMeta({
  permission: 'sites.master',
  redirect: (to) => ({ path: '/masterdata/masterbuilding', query: to.query }),
})
</script>

<template>
  <div />
</template>
