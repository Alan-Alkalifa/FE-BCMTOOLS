<script setup lang="ts">
/** A building's page is in Administration › Master building now: old links open it there. */
definePageMeta({
  permission: 'location.master',
  redirect: (to) => ({ path: `/masterdata/masterbuilding/${String(to.params.id)}`, query: to.query }),
})
</script>

<template>
  <div />
</template>
