<script setup lang="ts">
/** Master building moved to Administration › Master data (/masterdata/masterbuilding/{id}). */
definePageMeta({
  redirect: (to) => ({ path: `/masterdata/masterbuilding/${(to.params as { id: string }).id}`, query: to.query }),
})
</script>

<template>
  <div />
</template>
