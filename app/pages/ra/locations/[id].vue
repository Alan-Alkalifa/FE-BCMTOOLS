<script setup lang="ts">
/** A building's page is in Administration › Master building now. */
definePageMeta({
  permission: 'ra.access',
  redirect: (to) => ({ path: `/masterdata/masterbuilding/${String(to.params.id)}`, query: to.query }),
})
</script>

<template>
  <div />
</template>
